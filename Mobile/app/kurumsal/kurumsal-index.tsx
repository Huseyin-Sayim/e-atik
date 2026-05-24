import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Platform, StatusBar, TouchableOpacity, Image, Modal, Alert, RefreshControl } from 'react-native';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { MapView, Marker, Geojson } from '../../components/MapComponent';
import DatabaseService from '../../database/DatabaseService';
import campusParcels from '../../assets/kampusParsel.json';

const DEFAULT_AVATAR = require('../../assets/images/default-avatar.png');

function isPointInPolygon(latitude: number, longitude: number, polygonCoordinates: any[]) {
  let x = longitude, y = latitude;
  let inside = false;
  if (!polygonCoordinates || polygonCoordinates.length === 0) return false;
  let ring = polygonCoordinates[0];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    let xi = ring[i][0], yi = ring[i][1];
    let xj = ring[j][0], yj = ring[j][1];
    let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export default function KurumsalIndexScreen() {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const [corpName, setCorpName] = useState('...');
  const [points, setPoints] = useState(0);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [topBins, setTopBins] = useState<any[]>([]);
  const topBinsRef = useRef<any[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>({ latitude: 38.4595, longitude: 27.2287 });
  const [isMapActive, setIsMapActive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('light');

  React.useEffect(() => {
    // Profil ve Atık Kutusu abonelikleri
    const unsubProfile = DatabaseService.subscribeToProfilePhoto((newPhoto) => {
      setProfileImage(newPhoto);
    });
    const unsubBins = DatabaseService.subscribeToBins(() => {
      loadData();
    });
    const unsubTheme = DatabaseService.subscribeToTheme((theme) => {
      setCurrentTheme(theme);
    });

    // WebSocket Bağlantısı (Mini Harita İçin)
    const wsUrl = DatabaseService.getWsUrl();
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => console.log('✅ WebSocket Bağlantısı Kuruldu (Mini Harita)');
    ws.onerror = (e) => console.warn('WebSocket Hatası (Mini Harita):', e);
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'wasteRequestCreated' || payload.type === 'wasteRequestStatusChanged') {
          console.log('🔄 Yeni evsel atık işlemi/talebi algılandı, veriler yenileniyor...');
          loadData();
        }
      } catch (err) {
        // Diğer mesaj tiplerini yoksay
      }
    };
    wsRef.current = ws;

    return () => {
      unsubProfile();
      unsubBins();
      unsubTheme();
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
      let isActive = true;
      let intervalId: any = null;

      const setupLiveLocation = async () => {
        try {
          const staticLoc = { latitude: 38.4595, longitude: 27.2287 };
          if (isActive) {
            setUserLocation(staticLoc);
            
            // WebSocket üzerinden canlı konumu sunucuya yayınla
            const sendUpdate = () => {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                const currentBins = topBinsRef.current;
                const target = (currentBins && currentBins.length > 0) ? {
                  id: currentBins[0].id,
                  name: currentBins[0].name,
                  latitude: currentBins[0].latitude,
                  longitude: currentBins[0].longitude,
                  isRequest: currentBins[0].isRequest || false
                } : null;

                wsRef.current.send(JSON.stringify({
                  type: 'locationUpdate',
                  staffId: 'kurumsal_personel_1',
                  latitude: staticLoc.latitude,
                  longitude: staticLoc.longitude,
                  target: target
                }));
              }
            };

            sendUpdate();
            intervalId = setInterval(sendUpdate, 4000); // Her 4 saniyede bir kalp atışı gönder
          }
        } catch (e) {
          console.warn('Konum sabitleme hatası', e);
        }
      };

      setupLiveLocation();

      return () => {
        isActive = false;
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }, [])
  );

  const fetchRouteForMiniMap = async (targetBin: any, loc: any) => {
    if (!loc || !targetBin) {
      setRouteCoordinates([]);
      return;
    }
    try {
      const url = `https://router.project-osrm.org/route/v1/foot/${loc.longitude},${loc.latitude};${targetBin.longitude},${targetBin.latitude}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const json = await response.json();
      if (json.routes && json.routes.length > 0) {
        const coords = json.routes[0].geometry.coordinates.map((c: any[]) => ({
          latitude: c[1],
          longitude: c[0]
        }));
        setRouteCoordinates(coords);
      } else {
        setRouteCoordinates([{ latitude: loc.latitude, longitude: loc.longitude }, { latitude: targetBin.latitude, longitude: targetBin.longitude }]);
      }
    } catch (e) {
      console.warn("OSRM Route Error Mini Map:", e);
    }
  };

  useEffect(() => {
    if (topBins.length > 0 && userLocation) {
      fetchRouteForMiniMap(topBins[0], userLocation);
    }
  }, [topBins, userLocation]); // Personel hareket ettikçe rotayı canlı olarak yeniden hesapla!

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

  useEffect(() => {
    if (topBins.length === 0 && userLocation && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 800);
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

        const savedPoints = await AsyncStorage.getItem(`userPoints_${lowerEmail}`);
        if (savedPoints) {
          setPoints(parseInt(savedPoints));
        } else {
          await AsyncStorage.setItem(`userPoints_${lowerEmail}`, '0');
          setPoints(0);
        }

        // Backend'den en güncel profil bilgilerini çekip eşitle (Web ile senkronizasyon)
        const currentUser = await DatabaseService.getCurrentUser();
        if (currentUser) {
          if (currentUser.wallet !== undefined) {
            const actualBalance = currentUser.wallet ? currentUser.wallet.balance : 0;
            setPoints(actualBalance);
            await AsyncStorage.setItem(`userPoints_${lowerEmail}`, actualBalance.toString());
          }

          if (currentUser.name) {
            const fullCorpName = currentUser.name + (currentUser.surname ? ' ' + currentUser.surname : '');
            setCorpName(fullCorpName);
            await AsyncStorage.setItem(`userName_${lowerEmail}`, currentUser.name);
            if (currentUser.surname) {
              await AsyncStorage.setItem(`userSurname_${lowerEmail}`, currentUser.surname);
            }
          }
          if (currentUser.profileImage) {
            setProfileImage(currentUser.profileImage);
            DatabaseService.notifyProfilePhotoChanged(currentUser.profileImage);
            if (Platform.OS !== 'web') {
              try {
                await AsyncStorage.setItem(`profileImage_${lowerEmail}`, currentUser.profileImage);
                const userId = await AsyncStorage.getItem('currentUserId');
                if (userId) {
                  await AsyncStorage.setItem(`profileImage_${userId}`, currentUser.profileImage);
                }
              } catch (e) {
                console.warn('[STORAGE] Profile image cache failed:', e);
              }
            }
          } else {
            setProfileImage(null);
            DatabaseService.notifyProfilePhotoChanged(null);
            if (Platform.OS !== 'web') {
              try {
                await AsyncStorage.removeItem(`profileImage_${lowerEmail}`);
                const userId = await AsyncStorage.getItem('currentUserId');
                if (userId) {
                  await AsyncStorage.removeItem(`profileImage_${userId}`);
                }
              } catch (e) {
                console.warn('[STORAGE] Profile image remove failed:', e);
              }
            }
          }
        }
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

      // Evsel Atık Taleplerini Çek ve Haritala
      let mappedRequests: any[] = [];
      try {
        const fetchedRequests = await DatabaseService.getWasteRequests();
        const activeRequests = fetchedRequests.filter(
          (req: any) => req.status === 'PENDING' || req.status === 'ON_ROUTE'
        );
        mappedRequests = activeRequests.map((req: any) => {
          let catName = 'Evsel Atık';
          if (req.wasteType === 'DOMESTIC') catName = 'Organik Atık';
          else if (req.wasteType === 'ELECTRONIC') catName = 'Elektronik Atık';
          else if (req.wasteType === 'PLASTIC') catName = 'Ambalaj Atığı';

          return {
            id: 'req_' + req.id,
            dbId: req.id,
            name: `${catName} (${req.user ? req.user.name : 'Vatandaş'})`,
            note: req.note,
            userFullName: req.user ? `${req.user.name} ${req.user.surname || ''}` : 'Kullanıcı',
            fillPercentage: 100, // En yüksek öncelik
            latitude: parseFloat(req.latitude),
            longitude: parseFloat(req.longitude),
            isRequest: true,
            wasteType: req.wasteType,
            status: req.status,
            createdAt: req.createdAt || new Date().toISOString()
          };
        });
      } catch (reqErr) {
        console.warn('Evsel atıklar çekilirken hata oluştu, devam ediliyor:', reqErr);
      }

      // --- YENİ ALGORİTMA SIRALAMA MANTIĞI & BÖLGE FİLTRELEME ---
      const selectedRegionId = await AsyncStorage.getItem('@staff_selected_region');
      
      let filteredBins = mappedBins;

      if (selectedRegionId) {
        const selectedFeature = campusParcels.features.find((f: any) => f.id === selectedRegionId);
        if (selectedFeature) {
          const polyCoords = selectedFeature.geometry.coordinates;
          filteredBins = mappedBins.filter(bin => isPointInPolygon(bin.latitude, bin.longitude, polyCoords));
        }
      }

      // 1. Evsel atık taleplerini ilk gelen (en eski) en üstte kalacak şekilde sırala (Bölgeden bağımsız, tüm talepler gösterilir)
      const domesticRequests = [...mappedRequests].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // 2. Çöp kutularını doluluk oranına göre azalan (yüksekten düşüğe) sırala
      const sortedBins = [...filteredBins].sort((a, b) => b.fillPercentage - a.fillPercentage);

      // Nihai listeyi birleştir (Önce bölge atık kutuları, sonra evsel atık talepleri)
      let combined: any[] = [...sortedBins, ...domesticRequests];

      // Öncelikli bildirimler listesi - Panoda en fazla 4 bildirim gösterilir
      const sliced = combined.slice(0, 4);
      setTopBins(sliced);
      topBinsRef.current = sliced;

    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleItemPress = async (bin: any) => {
    if (bin.isRequest) {
      setSelectedItem(bin);
      setModalVisible(true);
    } else {
      // Normal atık kutusuna haritada odaklan ve rotayı çiz
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: bin.latitude,
          longitude: bin.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 800);
      }
      if (userLocation) {
        await fetchRouteForMiniMap(bin, userLocation);
      }
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
    <SafeAreaView style={[styles.safeArea, currentTheme === 'dark' && { backgroundColor: '#0f172a' }]}>
      <StatusBar barStyle={currentTheme === 'dark' ? "light-content" : "dark-content"} />
      
      <View style={[styles.header, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
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
            <Text style={[styles.corpName, currentTheme === 'dark' && { color: '#94a3b8' }]}>Hoş Geldin,</Text>
            <Text style={[styles.corpName, currentTheme === 'dark' && { color: '#fff' }]}>{corpName}</Text>
          </View>
        </View>
        <View style={[styles.pointContainer, currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569' }]}>
          <Text style={[styles.pointText, currentTheme === 'dark' && { color: '#fff' }]}>{points}</Text>
          <FontAwesome5 name="coins" size={20} color="#FFD700" solid />
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.container} 
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isMapActive}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={['#2e7d32']} 
            tintColor="#2e7d32" 
          />
        }
      >
        
        {/* Yapılan Son İşlemleri Gör Buton Kartı */}
        <TouchableOpacity 
          style={[styles.transactionsButtonCard, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }]} 
          onPress={() => router.push('/kurumsal/kurumsal-transactions' as any)}
        >
          <View style={styles.transactionsButtonLeft}>
            <View style={[styles.transactionsIconBg, currentTheme === 'dark' && { backgroundColor: '#065f46' }]}>
              <MaterialCommunityIcons name="history" size={24} color={currentTheme === 'dark' ? '#34d399' : '#2e7d32'} />
            </View>
            <View>
              <Text style={[styles.transactionsButtonTitle, currentTheme === 'dark' && { color: '#fff' }]}>Yapılan Son İşlemler</Text>
              <Text style={[styles.transactionsButtonSubtitle, currentTheme === 'dark' && { color: '#94a3b8' }]}>Firma faaliyet geçmişinizi görüntüleyin</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={currentTheme === 'dark' ? '#fff' : '#64748b'} />
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, currentTheme === 'dark' && { color: '#fff' }]}>Öncelikli Bildirimler Listesi</Text>
          <TouchableOpacity onPress={() => router.push('/kurumsal/kurumsal-notifications')}>
            <Ionicons name="chevron-forward-circle" size={28} color="#2e7d32" />
          </TouchableOpacity>
        </View>

        <View style={styles.notificationsContainer}>
          {topBins.map((bin) => {
            const isReq = bin.isRequest;
            const priorityColor = isReq ? '#2563eb' : getPriorityColor(bin.fillPercentage);
            const iconName = isReq ? 'home' : getPriorityIcon(bin.fillPercentage);
            
            return (
              <TouchableOpacity 
                key={bin.id} 
                style={[styles.notificationItem, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}
                onPress={() => handleItemPress(bin)}
                activeOpacity={0.7}
              >
                <View style={styles.priorityIndicator(priorityColor)} />
                <View style={styles.notificationIcon(priorityColor)}>
                  <Ionicons name={iconName as any} size={20} color={priorityColor} />
                </View>
                <View style={styles.notificationContent}>
                  {isReq ? (
                    <Text style={[styles.notificationText, currentTheme === 'dark' && { color: '#94a3b8' }]}>
                      <Text style={{ fontWeight: 'bold', color: '#2563eb' }}>[EVSEL ATIK] </Text>
                      <Text>Lütfen </Text>
                      <Text style={{ fontWeight: 'bold', color: currentTheme === 'dark' ? '#fff' : '#1e293b' }}>{bin.name}</Text>
                      <Text> konumundaki atık talebine yol alınız.</Text>
                    </Text>
                  ) : (
                    <Text style={[styles.notificationText, currentTheme === 'dark' && { color: '#94a3b8' }]}>
                      <Text>Lütfen </Text>
                      <Text style={{ fontWeight: 'bold', color: currentTheme === 'dark' ? '#fff' : '#1e293b' }}>{bin.name}</Text>
                      <Text> konumundaki atık kutusuna gidiniz.</Text>
                    </Text>
                  )}
                </View>
                {isReq ? (
                  <Text style={[styles.notificationPercentage, { color: '#2563eb', fontSize: 11, fontWeight: 'bold' }]}>
                    TALEP
                  </Text>
                ) : (
                  <Text style={[styles.notificationPercentage, { color: priorityColor }]}>
                    %{bin.fillPercentage}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
          {topBins.length === 0 && (
            <Text style={{ textAlign: 'center', color: '#94a3b8', padding: 10 }}>Bildirim bulunamadı.</Text>
          )}
        </View>

        {/* Görev Odak Haritası (Mini Map) - Her zaman görünür */}
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
                scrollEnabled={isMapActive}
                zoomEnabled={isMapActive}
                pitchEnabled={isMapActive}
                rotateEnabled={isMapActive}
                campusParcels={{
                  ...campusParcels,
                  features: (campusParcels as any).features.filter((f: any) => f.geometry.type !== 'Point')
                }}
                bins={topBins.length > 0 ? [topBins[0]] : []}
                staffLocation={userLocation}
                routeCoordinates={routeCoordinates}
                routeColor={topBins.length > 0 && topBins[0].isRequest ? 'blue' : 'red'}
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
                
                {/* En yüksek öncelikli bildirim/talep noktası */}
                {topBins.length > 0 && (
                  <Marker coordinate={{ latitude: topBins[0].latitude, longitude: topBins[0].longitude }}>
                    <View style={[
                      styles.miniPinContainer, 
                      topBins[0].isRequest && { backgroundColor: '#2563eb' }
                    ]}>
                      <MaterialCommunityIcons 
                        name={topBins[0].isRequest ? "home-map-marker" : "trash-can"} 
                        size={20} 
                        color="#fff" 
                      />
                    </View>
                  </Marker>
                )}

                {/* Personelin anlık konumu */}
                {userLocation && (
                  <Marker coordinate={userLocation}>
                    <View style={styles.staffMiniPinContainer}>
                      <MaterialCommunityIcons name="account-navigation" size={20} color="#fff" />
                    </View>
                  </Marker>
                )}
              </MapView>

              {/* Dokun-Odaklan Aktivasyon Katmanı */}
              {!isMapActive && (
                <TouchableOpacity 
                  activeOpacity={0.9}
                  style={styles.mapOverlay}
                  onPress={() => setIsMapActive(true)}
                >
                  <Ionicons name="finger-print" size={32} color="#fff" style={{ marginBottom: 8 }} />
                  <Text style={styles.mapOverlayText}>Haritayı İncelemek İçin Dokunun</Text>
                  <Text style={styles.mapOverlaySubtext}>Sayfa kaydırması geçici olarak durdurulur</Text>
                </TouchableOpacity>
              )}

              {/* İncelemeyi Bitir Yüzen Rozeti */}
              {isMapActive && (
                <TouchableOpacity 
                  style={styles.mapActiveBadge}
                  onPress={() => setIsMapActive(false)}
                >
                  <Ionicons name="close-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.mapActiveBadgeText}>İncelemeyi Bitir</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

      </ScrollView>

      {/* Detay Popup Modal (Evsel Atık Talepleri İçin) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, currentTheme === 'dark' && { color: '#fff' }]}>Evsel Atık Talebi</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={currentTheme === 'dark' ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={[styles.wasteDetailCard, currentTheme === 'dark' && { backgroundColor: '#0f172a', borderColor: '#334155' }]}>
                  <View style={[styles.wasteIconBg, { backgroundColor: '#eff6ff' }]}>
                    <Ionicons 
                      name={
                        selectedItem.wasteType === 'ELECTRONIC' ? 'hardware-chip-outline' :
                        selectedItem.wasteType === 'PLASTIC' ? 'cube-outline' : 'leaf-outline'
                      } 
                      size={32} 
                      color="#2563eb" 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.wasteCategoryLabel, currentTheme === 'dark' && { color: '#64748b' }]}>Atık Kategorisi</Text>
                    <Text style={[styles.wasteCategoryValue, currentTheme === 'dark' && { color: '#fff' }]}>
                      {selectedItem.wasteType === 'DOMESTIC' ? 'Mutfak / Organik Atık' :
                       selectedItem.wasteType === 'ELECTRONIC' ? 'Elektronik Evsel Atık' :
                       selectedItem.wasteType === 'PLASTIC' ? 'Ambalaj (Kağıt, Plastik)' : 'Genel Evsel Atık'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoSection}>
                  <Text style={[styles.infoSectionTitle, currentTheme === 'dark' && { color: '#64748b' }]}>Bildiren Vatandaş</Text>
                  <Text style={[styles.infoSectionValue, currentTheme === 'dark' && { color: '#fff' }]}>{selectedItem.userFullName}</Text>
                </View>

                <View style={styles.infoSection}>
                  <Text style={[styles.infoSectionTitle, currentTheme === 'dark' && { color: '#64748b' }]}>Açık Adres</Text>
                  <Text style={[styles.infoSectionValue, currentTheme === 'dark' && { color: '#fff' }]}>{selectedItem.note || 'Belirtilmedi'}</Text>
                </View>

                <View style={styles.infoSection}>
                  <Text style={[styles.infoSectionTitle, currentTheme === 'dark' && { color: '#64748b' }]}>Durum</Text>
                  <View style={[styles.statusBadge, { backgroundColor: selectedItem.status === 'ON_ROUTE' ? '#fffbeb' : '#f0fdf4' }, currentTheme === 'dark' && { backgroundColor: selectedItem.status === 'ON_ROUTE' ? '#451a03' : '#064e3b' }]}>
                    <Text style={[styles.statusBadgeText, { color: selectedItem.status === 'ON_ROUTE' ? '#d97706' : '#16a34a' }, currentTheme === 'dark' && { color: selectedItem.status === 'ON_ROUTE' ? '#f59e0b' : '#34d399' }]}>
                      {selectedItem.status === 'ON_ROUTE' ? 'Yolda (Ekipler Yönlendirildi)' : 'Beklemede'}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  {selectedItem.status !== 'ON_ROUTE' && (
                    <TouchableOpacity 
                      style={styles.routeBtn}
                      onPress={async () => {
                        try {
                          await DatabaseService.updateWasteRequestStatus(selectedItem.dbId, 'ON_ROUTE');
                          await loadData();
                          if (userLocation) {
                            await fetchRouteForMiniMap(selectedItem, userLocation);
                          }
                          setModalVisible(false);
                          Alert.alert('Rota Çizildi', 'Talep konumuna en kısa yaya rotası belirlendi. Haritayı inceleyebilirsiniz.');
                        } catch (err: any) {
                          Alert.alert('Hata', err.message || 'Durum güncellenirken hata oluştu.');
                        }
                      }}
                    >
                      <Ionicons name="navigate" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.btnText}>Yol Tarifi Al (Rota Çiz)</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity 
                    style={styles.collectBtn}
                    onPress={async () => {
                      try {
                        await DatabaseService.updateWasteRequestStatus(selectedItem.dbId, 'COLLECTED');
                        await loadData();
                        setModalVisible(false);
                        Alert.alert('Tebrikler!', 'Evsel atık başarıyla toplandı. Bildirim listesinden kaldırıldı.');
                      } catch (err: any) {
                        Alert.alert('Hata', err.message || 'Toplama işlemi tamamlanırken hata oluştu.');
                      }
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Atığı Topladım (Tamamla)</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    height: 320,
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
  },
  staffMiniPinContainer: {
    backgroundColor: '#16a34a',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 5,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  mapOverlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  mapOverlaySubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'System',
  },
  mapActiveBadge: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d32f2f',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  mapActiveBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  transactionsButtonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  transactionsButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionsIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionsButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  transactionsButtonSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 15,
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  modalBody: {
    marginBottom: 20,
  },
  wasteDetailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    gap: 15,
  },
  wasteIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wasteCategoryLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  wasteCategoryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 2,
  },
  infoSection: {
    marginBottom: 15,
  },
  infoSectionTitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 6,
  },
  infoSectionValue: {
    fontSize: 15,
    color: '#1e293b',
    lineHeight: 22,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalActions: {
    marginTop: 20,
    gap: 12,
  },
  routeBtn: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
  },
  collectBtn: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  }
});
