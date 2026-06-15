import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from './types';
import { Platform } from 'react-native';
import partnerStoresData from '../assets/partnerStores.json';

import Constants from 'expo-constants';

// true: Canlı sunucu (production), false: Yerel geliştirme ortamı (local)
const IS_PRODUCTION = true; 

const getBaseApiUrl = () => {
  if (IS_PRODUCTION) {
    return 'http://31.57.156.61:2001/api';
  }

  if (Platform.OS === 'web') {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${hostname}:2001/api`;
  }

  // Expo SDK 50+ ve farklı çalışma modları için daha geniş kapsamlı IP tespiti
  const debuggerHost = Constants.expoConfig?.hostUri || 
                       Constants.manifest2?.extra?.expoGo?.debuggerHost || 
                       Constants.manifest?.debuggerHost;
                       
  const localhost = debuggerHost?.split(':').shift();

  // iOS Simülatörü ise ve cihaz değilse localhost kullanabilir
  if (Platform.OS === 'ios' && !Constants.isDevice) return 'http://localhost:2001/api';

  if (!localhost) {
    console.warn('[DATABASE_SERVICE] Host IP bulunamadı, 10.0.2.2 (emülatör) deneniyor.');
    return 'http://10.0.2.2:2001/api';
  }

  const url = `http://${localhost}:2001/api`;
  console.log('🌐 [DATABASE_SERVICE] API Hedef Adresi:', url);
  console.log('📱 [DATABASE_SERVICE] Platform:', Platform.OS);
  return url;
};

const BASE_API_URL = getBaseApiUrl();
const AUTH_API_URL = `${BASE_API_URL}/auth`;
const USER_API_URL = `${BASE_API_URL}/users`;

const DatabaseService = {
  getWsUrl(): string {
    if (IS_PRODUCTION) {
      return 'ws://31.57.156.61:2001';
    }

    if (Platform.OS === 'web') {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      return `ws://${hostname}:2001`;
    }
    const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
    const localhost = debuggerHost?.split(':').shift();
    if (!localhost) return 'ws://10.0.2.2:2001';
    return `ws://${localhost}:2001`;
  },

  getSocketUrl(): string {
    if (IS_PRODUCTION) {
      return 'http://31.57.156.61:2001';
    }

    if (Platform.OS === 'web') {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      return `http://${hostname}:2001`;
    }
    const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
    const localhost = debuggerHost?.split(':').shift();
    if (!localhost) return 'http://10.0.2.2:2001';
    return `http://${localhost}:2001`;
  },

  handleError(error: any): never {
    // Failed to fetch durumunda detaylı bilgi bas
    if (error.message === 'Network request failed') {
      console.warn('❌ [DATABASE_SERVICE_ERROR]: Sunucuya fiziksel erişim sağlanamadı!');
      console.warn(`📍 Hedef URL: ${BASE_API_URL}`);
      throw new Error('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.');
    } else {
      console.warn('[DATABASE_SERVICE_ERROR]:', error);
    }
    throw error;
  },

  async safeParseJson(response: Response) {
    if (response.status === 401 || response.status === 403) {
      // Gerçek backend hata mesajını okumaya çalış
      let backendMsg = '';
      try {
        const errBody = await response.clone().json();
        backendMsg = errBody?.message || JSON.stringify(errBody);
      } catch {
        backendMsg = await response.clone().text().catch(() => '');
      }
      console.error(`🔐 [AUTH HATA] HTTP ${response.status} — Backend mesajı: "${backendMsg}" — URL: ${response.url}`);
      if (response.status === 401) {
        throw new Error('Oturumunuzun süresi doldu veya token geçersiz. Lütfen tekrar giriş yapın. (401)');
      } else {
        throw new Error('Bu işlem için yetkiniz yok. Hesap rolünüzü kontrol edin. (403)');
      }
    }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }
    const text = await response.text();
    throw new Error(`Sunucu hatası (${response.status}): JSON bekleniyordu ama farklı bir yanıt alındı. Yanıt özeti: ${text.substring(0, 100)}...`);
  },

  async getUsers(): Promise<User[]> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${USER_API_URL}?t=${new Date().getTime()}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.message || 'Kullanıcılar getirilemedi.');
      return json.data || [];
    } catch (error) {
      console.error('API okuma hatası:', error);
      return [];
    }
  },

  async updateUser(arg1: any, arg2?: any): Promise<any> {
    try {
      const userData = arg2 !== undefined ? arg2 : arg1;
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${USER_API_URL}/update-profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.message || 'Profil güncellenemedi.');
      return json.data || json;
    } catch (error) {
      this.handleError(error);
    }
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${AUTH_API_URL}/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      if (!response.ok) {
        const json = await this.safeParseJson(response);
        throw new Error(json.message || 'Şifre değiştirilemedi.');
      }
    } catch (error) {
      this.handleError(error);
    }
  },

  async requestEmailChange(newEmail: string): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${AUTH_API_URL}/request-email-change`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ newEmail })
      });
      if (!response.ok) {
        const json = await this.safeParseJson(response);
        throw new Error(json.message || 'Doğrulama kodu gönderilemedi.');
      }
    } catch (error) {
      this.handleError(error);
    }
  },

  async verifyEmailChange(newEmail: string, code: string): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${AUTH_API_URL}/verify-email-change`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ newEmail, code })
      });
      if (!response.ok) {
        const json = await this.safeParseJson(response);
        throw new Error(json.message || 'Doğrulama başarısız.');
      }
    } catch (error) {
      this.handleError(error);
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return null;

      const response = await fetch(`${USER_API_URL}/me?t=${new Date().getTime()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      if (!response.ok) return null;
      const json = await this.safeParseJson(response);
      return json.data || null;
    } catch (error) {
      console.error('API profile çekme hatası:', error);
      return null;
    }
  },

  async scanQrCode(code: string, coins: number, description?: string, scanType?: 'qr' | 'barcode'): Promise<any> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) throw new Error('Oturum bulunamadı.');

      const response = await fetch(`${USER_API_URL}/scan-qr`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ code, coins, description, scanType })
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.message || 'QR kod işlenirken hata oluştu.');
      return json;
    } catch (error) {
      this.handleError(error);
    }
  },

  async getTransactions(): Promise<any[]> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return [];
      const response = await fetch(`${USER_API_URL}/transactions?t=${new Date().getTime()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.message || 'İşlem geçmişi getirilemedi.');
      return json.data || [];
    } catch (error) {
      console.log('getTransactions hatası:', error);
      return [];
    }
  },

  async addUser(user: any): Promise<void> {
    try {
      const response = await fetch(`${AUTH_API_URL}/register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(user)
      });
      if (!response.ok) {
        const json = await this.safeParseJson(response);
        if (json.error) {
          console.warn('❌ [DATABASE_SERVICE_ERROR] Backend Detaylı Hata:', json.error);
        }
        throw new Error(json.message || 'Kayıt sırasında hata oluştu.');
      }
    } catch (error) {
      this.handleError(error);
    }
  },

  async loginUser(email: string, password: string): Promise<any> {
    try {
      const response = await fetch(`${AUTH_API_URL}/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) {
        if (json.error) {
          console.warn('❌ [DATABASE_SERVICE_ERROR] Backend Detaylı Hata:', json.error);
        }
        throw new Error(json.message || 'E-posta veya şifre hatalı.');
      }

      if (json.accessToken) await AsyncStorage.setItem('accessToken', json.accessToken);
      if (json.refreshToken) await AsyncStorage.setItem('refreshToken', json.refreshToken);

      return json.user || json.data || {};
    } catch (error) {
      this.handleError(error);
    }
  },

  async forgotPassword(email: string): Promise<void> {
    try {
      const response = await fetch(`${AUTH_API_URL}/reset/password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      if (!response.ok) {
        const json = await this.safeParseJson(response);
        throw new Error(json.message || 'Sıfırlama linki gönderilemedi.');
      }
    } catch (error: any) {
      this.handleError(error);
    }
  },

  async verifyResetCode(code: string): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${AUTH_API_URL}/verify/mail/${code}`, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        const json = await this.safeParseJson(response);
        throw new Error(json.message || 'Kod doğrulanamadı.');
      }
    } catch (error: any) {
      this.handleError(error);
    }
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const response = await fetch(`${AUTH_API_URL}/reset/password/${token}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ password: newPassword })
      });
      if (!response.ok) {
        const json = await this.safeParseJson(response);
        throw new Error(json.message || 'Şifre güncellenirken hata oluştu.');
      }
    } catch (error: any) {
      this.handleError(error);
    }
  },

  async getWasteTypes(): Promise<any[]> {
    try {
      const response = await fetch(`${BASE_API_URL}/waste-types?t=${new Date().getTime()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.message || 'Atık türleri getirilemedi.');
      return Array.isArray(json.data) ? json.data : [];
    } catch (error: any) {
      console.error('getWasteTypes hatası:', error);
      throw error;
    }
  },

  async createWasteRequest(payload: {
    wasteTypeId: string;
    addressLine: string;
    latitude: number;
    longitude: number;
    city?: string | null;
    district?: string | null;
    note?: string | null;
  }): Promise<any> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${BASE_API_URL}/waste-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.message || json.error || 'Talep oluşturulamadı.');
      return json.data || json;
    } catch (error: any) {
      this.handleError(error);
    }
  },

  async getMyWasteRequests(): Promise<any[]> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${BASE_API_URL}/waste-requests/mine?t=${new Date().getTime()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          'Accept': 'application/json',
        },
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.message || 'Talepler getirilemedi.');
      return Array.isArray(json) ? json : (json.data || []);
    } catch (error) {
      console.error('getMyWasteRequests hatası:', error);
      return [];
    }
  },

  async getWasteRequests(): Promise<any[]> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${BASE_API_URL}/waste-requests?t=${new Date().getTime()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          'Accept': 'application/json'
        }
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.message || 'Talepler getirilemedi.');
      return Array.isArray(json) ? json : (json.data || []);
    } catch (error) {
      console.error('getWasteRequests hatası:', error);
      return [];
    }
  },

  async updateWasteRequestStatus(id: string, status: string, earnedCoins?: number, weight?: number): Promise<any> {
    try {
      const token = await AsyncStorage.getItem('accessToken');

      // COLLECTED durumu için /collect endpoint'i kullan (kurumsal + personel erişebilir)
      if (status === 'COLLECTED') {
        const response = await fetch(`${BASE_API_URL}/waste-requests/${id}/collect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ weight: weight || null })
        });
        const json = await this.safeParseJson(response);
        if (!response.ok) throw new Error(json.message || 'Talep tamamlanamadı.');
        return json.data || json;
      }

      // Diğer durum güncellemeleri (ON_ROUTE vb.) için PATCH /:id kullan
      const response = await fetch(`${BASE_API_URL}/waste-requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.message || 'Durum güncellenemedi.');
      return json.data || json;
    } catch (error) {
      this.handleError(error);
    }
  },

  async getBins(): Promise<any[]> {
    try {
      const response = await fetch(`${BASE_API_URL}/bins?t=${new Date().getTime()}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.message || 'Kutular getirilemedi.');
      return json;
    } catch (error) {
      console.error('getBins hatası:', error);
      throw error; // Hata yutulmaz; çağıran katman mevcut marker'ları korumaya devam eder
    }
  },

  async addBin(binData: any): Promise<any> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      console.log(`🪣 [ADD_BIN] Token var mı: ${token ? 'EVET' : 'HAYIR — AsyncStorage boş!'}`);
      if (token) {
        console.log(`🪣 [ADD_BIN] Token ilk 30 karakter: ${token.substring(0, 30)}...`);
      }
      console.log(`🪣 [ADD_BIN] Gönderilen veri: ${JSON.stringify(binData)}`);
      const response = await fetch(`${BASE_API_URL}/bins/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(binData)
      });
      console.log(`🪣 [ADD_BIN] Backend yanıt kodu: HTTP ${response.status}`);
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.message || 'Kutu eklenemedi.');
      return json;
    } catch (error) {
      throw error;
    }
  },

  async updateBinItem(id: string, binData: any): Promise<any> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${BASE_API_URL}/bins/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(binData)
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.message || 'Kutu güncellenemedi.');
      return json;
    } catch (error) {
      throw error;
    }
  },

  async updateBinFullness(id: string, predictedFullness: number): Promise<any> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${BASE_API_URL}/bins/${id}/fullness`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ predictedFullness })
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.message || 'Kutu doluluk oranı güncellenemedi.');
      return json;
    } catch (error) {
      throw error;
    }
  },

  async deleteBinItem(id: string): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await fetch(`${BASE_API_URL}/bins/${id}`, {
        method: 'DELETE',
        headers: { 
          'Accept': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      if (!response.ok) {
        const json = await this.safeParseJson(response);
        throw new Error(json.message || 'Kutu silinemedi.');
      }
    } catch (error) {
      throw error;
    }
  },

  async getPartnerStores(): Promise<any[]> {
    try {
      const response = await fetch(`${BASE_API_URL}/partner-stores?t=${new Date().getTime()}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.error || 'Mağazalar getirilemedi.');
      return json || [];
    } catch (error) {
      console.error('getPartnerStores hatası, yerel yedeğe dönülüyor:', error);
      return partnerStoresData || [];
    }
  },

  async addPartnerStore(storeData: any): Promise<any> {
    try {
      const response = await fetch(`${BASE_API_URL}/partner-stores/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(storeData)
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.error || 'Mağaza eklenemedi.');
      return json;
    } catch (error) {
      console.error('addPartnerStore hatası:', error);
      throw error;
    }
  },

  async deletePartnerStore(id: string): Promise<void> {
    try {
      const response = await fetch(`${BASE_API_URL}/partner-stores/${id}`, {
        method: 'DELETE',
        headers: { 
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        const json = await this.safeParseJson(response);
        throw new Error(json.error || 'Mağaza silinemedi.');
      }
    } catch (error) {
      console.error('deletePartnerStore hatası:', error);
      throw error;
    }
  },

  async getWasteItems(): Promise<any[]> {
    try {
      const response = await fetch(`${BASE_API_URL}/waste-items?t=${new Date().getTime()}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Market öğeleri getirilemedi.');
      return await response.json();
    } catch (error) {
      return [];
    }
  },

  async createWasteItem(itemData: any): Promise<any> {
    try {
      const response = await fetch(`${BASE_API_URL}/waste-items`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(itemData)
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.error || 'Atık öğesi eklenemedi.');
      return json;
    } catch (error) {
      throw error;
    }
  },

  async updateWasteItem(id: string, itemData: any): Promise<any> {
    try {
      const response = await fetch(`${BASE_API_URL}/waste-items/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(itemData)
      });
      const json = await this.safeParseJson(response);
      if (!response.ok) throw new Error(json.error || 'Atık öğesi güncellenemedi.');
      return json;
    } catch (error) {
      throw error;
    }
  },

  async deleteWasteItem(id: string): Promise<void> {
    try {
      const response = await fetch(`${BASE_API_URL}/waste-items/${id}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error('Atık öğesi silinemedi.');
    } catch (error) {
      throw error;
    }
  },

  // Pub-Sub Mechanism for Theme, Profile and Bins
  currentProfilePhoto: null as string | null,
  profileListeners: [] as ((photo: string | null) => void)[],
  subscribeToProfilePhoto(listener: (photo: string | null) => void) {
    this.profileListeners.push(listener);
    if (this.currentProfilePhoto !== null) listener(this.currentProfilePhoto);
    return () => { this.profileListeners = this.profileListeners.filter(l => l !== listener); };
  },
  notifyProfilePhotoChanged(photo: string | null) {
    this.currentProfilePhoto = photo;
    this.profileListeners.forEach(l => l(photo));
  },

  currentTheme: 'light' as string,
  themeListeners: [] as ((theme: string) => void)[],
  subscribeToTheme(listener: (theme: string) => void) {
    this.themeListeners.push(listener);
    listener(this.currentTheme);
    return () => { this.themeListeners = this.themeListeners.filter(l => l !== listener); };
  },
  notifyThemeChanged(theme: string) {
    this.currentTheme = theme;
    this.themeListeners.forEach(l => l(theme));
  },

  binListeners: [] as (() => void)[],
  subscribeToBins(listener: () => void) {
    this.binListeners.push(listener);
    return () => { this.binListeners = this.binListeners.filter(l => l !== listener); };
  },
  notifyBinsChanged() {
    this.binListeners.forEach(l => l());
  }
};

export default DatabaseService;
