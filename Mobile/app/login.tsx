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
  const [loading, setLoading] = useState(false);

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

        if (now < expiry) {
          // --- AUTO-MIGRATION FOR EXISTING SESSIONS ---
          const currentUserId = await AsyncStorage.getItem('currentUserId');
          if (!currentUserId && parsedSession.id) {
            await AsyncStorage.setItem('currentUserId', parsedSession.id.toString());
            // Migration tetiklemek için handleLogin'deki mantığın bir benzerini buraya da kurabiliriz 
            // ama ID set edilmesi bile çoğu sayfanın çalışmasını sağlar.
          }
          // --------------------------------------------

          setLoading(true);
          setSuccessMessage('Oturumunuz açılıyor...');
          if (profileType) {
            setTimeout(() => {
              router.replace(profileType === 'kisisel' ? '/kisisel/kisisel-index' : '/kurumsal/kurumsal-index' as any);
            }, 1000);
          } else {
            router.replace('/profile-selection');
          }
        } else {
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

    setLoading(true);
    try {
      let isValidUser;
      try {
        isValidUser = await DatabaseService.loginUser(email, password);
      } catch (err: any) {
        setLoading(false);
        if (err.message === 'kullanıcı bulunamadı') {
          setErrorMessage('Böyle bir hesap bulunamadı. Lütfen önce hesap oluşturun.');
        } else {
          setErrorMessage(err.message || 'Giriş yapılamadı, lütfen tekrar deneyiniz.');
        }
        return;
      }

      setSuccessMessage('Giriş başarılı! Yönlendiriliyorsunuz...');
      
      if (rememberMe) {
        const thirtyDaysInMillis = 30 * 24 * 60 * 60 * 1000;
        const expiryDate = new Date().getTime() + thirtyDaysInMillis;

        const sessionData = {
          id: isValidUser.id, // ID eklendi
          email: email,
          profileType: isValidUser.profileType,
          expiry: expiryDate
        };

        await AsyncStorage.setItem('userSession', JSON.stringify(sessionData));
      } else {
        await AsyncStorage.removeItem('userSession');
      }

      const userId = isValidUser.id.toString();
      const lowerEmail = email.trim().toLowerCase();
      
      // --- MIGRATION LOGIC (Eski verileri ID sistemine taşı) ---
      const keysToMigrate = [
        { old: `userName_${lowerEmail}`, new: `userName_${userId}` },
        { old: `userSurname_${lowerEmail}`, new: `userSurname_${userId}` },
        { old: `userCity_${lowerEmail}`, new: `userCity_${userId}` },
        { old: `userDistrict_${lowerEmail}`, new: `userDistrict_${userId}` },
        { old: `profileImage_${lowerEmail}`, new: `profileImage_${userId}` },
        { old: `profileType_${lowerEmail}`, new: `profileType_${userId}` },
        { old: `userPhone_${lowerEmail}`, new: `userPhone_${userId}` },
      ];

      for (const key of keysToMigrate) {
        const oldData = await AsyncStorage.getItem(key.old);
        if (oldData) {
          await AsyncStorage.setItem(key.new, oldData);
          // Taşıma bittikten sonra eskiyi silmiyorum ki garanti olsun (opsiyonel)
        }
      }
      // -------------------------------------------------------

      await AsyncStorage.setItem('currentUserId', userId);
      await AsyncStorage.setItem('currentUserEmail', lowerEmail);
      
      // Backend'den gelen güncel verileri de ID üzerine yaz (En taze veri)
      if (isValidUser.name) await AsyncStorage.setItem(`userName_${userId}`, isValidUser.name);
      if (isValidUser.surname) await AsyncStorage.setItem(`userSurname_${userId}`, isValidUser.surname);
      if (isValidUser.city) await AsyncStorage.setItem(`userCity_${userId}`, isValidUser.city);
      if (isValidUser.district) await AsyncStorage.setItem(`userDistrict_${userId}`, isValidUser.district);

      const savedProfileType = await AsyncStorage.getItem(`profileType_${userId}`);
      const activeProfileType = savedProfileType || isValidUser.profileType;

      const isFirstLogin = !activeProfileType;

      setTimeout(() => {
        if (isFirstLogin) {
          router.replace('/profile-selection');
        } else {
          if (activeProfileType) {
            router.replace(activeProfileType === 'kisisel' ? '/kisisel/kisisel-index' : '/kurumsal/kurumsal-index' as any);
          } else {
            router.replace('/profile-selection');
          }
        }
      }, 1500);

    } catch (error: any) {
      setLoading(false);
      console.error('Giriş hatası:', error);
      setErrorMessage(error.message || 'Giriş işlemi sırasında bir sorun oluştu.');
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
            editable={!loading}
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Şifre"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color="#999" />
            </TouchableOpacity>
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

          <View style={styles.row}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setRememberMe(!rememberMe)}
              style={styles.checkboxRow}
              disabled={loading}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Beni hatırla</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={() => router.push('/forgot-password' as any)}
              disabled={loading}
            >
              <Text style={styles.forgotPasswordText}>Şifremi unuttum</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.baseButton, styles.loginButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.loginButtonText}>
                {successMessage 
                  ? 'Giriş Başarılı!' 
                  : (loading ? 'Giriş Yapılıyor...' : 'Giriş Yap')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.baseButton, styles.registerButton]}
              onPress={() => router.push('/register' as any)}
              disabled={loading}
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
    maxWidth: 500,
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
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
});
