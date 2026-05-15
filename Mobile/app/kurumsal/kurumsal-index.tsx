import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Platform, StatusBar, TouchableOpacity, Image } from 'react-native';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { MapView, Marker, Geojson } from '../../components/MapComponent';
import DatabaseService from '../../database/DatabaseService';
import campusParcels from '../../assets/kampusParsel.json';

const DEFAULT_AVATAR = require('../../assets/images/default-avatar.png');

export default function KurumsalIndexScreen() {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const [corpName, setCorpName] = useState('...');
  const [points, setPoints] = useState(0);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [topBins, setTopBins] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);


  useFocusEffect(
    React.useCallback(() => {
      loadData();
      setupLocation();
    }, [])
  );

  const setupLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: initial.coords.latitude, longitude: initial.coords.longitude });
      }
    } catch (e) {
      console.warn('Konum alınamadı', e);
    }
  };

  useEffect(() => {
    if (topBins.length > 0 && mapRef.current) {
      const topBin = topBins[0];
      const coordinates = [{ latitude: topBin.latitude, longitude: topBin.longitude }];
      
      if (userLocation) {
        coordinates.push({ latitude: userLocation.latitude, longitude: userLocation.longitude });
      }
      
      // Harita bileşeninin hazır olduğundan emin olmak için çok kısa bir gecikme
      setTimeout(() => {
        if (coordinates.length === 1) {
          mapRef.current?.animateToRegion({
            latitude: topBin.latitude,
            longitude: topBin.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }, 800);
        } else {
          mapRef.current?.fitToCoordinates(coordinates, {
            edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
            animated: true,
          });
        }
      }, 800);
    }
  }, [userLocation, topBins]);

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

      // Bildirimleri Çek
      const fetchedBins = await DatabaseService.getBins();
      const mappedBins = fetchedBins.map(b => ({
        id: b.id.toString(),
        name: b.name || 'İsimsiz Kutu',
        fillPercentage: b.predictedFullness || 0,
        latitude: parseFloat(b.latitude),
        longitude: parseFloat(b.longitude),
      }));

      // Doluluk oranına göre büyükten küçüğe sırala ve ilk 4'ünü al
      const sortedBins = mappedBins.sort((a, b) => b.fillPercentage - a.fillPercentage).slice(0, 4);
      setTopBins(sortedBins);

    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    }
  };

  const getPriorityColor = (percentage: number) => {
    if (percentage >= 75) return '#e74c3c'; // Kırmızı (Acil)
    if (percentage >= 40) return '#f39c12'; // Turuncu (Orta)
    return '#27ae60'; // Yeşil (Düşük)
  };

  const getPriorityIcon = (percentage: number) => {
    if (percentage >= 75) return 'alert-circle';
    if (percentage >= 40) return 'warning';
    return 'checkmark-circle';
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
          <FontAwesome5 name="coins" size={20} color="#FFD700" solid />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Öncelikli Bildirimler Listesi</Text>
          <TouchableOpacity onPress={() => router.push('/kurumsal/kurumsal-notifications')}>
            <Ionicons name="chevron-forward-circle" size={28} color="#2e7d32" />
          </TouchableOpacity>
        </View>

        <View style={styles.notificationsContainer}>
          {topBins.map((bin) => (
            <View key={bin.id} style={styles.notificationItem}>
              <View style={styles.priorityIndicator(getPriorityColor(bin.fillPercentage))} />
              <View style={styles.notificationIcon(getPriorityColor(bin.fillPercentage))}>
                <Ionicons name={getPriorityIcon(bin.fillPercentage) as any} size={20} color={getPriorityColor(bin.fillPercentage)} />
              </View>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationText}>
                  Lütfen <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>{bin.name}</Text> konumundaki atık kutusuna gidiniz.
                </Text>
              </View>
              <Text style={[styles.notificationPercentage, { color: getPriorityColor(bin.fillPercentage) }]}>
                %{bin.fillPercentage}
              </Text>
            </View>
          ))}
          {topBins.length === 0 && (
            <Text style={{ textAlign: 'center', color: '#94a3b8', padding: 10 }}>Bildirim bulunamadı.</Text>
          )}
        </View>

        {/* Görev Odak Haritası (Mini Map) */}
        {topBins.length > 0 && (
          <View style={styles.miniMapContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Görev Odak Haritası</Text>
            </View>
            <View style={styles.miniMapWrapper}>
              <MapView
                ref={mapRef}
                style={styles.miniMap}
                showsUserLocation={true}
                initialRegion={{
                  latitude: 38.4553,
                  longitude: 27.2290,
                  latitudeDelta: 0.0135,
                  longitudeDelta: 0.0135,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Geojson 
                  geojson={{
                    ...campusParcels,
                    features: (campusParcels as any).features.filter((f: any) => f.geometry.type !== 'Point')
                  } as any} 
                  strokeColor="#ff7800" 
                  fillColor="rgba(255, 120, 0, 0.1)" 
                  strokeWidth={2} 
                />
                <Marker coordinate={{ latitude: topBins[0].latitude, longitude: topBins[0].longitude }}>
                  <View style={styles.miniPinContainer}>
                    <MaterialCommunityIcons name="trash-can" size={20} color="#fff" />
                  </View>
                </Marker>
              </MapView>
            </View>
          </View>
        )}

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
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  notificationsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    marginBottom: 25,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingRight: 16,
    minHeight: 60,
  },
  priorityIndicator: (color: string) => ({
    width: 4,
    height: '100%',
    backgroundColor: color,
  }),
  notificationIcon: (color: string) => ({
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginRight: 12,
  }),
  notificationContent: {
    flex: 1,
    paddingVertical: 12,
  },
  notificationText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  notificationPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  miniMapContainer: {
    marginBottom: 30,
  },
  miniMapWrapper: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  miniMap: {
    flex: 1,
  },
  miniPinContainer: {
    backgroundColor: '#e74c3c',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 5,
  }
});
