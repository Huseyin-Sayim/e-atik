import React, { useState } from 'react';
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
  ActivityIndicator 
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

export default function KisiselIndexScreen() {
  const [userName, setUserName] = useState('...');
  const [points, setPoints] = useState(0);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Evsel Atık ve Detaylı Son İşlemler İçin State Tanımları
  const [wasteModalVisible, setWasteModalVisible] = useState(false);
  const [allTransactionsVisible, setAllTransactionsVisible] = useState(false);
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
        const savedName = await AsyncStorage.getItem(`userName_${lowerEmail}`);
        if (savedName) setUserName(savedName);
        
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
      Alert.alert('Eksik Seçim', 'Lütfen evsel atık türünü seçiniz.');
      return;
    }
    if (!detailedAddress.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen açık adres bilginizi giriniz.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Konum izinlerini kontrol et
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsSubmitting(false);
        Alert.alert(
          'Konum İzni Gerekli',
          'Evsel atık bildirimi yapabilmek için konum izni vermeniz gerekmektedir. Lütfen ayarlardan konum erişimine izin verin.'
        );
        return;
      }

      // 2. Güncel konumu çek
      const location = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Balanced 
      });

      const latitude = location.coords.latitude;
      const longitude = location.coords.longitude;

      // 3. Atık türünü veritabanı enum değerlerine eşle
      let mappedCategory = 'GENERAL';
      if (selectedWasteType === 'organic') mappedCategory = 'DOMESTIC';
      else if (selectedWasteType === 'electronic') mappedCategory = 'ELECTRONIC';
      else if (selectedWasteType === 'packaging') mappedCategory = 'PLASTIC';

      // 4. API'ye gönder
      await DatabaseService.createWasteRequest({
        wasteType: mappedCategory,
        note: detailedAddress,
        latitude,
        longitude
      });

      setIsSubmitting(false);
      setWasteModalVisible(false);
      
      // Formu temizle
      setSelectedWasteType(null);
      setDetailedAddress('');

      // Başarılı uyarısı
      Alert.alert(
        'İşlem Başarılı!',
        'Evsel atık bildiriminiz ilgili kuruma başarıyla iletilmiştir. Ekiplerimiz en kısa sürede adresinize yönlendirilecektir.'
      );
    } catch (err: any) {
      setIsSubmitting(false);
      console.error('Evsel atık bildirimi gönderilemedi:', err);
      Alert.alert(
        'Hata',
        err.message || 'Evsel atık bildirimi sunucuya gönderilirken bir hata oluştu.'
      );
    }
  };

  const wasteTypes = [
    { id: 'organic', name: 'Mutfak / Organik Atık', icon: 'leaf-outline', color: '#16a34a', bg: '#f0fdf4' },
    { id: 'bulky', name: 'Hacimli Atık (Koltuk vb.)', icon: 'bed-outline', color: '#d97706', bg: '#fffbeb' },
    { id: 'garden', name: 'Bahçe ve Dal Atıkları', icon: 'flower-outline', color: '#059669', bg: '#ecfdf5' },
    { id: 'electronic', name: 'Elektronik Evsel Atık', icon: 'hardware-chip-outline', color: '#2563eb', bg: '#eff6ff' },
    { id: 'packaging', name: 'Ambalaj (Kağıt, Plastik)', icon: 'cube-outline', color: '#7c3aed', bg: '#f5f3ff' },
  ];

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
        <View style={[styles.pointContainer, currentTheme === 'dark' && { backgroundColor: '#334155' }]}>
          <Text style={[styles.pointText, currentTheme === 'dark' && { color: '#fff' }]}>{points}</Text>
          <FontAwesome5 name="coins" size={20} color="#FFD700" />
        </View>
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
                const isSpent = item.type === 'SPENT';
                const pointsPrefix = isSpent ? '-' : '+';
                const pointsColor = isSpent ? '#ef4444' : '#2e7d32';
                
                const iconBgColor = currentTheme === 'dark' 
                  ? (isMarket ? '#1e3a8a' : '#065f46') 
                  : (isMarket ? '#e3f2fd' : '#e8f5e9');
                const iconColor = currentTheme === 'dark'
                  ? (isMarket ? '#60a5fa' : '#34d399') 
                  : (isMarket ? '#1565c0' : '#2e7d32');
                  
                const isBarcode = item.description && item.description.includes('barkod');
                const iconName = isMarket 
                  ? 'cart-outline' 
                  : (isBarcode ? 'barcode-outline' : 'qr-code-outline');

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
            <Text style={[styles.modalTitle, currentTheme === 'dark' && { color: '#fff' }]}>Tüm İşlemlerim</Text>
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
                  const isSpent = item.type === 'SPENT';
                  const pointsPrefix = isSpent ? '-' : '+';
                  const pointsColor = isSpent ? '#ef4444' : '#2e7d32';
                  
                  const iconBgColor = currentTheme === 'dark' 
                    ? (isMarket ? '#1e3a8a' : '#065f46') 
                    : (isMarket ? '#e3f2fd' : '#e8f5e9');
                  const iconColor = currentTheme === 'dark'
                    ? (isMarket ? '#60a5fa' : '#34d399') 
                    : (isMarket ? '#1565c0' : '#2e7d32');
                    
                  const isBarcode = item.description && item.description.includes('barkod');
                  const iconName = isMarket 
                    ? 'cart-outline' 
                    : (isBarcode ? 'barcode-outline' : 'qr-code-outline');

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
              {wasteTypes.map((type) => {
                const isSelected = selectedWasteType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.wasteCard,
                      { backgroundColor: currentTheme === 'dark' ? '#1e293b' : type.bg },
                      isSelected && { borderColor: '#16a34a', borderWidth: 2, transform: [{ scale: 0.98 }] },
                      currentTheme === 'dark' && !isSelected && { borderColor: '#334155', borderWidth: 1 }
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setSelectedWasteType(type.id)}
                  >
                    <View style={styles.wasteCardIconContainer}>
                      <Ionicons name={type.icon as any} size={28} color={isSelected ? '#16a34a' : type.color} />
                    </View>
                    <Text style={[
                      styles.wasteCardText, 
                      currentTheme === 'dark' && { color: '#fff' },
                      isSelected && { fontWeight: 'bold', color: '#16a34a' }
                    ]}>
                      {type.name}
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
    marginBottom: 15,
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
});
