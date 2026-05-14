import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from '../../database/DatabaseService';

export default function EditCorpEmailScreen() {
  const [currentEmailInput, setCurrentEmailInput] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [initialData, setInitialData] = useState({ email: '' });

  useEffect(() => {
    loadCurrentInfo();
  }, []);

  const loadCurrentInfo = async () => {
    try {
      const email = await AsyncStorage.getItem('currentUserEmail');
      if (email) {
        setInitialData({ email: email.toLowerCase() });
      }
      setCurrentEmailInput('');
      setNewEmail('');
      setConfirmEmail('');
    } catch (error) {
      console.error('Bilgi yükleme hatası:', error);
    }
  };

  const handleRequestCode = async () => {
    if (!newEmail.trim() || !confirmEmail.trim()) {
      Alert.alert('Uyarı', 'Lütfen yeni e-posta alanlarını doldurunuz.');
      return;
    }

    if (newEmail.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      Alert.alert('Hata', 'Yeni kurumsal e-posta adresleri birbiriyle eşleşmiyor.');
      return;
    }

    if (!newEmail.includes('@')) {
      Alert.alert('Hata', 'Geçerli bir e-posta adresi giriniz.');
      return;
    }

    setLoading(true);
    try {
      await DatabaseService.requestEmailChange(newEmail.trim().toLowerCase());
      setModalVisible(true);
    } catch (error: any) {
      console.error('Kod isteme hatası:', error);
      Alert.alert('Hata', error.message || 'Doğrulama kodu gönderilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndSave = async () => {
    if (verificationCode.length !== 6) {
      Alert.alert('Uyarı', 'Lütfen 6 haneli doğrulama kodunu giriniz.');
      return;
    }

    setLoading(true);
    try {
      const lowerNewEmail = newEmail.trim().toLowerCase();

      // 1. Backend Onay
      await DatabaseService.verifyEmailChange(lowerNewEmail, verificationCode);

      // 2. Yerel Hafıza Güncelleme
      await AsyncStorage.setItem('currentUserEmail', lowerNewEmail);

      // 3. Başarı İşlemleri
      setModalVisible(false);
      setInitialData({ email: lowerNewEmail });
      setCurrentEmailInput('');
      setNewEmail('');
      setConfirmEmail('');
      setVerificationCode('');

      Alert.alert('Başarılı', `Kurumsal e-posta adresiniz başarıyla güncellendi. Yeni adresinizle tekrar giriş yapmanız gerekebilir.`);
    } catch (error: any) {
      console.error('Doğrulama hatası:', error);
      Alert.alert('Hata', error.message || 'Kod doğrulanamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/kurumsal/kurumsal-settings')}
        >
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kurumsal E-posta İşlemleri</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mevcut Kurumsal E-posta</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#f1f5f9' }]}
                value={currentEmailInput}
                onChangeText={setCurrentEmailInput}
                placeholder={initialData.email || "mevcut@mail.com"}
                placeholderTextColor="#94a3b8"
                editable={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Yeni Kurumsal E-posta</Text>
              <TextInput
                style={styles.input}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="Yeni kurumsal e-postayı girin"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Yeni E-posta (Tekrar)</Text>
              <TextInput
                style={styles.input}
                value={confirmEmail}
                onChangeText={setConfirmEmail}
                placeholder="Yeni e-postayı tekrar girin"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <Text style={styles.infoText}>
            * E-posta değişikliği sonrası yeni adresinizle giriş yapmanız gerekecektir.
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.disabledButton]}
            onPress={handleRequestCode}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Doğrulama Kodu Gönder</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* DOĞRULAMA MODAL (POPUP) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kodu Doğrula</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubTitle}>
              {newEmail} adresine gönderilen 6 haneli kodu giriniz.
            </Text>

            <TextInput
              style={styles.codeInput}
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="000000"
              placeholderTextColor="#cbd5e1"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus={true}
            />

            <TouchableOpacity
              style={[styles.modalVerifyBtn, loading && styles.disabledButton]}
              onPress={handleVerifyAndSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalVerifyBtnText}>Onayla ve Güncelle</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRequestCode}
              disabled={loading}
              style={{ marginTop: 15 }}
            >
              <Text style={styles.resendText}>Kodu Tekrar Gönder</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  container: {
    padding: 20,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  infoText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 15,
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  saveButton: {
    backgroundColor: '#2e7d32',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#a5d6a7',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // MODAL STYLES (BANKING APP STYLE)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)', // Daha koyu ve premium overlay
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '90%', // Mobilde %90 kaplasın
    maxWidth: 360, // Web'de 360px'i geçmesin
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
    position: 'relative',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 0,
    top: -5,
    padding: 4,
    zIndex: 10,
  },
  modalSubTitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  codeInputContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
  },
  codeInput: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingVertical: Platform.OS === 'web' ? 12 : 18,
    fontSize: Platform.OS === 'web' ? 24 : 32,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: Platform.OS === 'web' ? 8 : 12,
    color: '#2e7d32',
  },
  modalVerifyBtn: {
    backgroundColor: '#2e7d32',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalVerifyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  resendContainer: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  resendText: {
    color: '#64748b',
    fontSize: 13,
  },
  resendAction: {
    color: '#2e7d32',
    fontWeight: '700',
    fontSize: 13,
  }
});
