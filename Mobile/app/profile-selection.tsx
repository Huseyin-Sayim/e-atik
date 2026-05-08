import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from '../database/DatabaseService';

export default function ProfileSelectionScreen() {
  const handleSelectProfile = async (type: 'kisisel' | 'kurumsal') => {
    try {
      console.log(`[PROFİL SEÇİMİ] Kullanıcı profili seçti: ${type}`);
      const email = await AsyncStorage.getItem('currentUserEmail');

      if (!email) {
        Alert.alert('Hata', 'Kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        router.replace('/login');
        return;
      }

      // Mevcut oturum varsa (Beni Hatırla seçilmişse) oturumu güncelle
      const sessionStr = await AsyncStorage.getItem('userSession');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        session.profileType = type;
        await AsyncStorage.setItem('userSession', JSON.stringify(session));
      }

      try {
        await AsyncStorage.setItem(`profileType_${email}`, type);
        
        await DatabaseService.updateUser(email, {
          profileType: type,
          isFirstLogin: false
        });
      } catch (err) {
        console.warn('Backend update failed, but proceeding to route:', err);
      }

      // Profil seçimine göre yönlendirme (Artık her ikisi de ortak Tabs yapısını kullanıyor)
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Profil kaydedilirken hata:', error);
      Alert.alert('Hata', 'Profil seçimi kaydedilirken bir sorun oluştu.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Hoş Geldiniz!</Text>
          <Text style={styles.subtitle}>
            Uygulamayı kullanmaya başlamadan önce lütfen hesap türünüzü seçin.
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          <TouchableOpacity
            style={[styles.card, styles.personalCard]}
            onPress={() => handleSelectProfile('kisisel')}
            activeOpacity={0.8}
          >
            <View style={styles.iconPlaceholder}>
              <Text style={styles.iconText}>👤</Text>
            </View>
            <Text style={styles.cardTitle}>Kişisel Hesap</Text>
            <Text style={styles.cardDescription}>
              Bireysel kullanıcılar için standart hesap türü.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, styles.corporateCard]}
            onPress={() => handleSelectProfile('kurumsal')}
            activeOpacity={0.8}
          >
            <View style={styles.iconPlaceholder}>
              <Text style={styles.iconText}>🏢</Text>
            </View>
            <Text style={styles.cardTitle}>Kurumsal Hesap</Text>
            <Text style={styles.cardDescription}>
              İşletmeler ve kurumlar için özel hesap türü.
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  cardsContainer: {
    width: '100%',
    gap: 20,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  personalCard: {
    borderColor: 'rgba(46, 125, 50, 0.2)', // Hafif yeşil kenarlık
  },
  corporateCard: {
    borderColor: 'rgba(21, 101, 192, 0.2)', // Hafif mavi kenarlık
  },
  iconPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 32,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
