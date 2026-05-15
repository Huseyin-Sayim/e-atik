import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from './types';
import { Platform } from 'react-native';

import Constants from 'expo-constants';

const getBaseApiUrl = () => {
  if (Platform.OS === 'web') return 'http://localhost:2001/api';

  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(':').shift();

  if (!localhost) {
    console.warn('[DATABASE_SERVICE] Host IP bulunamadı, 10.0.2.2 (emülatör) deneniyor.');
    return 'http://10.0.2.2:2001/api'; 
  }
  
  const url = `http://${localhost}:2001/api`;
  console.log('[DATABASE_SERVICE] Dinamik API URL:', url);
  return url;
};

const BASE_API_URL = getBaseApiUrl();
const AUTH_API_URL = `${BASE_API_URL}/auth`;
const USER_API_URL = `${BASE_API_URL}/users`;

class DatabaseService {
  /**
   * Tüm kayıtlı kullanıcıları döner (Backend'den çeker).
   */
  static async getUsers(): Promise<User[]> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(USER_API_URL, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Kullanıcılar getirilemedi.');
      const json = await response.json();
      return json.data || [];
    } catch (error) {
      console.error('API okuma hatası:', error);
      return [];
    }
  }

  /**
   * Kullanıcının şifresini değiştirir.
   */
  static async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const token = await AsyncStorage.getItem('accessToken');
    const response = await fetch(`${AUTH_API_URL}/change-password`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ oldPassword, newPassword })
    });
    if (!response.ok) {
      const json = await response.json();
      throw new Error(json.message || 'Şifre değiştirilemedi.');
    }
  }

  /**
   * Kullanıcının telefon numarasını veya e-postasını günceller.
   */
  static async updateContactInfo(email: string, data: { phoneNumber?: string, email?: string }): Promise<void> {
    await this.updateUser(email, data);
  }

  /**
   * E-posta değişikliği için kod ister.
   */
  static async requestEmailChange(newEmail: string): Promise<void> {
    const token = await AsyncStorage.getItem('accessToken');
    const response = await fetch(`${AUTH_API_URL}/request-email-change`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ newEmail })
    });
    if (!response.ok) {
      const json = await response.json();
      throw new Error(json.message || 'Doğrulama kodu gönderilemedi.');
    }
  }

  /**
   * E-posta değişikliğini kod ile onaylar.
   */
  static async verifyEmailChange(newEmail: string, code: string): Promise<void> {
    const token = await AsyncStorage.getItem('accessToken');
    const response = await fetch(`${AUTH_API_URL}/verify-email-change`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ newEmail, code })
    });
    if (!response.ok) {
      const json = await response.json();
      throw new Error(json.message || 'Doğrulama başarısız.');
    }
  }

  /**
   * Aktif oturumdaki kullanıcının profil bilgilerini döner.
   */
  static async getCurrentUser(): Promise<User | null> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return null;

      const response = await fetch(`${USER_API_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) return null;
      const json = await response.json();
      return json.data || null;
    } catch (error) {
      console.error('API profile çekme hatası:', error);
      return null;
    }
  }

  /**
   * Yeni bir kullanıcı kaydeder (Backend /register).
   */
  static async addUser(user: any): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${AUTH_API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(user),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const json = await response.json();

      if (!response.ok) {
        const errorMsg = json.error ? `${json.message} (${json.error})` : (json.message || 'Kayıt sırasında hata oluştu.');
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      if (error.message === 'Failed to fetch' || error.message.includes('Network request failed')) {
        throw new Error('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol ediniz.');
      }
      throw error;
    }
  }

  /**
   * Giriş kontrolü (Backend /login).
   */
  static async loginUser(email: string, password: string): Promise<any> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 saniye sonra iptal et

      const response = await fetch(`${AUTH_API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || 'Giriş yapılamadı.');
      }

      // Token'ları AsyncStorage'a kaydet
      if (json.accessToken) {
        await AsyncStorage.setItem('accessToken', json.accessToken);
      }
      if (json.refreshToken) {
        await AsyncStorage.setItem('refreshToken', json.refreshToken);
      }

      // login.tsx tarafının eskisi gibi çalışabilmesi için dönen datayı uyarlıyoruz
      // Not: Arkadaşının sisteminde 'profileType' olmadığı için şimdilik null dönebilir.
      const userData = json.user || json.data || {};
      return userData;
    } catch (error: any) {
      if (error.message === 'Failed to fetch' || error.message.includes('Network request failed')) {
        throw new Error('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol ediniz.');
      }
      throw error;
    }
  }

  /**
   * (İleride eklenebilir)
   */
  static async updateUser(email: string, updates: any): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${USER_API_URL}/update-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          email,
          ...updates
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.message || 'Profil güncellenirken hata oluştu.');
      }
    } catch (error: any) {
      console.error('Kullanıcı güncellenirken hata:', error);
      if (error.message === 'Failed to fetch' || error.message.includes('Network request failed')) {
        throw new Error('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol ediniz.');
      }
      throw error;
    }
  }

  static async forgotPassword(email: string): Promise<void> {
    try {
      const response = await fetch(`${AUTH_API_URL}/reset/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.message || 'Kod gönderilirken bir hata oluştu.');
      }
    } catch (error: any) {
      throw error;
    }
  }

  static async verifyResetCode(email: string, code: string): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${AUTH_API_URL}/verify/mail`, { // Not: Yeni backend GET /verify/mail/:code bekliyor. Bu kısım ileride güncellenebilir.
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ email, code })
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.message || 'Kod doğrulanamadı.');
      }
    } catch (error: any) {
      throw error;
    }
  }

  static async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    try {
      const response = await fetch(`${AUTH_API_URL}/reset/password`, { // Not: Yeni backend token bekliyor olabilir.
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, code, newPassword })
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.message || 'Şifre güncellenirken hata oluştu.');
      }
    } catch (error: any) {
      throw error;
    }
  }

  static async clearDatabase(): Promise<void> {
    console.warn("Clear database API'de tanımlı değil.");
  }

  // ==========================================
  // ATIK KUTULARI (BINS) API İŞLEMLERİ
  // ==========================================

  static async getBins(): Promise<any[]> {
    try {
      // Sadece timestamp ile cache kırma (Özel headerlar CORS hatası veriyordu)
      const response = await fetch(`${BASE_API_URL}/bins?t=${new Date().getTime()}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Kutular getirilemedi.');
      return await response.json();
    } catch (error) {
      console.error('getBins hatası:', error);
      return [];
    }
  }

  static async addBin(binData: any): Promise<any> {
    try {
      const response = await fetch(`${BASE_API_URL}/bins/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(binData)
      });
      if (!response.ok) throw new Error('Kutu eklenemedi.');
      return await response.json();
    } catch (error) {
      console.error('addBin hatası:', error);
      throw error;
    }
  }

  static async updateBinItem(id: string, binData: any): Promise<any> {
    try {
      const response = await fetch(`${BASE_API_URL}/bins/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(binData)
      });
      if (!response.ok) throw new Error('Kutu güncellenemedi.');
      return await response.json();
    } catch (error) {
      console.error('updateBinItem hatası:', error);
      throw error;
    }
  }

  static async deleteBinItem(id: string): Promise<void> {
    try {
      const response = await fetch(`${BASE_API_URL}/bins/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Kutu silinemedi.');
    } catch (error) {
      console.error('deleteBinItem hatası:', error);
      throw error;
    }
  }
}

export default DatabaseService;
