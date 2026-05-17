import React, { useState, useEffect, useRef } from 'react';
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
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { WebView } from 'react-native-webview';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DatabaseService from '../../database/DatabaseService';

const DEFAULT_AVATAR = require('../../assets/images/default-avatar.png');

const getCropHtml = (base64Image: string) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #0f172a;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          overflow: hidden;
        }
        #header {
          text-align: center;
          padding: 15px;
        }
        h2 { margin: 0 0 5px 0; font-size: 20px; font-weight: 800; }
        p { margin: 0; font-size: 13px; color: #94a3b8; line-height: 18px; padding: 0 15px; }
        #cropContainer {
          position: relative;
          width: 280px;
          height: 280px;
          border-radius: 50%;
          border: 4px solid #2e7d32;
          overflow: hidden;
          background: #000;
          margin: 25px 0;
          box-shadow: 0 10px 25px rgba(0,0,0,0.6);
        }
        #previewImage {
          position: absolute;
          top: 0;
          left: 0;
          transform-origin: top left;
          user-select: none;
          -webkit-user-drag: none;
        }
        #controls {
          display: flex;
          gap: 15px;
          margin-top: 15px;
          width: 85%;
          justify-content: center;
        }
        .btn {
          flex: 1;
          padding: 16px;
          border-radius: 16px;
          border: none;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        #cancelBtn { background-color: #475569; color: #fff; }
        #saveBtn { background-color: #2e7d32; color: #fff; }
      </style>
    </head>
    <body>
      <div id="header">
        <h2>Fotoğrafı Düzenle</h2>
        <p>Resmi parmağınızla sürükleyerek veya iki parmağınızla büyüterek yeşil daireye ortalayın</p>
      </div>
      
      <div id="cropContainer">
        <img id="previewImage" src="${base64Image}" alt="" />
      </div>

      <div id="controls">
        <button class="btn" id="cancelBtn" onclick="cancel()">GERİ</button>
        <button class="btn" id="saveBtn" onclick="crop()">TAMAM</button>
      </div>

      <script>
        const img = document.getElementById('previewImage');
        const container = document.getElementById('cropContainer');
        
        let scale = 1;
        let x = 0;
        let y = 0;
        
        let startX = 0;
        let startY = 0;
        let isDragging = false;
        let startDistance = 0;
        
        img.onload = () => {
          const minScale = Math.max(280 / img.naturalWidth, 280 / img.naturalHeight);
          scale = minScale;
          
          x = (280 - img.naturalWidth * scale) / 2;
          y = (280 - img.naturalHeight * scale) / 2;
          
          updateTransform();
        };
        
        // Eğer görsel cache'den hızlıca yüklendiyse onload'u tetikle
        if (img.complete) {
          img.onload();
        }
        
        function updateTransform() {
          img.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + scale + ')';
        }
        
        container.addEventListener('touchstart', (e) => {
          if (e.touches.length === 1) {
            isDragging = true;
            startX = e.touches[0].clientX - x;
            startY = e.touches[0].clientY - y;
          } else if (e.touches.length === 2) {
            isDragging = false;
            startDistance = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
          }
        });
        
        container.addEventListener('touchmove', (e) => {
          e.preventDefault();
          if (isDragging && e.touches.length === 1) {
            x = e.touches[0].clientX - startX;
            y = e.touches[0].clientY - startY;
            updateTransform();
          } else if (e.touches.length === 2) {
            const distance = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            const factor = distance / startDistance;
            scale *= factor;
            startDistance = distance;
            
            const centerX = 140;
            const centerY = 140;
            x = centerX - (centerX - x) * factor;
            y = centerY - (centerY - y) * factor;
            
            updateTransform();
          }
        });
        
        container.addEventListener('touchend', () => {
          isDragging = false;
        });
        
        function cancel() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cancel' }));
        }
        
        function crop() {
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = 300;
          cropCanvas.height = 300;
          const cropCtx = cropCanvas.getContext('2d');
          
          cropCtx.drawImage(
            img,
            -x / scale,
            -y / scale,
            280 / scale,
            280 / scale,
            0,
            0,
            300,
            300
          );
          
          const croppedBase64 = cropCanvas.toDataURL('image/jpeg', 0.85);
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'crop', base64: croppedBase64 }));
        }
      </script>
    </body>
    </html>
  `;
};

export default function KurumsalSettingsScreen() {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userSurname, setUserSurname] = useState('');
  const [address, setAddress] = useState('');
  
  // HTML5 Kırpma Değerleri ve State
  const [webViewImage, setWebViewImage] = useState<string | null>(null);
  const [showCropWebView, setShowCropWebView] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'success'
  });

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

      // Backend'den en güncel profil bilgilerini çekip eşitle (Web ile senkronizasyon)
      const currentUser = await DatabaseService.getCurrentUser();
      if (currentUser) {
        if (currentUser.name) {
          setUserName(currentUser.name);
          if (currentUser.surname) {
            setUserSurname(currentUser.surname);
          }
          if (userId) {
            await AsyncStorage.setItem(`userName_${userId}`, currentUser.name);
            if (currentUser.surname) {
              await AsyncStorage.setItem(`userSurname_${userId}`, currentUser.surname);
            }
          }
        }
        if (currentUser.profileImage) {
          setProfileImage(currentUser.profileImage);
          if (Platform.OS !== 'web') {
            try {
              if (userId) {
                await AsyncStorage.setItem(`profileImage_${userId}`, currentUser.profileImage);
              }
              if (email) {
                await AsyncStorage.setItem(`profileImage_${email.trim().toLowerCase()}`, currentUser.profileImage);
              }
            } catch (e) {
              console.warn('[STORAGE] Profile image cache failed:', e);
            }
          }
        } else {
          setProfileImage(null);
          if (Platform.OS !== 'web') {
            try {
              if (userId) {
                await AsyncStorage.removeItem(`profileImage_${userId}`);
              }
              if (email) {
                await AsyncStorage.removeItem(`profileImage_${email.trim().toLowerCase()}`);
              }
            } catch (e) {
              console.warn('[STORAGE] Profile image remove failed:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false, // Yerleşik kırpıcıyı kapatıyoruz, bizim HTML5 kırpıcımız devralıyor!
      quality: 0.8,
      base64: true,
    });
 
    if (!result.canceled) {
      const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setWebViewImage(base64Data);
      setShowCropWebView(true);
    }
  };

  const saveProfileImage = async (croppedBase64: string) => {
    setUploading(true);
    setProfileImage(croppedBase64);
    DatabaseService.notifyProfilePhotoChanged(croppedBase64);
    
    const userId = await AsyncStorage.getItem('currentUserId');
    const email = await AsyncStorage.getItem('currentUserEmail');
    
    if (userId) {
      if (Platform.OS !== 'web') {
        try {
          await AsyncStorage.setItem(`profileImage_${userId}`, croppedBase64);
          if (email) {
            await AsyncStorage.setItem(`profileImage_${email.toLowerCase()}`, croppedBase64);
          }
        } catch (e) {
          console.warn('[STORAGE] Profile image cache failed:', e);
        }
      }
      
      try {
        if (email) {
          await DatabaseService.updateUser(email.trim().toLowerCase(), { profileImage: croppedBase64 });
          setCustomAlert({
            visible: true,
            title: 'Başarılı',
            message: 'Profil fotoğrafınız başarıyla güncellendi! ✅',
            type: 'success'
          });
        }
      } catch (err) {
        console.warn('[PROFIL] Backend kayıt hatası:', err);
        setCustomAlert({
          visible: true,
          title: 'Hata',
          message: 'Profil fotoğrafı kaydedilirken bir sunucu hatası oluştu.',
          type: 'error'
        });
      } finally {
        setUploading(false);
      }
    } else {
      setUploading(false);
    }
  };

  const deleteImage = async () => {
    if (!profileImage) return;
    
    Alert.alert(
      "Profil Fotoğrafını Sil",
      "Profil fotoğrafınızı silmek istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        { 
          text: "Sil", 
          style: "destructive",
          onPress: async () => {
            setUploading(true);
            setProfileImage(null);
            DatabaseService.notifyProfilePhotoChanged(null);

            try {
              const userId = await AsyncStorage.getItem('currentUserId');
              const email = await AsyncStorage.getItem('currentUserEmail');
              if (userId) {
                if (Platform.OS !== 'web') {
                  try {
                    await AsyncStorage.removeItem(`profileImage_${userId}`);
                    if (email) {
                      await AsyncStorage.removeItem(`profileImage_${email.toLowerCase()}`);
                    }
                  } catch (e) {
                    console.warn('[STORAGE] Profile image remove failed:', e);
                  }
                }
                if (email) {
                  await DatabaseService.updateUser(email.trim().toLowerCase(), { profileImage: null });
                }
                Alert.alert("Başarılı", "Profil fotoğrafınız başarıyla silindi! 🗑️");
              }
            } catch (err) {
              console.warn('[PROFIL] Silme hatası:', err);
              Alert.alert("Hata", "Profil fotoğrafı silinirken bir sorun oluştu.");
            } finally {
              setUploading(false);
            }
          }
        }
      ]
    );
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
            <TouchableOpacity 
              style={[styles.uploadActionBtn, uploading && styles.disabledBtn]} 
              onPress={pickImage}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                  <Text style={styles.uploadActionBtnText}>Fotoğraf Yükle</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.deleteActionBtn, (!profileImage || uploading) && styles.disabledBtn]} 
              onPress={deleteImage}
              disabled={!profileImage || uploading}
            >
              <Ionicons name="trash-outline" size={18} color={profileImage && !uploading ? "#ef4444" : "#cbd5e1"} />
              <Text style={[styles.deleteActionBtnText, (!profileImage || uploading) && { color: '#cbd5e1' }]}>Sil</Text>
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

      {/* PREMİUM CUSTOM YUVARLAK ALERT MODALI */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={customAlert.visible}
        onRequestClose={() => setCustomAlert({ ...customAlert, visible: false })}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertContent}>
            <View style={[
              styles.alertIconContainer,
              customAlert.type === 'success' && { backgroundColor: '#f0fdf4' },
              customAlert.type === 'error' && { backgroundColor: '#fef2f2' },
              customAlert.type === 'warning' && { backgroundColor: '#fff7ed' },
            ]}>
              <Ionicons 
                name={
                  customAlert.type === 'success' ? 'checkmark-circle' :
                  customAlert.type === 'error' ? 'close-circle' : 'warning'
                } 
                size={48} 
                color={
                  customAlert.type === 'success' ? '#16a34a' :
                  customAlert.type === 'error' ? '#dc2626' : '#ea580c'
                } 
              />
            </View>
            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            <Text style={styles.alertMessage}>{customAlert.message}</Text>
            <TouchableOpacity 
              style={[
                styles.alertBtn,
                customAlert.type === 'success' && { backgroundColor: '#2e7d32' },
                customAlert.type === 'error' && { backgroundColor: '#dc2626' },
                customAlert.type === 'warning' && { backgroundColor: '#ea580c' },
              ]}
              onPress={() => setCustomAlert({ ...customAlert, visible: false })}
            >
              <Text style={styles.alertBtnText}>TAMAM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* HTML5 WEBVIEW PREMİUM KIRPMA MODALI */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showCropWebView}
        onRequestClose={() => {
          setShowCropWebView(false);
          setWebViewImage(null);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
          <WebView
            originWhitelist={['*']}
            source={{ html: getCropHtml(webViewImage || '') }}
            onMessage={(event) => {
              const res = JSON.parse(event.nativeEvent.data);
              if (res.type === 'cancel') {
                setShowCropWebView(false);
                setWebViewImage(null);
              } else if (res.type === 'crop') {
                setShowCropWebView(false);
                setWebViewImage(null);
                saveProfileImage(res.base64);
              }
            }}
            ref={webViewRef}
            style={{ flex: 1 }}
            scrollEnabled={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </SafeAreaView>
      </Modal>
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
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
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
  },
  // CUSTOM PREMIUM ALERT STYLES (32 RADIUS!)
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)', // Slate koyu arka plan
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertContent: {
    width: '85%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 32, // Belirgin, premium 32 radius kavis!
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  alertIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  alertBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16, // Oval buton
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
