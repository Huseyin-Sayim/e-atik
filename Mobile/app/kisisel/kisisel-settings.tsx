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
import { router, useFocusEffect } from 'expo-router';
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

        // Mouse ve Wheel desteği (Web için)
        container.addEventListener('mousedown', (e) => {
          isDragging = true;
          startX = e.clientX - x;
          startY = e.clientY - y;
        });
        
        window.addEventListener('mousemove', (e) => {
          if (isDragging) {
            x = e.clientX - startX;
            y = e.clientY - startY;
            updateTransform();
          }
        });
        
        window.addEventListener('mouseup', () => {
          isDragging = false;
        });

        container.addEventListener('wheel', (e) => {
          e.preventDefault();
          const zoomSpeed = 0.05;
          const factor = e.deltaY < 0 ? (1 + zoomSpeed) : (1 - zoomSpeed);
          scale *= factor;
          
          const centerX = 140;
          const centerY = 140;
          x = centerX - (centerX - x) * factor;
          y = centerY - (centerY - y) * factor;
          
          updateTransform();
        });
        
        function postMsg(data) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(data);
          } else if (window.parent) {
            window.parent.postMessage(data, '*');
          }
        }

        function cancel() {
          postMsg(JSON.stringify({ type: 'cancel' }));
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
          postMsg(JSON.stringify({ type: 'crop', base64: croppedBase64 }));
        }
      </script>
    </body>
    </html>
  `;
};

export default function KisiselSettingsScreen() {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [address, setAddress] = useState('');
  const [userName, setUserName] = useState('');
  
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

  const [currentTheme, setCurrentTheme] = useState('light');

  useEffect(() => {
    const unsubscribe = DatabaseService.subscribeToTheme((theme) => {
      setCurrentTheme(theme);
    });
    
    return () => unsubscribe();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

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

      // Backend'den en güncel profil bilgilerini çekip eşitle (Web ile senkronizasyon)
      const currentUser = await DatabaseService.getCurrentUser();
      if (currentUser) {
        if (currentUser.name) {
          const fullName = currentUser.name + (currentUser.surname ? ' ' + currentUser.surname : '');
          setUserName(fullName);
          if (userId) {
            await AsyncStorage.setItem(`userName_${userId}`, currentUser.name);
            if (currentUser.surname) {
              await AsyncStorage.setItem(`userSurname_${userId}`, currentUser.surname);
            }
          }
        }
        if (currentUser.email) {
          setUserEmail(currentUser.email.trim().toLowerCase());
          await AsyncStorage.setItem('currentUserEmail', currentUser.email.trim().toLowerCase());
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
      try {
        await AsyncStorage.setItem(`profileImage_${userId}`, croppedBase64);
        if (email) {
          await AsyncStorage.setItem(`profileImage_${email.toLowerCase()}`, croppedBase64);
        }
      } catch (e) {
        console.warn('[STORAGE] Profile image cache failed:', e);
      }
      
      try {
        if (email) {
          await DatabaseService.updateUser({ profileImage: croppedBase64 });
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

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleWebMessage = (event: MessageEvent) => {
        try {
          const res = JSON.parse(event.data);
          if (res.type === 'cancel') {
            setShowCropWebView(false);
            setWebViewImage(null);
          } else if (res.type === 'crop') {
            setShowCropWebView(false);
            setWebViewImage(null);
            saveProfileImage(res.base64);
          }
        } catch (e) {
          // JSON parse hatasını yutabiliriz
        }
      };
      window.addEventListener('message', handleWebMessage);
      return () => window.removeEventListener('message', handleWebMessage);
    }
  }, [saveProfileImage]);

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
                  await DatabaseService.updateUser({ profileImage: null });
                }
                Alert.alert("Başarılı", "Profil fotoğrafınız başarıyla silindi! 🗑️");
              }
            } catch (err) {
              console.warn('[PROFIL] Silme işlemi sırasında hata:', err);
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
      // Çıkış yaparken session ve email'i temizle
      await AsyncStorage.removeItem('userSession');
      await AsyncStorage.removeItem('currentUserEmail');
      router.replace('/login');
    } catch (error) {
      console.error('Çıkış yapılırken hata:', error);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, currentTheme === 'dark' && { backgroundColor: '#0f172a' }]}>
      <StatusBar barStyle={currentTheme === 'dark' ? "light-content" : "dark-content"} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* PROFIL KARTI */}
        <View style={[styles.card, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
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
              <Text style={[styles.userNameText, currentTheme === 'dark' && { color: '#fff' }]}>{userName || 'Kullanıcı'}</Text>
              <Text style={[styles.userEmailText, currentTheme === 'dark' && { color: '#94a3b8' }]}>{userEmail}</Text>
              
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={[styles.uploadBtn, uploading && styles.disabledBtn]} 
                  onPress={pickImage}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="camera" size={16} color="#fff" />
                      <Text style={styles.btnText}>Yükle</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.deleteBtn, (!profileImage || uploading) && styles.disabledBtn]} 
                  onPress={deleteImage}
                  disabled={!profileImage || uploading}
                >
                  <Ionicons name="trash" size={16} color={profileImage && !uploading ? "#fff" : "#94a3b8"} />
                  <Text style={[styles.btnText, (!profileImage || uploading) && styles.disabledText]}>Sil</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* AYAR SEKMELERI */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, currentTheme === 'dark' && { color: '#64748b' }]}>Hesap Ayarları</Text>
          
          <TouchableOpacity 
            style={[styles.menuItem, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]} 
            activeOpacity={0.7}
            onPress={() => router.push('/kisisel/edit-personal-info')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}>
              <Ionicons name="person" size={20} color="#0284c7" />
            </View>
            <Text style={[styles.menuItemText, currentTheme === 'dark' && { color: '#fff' }]}>Kişisel Bilgiler</Text>
            <Ionicons name="chevron-forward" size={18} color={currentTheme === 'dark' ? '#64748b' : '#cbd5e1'} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]} 
            activeOpacity={0.7}
            onPress={() => router.push('/kisisel/edit-address')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#f0fdf4' }]}>
              <Ionicons name="location" size={20} color="#16a34a" />
            </View>
            <Text style={[styles.menuItemText, currentTheme === 'dark' && { color: '#fff' }]}>Adres Bilgileri</Text>
            <Ionicons name="chevron-forward" size={18} color={currentTheme === 'dark' ? '#64748b' : '#cbd5e1'} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]} 
            activeOpacity={0.7}
            onPress={() => router.push('/kisisel/edit-contact')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#fef2f2' }]}>
              <Ionicons name="call" size={20} color="#dc2626" />
            </View>
            <Text style={[styles.menuItemText, currentTheme === 'dark' && { color: '#fff' }]}>İletişim Bilgileri</Text>
            <Ionicons name="chevron-forward" size={18} color={currentTheme === 'dark' ? '#64748b' : '#cbd5e1'} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]} 
            activeOpacity={0.7}
            onPress={() => router.push('/kisisel/edit-email')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#faf5ff' }]}>
              <Ionicons name="mail" size={20} color="#9333ea" />
            </View>
            <Text style={[styles.menuItemText, currentTheme === 'dark' && { color: '#fff' }]}>E-posta İşlemleri</Text>
            <Ionicons name="chevron-forward" size={18} color={currentTheme === 'dark' ? '#64748b' : '#cbd5e1'} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]} 
            activeOpacity={0.7}
            onPress={() => router.push('/kisisel/change-password')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
              <Ionicons name="lock-closed" size={20} color="#ea580c" />
            </View>
            <Text style={[styles.menuItemText, currentTheme === 'dark' && { color: '#fff' }]}>Şifre Değiştir</Text>
            <Ionicons name="chevron-forward" size={18} color={currentTheme === 'dark' ? '#64748b' : '#cbd5e1'} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]} 
            activeOpacity={0.7}
            onPress={() => router.push('/kisisel/theme-settings')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#e2e8f0' }]}>
              <Ionicons name="color-palette" size={20} color="#475569" />
            </View>
            <Text style={[styles.menuItemText, currentTheme === 'dark' && { color: '#fff' }]}>Tema Ayarları</Text>
            <Ionicons name="chevron-forward" size={18} color={currentTheme === 'dark' ? '#64748b' : '#cbd5e1'} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.logoutBtn, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }]} 
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutBtnText}>Oturumu Kapat</Text>
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
          {Platform.OS === 'web' ? (
            <iframe
              srcDoc={getCropHtml(webViewImage || '')}
              style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
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
          )}
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
