import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DatabaseService from '../database/DatabaseService';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const sessionData = await AsyncStorage.getItem('userSession');
      if (sessionData) {
        const parsedSession = JSON.parse(sessionData);
        const expiry = parsedSession.expiry;
        const profileType = parsedSession.profileType;
        const now = new Date().getTime();

        // Eğer oturum süresi dolmamışsa (30 gün) otomatik giriş yap
        if (now < expiry) {
          console.log('[OTURUM KONTROLÜ] Geçerli bir oturum bulundu, yönlendiriliyor...');
          if (profileType) {
            router.replace(profileType === 'kisisel' ? '/kisisel/kisisel-index' : '/kurumsal/kurumsal-index' as any);
          } else {
            router.replace('/profile-selection');
          }
        } else {
          // Süresi dolmuşsa temizle
          await AsyncStorage.removeItem('userSession');
        }
      }
    } catch (error) {
      console.error('Oturum kontrolü sırasında hata:', error);
    }
  };

  const handleLogin = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!email || !password) {
      setErrorMessage('Lütfen e-posta ve şifre alanlarının ikisini de doldurun.');
      return;
    }

    try {
      let isValidUser;
      try {
        isValidUser = await DatabaseService.loginUser(email, password);
      } catch (err: any) {
        if (err.message === 'kullanıcı bulunamadı') {
          setErrorMessage('Böyle bir hesap bulunamadı. Lütfen önce hesap oluşturun.');
        } else {
          setErrorMessage(err.message || 'Giriş yapılamadı, lütfen tekrar deneyiniz.');
        }
        return;
      }


      setSuccessMessage('Giriş Başarılı, Hoş geldiniz!');
      
      // Küçük bir gecikme ekleyelim ki kullanıcı mesajı görsün
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Giriş yapılıyor:', { email, password, rememberMe });

      // "Beni Hatırla" seçiliyse 30 günlük oturum kaydet
      if (rememberMe) {
        const thirtyDaysInMillis = 30 * 24 * 60 * 60 * 1000;
        const expiryDate = new Date().getTime() + thirtyDaysInMillis;

        const sessionData = {
          email: email.toLowerCase(),
          name: isValidUser.name,
          profileType: isValidUser.profileType,
          expiry: expiryDate
        };

        await AsyncStorage.setItem('userSession', JSON.stringify(sessionData));
        console.log('[OTURUM KAYDEDİLDİ] 30 gün boyunca açık kalacak.');
      } else {
        // Seçili değilse eski kayıt varsa temizle
        await AsyncStorage.removeItem('userSession');
      }

      // Profil seçimi veya diğer ekranlar için güncel email bilgisini sakla
      const lowerEmail = email.toLowerCase();
      await AsyncStorage.setItem('currentUserEmail', lowerEmail);
      if (isValidUser.name) {
        await AsyncStorage.setItem(`userName_${lowerEmail}`, isValidUser.name);
      }
      
      // Backend'den gelen profil fotoğrafını kaydet
      if (isValidUser.profileImage) {
        await AsyncStorage.setItem(`profileImage_${lowerEmail}`, isValidUser.profileImage);
      }

      // Backend kaydetmediği için yerel hafızadan profil tipini kontrol et
      const savedProfileType = await AsyncStorage.getItem(`profileType_${lowerEmail}`);
      const activeProfileType = savedProfileType || isValidUser.profileType;

      const isFirstLogin = !activeProfileType;

      if (isFirstLogin) {
        console.log('[YÖNLENDİRME] Kullanıcı ilk kez giriş yapıyor veya profil seçmemiş. Profil seçimine yönlendiriliyor...');
        router.replace('/profile-selection');
      } else {
        console.log('[YÖNLENDİRME] Kullanıcı daha önce giriş yapmış. Profil tipine göre ana sayfaya yönlendiriliyor...');
        if (activeProfileType) {
          router.replace(activeProfileType === 'kisisel' ? '/kisisel/kisisel-index' : '/kurumsal/kurumsal-index' as any);
        } else {
          router.replace('/profile-selection');
        }
      }

    } catch (error) {
      console.error('Oturum kaydedilirken veya giriş yaparken hata:', error);
      Alert.alert('Hata', 'Giriş işlemi sırasında bir sorun oluştu.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.title}>Giriş Yap</Text>

          <TextInput
            style={styles.input}
            placeholder="E-posta"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Şifre"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color="#999" />
            </TouchableOpacity>
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

          <View style={styles.row}>
            {/* BENİ HATIRLA - Hitbox sadece içerik kadar */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setRememberMe(!rememberMe)}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Beni hatırla</Text>
            </TouchableOpacity>

            {/* ŞİFREMİ UNUTTUM - Sağa yapışık ve görünür */}
            <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={() => router.push('/forgot-password' as any)}
            >
              <Text style={styles.forgotPasswordText}>Şifremi unuttum</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.baseButton, styles.loginButton]}
              onPress={handleLogin}
            >
              <Text style={styles.loginButtonText}>Giriş Yap</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.baseButton, styles.registerButton]}
              onPress={() => router.push('/register' as any)}
            >
              <Text style={styles.registerButtonText}>Kayıt Ol</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  container: {
    padding: 24,
    width: '100%',
    maxWidth: 500, // Çok geniş ekranlarda (Web gibi) dağılmayı önler
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    color: '#111',
  },
  input: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 15,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#000',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    color: '#000',
  },
  eyeIcon: {
    padding: 10,
    marginRight: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    width: '100%',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Hitbox'ı sınırlamak için padding'i küçülttük
    paddingVertical: 5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#555',
  },
  forgotPasswordContainer: {
    paddingVertical: 5,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  baseButton: {
    flex: 1,
    height: 55,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButton: {
    backgroundColor: '#2e7d32',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerButton: {
    borderWidth: 2,
    borderColor: '#2e7d32',
  },
  registerButtonText: {
    color: '#2e7d32',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  successText: {
    color: '#2e7d32',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
});