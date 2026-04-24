import { User } from './types';

const API_URL = 'http://192.168.1.40:2001/api/users';

class DatabaseService {
  /**
   * Tüm kayıtlı kullanıcıları döner (Backend'den çeker).
   */
  static async getUsers(): Promise<User[]> {
    try {
      const response = await fetch(API_URL);
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
      const response = await fetch(`${API_URL}/register`, {
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
      const response = await fetch(`${API_URL}/login`, {
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

      return json.data;
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
        const response = await fetch(`${API_URL}/update-profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
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
      const response = await fetch(`${API_URL}/forgot-password`, {
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
      const response = await fetch(`${API_URL}/verify-reset-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
      const response = await fetch(`${API_URL}/reset-password`, {
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
