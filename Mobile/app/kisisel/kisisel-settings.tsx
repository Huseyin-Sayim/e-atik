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

export default function KisiselSettingsScreen() {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [address, setAddress] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userId = await AsyncStorage.getItem('currentUserId');
      const email = await AsyncStorage.getItem('currentUserEmail');
      const sessionStr = await AsyncStorage.getItem('userSession');
      
      if (userId) {
        // Adres Bilgisi
        const savedCity = await AsyncStorage.getItem(`userCity_${userId}`);
        const savedDistrict = await AsyncStorage.getItem(`userDistrict_${userId}`);
        if (savedCity && savedDistrict) {
          setAddress(`${savedCity} / ${savedDistrict}`);
        } else if (savedCity || savedDistrict) {
          setAddress(savedCity || savedDistrict || '');
        }

        // İsim Bilgisi (Önce AsyncStorage, sonra Session)
        const savedName = await AsyncStorage.getItem(`userName_${userId}`);
        const savedSurname = await AsyncStorage.getItem(`userSurname_${userId}`);
        if (savedName) {
          setUserName(savedName + (savedSurname ? ' ' + savedSurname : ''));
        } else if (sessionStr) {
          const session = JSON.parse(sessionStr);
          setUserName((session.name || '') + (session.surname ? ' ' + session.surname : ''));
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
      console.warn('[PROFIL] Silme işlemi sırasında hata:', err);
    }
  };
  
  const handleLogout = async () => {
    try {
      // Çıkış yaparken session ve email'i temizle
      await AsyncStorage.removeItem('userSession');
      await AsyncStorage.removeItem('currentUserEmail');
      router.replace('/login');
    } catch (error) {
      console.error('Çıkış yapılırken hata:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* PROFIL KARTI */}
        <View style={styles.card}>
          <View style={styles.photoContainer}>
            <View style={styles.imageWrapper}>
              <Image 
                key={profileImage || 'default'}
                source={profileImage ? { uri: profileImage } : DEFAULT_AVATAR} 
                style={styles.profileImage} 
                resizeMode="cover" 
              />
            </View>

            <View style={styles.buttonWrapper}>
              <Text style={styles.userNameText}>{userName || 'Kullanıcı'}</Text>
              <Text style={styles.userEmailText}>{userEmail}</Text>
              
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
                  <Ionicons name="camera" size={16} color="#fff" />
                  <Text style={styles.btnText}>Yükle</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.deleteBtn, !profileImage && styles.disabledBtn]} 
                  onPress={deleteImage}
                  disabled={!profileImage}
                >
                  <Ionicons name="trash" size={16} color={profileImage ? "#fff" : "#94a3b8"} />
                  <Text style={[styles.btnText, !profileImage && styles.disabledText]}>Sil</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* AYAR SEKMELERI */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hesap Ayarları</Text>
          
          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/kisisel/edit-personal-info')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}>
              <Ionicons name="person" size={20} color="#0284c7" />
            </View>
            <Text style={styles.menuItemText}>Kişisel Bilgiler</Text>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/kisisel/edit-address')}
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
            onPress={() => router.push('/kisisel/edit-contact')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#fef2f2' }]}>
              <Ionicons name="call" size={20} color="#dc2626" />
            </View>
            <Text style={styles.menuItemText}>İletişim Bilgileri</Text>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/kisisel/edit-email')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#faf5ff' }]}>
              <Ionicons name="mail" size={20} color="#9333ea" />
            </View>
            <Text style={styles.menuItemText}>E-posta İşlemleri</Text>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/kisisel/change-password')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
              <Ionicons name="lock-closed" size={20} color="#ea580c" />
            </View>
            <Text style={styles.menuItemText}>Şifre Değiştir</Text>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutBtnText}>Oturumu Kapat</Text>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 25,
  },
  photoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  buttonWrapper: {
    marginLeft: 15,
    flex: 1,
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 2,
  },
  userEmailText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e7d32',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  disabledBtn: {
    backgroundColor: '#f1f5f9',
  },
  btnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  disabledText: {
    color: '#94a3b8',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 15,
    marginLeft: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  menuSubText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fee2e2',
    gap: 10,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '700',
  },
  versionText: {
    textAlign: 'center',
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 25,
  }
});
