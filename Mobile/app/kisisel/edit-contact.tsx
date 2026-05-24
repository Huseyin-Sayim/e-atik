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
  ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from '../../database/DatabaseService';

export default function EditContactScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialData, setInitialData] = useState({ phoneNumber: '' });
  const [currentTheme, setCurrentTheme] = useState('light');

  useEffect(() => {
    loadCurrentInfo();
    const unsubscribe = DatabaseService.subscribeToTheme((theme) => {
      setCurrentTheme(theme);
    });
    return unsubscribe;
  }, []);

  const loadCurrentInfo = async () => {
    try {
      const userId = await AsyncStorage.getItem('currentUserId');
      if (userId) {
        const savedPhone = await AsyncStorage.getItem(`userPhone_${userId}`);
        if (savedPhone) {
          setInitialData({ phoneNumber: savedPhone });
        } else {
          const me = await DatabaseService.getCurrentUser();
          if (me) {
            setInitialData({ phoneNumber: me.phoneNumber || '' });
            await AsyncStorage.setItem(`userPhone_${userId}`, me.phoneNumber || '');
          }
        }
      }
      setPhoneNumber('');
    } catch (error) {
      console.error('Bilgi yükleme hatası:', error);
    }
  };

  const handleSave = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Uyarı', 'Lütfen yeni telefon numarasını giriniz.');
      return;
    }

    setLoading(true);
    try {
      const userId = await AsyncStorage.getItem('currentUserId');
      const email = await AsyncStorage.getItem('currentUserEmail');
      
      if (userId && email) {
        const lowerEmail = email.trim().toLowerCase();
        const finalPhone = phoneNumber.trim();
        
        // 1. Backend Güncelleme
        await DatabaseService.updateContactInfo(lowerEmail, { 
          phoneNumber: finalPhone
        });
        
        // 2. Yerel Hafıza Güncelleme
        await AsyncStorage.setItem(`userPhone_${userId}`, finalPhone);
        
        // 3. ANLIK GÜNCELLEME
        setInitialData({ phoneNumber: finalPhone });
        setPhoneNumber('');

        Alert.alert('Başarılı', `Telefon numaranız (${finalPhone}) başarıyla güncellendi.`);
      }
    } catch (error) {
      console.error('Güncelleme hatası:', error);
      Alert.alert('Hata', 'Telefon numarası güncellenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, currentTheme === 'dark' && { backgroundColor: '#0f172a' }]}>
      <StatusBar barStyle={currentTheme === 'dark' ? "light-content" : "dark-content"} />
      
      <View style={[styles.header, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity 
          style={[styles.backButton, currentTheme === 'dark' && { backgroundColor: '#334155' }]} 
          onPress={() => router.replace('/kisisel/kisisel-settings')}
        >
          <Ionicons name="arrow-back" size={24} color={currentTheme === 'dark' ? '#fff' : '#1e293b'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, currentTheme === 'dark' && { color: '#fff' }]}>İletişim Bilgilerini Düzenle</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={[styles.formCard, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, currentTheme === 'dark' && { color: '#94a3b8' }]}>Telefon Numarası</Text>
              <TextInput
                style={[styles.input, currentTheme === 'dark' && { backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }]}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder={initialData.phoneNumber || "05XX XXX XX XX"}
                placeholderTextColor={currentTheme === 'dark' ? "#64748b" : "#94a3b8"}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <Text style={[styles.infoText, currentTheme === 'dark' && { color: '#64748b' }]}>
            * Telefon numaranız, atık toplama süreçlerinde size ulaşılabilmesi ve hesap güvenliğiniz için önemlidir.
          </Text>
        </ScrollView>

        <View style={[styles.footer, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderTopColor: '#334155' }]}>
          <TouchableOpacity 
            style={[styles.saveButton, loading && styles.disabledButton]} 
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Kaydet</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
});
