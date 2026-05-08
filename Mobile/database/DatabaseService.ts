import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from './types';
import { Platform } from 'react-native';

const BASE_API_URL = Platform.OS === 'web' ? 'http://localhost:2001/api' : 'http://192.168.1.40:2001/api';
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
   * Yeni bir kullanıcı kaydeder (Backend /register).
   */
  static async addUser(user: any): Promise<void> {
    try {
      const response = await fetch(`${AUTH_API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(user)
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || 'Kayıt sırasında hata oluştu.');
      }
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Giriş kontrolü (Backend /login).
   */
  static async loginUser(email: string, password: string): Promise<any> {
    try {
      const response = await fetch(`${AUTH_API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

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
      throw error;
    }
  }

  /**
   * (İleride eklenebilir)
   */
  static async updateUser(email: string, updates: any): Promise<void> {
    try {
      if (updates.profileType) {
        const token = await AsyncStorage.getItem('accessToken');
        const response = await fetch(`${USER_API_URL}/update-profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({
            email,
            profileType: updates.profileType
          })
        });

        if (!response.ok) {
          const json = await response.json();
          throw new Error(json.message || 'Profil güncellenirken hata oluştu.');
        }
      }
    } catch (error: any) {
      console.error('Kullanıcı güncellenirken hata:', error);
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
}

export default DatabaseService;
