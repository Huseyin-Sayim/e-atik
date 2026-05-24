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
  Alert,
  ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from '../../database/DatabaseService';

export default function ThemeSettingsScreen() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentTheme, setCurrentTheme] = useState('light');

  useEffect(() => {
    loadTheme();
    
    const unsubscribe = DatabaseService.subscribeToTheme((t) => {
      setCurrentTheme(t);
    });
    return () => unsubscribe();
  }, []);

  const loadTheme = async () => {
    try {
      const userId = await AsyncStorage.getItem('currentUserId');
      const savedTheme = await AsyncStorage.getItem(`theme_${userId}`);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setTheme(savedTheme);
      }
    } catch (error) {
      console.error('Tema yükleme hatası:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const userId = await AsyncStorage.getItem('currentUserId');
      await AsyncStorage.setItem(`theme_${userId}`, theme);
      
      const email = await AsyncStorage.getItem('currentUserEmail');
      if (email) {
        await DatabaseService.updateUser(email.trim().toLowerCase(), { theme });
      }
      
      DatabaseService.notifyThemeChanged(theme);
      
      Alert.alert('Başarılı', 'Tema tercihiniz kaydedildi ve anında uygulandı.');
    } catch (error) {
      console.error('Tema kaydetme hatası:', error);
      Alert.alert('Hata', 'Tema kaydedilirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2e7d32" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, currentTheme === 'dark' && { backgroundColor: '#0f172a' }]}>
      <StatusBar barStyle={currentTheme === 'dark' ? "light-content" : "dark-content"} />
      
      <View style={[styles.header, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity 
          style={[styles.backButton, currentTheme === 'dark' && { backgroundColor: '#334155' }]} 
          onPress={() => router.replace('/kurumsal/kurumsal-settings')}
        >
          <Ionicons name="arrow-back" size={24} color={currentTheme === 'dark' ? '#fff' : '#1e293b'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, currentTheme === 'dark' && { color: '#fff' }]}>Tema Ayarları</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.formCard, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
          <Text style={[styles.label, currentTheme === 'dark' && { color: '#64748b' }]}>Uygulama Teması</Text>
          
          {/* Açık Tema Seçeneği */}
          <TouchableOpacity 
            style={[styles.themeOption, currentTheme === 'dark' && { borderBottomColor: '#334155' }]}
            onPress={() => setTheme('light')}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, theme === 'light' && styles.checkboxSelected, currentTheme === 'dark' && theme !== 'light' && { borderColor: '#475569' }]}>
              {theme === 'light' && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <View style={styles.themeTextContainer}>
              <Text style={[styles.themeName, currentTheme === 'dark' && { color: '#fff' }]}>Açık Tema</Text>
              <Text style={[styles.themeDesc, currentTheme === 'dark' && { color: '#64748b' }]}>Standart aydınlık görünüm</Text>
            </View>
          </TouchableOpacity>

          {/* Koyu Tema Seçeneği */}
          <TouchableOpacity 
            style={[styles.themeOption, currentTheme === 'dark' && { borderBottomColor: '#334155' }]}
            onPress={() => setTheme('dark')}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, theme === 'dark' && styles.checkboxSelected, currentTheme === 'dark' && theme !== 'dark' && { borderColor: '#475569' }]}>
              {theme === 'dark' && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <View style={styles.themeTextContainer}>
              <Text style={[styles.themeName, currentTheme === 'dark' && { color: '#fff' }]}>Koyu Tema</Text>
              <Text style={[styles.themeDesc, currentTheme === 'dark' && { color: '#64748b' }]}>Göz yormayan karanlık görünüm</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={[styles.infoText, currentTheme === 'dark' && { color: '#64748b' }]}>
          * Seçtiğiniz tema cihazınızda saklanır ve siz değiştirene kadar korunur.
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
            <Text style={styles.saveButtonText}>Tercihi Kaydet</Text>
          )}
        </TouchableOpacity>
      </View>
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
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 15,
    marginLeft: 4,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  checkboxSelected: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  themeTextContainer: {
    flex: 1,
  },
  themeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  themeDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
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
