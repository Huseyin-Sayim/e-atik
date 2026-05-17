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

export default function EditPersonalInfoScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialData, setInitialData] = useState({ ad: '', soyad: '' });

  useEffect(() => {
    loadCurrentInfo();
  }, []);

  const loadCurrentInfo = async () => {
    try {
      const userId = await AsyncStorage.getItem('currentUserId');
      const sessionStr = await AsyncStorage.getItem('userSession');
      let ad = '';
      let soyad = '';

      if (userId) {
        const savedName = await AsyncStorage.getItem(`userName_${userId}`);
        const savedSurname = await AsyncStorage.getItem(`userSurname_${userId}`);
        if (savedName) ad = savedName;
        if (savedSurname) soyad = savedSurname;
      }

      // Eğer local'de yoksa session'dan bak
      if (!ad && sessionStr) {
        const session = JSON.parse(sessionStr);
        ad = session.name || '';
        soyad = session.surname || '';
      }

      // Eski hesaplar için kurtarma mantığı
      if (ad && !soyad) {
        const parts = ad.trim().split(/\s+/);
        if (parts.length > 1) {
          soyad = parts.pop() || '';
          ad = parts.join(' ');
        }
      }

      setInitialData({ ad, soyad });
      setFirstName('');
      setLastName('');
    } catch (error) {
      console.error('Bilgi yükleme hatası:', error);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim() && !lastName.trim()) {
      Alert.alert('Uyarı', 'Lütfen en az bir alanı doldurunuz.');
      return;
    }

    setLoading(true);
    try {
      const userId = await AsyncStorage.getItem('currentUserId');
      const email = await AsyncStorage.getItem('currentUserEmail');
      
      if (userId && email) {
        const lowerEmail = email.trim().toLowerCase();
        const finalFirstName = firstName.trim() || initialData.ad;
        const finalLastName = lastName.trim() || initialData.soyad;
        
        // 1. Backend Güncelleme
        await DatabaseService.updateUser(lowerEmail, { 
          name: finalFirstName,
          surname: finalLastName 
        });
        
        // 2. Yerel Hafıza Güncelleme
        await AsyncStorage.setItem(`userName_${userId}`, finalFirstName);
        await AsyncStorage.setItem(`userSurname_${userId}`, finalLastName);
        
        // 3. Session Güncelleme
        const sessionStr = await AsyncStorage.getItem('userSession');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          session.name = finalFirstName;
          session.surname = finalLastName;
          await AsyncStorage.setItem('userSession', JSON.stringify(session));
        }

        // 4. ANLIK GÜNCELLEME
        setInitialData({ ad: finalFirstName, soyad: finalLastName });
        setFirstName('');
        setLastName('');

        Alert.alert('Başarılı', `Bilgileriniz (${finalFirstName} ${finalLastName}) başarıyla güncellendi.`);
      }
    } catch (error) {
      console.error('Güncelleme hatası:', error);
      Alert.alert('Hata', 'Bilgiler güncellenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      {/* Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.replace('/kisisel/kisisel-settings')}
        >
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bilgileri Düzenle</Text>
        <View style={{ width: 40 }} /> {/* Dengeleme için */}
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ad</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder={initialData.ad || "Adınız"}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Soyad</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder={initialData.soyad || "Soyadınız"}
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <Text style={styles.infoText}>
            * Değişiklikler anında profilinize yansıtılacaktır.
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
