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
  private static handleError(error: any): never {
    console.error('[DATABASE_SERVICE_ERROR]:', error);
    if (error.name === 'AbortError' || error.message === 'Aborted') {
      throw new Error('Sunucuya bağlanırken zaman aşımı oluştu. Lütfen sunucunun açık olduğundan emin olun.');
    }
    if (error.message === 'Failed to fetch' || error.message.includes('Network request failed')) {
      throw new Error('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol ediniz.');
    }
    throw error;
  }

  /**
   * Tüm kayıtlı kullanıcıları döner (Backend'den çeker).
   */
  static async getUsers(): Promise<User[]> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${USER_API_URL}?t=${new Date().getTime()}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Kullanıcılar getirilemedi.');
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return json.data || [];
      } catch (parseError) {
        console.error('[DATABASE_SERVICE] getUsers JSON parse hatası! Ham yanıt:', text.substring(0, 500));
        throw parseError;
      }
    } catch (error) {
      console.error('API okuma hatası:', error);
      return [];
    }
  }

  /**
   * Kullanıcının şifresini değiştirir.
   */
  static async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    try {
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
    } catch (error) {
      this.handleError(error);
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
    try {
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
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * E-posta değişikliğini kod ile onaylar.
   */
  static async verifyEmailChange(newEmail: string, code: string): Promise<void> {
    try {
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
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Aktif oturumdaki kullanıcının profil bilgilerini döner.
   */
  static async getCurrentUser(): Promise<User | null> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return null;

      const response = await fetch(`${USER_API_URL}/me?t=${new Date().getTime()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) return null;
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return json.data || null;
      } catch (parseError) {
        console.error('[DATABASE_SERVICE] getCurrentUser JSON parse hatası! Ham yanıt:', text.substring(0, 500));
        throw parseError;
      }
    } catch (error) {
      console.error('API profile çekme hatası:', error);
      return null;
    }
  }

  /**
   * QR Kodu veya Barkodu backend'e gönderir ve coin ekler.
   */
  static async scanQrCode(code: string, coins: number, description?: string, scanType?: 'qr' | 'barcode'): Promise<any> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) throw new Error('Oturum bulunamadı.');

      const response = await fetch(`${USER_API_URL}/scan-qr`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code, coins, description, scanType })
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message || 'QR kod veya barkod işlenirken bir hata oluştu.');
      }
      return json;
    } catch (error) {
      this.handleError(error);
    }
  }
  /**
   * Kullanıcının işlem geçmişini backend'den çeker.
   */
  static async getTransactions(): Promise<any[]> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return [];

      const response = await fetch(`${USER_API_URL}/transactions?t=${new Date().getTime()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('İşlem geçmişi getirilemedi.');
      const json = await response.json();
      return json.data || [];
    } catch (error) {
      console.log('getTransactions hatası (Backend offline olabilir):', error);
      return [];
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

      // JSON Korumalı Ayrıştırma Kalkanı
      let json: any = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          json = await response.json();
        } catch (e) {
          throw new Error('İşlem sırasında sunucudan geçersiz bir yanıt alındı. Lütfen daha sonra tekrar deneyiniz.');
        }
      } else {
        throw new Error('Sunucu şu anda hizmet veremiyor. Lütfen daha sonra tekrar deneyiniz.');
      }

      if (!response.ok) {
        const errorMsg = json.message || 'Kayıt sırasında bir hata oluştu. Lütfen bilgilerinizi kontrol edip tekrar deneyiniz.';
        throw new Error(errorMsg);
      }
    } catch (error) {
      this.handleError(error);
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

      // JSON Korumalı Ayrıştırma Kalkanı
      let json: any = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          json = await response.json();
        } catch (e) {
          throw new Error('Giriş yapılırken sunucudan geçersiz bir yanıt alındı. Lütfen daha sonra tekrar deneyiniz.');
        }
      } else {
        throw new Error('Sunucumuz şu anda hizmet veremiyor. Lütfen daha sonra tekrar deneyiniz.');
      }

      if (!response.ok) {
        throw new Error(json.message || 'E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol ediniz.');
      }

      // Token'ları AsyncStorage'a kaydet
      if (json.accessToken) {
        await AsyncStorage.setItem('accessToken', json.accessToken);
      }
      if (json.refreshToken) {
        await AsyncStorage.setItem('refreshToken', json.refreshToken);
      }

      // login.tsx tarafının eskisi gibi çalışabilmesi için dönen datayı uyarlıyoruz
      const userData = json.user || json.data || {};
      return userData;
    } catch (error) {
      this.handleError(error);
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
    } catch (error) {
      this.handleError(error);
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
      this.handleError(error);
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
      this.handleError(error);
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
      this.handleError(error);
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

  // Profil fotoğrafı değişimlerini tüm ekranlara anlık yansıtmak için Pub-Sub (Yayıncı-Abone) mekanizması
  static currentProfilePhoto: string | null = null;
  private static profileListeners: ((photo: string | null) => void)[] = [];

  static subscribeToProfilePhoto(listener: (photo: string | null) => void) {
    this.profileListeners.push(listener);
    // Bileşen mount edildiği saniye, hafızadaki en son resmi anında yolla (gecikmesiz yükleme)
    if (this.currentProfilePhoto !== undefined) {
      listener(this.currentProfilePhoto);
    }
    return () => {
      this.profileListeners = this.profileListeners.filter(l => l !== listener);
    };
  }

  static notifyProfilePhotoChanged(photo: string | null) {
    this.currentProfilePhoto = photo; // Resmi anlık olarak global hafızaya (RAM) kaydet
    this.profileListeners.forEach(listener => {
      try {
        listener(photo);
      } catch (e) {
        console.error('Profil fotoğrafı dinleyicisi tetiklenirken hata:', e);
      }
    });
  }
}

export default DatabaseService;
