import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Platform, StatusBar, TouchableOpacity, Image } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function KisiselIndexScreen() {
  const [userName, setUserName] = useState('...');
  const [points, setPoints] = useState(125);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const email = await AsyncStorage.getItem('currentUserEmail');
      const sessionStr = await AsyncStorage.getItem('userSession');
      
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        setUserName(session.name || 'Kullanıcı');
      }

      if (email) {
        const savedPhoto = await AsyncStorage.getItem(`profileImage_kisisel_${email}`);
        if (savedPhoto) setProfileImage(savedPhoto);
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.profileIconContainer}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileIcon} resizeMode="cover" />
            ) : (
              /* SAF ÇİZİM DEFAULT PP (RESİM VEYA İKON BAĞIMLILIĞI YOK) */
              <View style={styles.drawnAvatarContainer}>
                <View style={styles.avatarHead} />
                <View style={styles.avatarBody} />
              </View>
            )}
          </TouchableOpacity>
          <View>
            <Text style={styles.userName}>Hoş Geldin,</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
        </View>
        <View style={styles.pointContainer}>
          <Text style={styles.pointText}>{points}</Text>
          <FontAwesome5 name="coins" size={20} color="#FFD700" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Neler Yapabilirsin?</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionCard}>
            <View style={[styles.actionIcon, { backgroundColor: '#e8f5e9' }]}>
              <Ionicons name="qr-code-outline" size={28} color="#2e7d32" />
            </View>
            <Text style={styles.actionLabel}>Kova Tara</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard}>
            <View style={[styles.actionIcon, { backgroundColor: '#e3f2fd' }]}>
              <Ionicons name="map-outline" size={28} color="#1565c0" />
            </View>
            <Text style={styles.actionLabel}>Haritaya Bak</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={24} color="#f1c40f" />
          <Text style={styles.tipText}>
            Gereksiz fişleri prizden çekerek ayda ortalama 5 ağacı kurtarabilirsin!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIconContainer: {
    marginRight: 12,
  },
  profileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#eee',
  },
  drawnAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#95a5a6',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
  },
  avatarHead: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e0e0e0',
    marginTop: 6,
  },
  avatarBody: {
    width: 28,
    height: 18,
    backgroundColor: '#e0e0e0',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    marginTop: 2,
  },
  welcomeText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  pointContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  pointText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 6,
    color: '#2c3e50',
  },
  container: {
    padding: 20,
  },
  scoreCard: {
    backgroundColor: '#2e7d32',
    borderRadius: 24,
    padding: 20,
    marginBottom: 25,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  scoreTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  scoreValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    marginVertical: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  progressText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 25,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f2f6',
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#fef9e7',
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#9a7d0a',
    lineHeight: 20,
  }
});
