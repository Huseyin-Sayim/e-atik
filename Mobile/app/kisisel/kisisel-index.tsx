import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Platform, StatusBar, TouchableOpacity, Image, Alert } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import DatabaseService from '../../database/DatabaseService';

const DEFAULT_AVATAR = require('../../assets/images/default-avatar.png');

const parseTransactionDescription = (fullDesc: string | null) => {
  if (!fullDesc) return { name: 'Atık Dönüşüm Ödülü', option: 'QR Kod' };

  // Clean up duplicate suffixes if any first
  let desc = fullDesc;
  const suffixRegex = /\s*\((qr|barkod)\s*\|\s*[^)]+\)/g;
  const matches = desc.match(suffixRegex);
  if (matches && matches.length > 1) {
    desc = desc.replace(suffixRegex, '');
    desc = `${desc} ${matches[0].trim()}`;
  }

  // Check if it matches "(barkod | <code>)"
  const barcodeMatch = desc.match(/(.*?)\s*\(barkod\s*\|\s*([^)]+)\)/);
  if (barcodeMatch) {
    return {
      name: barcodeMatch[1].trim(),
      option: `Barkod (${barcodeMatch[2].trim()})`
    };
  }

  // Check if it matches "(qr | <code>)"
  const qrMatch = desc.match(/(.*?)\s*\(qr\s*\|\s*([^)]+)\)/);
  if (qrMatch) {
    return {
      name: qrMatch[1].trim(),
      option: `QR Kod (${qrMatch[2].trim()})`
    };
  }

  // Check if it matches "(qr)"
  const qrOnlyMatch = desc.match(/(.*?)\s*\(qr\)/);
  if (qrOnlyMatch) {
    return {
      name: qrOnlyMatch[1].trim(),
      option: 'QR Kod'
    };
  }

  // Check if it's a purchase (Market)
  if (desc.includes('Market') || desc.includes('Satın Alma')) {
    return {
      name: desc,
      option: 'Market Harcaması'
    };
  }

  // Default fallback
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

  // Remove any suffixes like " (barkod | 123)" or " (qr | 123)" or " (qr)" for clean list display
  return description.replace(/\s*\((qr|barkod)\s*(\|\s*[^)]+)?\)/g, '').replace(/\s*\(qr\)/g, '').trim();
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

  React.useEffect(() => {
    const unsubscribe = DatabaseService.subscribeToProfilePhoto((newPhoto) => {
      setProfileImage(newPhoto);
    });
    return unsubscribe;
  }, []);

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
        setProfileImage(savedPhoto); 

        const savedPoints = await AsyncStorage.getItem(`userPoints_${lowerEmail}`);
        if (savedPoints) {
          setPoints(parseInt(savedPoints));
        } else {
          await AsyncStorage.setItem(`userPoints_${lowerEmail}`, '0');
          setPoints(0);
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
            {transactions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyText}>Henüz bir işleminiz bulunmuyor.</Text>
              </View>
            ) : (
              transactions.map((item, index) => {
                const isMarket = item.description && item.description.includes('Market');
                const isSpent = item.type === 'SPENT';
                const pointsPrefix = isSpent ? '-' : '+';
                const pointsColor = isSpent ? '#ef4444' : '#2e7d32';
                const iconBgColor = isMarket ? '#e3f2fd' : '#e8f5e9';
                const iconColor = isMarket ? '#1565c0' : '#2e7d32';
                const isBarcode = item.description && item.description.includes('barkod');
                const iconName = isMarket 
                  ? 'cart-outline' 
                  : (isBarcode ? 'barcode-outline' : 'qr-code-outline');

                return (
                  <TouchableOpacity 
                    key={item.id} 
                    style={[styles.transactionItem, index === transactions.length - 1 && { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      const cleanDesc = formatTransactionDescription(item.description, item.amount);
                      const parsed = parseTransactionDescription(item.description || 'Geri Dönüşüm Ödülü');
                      const conversionLine = isMarket 
                        ? `⚙️ İşlem Türü: ${parsed.option}` 
                        : `⚙️ Dönüştürme Seçeneği: ${parsed.option}`;

                      Alert.alert(
                        'İşlem Detayları',
                        `📝 Açıklama: ${cleanDesc}\n\n${conversionLine}\n\n🪙 Puan Değişimi: ${pointsPrefix}${item.amount} Puan\n\n📅 İşlem Tarihi: ${formatTransactionDate(item.createdAt)}\n\n🆔 İşlem Numarası: ${item.id}`,
                        [{ text: 'Tamam', style: 'default' }]
                      );
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
                      <Text style={styles.transactionName}>{formatTransactionDescription(item.description, item.amount)}</Text>
                      <Text style={styles.transactionDate}>{formatTransactionDate(item.createdAt)}</Text>
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
  }
});
