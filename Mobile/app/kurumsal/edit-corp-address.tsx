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
  ActivityIndicator,
  Modal
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from '../../database/DatabaseService';

export default function EditCorpAddressScreen() {
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialData, setInitialData] = useState({ city: '', district: '' });
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
    loadCurrentInfo();
  }, []);

  const loadCurrentInfo = async () => {
    try {
      const userId = await AsyncStorage.getItem('currentUserId');
      if (userId) {
        // Önce yerel hafızaya bak
        const savedCity = await AsyncStorage.getItem(`userCity_${userId}`);
        const savedDistrict = await AsyncStorage.getItem(`userDistrict_${userId}`);
        if (savedCity || savedDistrict) {
          setInitialData({ 
            city: savedCity || '', 
            district: savedDistrict || '' 
          });
        } else {
          // 2. Yerelde yoksa veritabanından çek
          const me = await DatabaseService.getCurrentUser();
          if (me) {
            const finalCity = me.city || '';
            const finalDistrict = me.district || '';
            setInitialData({ city: finalCity, district: finalDistrict });
            
            await AsyncStorage.setItem(`userCity_${userId}`, finalCity);
            await AsyncStorage.setItem(`userDistrict_${userId}`, finalDistrict);
          }
        }
      }
      setCity('');
      setDistrict('');
    } catch (error) {
      console.error('Adres bilgisi yükleme hatası:', error);
    }
  };

  const handleSave = async () => {
    if (!city.trim() && !district.trim()) {
      setCustomAlert({ visible: true, title: 'Uyarı', message: 'Lütfen en az bir alanı doldurunuz.', type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const userId = await AsyncStorage.getItem('currentUserId');
      const email = await AsyncStorage.getItem('currentUserEmail');
      
      if (userId && email) {
        const lowerEmail = email.trim().toLowerCase();
        const finalCity = city.trim() || initialData.city;
        const finalDistrict = district.trim() || initialData.district;
        
        // 1. Backend Güncelleme
        await DatabaseService.updateUser(lowerEmail, { 
          city: finalCity,
          district: finalDistrict 
        });
        
        // 2. Yerel Hafıza Güncelleme
        await AsyncStorage.setItem(`userCity_${userId}`, finalCity);
        await AsyncStorage.setItem(`userDistrict_${userId}`, finalDistrict);
        
        // 3. ANLIK GÜNCELLEME
        setInitialData({ city: finalCity, district: finalDistrict });
        setCity('');
        setDistrict('');

        setCustomAlert({
          visible: true,
          title: 'Başarılı',
          message: `Kurumsal adres bilgileriniz (${finalCity} / ${finalDistrict}) başarıyla güncellendi.`,
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Güncelleme hatası:', error);
      setCustomAlert({
        visible: true,
        title: 'Hata',
        message: 'Adres bilgileri güncellenirken bir sorun oluştu.',
        type: 'error'
      });
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
        <Text style={styles.headerTitle}>Kurumsal Adres Güncelle</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Şehir</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder={initialData.city || "Şehir"}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>İlçe</Text>
              <TextInput
                style={styles.input}
                value={district}
                onChangeText={setDistrict}
                placeholder={initialData.district || "İlçe"}
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <Text style={styles.infoText}>
            * Bu bilgiler kurumsal atık toplama süreçlerinde varsayılan olarak kullanılacaktır.
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.saveButton, loading && styles.disabledButton]} 
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Adresi Güncelle</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

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
                size={44} 
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
    borderRadius: 24,
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
    borderRadius: 28,
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
    borderRadius: 18,
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
    borderRadius: 20,
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
  // CUSTOM PREMIUM ALERT STYLES
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)', // Slate renginde koyu transparan katman
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
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
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
    borderRadius: 16, // Premium buton radiusu
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
