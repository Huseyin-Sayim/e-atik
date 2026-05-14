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

export default function EditCorpAddressScreen() {
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialData, setInitialData] = useState({ city: '', district: '' });

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
      Alert.alert('Uyarı', 'Lütfen en az bir alanı doldurunuz.');
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

        Alert.alert('Başarılı', `Kurumsal adres bilgileriniz (${finalCity} / ${finalDistrict}) başarıyla güncellendi.`);
      }
    } catch (error) {
      console.error('Güncelleme hatası:', error);
      Alert.alert('Hata', 'Adres bilgileri güncellenirken bir sorun oluştu.');
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
});
