import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  Platform, 
  StatusBar, 
  ScrollView,
  Image,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DatabaseService from '../../database/DatabaseService';

const DEFAULT_AVATAR = require('../../assets/images/default-avatar.png');

export default function KurumsalSettingsScreen() {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userSurname, setUserSurname] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userId = await AsyncStorage.getItem('currentUserId');
      const email = await AsyncStorage.getItem('currentUserEmail');
      const sessionStr = await AsyncStorage.getItem('userSession');
      
      if (userId) {
        // İsim Soyisim Çek
        const savedName = await AsyncStorage.getItem(`userName_${userId}`);
        const savedSurname = await AsyncStorage.getItem(`userSurname_${userId}`);
        
        if (savedName) setUserName(savedName);
        if (savedSurname) setUserSurname(savedSurname);

        // Eğer local storage'da yoksa session'dan bak
        if (!savedName && sessionStr) {
          const session = JSON.parse(sessionStr);
          setUserName(session.name || '');
          setUserSurname(session.surname || '');
        }

        // Adres Çek
        const savedCity = await AsyncStorage.getItem(`userCity_${userId}`);
        const savedDistrict = await AsyncStorage.getItem(`userDistrict_${userId}`);
        if (savedCity && savedDistrict) {
          setAddress(`${savedCity} / ${savedDistrict}`);
        }

        // Profil Fotoğrafı
        const savedPhoto = await AsyncStorage.getItem(`profileImage_${userId}`);
        if (savedPhoto) setProfileImage(savedPhoto);
      }

      if (email) {
        setUserEmail(email.trim().toLowerCase());
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
      base64: true,
    });

    if (!result.canceled) {
      const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setProfileImage(base64Data);
      
      const userId = await AsyncStorage.getItem('currentUserId');
      const email = await AsyncStorage.getItem('currentUserEmail');
      
      if (userId) {
        await AsyncStorage.setItem(`profileImage_${userId}`, base64Data);
        
        try {
          if (email) {
            await DatabaseService.updateUser(email.trim().toLowerCase(), { profileImage: base64Data });
          }
        } catch (err) {
          console.warn('[PROFIL] Backend kayıt hatası:', err);
        }
      }
    }
  };

  const deleteImage = async () => {
    if (!profileImage) return;
    setProfileImage(null);
    try {
      const userId = await AsyncStorage.getItem('currentUserId');
      const email = await AsyncStorage.getItem('currentUserEmail');
      if (userId) {
        await AsyncStorage.removeItem(`profileImage_${userId}`);
        if (email) {
          await DatabaseService.updateUser(email.trim().toLowerCase(), { profileImage: null });
        }
      }
    } catch (err) {
      console.warn('[PROFIL] Silme hatası:', err);
    }
  };
  
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userSession');
      await AsyncStorage.removeItem('currentUserEmail');
      router.replace('/login');
    } catch (error) {
      console.error('Çıkış hatası:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* PROFIL KARTI (PREMIUM) */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.imageWrapper}>
              <Image 
                source={profileImage ? { uri: profileImage } : DEFAULT_AVATAR} 
                style={styles.profileImage} 
              />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userNameText}>
                {userName ? `${userName} ${userSurname}` : 'Kurumsal Kullanıcı'}
              </Text>
              <Text style={styles.userEmailText}>{userEmail}</Text>
            </View>
          </View>

          <View style={styles.profileActions}>
            <TouchableOpacity style={styles.uploadActionBtn} onPress={pickImage}>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <Text style={styles.uploadActionBtnText}>Fotoğraf Yükle</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.deleteActionBtn, !profileImage && styles.disabledBtn]} 
              onPress={deleteImage}
              disabled={!profileImage}
            >
              <Ionicons name="trash-outline" size={18} color={profileImage ? "#ef4444" : "#cbd5e1"} />
              <Text style={[styles.deleteActionBtnText, !profileImage && { color: '#cbd5e1' }]}>Sil</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AYARLAR MENÜSÜ */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Hesap Ayarları</Text>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/kurumsal/edit-corp-info')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
              <Ionicons name="business" size={20} color="#3b82f6" />
            </View>
            <Text style={styles.menuItemText}>Kurumsal Bilgiler</Text>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/kurumsal/edit-corp-address')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#f0fdf4' }]}>
              <Ionicons name="location" size={20} color="#16a34a" />
            </View>
            <Text style={styles.menuItemText}>Adres Bilgileri</Text>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/kurumsal/edit-corp-contact')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
              <Ionicons name="call" size={20} color="#ea580c" />
            </View>
            <Text style={styles.menuItemText}>İletişim Bilgileri</Text>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/kurumsal/edit-corp-email')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#f5f3ff' }]}>
              <Ionicons name="mail" size={20} color="#8b5cf6" />
            </View>
            <Text style={styles.menuItemText}>E-posta İşlemleri</Text>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/kurumsal/change-corp-password')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#fef2f2' }]}>
              <Ionicons name="lock-closed" size={20} color="#ef4444" />
            </View>
            <Text style={styles.menuItemText}>Şifre İşlemleri</Text>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutBtnText}>Güvenli Çıkış Yap</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Versiyon 1.0.4</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 25,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  imageWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 15, // Kurumsal için daha keskin/premium box
    backgroundColor: '#f1f5f9',
  },
  editBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#2e7d32',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  userEmailText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  profileActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 15,
    gap: 12,
  },
  uploadActionBtn: {
    flex: 1, // Eşit uzunluk için 1 yapıldı
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2e7d32',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  uploadActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  deleteActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fee2e2',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  deleteActionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  disabledBtn: {
    backgroundColor: '#f8fafc',
    borderColor: '#f1f5f9',
    opacity: 0.6,
  },
  menuSection: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 25,
    paddingVertical: 16,
    borderRadius: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#fee2e2',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '700',
  },
  versionText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 20,
  }
});
