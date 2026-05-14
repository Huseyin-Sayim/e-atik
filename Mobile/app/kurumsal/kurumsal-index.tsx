import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Platform, StatusBar, TouchableOpacity, Image } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

const DEFAULT_AVATAR = require('../../assets/images/default-avatar.png');

export default function KurumsalIndexScreen() {
  const [corpName, setCorpName] = useState('...');
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
      
      let fullName = 'Kurumsal Firma';

      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        fullName = (session.name || 'Kurumsal') + (session.surname ? ' ' + session.surname : '');
      }

      if (email) {
        const lowerEmail = email.toLowerCase();
        const savedName = await AsyncStorage.getItem(`userName_${lowerEmail}`);
        const savedSurname = await AsyncStorage.getItem(`userSurname_${lowerEmail}`);
        
        if (savedName) {
          fullName = savedName + (savedSurname ? ' ' + savedSurname : '');
        }
        
        setCorpName(fullName);
        
        const savedPhoto = await AsyncStorage.getItem(`profileImage_${lowerEmail}`);
        setProfileImage(savedPhoto);

        await AsyncStorage.setItem(`userPoints_${lowerEmail}`, '50');
        setPoints(50);
      } else {
        setCorpName(fullName);
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
            <Text style={styles.corpName}>Hoş Geldin,</Text>
            <Text style={styles.corpName}>{corpName}</Text>
          </View>
        </View>
        <View style={styles.pointContainer}>
          <Text style={styles.pointText}>{points}</Text>
          <FontAwesome5 name="coins" size={20} color="#FFD700" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* İçerik buraya eklenecek */}
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  corpName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
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
    backgroundColor: '#e8f5e9',
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#2e7d32',
    lineHeight: 20,
  }
});
