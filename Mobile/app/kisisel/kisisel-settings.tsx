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
  const [userName, setUserName] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const email = await AsyncStorage.getItem('currentUserEmail');
      const sessionStr = await AsyncStorage.getItem('userSession');
      
      if (email) setUserEmail(email);
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        setUserName(session.name || '');
      }

      if (email) {
        const savedPhoto = await AsyncStorage.getItem(`profileImage_${email}`);
        if (savedPhoto) setProfileImage(savedPhoto);
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
      
      const email = await AsyncStorage.getItem('currentUserEmail');
      if (email) {
        const lowerEmail = email.toLowerCase();
        await AsyncStorage.setItem(`profileImage_${lowerEmail}`, base64Data);
        
        try {
          await DatabaseService.updateUser(lowerEmail, { profileImage: base64Data });
          console.log('[PROFIL] Base64 fotoğraf backend\'e kaydedildi.');
        } catch (err) {
          console.warn('[PROFIL] Backend kayıt hatası:', err);
        }
      }
    }
  };

  const deleteImage = async () => {
    if (!profileImage) return;

    // Arayüzü anında güncelle
    setProfileImage(null);

    try {
      const email = await AsyncStorage.getItem('currentUserEmail');
      if (email) {
        const lowerEmail = email.toLowerCase();
        await AsyncStorage.removeItem(`profileImage_${lowerEmail}`);
        await DatabaseService.updateUser(lowerEmail, { profileImage: null });
        console.log('[PROFIL] Fotoğraf başarıyla silindi.');
      }
    } catch (err) {
      console.warn('[PROFIL] Silme işlemi sırasında hata:', err);
    }
  };
  
  const handleLogout = async () => {
    try {
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
        
        <View style={styles.card}>
          <View style={styles.photoContainer}>
            {/* Profil Fotoğrafı (SAF ÇİZİM) */}
            <View style={styles.imageWrapper}>
              <Image 
                key={profileImage || 'default'}
                source={profileImage ? { uri: profileImage } : DEFAULT_AVATAR} 
                style={styles.profileImage} 
                resizeMode="cover" 
              />
            </View>

            {/* Butonlar */}
            <View style={styles.buttonWrapper}>
              <Text style={styles.title}>{userName || 'Kullanıcı'} Profili</Text>
              
              <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.btnText}>Fotoğraf Yükle</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.deleteBtn, !profileImage && styles.disabledBtn]} 
                onPress={deleteImage}
                disabled={!profileImage}
              >
                <Ionicons name="trash" size={18} color={profileImage ? "#fff" : "#95a5a6"} />
                <Text style={[styles.btnText, !profileImage && styles.disabledText]}>Fotoğrafı Sil</Text>
              </TouchableOpacity>
            </View>
          </View>
          
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#e74c3c" />
          <Text style={styles.logoutBtnText}>Çıkış Yap</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContent: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  photoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: '#dcdde1',
    overflow: 'hidden',
  },
  drawnAvatarContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#95a5a6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
    marginTop: 10,
  },
  avatarBody: {
    width: 56,
    height: 36,
    backgroundColor: '#e0e0e0',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: 4,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  buttonWrapper: {
    marginLeft: 20,
    flex: 1,
    gap: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2ecc71',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 8,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e74c3c',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 8,
  },
  disabledBtn: {
    backgroundColor: '#f1f2f6',
  },
  btnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  disabledText: {
    color: '#95a5a6',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f2f6',
    marginVertical: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#7f8c8d',
    flex: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  logoutBtnText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '700',
  }
});
