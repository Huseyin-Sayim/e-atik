import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Platform, StatusBar, TouchableOpacity, Image, Modal, Alert, RefreshControl, TextInput, Pressable } from 'react-native';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { MapView, Marker, Geojson } from '../../components/MapComponent';
import DatabaseService from '../../database/DatabaseService';
import { useBinFullnessLive } from '../../hooks/useBinFullnessLive';
import { toFillPercentage } from '../../utils/fullness';
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

const WASTE_CATEGORIES = [
  { name: 'Plastik', icon: 'water-outline', color: '#06b6d4' },
  { name: 'Kağıt & Karton', icon: 'document-text-outline', color: '#facc15' },
  { name: 'Cam', icon: 'wine-outline', color: '#10b981' },
  { name: 'Metal', icon: 'cog-outline', color: '#64748b' },
  { name: 'Ahşap', icon: 'hammer-outline', color: '#a855f7' },
  { name: 'Elektronik', icon: 'hardware-chip-outline', color: '#6366f1' },
  { name: 'Atık Yağ', icon: 'funnel-outline', color: '#d97706' },
  { name: 'Organik', icon: 'leaf-outline', color: '#84cc16' },
  { name: 'Tekstil', icon: 'shirt-outline', color: '#ec4899' },
  { name: 'Lastik', icon: 'ellipse-outline', color: '#4b5563' },
  { name: 'Diğer', icon: 'trash-outline', color: '#94a3b8' },
];

export default function KurumsalIndexScreen() {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const [corpName, setCorpName] = useState('...');
  const [corpEmail, setCorpEmail] = useState('');
  const [points, setPoints] = useState(0);
  const [coinTooltipVisible, setCoinTooltipVisible] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [wasteRequests, setWasteRequests] = useState<any[]>([]);
  const [bins, setBins] = useState<any[]>([]);
  const [topBins, setTopBins] = useState<any[]>([]);
  const topBinsRef = useRef<any[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>({ latitude: 38.4595, longitude: 27.2287 });
  const [isMapActive, setIsMapActive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [earnedCoins, setEarnedCoins] = useState('');
  const [wasteWeight, setWasteWeight] = useState('');
  const [currentTheme, setCurrentTheme] = useState('light');
  const [journeyModalVisible, setJourneyModalVisible] = useState(false);
  const [journeyStats, setJourneyStats] = useState<any[]>([]);
  const [categoryDetailVisible, setCategoryDetailVisible] = useState(false);
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<any>(null);
  const [wasteItems, setWasteItems] = useState<any[]>([]);

  useBinFullnessLive(topBins, setTopBins, {
    selectedBin: selectedItem,
    onSelectedBinChange: setSelectedItem,
  });

  useEffect(() => {
    topBinsRef.current = topBins;
  }, [topBins]);

  // Calculate statistics when transactions change
  useEffect(() => {
    // Logic placeholder based on requirement
  }, []);

  const getStandardLiters = (itemName: string): number => {
    const name = itemName.toLowerCase();
    if (name.includes('plastik kapak')) return 0.1;
    if (name.includes('pet şişe')) return 0.5;
    if (name.includes('cam şişe') || name.includes('cam kavanoz')) return 1.0;
    if (name.includes('naylon poşet')) return 0.2;
    if (name.includes('metal kutu')) return 0.3;
    if (name.includes('karton') || name.includes('kağıt')) return 2.0;
    if (name.includes('pil')) return 0.05;
    if (name.includes('atık lastik')) return 50.0;
    if (name.includes('tekstil')) return 3.0;
    if (name.includes('ahşap')) return 5.0;
    if (name.includes('bitkisel yağ')) return 1.0;
    if (name.includes('e-atık') || name.includes('floresan')) return 2.0;
    return 1.0;
  };

  const matchCategory = (statName: string, wItemName: string) => {
    const sName = statName.toLowerCase();
    const wName = wItemName.toLowerCase();
    
    if (sName === wName) return true;
    if (sName.includes('organik') && wName.includes('organik')) return true;
    if (sName.includes('elektronik') && wName.includes('elektronik')) return true;
    if (sName.includes('plastik') && (wName.includes('plastik') || wName.includes('ambalaj'))) return true;
    if (sName.includes('ambalaj') && (wName.includes('plastik') || wName.includes('ambalaj'))) return true;
    if (sName.includes('cam') && wName.includes('cam')) return true;
    if (sName.includes('kağıt') && wName.includes('kağıt')) return true;
    if (sName.includes('metal') && wName.includes('metal')) return true;
    if (sName.includes('yağ') && wName.includes('yağ')) return true;
    
    return false;
  };

  const calculateJourneyStats = (txs: any[]) => {
    const stats: Record<string, { volume: number; coins: number; items: Record<string, { count: number; volume: number }> }> = {};
    
    txs.forEach(tx => {
      if (tx.type !== 'EARNED') return;
      const rawDesc = tx.description || '';
      
      let formattedDesc = rawDesc;
      if (rawDesc === 'QR Kod Tarama Ödülü' || rawDesc === 'Geri Dönüşüm Ödülü' || rawDesc === 'Atık Dönüşüm Ödülü' || rawDesc === 'Atık Toplama/Dönüşüm İşlemi') {
        switch (tx.amount) {
          case 2: formattedDesc = 'Plastik Kapak Geri Dönüştürme Ödülü'; break;
          case 3: formattedDesc = 'Kağıt / Naylon Poşet Geri Dönüştürme Ödülü'; break;
          case 4: formattedDesc = 'Karton / Cam Kavanoz Geri Dönüştürme Ödülü'; break;
          case 5: formattedDesc = 'Pet Şişe / Geri Dönüştürme Ödülü'; break;
          case 7: formattedDesc = 'Metal Kutu Geri Dönüştürme Ödülü'; break;
          case 8: formattedDesc = 'Cam Şişe Geri Dönüştürme Ödülü'; break;
          case 10: formattedDesc = 'Atık Lastik Geri Dönüştürme Ödülü'; break;
          case 12: formattedDesc = 'Tekstil Geri Dönüştürme Ödülü'; break;
          case 15: formattedDesc = 'Pil / Ahşap Geri Dönüştürme Ödülü'; break;
          case 20: formattedDesc = 'Bitkisel Yağ Geri Dönüştürme Ödülü'; break;
          case 50: formattedDesc = 'E-Atık Geri Dönüştürme Ödülü'; break;
          default: formattedDesc = 'Atık Dönüşüm Ödülü';
        }
      } else {
        formattedDesc = rawDesc.replace(/\s*\((qr|barkod)\s*\|\s*[^)]+\)/g, '').replace(/\s*\(qr\)/g, '').trim();
      }
      
      let category = '';
      let volume = 0;
      let itemLabel = '';

      if (rawDesc.includes('Evsel Atık') || formattedDesc.includes('Evsel Atık')) {
        volume = 5.0;
        const kgMatch = rawDesc.match(/(\d+(\.\d+)?)kg/) || formattedDesc.match(/(\d+(\.\d+)?)kg/);
        if (kgMatch && kgMatch[1]) {
          volume = parseFloat(kgMatch[1]);
        }
        
        category = 'Karışık Evsel';
        itemLabel = 'Evsel Atık';
        if (rawDesc.includes('DOMESTIC') || rawDesc.includes('organic') || rawDesc.includes('Organik')) {
          category = 'Organik';
          itemLabel = 'Organik Atık';
        }
        if (rawDesc.includes('ELECTRONIC') || rawDesc.includes('electronic') || rawDesc.includes('Elektronik')) {
          category = 'Elektronik';
          itemLabel = 'Elektronik Atık';
        }
        if (rawDesc.includes('PLASTIC') || rawDesc.includes('packaging') || rawDesc.includes('Ambalaj') || rawDesc.includes('Plastik')) {
          category = 'Plastik';
          itemLabel = 'Ambalaj Atığı';
        }
        
      } else {
        let itemName = formattedDesc;
        if (formattedDesc.includes(' Geri Dönüştürme Ödülü')) {
          itemName = formattedDesc.split(' Geri Dönüştürme Ödülü')[0];
        } else if (formattedDesc.includes(' Geri Dönüşüm Ödülü')) {
          itemName = formattedDesc.split(' Geri Dönüşüm Ödülü')[0];
        } else if (formattedDesc.includes(' Ödülü')) {
          itemName = formattedDesc.split(' Ödülü')[0];
        }
        
        volume = getStandardLiters(itemName);
        itemLabel = itemName;
        
        category = 'Diğer';
        const lowerName = itemName.toLowerCase();
        if (lowerName.includes('plastik') || lowerName.includes('pet') || lowerName.includes('poşet')) {
          category = 'Plastik';
        } else if (lowerName.includes('cam')) {
          category = 'Cam';
        } else if (lowerName.includes('kağıt') || lowerName.includes('karton')) {
          category = 'Kağıt & Karton';
        } else if (lowerName.includes('metal')) {
          category = 'Metal';
        } else if (lowerName.includes('yağ')) {
          category = 'Atık Yağ';
        } else if (lowerName.includes('ahşap') || lowerName.includes('tahta')) {
          category = 'Ahşap';
        } else if (lowerName.includes('tekstil') || lowerName.includes('giysi') || lowerName.includes('kıyafet')) {
          category = 'Tekstil';
        } else if (lowerName.includes('lastik')) {
          category = 'Lastik';
        } else if (lowerName.includes('pil') || lowerName.includes('e-atık') || lowerName.includes('floresan') || lowerName.includes('lamba') || lowerName.includes('elektronik') || lowerName.includes('laptop')) {
          category = 'Elektronik';
        }
      }

      if (category && volume > 0) {
        if (!stats[category]) {
          stats[category] = { volume: 0, coins: 0, items: {} };
        }
        stats[category].volume += volume;
        stats[category].coins += tx.amount || 0;
        const label = itemLabel || 'Bilinmeyen';
        if (!stats[category].items[label]) {
          stats[category].items[label] = { count: 0, volume: 0 };
        }
        stats[category].items[label].count += 1;
        stats[category].items[label].volume += volume;
      }
    });

    const statsArray = Object.keys(stats).map(key => ({
      name: key,
      volume: stats[key].volume.toFixed(1),
      coins: stats[key].coins,
      icon: getCategoryIcon(key),
      color: getCategoryColor(key),
      items: Object.entries(stats[key].items).map(([name, d]) => ({ name, count: d.count, volume: d.volume }))
    })).sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume));

    setJourneyStats(statsArray);
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Organik': return 'leaf-outline';
      case 'Elektronik': return 'hardware-chip-outline';
      case 'Plastik': return 'water-outline';
      case 'Cam': return 'wine-outline';
      case 'Kağıt & Karton': return 'document-text-outline';
      case 'Metal': return 'cog-outline';
      case 'Ahşap': return 'hammer-outline';
      case 'Atık Yağ': return 'funnel-outline';
      case 'Tekstil': return 'shirt-outline';
      case 'Lastik': return 'ellipse-outline';
      default: return 'trash-outline';
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Organik': return '#84cc16';
      case 'Elektronik': return '#6366f1';
      case 'Plastik': return '#06b6d4';
      case 'Cam': return '#10b981';
      case 'Kağıt & Karton': return '#facc15';
      case 'Metal': return '#64748b';
      case 'Ahşap': return '#a855f7';
      case 'Atık Yağ': return '#d97706';
      case 'Tekstil': return '#ec4899';
      case 'Lastik': return '#4b5563';
      default: return '#94a3b8';
    }
  };

  React.useEffect(() => {
    const unsubProfile = DatabaseService.subscribeToProfilePhoto((newPhoto) => {
      setProfileImage(newPhoto);
    });
    const unsubBins = DatabaseService.subscribeToBins(() => {
      loadData();
    });
    const unsubTheme = DatabaseService.subscribeToTheme((theme) => {
      setCurrentTheme(theme);
    });

    const wsUrl = DatabaseService.getWsUrl();
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => console.log('✅ WebSocket Bağlantısı Kuruldu (Mini Harita)');
    ws.onerror = (e) => console.warn('WebSocket Hatası (Mini Harita):', e);
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (['wasteRequestCreated', 'wasteRequestStatusChanged', 'binCreated', 'binUpdated', 'binDeleted'].includes(payload.type)) {
          console.log('🔄 Yeni evsel atık işlemi/talebi algılandı, veriler yenileniyor...');
          loadData();
        }
      } catch (err) {}
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
            intervalId = setInterval(sendUpdate, 4000);
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
        setRouteCoordinates([{ latitude: loc.latitude, longitude: loc.longitude }, { latitude: targetBin.latitude, longitude: targetBin.latitude }]);
      }
    } catch (e) {
      console.warn("OSRM Route Error Mini Map:", e);
    }
  };

  useEffect(() => {
    if (topBins.length > 0 && userLocation) {
      fetchRouteForMiniMap(topBins[0], userLocation);
    }
  }, [topBins, userLocation]);

  useEffect(() => {
    if (topBins.length > 0 && mapRef.current) {
      const topBin = topBins[0];
      const coordinates = [{ latitude: topBin.latitude, longitude: topBin.longitude }];
      
      if (userLocation) {
        coordinates.push({ latitude: userLocation.latitude, longitude: userLocation.longitude });
      }
      
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
        const userId = await AsyncStorage.getItem('currentUserId');
        let savedName = null;
        let savedSurname = null;
        if (userId) {
          savedName = await AsyncStorage.getItem(`userName_${userId}`);
          savedSurname = await AsyncStorage.getItem(`userSurname_${userId}`);
        }
        if (!savedName) {
          savedName = await AsyncStorage.getItem(`userName_${lowerEmail}`);
          savedSurname = await AsyncStorage.getItem(`userSurname_${lowerEmail}`);
        }
        
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
            if (userId) {
              await AsyncStorage.setItem(`userName_${userId}`, currentUser.name);
              if (currentUser.surname) {
                await AsyncStorage.setItem(`userSurname_${userId}`, currentUser.surname);
              }
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
        fillPercentage: toFillPercentage(b.predictedFullness),
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

      // Kurumsal işlemlerini (veya genel transactions) yükle
      try {
        const fetchedTransactions = await DatabaseService.getTransactions();
        
        const fetchedWasteItems = await DatabaseService.getWasteItems();
        setWasteItems(fetchedWasteItems);

        if (Array.isArray(fetchedTransactions)) {
          calculateJourneyStats(fetchedTransactions);
        }
      } catch (txErr) {
        console.warn('Kurumsal işlem geçmişi yükleme hatası:', txErr);
      }

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
        <TouchableOpacity 
          style={[styles.pointContainer, currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569' }]}
          onPress={() => setCoinTooltipVisible(true)}
          activeOpacity={0.75}
        >
          <Text style={[styles.pointText, currentTheme === 'dark' && { color: '#fff' }]}>{points}</Text>
          <FontAwesome5 name="coins" size={20} color="#FFD700" solid />
        </TouchableOpacity>
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
        
        {/* Hızlı İşlemler Section */}
        <View style={styles.quickActionsSection}>
          <Text style={[styles.sectionTitle, currentTheme === 'dark' && { color: '#fff' }]}>Hızlı İşlemler</Text>
          <View style={styles.quickActionsRow}>

            <TouchableOpacity 
              style={[
                styles.quickActionSquare, 
                { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1.5 },
                currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }
              ]}
              onPress={() => router.push('/kurumsal/kurumsal-transactions' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIconContainer, { backgroundColor: '#3b82f620' }]}>
                <MaterialCommunityIcons name="history" size={28} color="#3b82f6" />
              </View>
              <Text style={[styles.quickActionLabel, currentTheme === 'dark' && { color: '#fff' }]}>Son İşlemler</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.quickActionSquare, 
                { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1.5 },
                currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }
              ]}
              onPress={() => setJourneyModalVisible(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIconContainer, { backgroundColor: '#10b98120' }]}>
                <Ionicons name="leaf-outline" size={28} color="#10b981" />
              </View>
              <Text style={[styles.quickActionLabel, currentTheme === 'dark' && { color: '#fff' }]}>Geri Dönüşüm{"\n"}Yolculuğum</Text>
            </TouchableOpacity>
          </View>
        </View>

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
                    onPress={() => {
                      setEarnedCoins('');
                      setWasteWeight('');
                      setCompleteModalVisible(true);
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

      {/* Tamamlama Detayları Modalı */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={completeModalVisible}
        onRequestClose={() => setCompleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, currentTheme === 'dark' && { color: '#fff' }]}>Atığı Tamamla</Text>
              <TouchableOpacity onPress={() => setCompleteModalVisible(false)}>
                <Ionicons name="close" size={24} color={currentTheme === 'dark' ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>
            <View style={{ width: '100%', paddingVertical: 10 }}>
              <Text style={{ fontSize: 14, color: currentTheme === 'dark' ? '#94a3b8' : '#64748b', marginBottom: 5 }}>Kazandırılacak Coin</Text>
              <TextInput
                style={[styles.inputField, currentTheme === 'dark' && { backgroundColor: '#0f172a', color: '#fff', borderColor: '#334155' }]}
                placeholder={
                  selectedItem?.wasteType === 'DOMESTIC' ? 'Standart: 50 Puan' :
                  selectedItem?.wasteType === 'ELECTRONIC' ? 'Standart: 100 Puan' :
                  selectedItem?.wasteType === 'PLASTIC' ? 'Standart: 30 Puan' : 'Standart: 50 Puan'
                }
                placeholderTextColor={currentTheme === 'dark' ? '#64748b' : '#94a3b8'}
                keyboardType="numeric"
                value={earnedCoins}
                onChangeText={setEarnedCoins}
              />
              
              <Text style={{ fontSize: 14, color: currentTheme === 'dark' ? '#94a3b8' : '#64748b', marginBottom: 5, marginTop: 15 }}>Ağırlık (kg)</Text>
              <TextInput
                style={[styles.inputField, currentTheme === 'dark' && { backgroundColor: '#0f172a', color: '#fff', borderColor: '#334155' }]}
                placeholder={
                  selectedItem?.wasteType === 'DOMESTIC' ? 'Standart: 5.0 kg' :
                  selectedItem?.wasteType === 'ELECTRONIC' ? 'Standart: 10.0 kg' :
                  selectedItem?.wasteType === 'PLASTIC' ? 'Standart: 3.0 kg' : 'Standart: 5.0 kg'
                }
                placeholderTextColor={currentTheme === 'dark' ? '#64748b' : '#94a3b8'}
                keyboardType="numeric"
                value={wasteWeight}
                onChangeText={setWasteWeight}
              />
              
              <TouchableOpacity 
                style={[styles.collectBtn, { marginTop: 20 }]}
                onPress={async () => {
                  try {
                    const c = (earnedCoins && earnedCoins.trim()) ? parseInt(earnedCoins) : undefined;
                    const w = (wasteWeight && wasteWeight.trim()) ? parseFloat(wasteWeight) : undefined;
                    await DatabaseService.updateWasteRequestStatus(selectedItem.dbId, 'COLLECTED', c, w);
                    await loadData();
                    setCompleteModalVisible(false);
                    setModalVisible(false);
                    Alert.alert('Tebrikler!', 'Evsel atık başarıyla toplandı. Bildirim listesinden kaldırıldı.');
                  } catch (err: any) {
                    Alert.alert('Hata', err.message || 'Toplama işlemi tamamlanırken hata oluştu.');
                  }
                }}
              >
                <Ionicons name="checkmark-done" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.btnText}>Onayla ve Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Geri Dönüşüm Yolculuğum İstatistik Modalı */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={journeyModalVisible}
        onRequestClose={() => setJourneyModalVisible(false)}
      >
        <SafeAreaView style={[styles.fullModalSafeArea, currentTheme === 'dark' && { backgroundColor: '#0f172a' }, { position: 'relative' }]}>
          <View style={[styles.fullModalHeader, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
            <TouchableOpacity 
              style={[styles.fullModalBackButtonCircle, currentTheme === 'dark' && { backgroundColor: '#334155' }]}
              onPress={() => setJourneyModalVisible(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="caret-back" size={20} color={currentTheme === 'dark' ? '#fff' : '#1e293b'} style={{ marginRight: 2 }} />
            </TouchableOpacity>
            <Text style={[styles.fullModalTitle, currentTheme === 'dark' && { color: '#fff' }]}>Geri Dönüşüm Yolculuğum</Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView contentContainerStyle={styles.fullModalScrollContent} showsVerticalScrollIndicator={false}>
            {/* Toplam İstatistik Kartı */}
            <View style={[styles.statsSummaryCard, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
              <View style={styles.statsSummaryHeader}>
                <Ionicons name="leaf" size={40} color="#2e7d32" />
                <View style={{ marginLeft: 15, flex: 1 }}>
                  <Text style={[styles.statsSummarySubtitle, currentTheme === 'dark' && { color: '#94a3b8' }]}>Toplam Geri Dönüşüm</Text>
                  <Text style={[styles.statsSummaryTitle, currentTheme === 'dark' && { color: '#fff' }]}>
                    {journeyStats.reduce((sum, item) => sum + parseFloat(item.volume), 0).toFixed(1)} L / kg
                  </Text>
                </View>
              </View>
              <Text style={[styles.statsSummaryFootnote, currentTheme === 'dark' && { color: '#94a3b8' }]}>
                Doğaya katkı sağladığınız tüm geri dönüşüm miktarlarının özeti.
              </Text>
            </View>

            {/* Kategori Bazlı Dağılım */}
            <Text style={[styles.statsSectionTitle, currentTheme === 'dark' && { color: '#fff' }]}>Atık Kategorisi Dağılımı</Text>
            
            {journeyStats.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="leaf-outline" size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, currentTheme === 'dark' && { color: '#94a3b8' }]}>Henüz geri dönüşüm bildiriminiz bulunmuyor.</Text>
              </View>
            ) : (
              <View style={[styles.journeyStatsList, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
                {(() => {
                  const totalVolume = journeyStats.reduce((sum, s) => sum + parseFloat(s.volume), 0) || 1;
                  const sortedCategories = [...WASTE_CATEGORIES].map(cat => {
                    const stat = journeyStats.find(s => s.name === cat.name);
                    const volume = stat ? parseFloat(stat.volume) : 0;
                    const earnedCoins = stat ? stat.coins : 0;
                    return {
                      ...cat,
                      volume,
                      earnedCoins
                    };
                  }).sort((a, b) => b.volume - a.volume);

                  return sortedCategories.map((cat, index) => {
                    const percentage = Math.min(100, Math.round((cat.volume / totalVolume) * 100));
                    const statEntry = journeyStats.find(s => s.name === cat.name) || {
                      name: cat.name,
                      volume: '0.0',
                      coins: 0,
                      icon: cat.icon,
                      color: cat.color,
                      items: []
                    };
                    return (
                      <TouchableOpacity
                        key={index}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedCategoryDetail(statEntry);
                          setCategoryDetailVisible(true);
                        }}
                        style={[styles.journeyStatItem, index === sortedCategories.length - 1 && { borderBottomWidth: 0 }, currentTheme === 'dark' && { borderBottomColor: '#334155' }]}
                      >
                        <View style={[styles.journeyStatIconContainer, { backgroundColor: (cat.color || '#16a34a') + '20' }]}>
                          <Ionicons name={cat.icon} size={24} color={cat.color || '#16a34a'} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 15 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <Text style={[styles.journeyStatName, currentTheme === 'dark' && { color: '#fff' }]}>{cat.name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[styles.journeyStatVolume, { color: cat.color || '#16a34a' }]}>{cat.volume > 0 ? cat.volume.toFixed(1) : '0'} L</Text>
                              <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                            </View>
                          </View>
                          <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: cat.color || '#16a34a' }]} />
                          </View>
                          <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            Kazanç: {cat.earnedCoins.toFixed(0)} Puan | Dağılımdaki payı: %{percentage}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>
            )}
          </ScrollView>

          {/* Kategori Detay Overlay — journey modal'ın en altında, en üst z-index katmanı olması için */}
          {categoryDetailVisible && selectedCategoryDetail && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setCategoryDetailVisible(false)}
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                justifyContent: 'flex-end',
                zIndex: 999,
              }}
            >
              <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ width: '100%' }}>
                <View style={{
                  backgroundColor: currentTheme === 'dark' ? '#1e293b' : '#fff',
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  paddingBottom: 34,
                  maxHeight: 520,
                  width: '100%'
                }}>
                  {/* Handle bar */}
                  <View style={{ alignItems: 'center', paddingTop: 12, marginBottom: 4 }}>
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0' }} />
                  </View>

                  {/* Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: currentTheme === 'dark' ? '#334155' : '#f1f5f9' }}>
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: selectedCategoryDetail.color + '20', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Ionicons name={selectedCategoryDetail.icon} size={24} color={selectedCategoryDetail.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: currentTheme === 'dark' ? '#fff' : '#1e293b' }}>
                        {selectedCategoryDetail.name}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
                        Toplam: {parseFloat(selectedCategoryDetail.volume).toFixed(1)} L · {selectedCategoryDetail.coins} 🪙
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setCategoryDetailVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close-circle" size={26} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>

                  <Text style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8, fontSize: 12, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Geri Dönüştürülen Ürünler
                  </Text>

                  <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                    {(selectedCategoryDetail.items || []).length === 0 ? (
                      <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 10 }}>
                        <Ionicons name="leaf-outline" size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
                        <Text style={{ color: currentTheme === 'dark' ? '#94a3b8' : '#64748b', textAlign: 'center', fontSize: 14, lineHeight: 20 }}>
                          Henüz bu kategoride atık dönüştürmediniz. Atıklarınızı dönüştürerek hem puan kazanabilir hem de çevreye katkı sağlayabilirsiniz! 🌱
                        </Text>
                      </View>
                    ) : (
                      (selectedCategoryDetail.items || []).map((item: any, i: number) => (
                        <View key={i} style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 13,
                          borderBottomWidth: i < selectedCategoryDetail.items.length - 1 ? 1 : 0,
                          borderBottomColor: currentTheme === 'dark' ? '#334155' : '#f1f5f9',
                        }}>
                          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: selectedCategoryDetail.color + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                            <Ionicons name={selectedCategoryDetail.icon} size={18} color={selectedCategoryDetail.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '500', color: currentTheme === 'dark' ? '#f1f5f9' : '#1e293b' }}>
                              {item.name}
                            </Text>
                            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                              {item.volume.toFixed(1)} L
                            </Text>
                          </View>
                          <View style={{ backgroundColor: selectedCategoryDetail.color + '20', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: selectedCategoryDetail.color }}>
                              {item.count}x
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </Modal>
      <Modal
        visible={coinTooltipVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCoinTooltipVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }}
          onPress={() => setCoinTooltipVisible(false)}
        >
          <View style={{
            position: 'absolute',
            top: Platform.OS === 'ios' ? 105 : (StatusBar.currentHeight ? StatusBar.currentHeight + 60 : 75),
            right: 20,
            width: 260,
            backgroundColor: currentTheme === 'dark' ? '#1e293b' : '#fff',
            borderRadius: 16,
            padding: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 10,
            borderWidth: 1,
            borderColor: currentTheme === 'dark' ? '#334155' : '#f1f5f9',
          }}>
            {/* Arrow */}
            <View style={{
              position: 'absolute',
              top: -6,
              right: 24,
              width: 12,
              height: 12,
              backgroundColor: currentTheme === 'dark' ? '#1e293b' : '#fff',
              transform: [{ rotate: '45deg' }],
              borderTopWidth: 1,
              borderLeftWidth: 1,
              borderColor: currentTheme === 'dark' ? '#334155' : '#f1f5f9',
            }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              <FontAwesome5 name="coins" size={16} color="#facc15" />
              <Text style={{ fontWeight: '700', fontSize: 14, color: currentTheme === 'dark' ? '#fff' : '#1e293b' }}>
                E-Atık Coin Nedir?
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: currentTheme === 'dark' ? '#94a3b8' : '#64748b', lineHeight: 18 }}>
              Atıkları teslim ederek ve geri dönüşüm süreçlerini tamamlayarak kurumunuza kazandırılan puanlardır. Kurumsal avantajlar ve ödüller için kullanılabilir. 🌱
            </Text>
            <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: currentTheme === 'dark' ? '#334155' : '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="checkmark-circle" size={14} color="#10b981" />
              <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '600' }}>Mevcut bakiyeniz: {points} coin</Text>
            </View>
          </View>
        </Pressable>
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
  },
  inputField: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
  },
  quickActionsSection: {
    marginBottom: 25,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 15,
  },
  quickActionSquare: {
    width: 110,
    height: 110,
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
  },
  quickActionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    lineHeight: 14,
  },
  fullModalSafeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  fullModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 72,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  fullModalBackButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  fullModalScrollContent: {
    padding: 20,
  },
  statsSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  statsSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statsSummarySubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  statsSummaryTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statsSummaryFootnote: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  statsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 15,
  },
  journeyStatsList: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 15,
    marginBottom: 30,
  },
  journeyStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  journeyStatIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  journeyStatName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  journeyStatVolume: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
