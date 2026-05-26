import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  Platform, 
  StatusBar, 
  TouchableOpacity, 
  Image, 
  Alert, 
  Modal, 
  TextInput, 
  ActivityIndicator,
  Animated,
  Pressable
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import DatabaseService from '../../database/DatabaseService';
import * as Location from 'expo-location';

const DEFAULT_AVATAR = require('../../assets/images/default-avatar.png');

const parseTransactionDescription = (fullDesc: string | null) => {
  if (!fullDesc) return { name: 'Atık Dönüşüm Ödülü', option: 'QR Kod' };

  let desc = fullDesc;
  const suffixRegex = /\s*\((qr|barkod)\s*\|\s*[^)]+\)/g;
  const matches = desc.match(suffixRegex);
  if (matches && matches.length > 1) {
    desc = desc.replace(suffixRegex, '');
    desc = `${desc} ${matches[0].trim()}`;
  }

  const barcodeMatch = desc.match(/(.*?)\s*\(barkod\s*\|\s*([^)]+)\)/);
  if (barcodeMatch) {
    return {
      name: barcodeMatch[1].trim(),
      option: `Barkod (${barcodeMatch[2].trim()})`
    };
  }

  const qrMatch = desc.match(/(.*?)\s*\(qr\s*\|\s*([^)]+)\)/);
  if (qrMatch) {
    return {
      name: qrMatch[1].trim(),
      option: `QR Kod (${qrMatch[2].trim()})`
    };
  }

  const qrOnlyMatch = desc.match(/(.*?)\s*\(qr\)/);
  if (qrOnlyMatch) {
    return {
      name: qrOnlyMatch[1].trim(),
      option: 'QR Kod'
    };
  }

  if (desc.includes('Market') || desc.includes('Satın Alma')) {
    return {
      name: desc,
      option: 'Market Harcaması'
    };
  }

  return {
    name: desc,
    option: 'QR Kod'
  };
};

const formatTransactionDescription = (description: string | null, amount: number) => {
  if (!description || description === 'QR Kod Tarama Ödülü' || description === 'Geri Dönüşüm Ödülü' || description === 'Atık Dönüşüm Ödülü') {
    switch (amount) {
      case 2: return 'Plastik Kapak Geri Dönüştürme Ödülü';
      case 3: return 'Kağıt / Naylon Poşet Geri Dönüştürme Ödülü';
      case 4: return 'Karton / Cam Kavanoz Geri Dönüştürme Ödülü';
      case 5: return 'Pet Şişe / Geri Dönüştürme Ödülü';
      case 7: return 'Metal Kutu Geri Dönüştürme Ödülü';
      case 8: return 'Cam Şişe Geri Dönüştürme Ödülü';
      case 10: return 'Atık Lastik Geri Dönüştürme Ödülü';
      case 12: return 'Tekstil Geri Dönüştürme Ödülü';
      case 15: return 'Pil / Ahşap Geri Dönüştürme Ödülü';
      case 20: return 'Bitkisel Yağ Geri Dönüştürme Ödülü';
      case 50: return 'E-Atık Geri Dönüştürme Ödülü';
      default: return 'Atık Dönüşüm Ödülü';
    }
  }

  return description.replace(/\s*\((qr|barkod)\s*\|\s*[^)]+\)/g, '').replace(/\s*\(qr\)/g, '').trim();
};

const formatTransactionDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    
    if (isNaN(date.getTime())) return 'Bilinmeyen Tarih';

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    const dateZero = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = nowZero.getTime() - dateZero.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Bugün, ${timeStr}`;
    } else if (diffDays === 1) {
      return `Dün, ${timeStr}`;
    } else {
      const months = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
      ];
      const day = date.getDate();
      const month = months[date.getMonth()];
      return `${day} ${month}, ${timeStr}`;
    }
  } catch (error) {
    return 'Bilinmeyen Tarih';
  }
};

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

// Evsel Atık Bildirimi için sabit kategoriler (marketten bağımsız)
const EVSEL_WASTE_TYPES = [
  { id: 'GENERAL',    name: 'Genel Evsel Atık',         icon: 'trash-outline',           color: '#64748b', wasteType: 'DOMESTIC',   coins: 50  },
  { id: 'PACKAGING',  name: 'Ambalaj (Kağıt/Plastik)', icon: 'cube-outline',            color: '#22d3ee', wasteType: 'PLASTIC',    coins: 30  },
  { id: 'ORGANIC',    name: 'Organik Atık',             icon: 'leaf-outline',            color: '#84cc16', wasteType: 'DOMESTIC',   coins: 50  },
  { id: 'ELECTRONIC', name: 'Elektronik Atık',          icon: 'hardware-chip-outline',   color: '#6366f1', wasteType: 'ELECTRONIC', coins: 100 },
  { id: 'BULKY',      name: 'Büyük Eşya / Mobilya',    icon: 'bed-outline',             color: '#a855f7', wasteType: 'DOMESTIC',   coins: 50  },
  { id: 'HAZARDOUS',  name: 'Tehlikeli Atık (Pil/İlaç)',icon: 'warning-outline',         color: '#ef4444', wasteType: 'DOMESTIC',   coins: 50  },
];

export default function KisiselIndexScreen() {
  const [userName, setUserName] = useState('...');
  const [points, setPoints] = useState(0);
  const [coinTooltipVisible, setCoinTooltipVisible] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Evsel Atık ve Detaylı Son İşlemler İçin State Tanımları
  const [wasteModalVisible, setWasteModalVisible] = useState(false);
  const [journeyModalVisible, setJourneyModalVisible] = useState(false);
  const [journeyStats, setJourneyStats] = useState<any[]>([]);
  const [categoryDetailVisible, setCategoryDetailVisible] = useState(false);
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<any>(null);
  const [allTransactionsVisible, setAllTransactionsVisible] = useState(false);
  const [wasteItems, setWasteItems] = useState<any[]>([]);

  // Toast (in-modal uyarı sistemi)
  const [wasteToast, setWasteToast] = useState<{ type: 'error' | 'success' | 'warning'; title: string; message: string } | null>(null);
  const toastAnim = useRef(new Animated.Value(-100)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showWasteToast = (type: 'error' | 'success' | 'warning', title: string, message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setWasteToast({ type, title, message });
    toastAnim.setValue(-120);
    Animated.spring(toastAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: -120,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setWasteToast(null));
    }, 3500);
  };

  // Calculate statistics when transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      calculateJourneyStats(transactions);
    }
  }, [transactions]);

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

  const calculateJourneyStats = (txs: any[]) => {
    const stats: Record<string, { volume: number; coins: number; items: Record<string, { count: number; volume: number }> }> = {};
    
    txs.forEach(tx => {
      if (tx.type !== 'EARNED') return;
      const rawDesc = tx.description || '';
      const formattedDesc = formatTransactionDescription(rawDesc, tx.amount);
      
      let category = '';
      let volume = 0;
      let itemLabel = '';

      if (rawDesc.includes('Evsel Atık') || formattedDesc.includes('Evsel Atık')) {
        volume = 5.0;
        const kgMatch = rawDesc.match(/(\d+(\.\d+)?)kg/) || formattedDesc.match(/(\d+(\.\d+)?)kg/);
        if (kgMatch && kgMatch[1]) volume = parseFloat(kgMatch[1]);
        category = 'Karışık Evsel';
        itemLabel = 'Evsel Atık';
        if (rawDesc.includes('DOMESTIC') || rawDesc.includes('Organik')) { category = 'Organik'; itemLabel = 'Organik Atık'; }
        if (rawDesc.includes('ELECTRONIC') || rawDesc.includes('Elektronik')) { category = 'Elektronik'; itemLabel = 'Elektronik Atık'; }
        if (rawDesc.includes('PLASTIC') || rawDesc.includes('Ambalaj') || rawDesc.includes('Plastik')) { category = 'Plastik'; itemLabel = 'Ambalaj Atığı'; }
      } else {
        let itemName = formattedDesc;
        if (formattedDesc.includes(' Geri Dönüştürme Ödülü')) itemName = formattedDesc.split(' Geri Dönüştürme Ödülü')[0];
        else if (formattedDesc.includes(' Geri Dönüşüm Ödülü')) itemName = formattedDesc.split(' Geri Dönüşüm Ödülü')[0];
        else if (formattedDesc.includes(' Ödülü')) itemName = formattedDesc.split(' Ödülü')[0];
        volume = getStandardLiters(itemName);
        itemLabel = itemName;
        category = 'Diğer';
        const lowerName = itemName.toLowerCase();
        if (lowerName.includes('plastik') || lowerName.includes('pet') || lowerName.includes('poşet')) category = 'Plastik';
        else if (lowerName.includes('cam')) category = 'Cam';
        else if (lowerName.includes('kağıt') || lowerName.includes('karton')) category = 'Kağıt & Karton';
        else if (lowerName.includes('metal')) category = 'Metal';
        else if (lowerName.includes('yağ')) category = 'Atık Yağ';
        else if (lowerName.includes('ahşap') || lowerName.includes('tahta')) category = 'Ahşap';
        else if (lowerName.includes('tekstil') || lowerName.includes('giysi') || lowerName.includes('kıyafet')) category = 'Tekstil';
        else if (lowerName.includes('lastik')) category = 'Lastik';
        else if (lowerName.includes('pil') || lowerName.includes('e-atık') || lowerName.includes('floresan') || lowerName.includes('lamba') || lowerName.includes('elektronik') || lowerName.includes('laptop')) category = 'Elektronik';
      }

      if (category && volume > 0) {
        if (!stats[category]) stats[category] = { volume: 0, coins: 0, items: {} };
        stats[category].volume += volume;
        stats[category].coins += tx.amount || 0;
        const label = itemLabel || 'Bilinmeyen';
        if (!stats[category].items[label]) stats[category].items[label] = { count: 0, volume: 0 };
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
  const [selectedWasteType, setSelectedWasteType] = useState<string | null>(null);
  const [detailedAddress, setDetailedAddress] = useState('');
  const [userCity, setUserCity] = useState('');
  const [userDistrict, setUserDistrict] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unreadRequests, setUnreadRequests] = useState<any[]>([]);
  const [currentTheme, setCurrentTheme] = useState('light');
  const [customAlertVisible, setCustomAlertVisible] = useState(false);
  const [customAlertTitle, setCustomAlertTitle] = useState('');
  const [customAlertMessage, setCustomAlertMessage] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);

  React.useEffect(() => {
    const unsubscribePhoto = DatabaseService.subscribeToProfilePhoto((newPhoto) => {
      setProfileImage(newPhoto);
    });
    const unsubscribeTheme = DatabaseService.subscribeToTheme((theme) => {
      setCurrentTheme(theme);
    });
    return () => {
      unsubscribePhoto();
      unsubscribeTheme();
    };
  }, []);
  const showCustomAlert = (title: string, message: string) => {
    setCustomAlertTitle(title);
    setCustomAlertMessage(message);
    setCustomAlertVisible(true);
  };
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
        const userId = await AsyncStorage.getItem('currentUserId');
        let savedName = null;
        let savedSurname = null;
        if (userId) {
          savedName = await AsyncStorage.getItem(`userName_${userId}`);
          savedSurname = await AsyncStorage.getItem(`userSurname_${userId}`);
        }
        if (!savedName) {
          savedName = await AsyncStorage.getItem(`userName_${lowerEmail}`);
        }
        if (savedName) {
          setUserName(savedName + (savedSurname ? ' ' + savedSurname : ''));
        }
        
        const savedPhoto = await AsyncStorage.getItem(`profileImage_${lowerEmail}`);
        setProfileImage(savedPhoto); 

        const savedPoints = await AsyncStorage.getItem(`userPoints_${lowerEmail}`);
        if (savedPoints) {
          setPoints(parseInt(savedPoints));
        } else {
          await AsyncStorage.setItem(`userPoints_${lowerEmail}`, '0');
          setPoints(0);
        }

        // Offline İl/İlçe Verilerini Yükle
        if (userId) {
          const savedCity = await AsyncStorage.getItem(`userCity_${userId}`);
          const savedDistrict = await AsyncStorage.getItem(`userDistrict_${userId}`);
          if (savedCity) setUserCity(savedCity);
          if (savedDistrict) setUserDistrict(savedDistrict);
        }

        // Backend'den dinamik işlem geçmişini (son işlemler) çek
        const fetchedTransactions = await DatabaseService.getTransactions();
        setTransactions(fetchedTransactions);

        const fetchedWasteItems = await DatabaseService.getWasteItems();
        setWasteItems(fetchedWasteItems);

        // Backend'den en güncel profil bilgilerini çekip eşitle (Web ile senkronizasyon)
        const currentUser = await DatabaseService.getCurrentUser();
        if (currentUser) {
          if (currentUser.wallet !== undefined) {
            const actualBalance = currentUser.wallet ? currentUser.wallet.balance : 0;
            setPoints(actualBalance);
            await AsyncStorage.setItem(`userPoints_${lowerEmail}`, actualBalance.toString());
          }

          if (currentUser.name) {
            const fullName = currentUser.name + (currentUser.surname ? ' ' + currentUser.surname : '');
            setUserName(fullName);
            await AsyncStorage.setItem(`userName_${lowerEmail}`, fullName);
            if (userId) {
              await AsyncStorage.setItem(`userName_${userId}`, currentUser.name);
              if (currentUser.surname) {
                await AsyncStorage.setItem(`userSurname_${userId}`, currentUser.surname);
              }
            }
          }

          // İl/İlçe bilgilerini de eşitle ve AsyncStorage'a kaydet
          if (currentUser.city) {
            setUserCity(currentUser.city);
            if (userId) await AsyncStorage.setItem(`userCity_${userId}`, currentUser.city);
          }
          if (currentUser.district) {
            setUserDistrict(currentUser.district);
            if (userId) await AsyncStorage.setItem(`userDistrict_${userId}`, currentUser.district);
          }

          if (currentUser.profileImage) {
            setProfileImage(currentUser.profileImage);
            DatabaseService.notifyProfilePhotoChanged(currentUser.profileImage);
            if (Platform.OS !== 'web') {
              try {
                await AsyncStorage.setItem(`profileImage_${lowerEmail}`, currentUser.profileImage);
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
                if (userId) {
                  await AsyncStorage.removeItem(`profileImage_${userId}`);
                }
              } catch (e) {
                console.warn('[STORAGE] Profile image remove failed:', e);
              }
            }
          }
        }

        // Fetch unread collected waste requests
        const allRequests = await DatabaseService.getWasteRequests();
        const userCollected = allRequests.filter((r: any) => r.userId === userId && r.status === 'COLLECTED');
        const readIdsStr = await AsyncStorage.getItem(`readCollectedRequests_${userId}`);
        const readIds = readIdsStr ? JSON.parse(readIdsStr) : [];
        const unreads = userCollected.filter((r: any) => !readIds.includes(r.id));
        setUnreadRequests(unreads);
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    }
  };

  const handleWasteRequestButton = async () => {
    if (unreadRequests.length > 0) {
      const userId = await AsyncStorage.getItem('currentUserId');
      
      const unreadsInfo = unreadRequests.map(r => `• Konum: ${r.note || 'Belirtilmedi'}\n  Talep No: ${r.id.substring(0,6)}...`).join('\n\n');
      
      Alert.alert(
        'Talebiniz Tamamlandı! 🎉',
        `Ekiplerimiz evsel atık taleplerinizi başarıyla topladı:\n\n${unreadsInfo}`,
        [
          {
            text: 'Tamam',
            onPress: async () => {
              const readIdsStr = await AsyncStorage.getItem(`readCollectedRequests_${userId}`);
              const readIds = readIdsStr ? JSON.parse(readIdsStr) : [];
              const newReadIds = [...readIds, ...unreadRequests.map(r => r.id)];
              await AsyncStorage.setItem(`readCollectedRequests_${userId}`, JSON.stringify(newReadIds));
              setUnreadRequests([]); 
              setWasteModalVisible(true);
            }
          }
        ]
      );
    } else {
      setWasteModalVisible(true);
    }
  };

  const handleWasteSubmit = async () => {
    if (!selectedWasteType) {
      showWasteToast('warning', 'Eksik Seçim', 'Lütfen evsel atık türünü seçiniz.');
      return;
    }
    if (!detailedAddress.trim()) {
      showWasteToast('error', 'Eksik Bilgi', 'Lütfen açık adres bilginizi giriniz.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Konum izinlerini kontrol et
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsSubmitting(false);
        showWasteToast('error', 'Konum İzni Gerekli', 'Evsel atık bildirimi yapabilmek için konum izni vermeniz gerekmektedir.');
        return;
      }

      // 2. Güncel konumu çek
      const location = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Balanced 
      });

      const latitude = location.coords.latitude;
      const longitude = location.coords.longitude;

      // 3. Atık türünü veritabanı enum değerlerine eşle
      const evselItem = EVSEL_WASTE_TYPES.find(w => w.id === selectedWasteType);
      const mappedCategory = evselItem ? evselItem.wasteType : 'DOMESTIC';

      // 4. API'ye gönder
      await DatabaseService.createWasteRequest({
        wasteType: mappedCategory,
        note: detailedAddress,
        latitude,
        longitude
      });

      setIsSubmitting(false);

      // Başarılı: önce toast göster, 1 saniye sonra modalı kapat
      showWasteToast('success', 'İşlem Başarılı!', 'Bildiriminiz kuruma iletildi. Ekiplerimiz en kısa sürede adresinize yönlendirilecektir.');
      setTimeout(() => {
        setWasteModalVisible(false);
        setSelectedWasteType(null);
        setDetailedAddress('');
        setWasteToast(null);
      }, 1800);

    } catch (err: any) {
      setIsSubmitting(false);
      console.error('Evsel atık bildirimi gönderilemedi:', err);
      showWasteToast('error', 'Hata', err.message || 'Bildirim sunucuya gönderilirken bir hata oluştu.');
    }
  };

  // Dinamik wasteItems kullanıyoruz, sabit wasteTypes kaldırıldı.

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
            <Text style={[styles.userName, currentTheme === 'dark' && { color: '#94a3b8' }]}>Hoş Geldin,</Text>
            <Text style={[styles.userName, currentTheme === 'dark' && { color: '#fff' }]}>{userName}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={[styles.pointContainer, currentTheme === 'dark' && { backgroundColor: '#334155' }]}
          onPress={() => setCoinTooltipVisible(true)}
          activeOpacity={0.75}
        >
          <Text style={[styles.pointText, currentTheme === 'dark' && { color: '#fff' }]}>{points}</Text>
          <FontAwesome5 name="coins" size={20} color="#FFD700" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.quickActionsSection}>
          <Text style={[styles.sectionTitle, currentTheme === 'dark' && { color: '#fff' }]}>Hızlı İşlemler</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity 
              style={[styles.quickActionSquare, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}
              activeOpacity={0.8}
              onPress={handleWasteRequestButton}
            >
              <View style={styles.quickActionIconContainer}>
                <Ionicons name="trash-bin-outline" size={28} color="#16a34a" />
                {unreadRequests.length > 0 && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{unreadRequests.length}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.quickActionLabel, currentTheme === 'dark' && { color: '#fff' }]}>Evsel Atık{"\n"}Bildirimi</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.quickActionSquare, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}
              activeOpacity={0.8}
              onPress={() => setJourneyModalVisible(true)}
            >
              <View style={[styles.quickActionIconContainer, { backgroundColor: '#10b98120' }]}>
                <Ionicons name="leaf-outline" size={28} color="#10b981" />
              </View>
              <Text style={[styles.quickActionLabel, currentTheme === 'dark' && { color: '#fff' }]}>Geri Dönüşüm{"\n"}Yolculuğum</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.transactionsContainer, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, currentTheme === 'dark' && { color: '#fff' }]}>Son İşlemler</Text>
            <TouchableOpacity onPress={() => setAllTransactionsVisible(true)} activeOpacity={0.7}>
              <Ionicons name="chevron-forward-circle" size={28} color="#2e7d32" />
            </TouchableOpacity>
          </View>
          
          <View style={[styles.transactionsList, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            {transactions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
                <Text style={[styles.emptyText, currentTheme === 'dark' && { color: '#94a3b8' }]}>Henüz bir işleminiz bulunmuyor.</Text>
              </View>
            ) : (
              transactions.slice(0, 4).map((item, index, arr) => {
                const isMarket = item.description && item.description.includes('Market');
                const isEvsel = item.description && item.description.includes('Evsel Atık');
                const isSpent = item.type === 'SPENT';
                const pointsPrefix = isSpent ? '-' : '+';
                const pointsColor = isSpent ? '#ef4444' : '#2e7d32';
                
                const iconBgColor = currentTheme === 'dark' 
                  ? (isEvsel ? '#064e3b' : (isMarket ? '#1e3a8a' : '#065f46')) 
                  : (isEvsel ? '#dcfce7' : (isMarket ? '#e3f2fd' : '#e8f5e9'));
                const iconColor = currentTheme === 'dark'
                  ? (isEvsel ? '#34d399' : (isMarket ? '#60a5fa' : '#34d399')) 
                  : (isEvsel ? '#16a34a' : (isMarket ? '#1565c0' : '#2e7d32'));
                  
                const isBarcode = item.description && item.description.includes('barkod');
                const iconName = isEvsel ? 'leaf-outline' : (isMarket 
                  ? 'cart-outline' 
                  : (isBarcode ? 'barcode-outline' : 'qr-code-outline'));

                return (
                  <TouchableOpacity 
                    key={item.id} 
                    style={[styles.transactionItem, index === arr.length - 1 && { borderBottomWidth: 0 }, currentTheme === 'dark' && { borderBottomColor: '#334155' }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedTransaction(item);
                      setTransactionModalVisible(true);
                    }}
                  >
                    <View style={[styles.transactionIconContainer, { backgroundColor: iconBgColor }]}>
                      <Ionicons 
                        name={iconName} 
                        size={22} 
                        color={iconColor} 
                      />
                    </View>
                    <View style={styles.transactionDetails}>
                      <Text style={[styles.transactionName, currentTheme === 'dark' && { color: '#fff' }]}>{formatTransactionDescription(item.description, item.amount)}</Text>
                      <Text style={[styles.transactionDate, currentTheme === 'dark' && { color: '#94a3b8' }]}>{formatTransactionDate(item.createdAt)}</Text>
                    </View>
                    <Text style={[styles.transactionPoints, { color: pointsColor }]}>
                      {pointsPrefix}{item.amount} Puan
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

        <View style={[styles.tipCard, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
          <Ionicons name="bulb-outline" size={24} color="#f1c40f" />
          <View style={styles.tipTextContainer}>
            <Text style={[styles.tipTitle, currentTheme === 'dark' && { color: '#fff' }]}>Küçük Bilgi:</Text>
            <Text style={[styles.tipText, currentTheme === 'dark' && { color: '#94a3b8' }]}>
              Gereksiz fişleri prizden çekerek ayda ortalama 5 ağacı kurtarabilirsin!
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={false}
        visible={allTransactionsVisible}
        onRequestClose={() => setAllTransactionsVisible(false)}
      >
        <SafeAreaView style={[styles.modalSafeArea, currentTheme === 'dark' && { backgroundColor: '#0f172a' }]}>
          <View style={[styles.modalHeader, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
            <TouchableOpacity 
              style={[styles.modalBackButtonCircle, currentTheme === 'dark' && { backgroundColor: '#334155' }]}
              onPress={() => setAllTransactionsVisible(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="caret-back" size={20} color={currentTheme === 'dark' ? '#fff' : '#1e293b'} style={{ marginRight: 2 }} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, currentTheme === 'dark' && { color: '#fff' }]}>Yapılan Son İşlemler</Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.transactionsList, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
              {transactions.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="receipt-outline" size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
                  <Text style={[styles.emptyText, currentTheme === 'dark' && { color: '#94a3b8' }]}>Henüz bir işleminiz bulunmuyor.</Text>
                </View>
              ) : (
                transactions.map((item, index, arr) => {
                  const isMarket = item.description && item.description.includes('Market');
                  const isEvsel = item.description && item.description.includes('Evsel Atık');
                  const isSpent = item.type === 'SPENT';
                  const pointsPrefix = isSpent ? '-' : '+';
                  const pointsColor = isSpent ? '#ef4444' : '#2e7d32';
                  
                  const iconBgColor = currentTheme === 'dark' 
                    ? (isEvsel ? '#064e3b' : (isMarket ? '#1e3a8a' : '#065f46')) 
                    : (isEvsel ? '#dcfce7' : (isMarket ? '#e3f2fd' : '#e8f5e9'));
                  const iconColor = currentTheme === 'dark'
                    ? (isEvsel ? '#34d399' : (isMarket ? '#60a5fa' : '#34d399')) 
                    : (isEvsel ? '#16a34a' : (isMarket ? '#1565c0' : '#2e7d32'));
                    
                  const isBarcode = item.description && item.description.includes('barkod');
                  const iconName = isEvsel ? 'leaf-outline' : (isMarket 
                    ? 'cart-outline' 
                    : (isBarcode ? 'barcode-outline' : 'qr-code-outline'));

                  return (
                    <TouchableOpacity 
                      key={item.id} 
                      style={[styles.transactionItem, index === arr.length - 1 && { borderBottomWidth: 0 }, currentTheme === 'dark' && { borderBottomColor: '#334155' }]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedTransaction(item);
                        setTransactionModalVisible(true);
                      }}
                    >
                      <View style={[styles.transactionIconContainer, { backgroundColor: iconBgColor }]}>
                        <Ionicons name={iconName} size={22} color={iconColor} />
                      </View>
                      <View style={styles.transactionDetails}>
                        <Text style={[styles.transactionName, currentTheme === 'dark' && { color: '#fff' }]}>{formatTransactionDescription(item.description, item.amount)}</Text>
                        <Text style={[styles.transactionDate, currentTheme === 'dark' && { color: '#94a3b8' }]}>{formatTransactionDate(item.createdAt)}</Text>
                      </View>
                      <Text style={[styles.transactionPoints, { color: pointsColor }]}>
                        {pointsPrefix}{item.amount} Puan
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={customAlertVisible}
        onRequestClose={() => setCustomAlertVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ 
            backgroundColor: currentTheme === 'dark' ? '#1e293b' : '#fff', 
            borderRadius: 16, 
            padding: 24, 
            width: '90%', 
            maxWidth: 400,
            borderWidth: currentTheme === 'dark' ? 1 : 0,
            borderColor: '#334155',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="information-circle-outline" size={24} color="#2e7d32" style={{ marginRight: 8 }} />
              <Text style={{ 
                fontSize: 20, 
                fontWeight: 'bold', 
                color: currentTheme === 'dark' ? '#fff' : '#1e293b',
                flex: 1
              }}>{customAlertTitle}</Text>
            </View>
            <Text style={{ 
              fontSize: 15, 
              color: currentTheme === 'dark' ? '#94a3b8' : '#475569',
              lineHeight: 22,
              marginBottom: 24 
            }}>{customAlertMessage}</Text>
            <TouchableOpacity 
              style={{ 
                backgroundColor: '#2e7d32', 
                paddingVertical: 14, 
                borderRadius: 10, 
                alignItems: 'center' 
              }}
              onPress={() => setCustomAlertVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={transactionModalVisible}
        onRequestClose={() => setTransactionModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ 
            backgroundColor: currentTheme === 'dark' ? '#1e293b' : '#fff', 
            borderRadius: 16, 
            padding: 24, 
            width: '90%', 
            maxWidth: 400,
            borderWidth: currentTheme === 'dark' ? 1 : 0,
            borderColor: '#334155',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="receipt" size={24} color="#2e7d32" style={{ marginRight: 8 }} />
              <Text style={{ 
                fontSize: 20, 
                fontWeight: 'bold', 
                color: currentTheme === 'dark' ? '#fff' : '#1e293b',
                flex: 1
              }}>İşlem Detayları</Text>
            </View>

            {selectedTransaction && (
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>Açıklama</Text>
                  <Text style={{ fontSize: 15, color: currentTheme === 'dark' ? '#fff' : '#1e293b', fontWeight: '500' }}>
                    {formatTransactionDescription(selectedTransaction.description, selectedTransaction.amount)}
                  </Text>
                </View>

                <View>
                  <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>İşlem Türü / Seçenek</Text>
                  <Text style={{ fontSize: 15, color: currentTheme === 'dark' ? '#fff' : '#1e293b' }}>
                    {parseTransactionDescription(selectedTransaction.description || '').option}
                  </Text>
                </View>

                <View>
                  <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>Puan Değişimi</Text>
                  <Text style={{ 
                    fontSize: 16, 
                    fontWeight: 'bold', 
                    color: selectedTransaction.type === 'SPENT' ? '#ef4444' : '#2e7d32' 
                  }}>
                    {selectedTransaction.type === 'SPENT' ? '-' : '+'}{selectedTransaction.amount} Puan
                  </Text>
                </View>

                <View>
                  <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>İşlem Tarihi</Text>
                  <Text style={{ fontSize: 15, color: currentTheme === 'dark' ? '#fff' : '#1e293b' }}>
                    {formatTransactionDate(selectedTransaction.createdAt)}
                  </Text>
                </View>

                <View>
                  <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>İşlem Numarası</Text>
                  <Text style={{ fontSize: 13, color: currentTheme === 'dark' ? '#64748b' : '#94a3b8', fontFamily: 'monospace' }}>
                    {selectedTransaction.id}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity 
              style={{ 
                backgroundColor: '#2e7d32', 
                paddingVertical: 14, 
                borderRadius: 10, 
                alignItems: 'center',
                marginTop: 24
              }}
              onPress={() => setTransactionModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={false}
        visible={wasteModalVisible}
        onRequestClose={() => setWasteModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalSafeArea, currentTheme === 'dark' && { backgroundColor: '#0f172a' }]}>
          {/* ── IN-MODAL TOAST ── */}
          {wasteToast && (
            <Animated.View
              style={{
                position: 'absolute',
                top: 10,
                left: 12,
                right: 12,
                zIndex: 999,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
                elevation: 12,
                backgroundColor:
                  wasteToast.type === 'success' ? '#166534' :
                  wasteToast.type === 'warning' ? '#78350f' : '#7f1d1d',
                transform: [{ translateY: toastAnim }],
              }}
            >
              <Ionicons
                name={
                  wasteToast.type === 'success' ? 'checkmark-circle' :
                  wasteToast.type === 'warning' ? 'warning' : 'close-circle'
                }
                size={26}
                color={
                  wasteToast.type === 'success' ? '#4ade80' :
                  wasteToast.type === 'warning' ? '#fbbf24' : '#f87171'
                }
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 2 }}>
                  {wasteToast.title}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12.5, lineHeight: 17 }}>
                  {wasteToast.message}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setWasteToast(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </Animated.View>
          )}

          <View style={[styles.modalHeader, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
            <TouchableOpacity 
              style={[styles.modalBackButtonCircle, currentTheme === 'dark' && { backgroundColor: '#334155' }]}
              onPress={() => setWasteModalVisible(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="caret-back" size={20} color={currentTheme === 'dark' ? '#fff' : '#1e293b'} style={{ marginRight: 2 }} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, currentTheme === 'dark' && { color: '#fff' }]}>Evsel Atık Bildirimi</Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView 
            contentContainerStyle={styles.formScrollContent} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.inputLabel, currentTheme === 'dark' && { color: '#fff' }]}>Bölge Bilgisi (Profilinizden)</Text>
            <View style={[styles.regionInfoBox, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
              <Ionicons name="location-sharp" size={20} color="#64748b" style={{ marginRight: 8 }} />
              <Text style={[styles.regionInfoText, currentTheme === 'dark' && { color: '#fff' }]}>
                {userCity && userDistrict ? `${userCity} / ${userDistrict}` : 'Belirtilmemiş (Profilinizden güncelleyebilirsiniz)'}
              </Text>
            </View>

            <Text style={[styles.inputLabel, currentTheme === 'dark' && { color: '#fff' }]}>Evsel Atık Türü Seçin</Text>
            <View style={styles.wasteGrid}>
              {EVSEL_WASTE_TYPES.map((type) => {
                const isSelected = selectedWasteType === type.id;
                const iconColor = type.color;
                const bg = type.color + '20';

                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.wasteCard,
                      { backgroundColor: currentTheme === 'dark' ? '#1e293b' : bg },
                      currentTheme === 'dark' && { borderColor: '#334155' },
                      isSelected && { borderColor: iconColor, borderWidth: 2 }
                    ]}
                    onPress={() => setSelectedWasteType(type.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.wasteCardIconContainer}>
                      <Ionicons name={type.icon as any} size={26} color={isSelected ? iconColor : (currentTheme === 'dark' ? '#94a3b8' : '#64748b')} />
                    </View>
                    <Text style={[
                      styles.wasteCardText, 
                      currentTheme === 'dark' && { color: '#cbd5e1' },
                      isSelected && { fontWeight: 'bold', color: iconColor }
                    ]}>
                      {type.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: isSelected ? iconColor : '#94a3b8', marginTop: 2 }}>
                      {type.coins} 🪙
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.inputLabel, currentTheme === 'dark' && { color: '#fff' }]}>Açık Adresiniz</Text>
            <TextInput
              style={[styles.addressInput, currentTheme === 'dark' && { backgroundColor: '#1e293b', color: '#fff', borderColor: '#334155' }]}
              multiline={true}
              numberOfLines={4}
              value={detailedAddress}
              onChangeText={setDetailedAddress}
              placeholder="Sokak, mahalle, bina no ve daire no bilgilerini detaylıca giriniz..."
              placeholderTextColor="#94a3b8"
            />

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && { backgroundColor: '#86efac' }]}
              onPress={handleWasteSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Bildirimi Gönder</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Geri Dönüşüm Yolculuğum İstatistik Modalı */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={journeyModalVisible}
        onRequestClose={() => setJourneyModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalSafeArea, currentTheme === 'dark' && { backgroundColor: '#0f172a' }, { position: 'relative' }]}>

          <View style={[styles.modalHeader, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
            <TouchableOpacity 
              style={[styles.modalBackButtonCircle, currentTheme === 'dark' && { backgroundColor: '#334155' }]}
              onPress={() => setJourneyModalVisible(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="caret-back" size={20} color={currentTheme === 'dark' ? '#fff' : '#1e293b'} style={{ marginRight: 2 }} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, currentTheme === 'dark' && { color: '#fff' }]}>Geri Dönüşüm Yolculuğum</Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
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
              Atıklarınızı geri dönüştürerek kazandığınız puanlardır. Anlaşmalı mağazalarda indirim ve ödüller için kullanabilirsiniz. Ne kadar çok geri dönüştürürseniz, o kadar çok coin kazanırsınız! 🌱
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
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#eee',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 22,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#fef9e7',
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
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
  
  // Yeni Stiller
  quickActionsSection: {
    marginBottom: 25,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 15,
  },
  quickActionSquare: {
    width: 110,
    height: 110,
    backgroundColor: '#f0fdf4',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#16a34a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      }
    }),
  },
  quickActionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
    textAlign: 'center',
    lineHeight: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 72, // Enine göre uzatılmış, son derece premium uzunluk
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  modalBackButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalScrollContent: {
    padding: 20,
  },
  formScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 8,
    marginTop: 16,
  },
  regionInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  regionInfoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  wasteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 4,
  },
  wasteCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
  },
  wasteCardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  wasteCardText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  addressInput: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 16,
    height: 100,
    textAlignVertical: 'top',
    fontSize: 15,
    color: '#1e293b',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#16a34a',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    ...Platform.select({
      ios: {
        shadowColor: '#16a34a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      }
    }),
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
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
});
