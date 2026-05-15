import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Platform, StatusBar, TouchableOpacity, Image } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

const DEFAULT_AVATAR = require('../../assets/images/default-avatar.png');

const RECENT_TRANSACTIONS = [
  { id: '1', title: 'Akıllı Kova - Plastik Atık', type: 'qr', points: '+10', date: 'Bugün, 14:30' },
  { id: '2', title: 'Market İadesi - Cam Şişe', type: 'market', points: '+5', date: 'Dün, 09:15' },
  { id: '3', title: 'Akıllı Kova - Kağıt Atık', type: 'qr', points: '+15', date: '12 Mayıs, 16:45' },
  { id: '4', title: 'Market İadesi - Pil', type: 'market', points: '+20', date: '10 Mayıs, 11:20' },
  { id: '5', title: 'Akıllı Kova - Genel Atık', type: 'qr', points: '+5', date: '08 Mayıs, 13:10' },
  { id: '6', title: 'Market İadesi - Plastik Poşet', type: 'market', points: '+5', date: '05 Mayıs, 18:00' },
];


export default function KisiselIndexScreen() {
  const [userName, setUserName] = useState('...');
  const [points, setPoints] = useState(0);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const email = await AsyncStorage.getItem('currentUserEmail');
      const sessionStr = await AsyncStorage.getItem('userSession');
      
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        setUserName(session.name || 'Kullanıcı');
      }

      if (email) {
        const lowerEmail = email.toLowerCase();
        const savedName = await AsyncStorage.getItem(`userName_${lowerEmail}`);
        if (savedName) setUserName(savedName);
        
        const savedPhoto = await AsyncStorage.getItem(`profileImage_${lowerEmail}`);
        setProfileImage(savedPhoto); // null ise null set eder, eskiyi temizler

        const savedPoints = await AsyncStorage.getItem(`userPoints_${lowerEmail}`);
        if (savedPoints) {
          setPoints(parseInt(savedPoints));
        } else {
          // Varsayılan başlangıç puanı
          await AsyncStorage.setItem(`userPoints_${lowerEmail}`, '50');
          setPoints(50);
        }
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
            <Image 
              key={profileImage || 'default'}
              source={profileImage ? { uri: profileImage } : DEFAULT_AVATAR} 
              style={styles.profileIcon} 
              resizeMode="cover" 
            />
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
        
        <View style={styles.transactionsContainer}>
          <Text style={styles.sectionTitle}>Son İşlemler</Text>
          
          <View style={styles.transactionsList}>
            {RECENT_TRANSACTIONS.map((item, index) => (
              <View key={item.id} style={[styles.transactionItem, index === RECENT_TRANSACTIONS.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[styles.transactionIconContainer, { backgroundColor: item.type === 'qr' ? '#e8f5e9' : '#e3f2fd' }]}>
                  <Ionicons 
                    name={item.type === 'qr' ? 'qr-code-outline' : 'cart-outline'} 
                    size={22} 
                    color={item.type === 'qr' ? '#2e7d32' : '#1565c0'} 
                  />
                </View>
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionName}>{item.title}</Text>
                  <Text style={styles.transactionDate}>{item.date}</Text>
                </View>
                <Text style={styles.transactionPoints}>{item.points} Puan</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={24} color="#f1c40f" />
          <View style={styles.tipTextContainer}>
            <Text style={styles.tipTitle}>Küçük Bilgi:</Text>
            <Text style={styles.tipText}>
              Gereksiz fişleri prizden çekerek ayda ortalama 5 ağacı kurtarabilirsin!
            </Text>
          </View>
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
  tipTextContainer: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#d4ac0d',
    marginBottom: 2,
  },
  tipText: {
    fontSize: 13,
    color: '#9a7d0a',
    lineHeight: 18,
  },
  transactionsContainer: {
    marginBottom: 25,
  },
  transactionsList: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  transactionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  transactionPoints: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2e7d32',
  }
});
