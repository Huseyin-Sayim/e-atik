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
  ActivityIndicator,
  Alert,
  Modal
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import DatabaseService from '../../database/DatabaseService';

const parseTransactionDescription = (fullDesc: string | null) => {
  if (!fullDesc) return { name: 'Atık Toplama/Dönüşüm İşlemi', option: 'QR Kod' };

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
  if (!description || description === 'QR Kod Tarama Ödülü' || description === 'Geri Dönüşüm Ödülü' || description === 'Atık Toplama/Dönüşüm İşlemi') {
    switch (amount) {
      case 2: return 'Plastik Kapak Toplama İşlemi';
      case 3: return 'Kağıt / Naylon Poşet Toplama İşlemi';
      case 4: return 'Karton / Cam Kavanoz Toplama İşlemi';
      case 5: return 'Pet Şişe Toplama İşlemi';
      case 7: return 'Metal Kutu Toplama İşlemi';
      case 8: return 'Cam Şişe Toplama İşlemi';
      case 10: return 'Atık Lastik Toplama İşlemi';
      case 12: return 'Tekstil Toplama İşlemi';
      case 15: return 'Pil / Ahşap Toplama İşlemi';
      case 20: return 'Bitkisel Yağ Toplama İşlemi';
      case 50: return 'E-Atık Toplama İşlemi';
      default: return 'Atık Toplama/Dönüşüm İşlemi';
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

export default function KurumsalTransactionsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [currentTheme, setCurrentTheme] = useState('light');
  const [customAlertVisible, setCustomAlertVisible] = useState(false);
  const [customAlertTitle, setCustomAlertTitle] = useState('');
  const [customAlertMessage, setCustomAlertMessage] = useState('');

  const showCustomAlert = (title: string, message: string) => {
    setCustomAlertTitle(title);
    setCustomAlertMessage(message);
    setCustomAlertVisible(true);
  };

  React.useEffect(() => {
    const unsubscribe = DatabaseService.subscribeToTheme((theme) => {
      setCurrentTheme(theme);
    });
    return unsubscribe;
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadTransactions();
    }, [])
  );

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const fetchedTransactions = await DatabaseService.getTransactions();
      // Tarihe göre en yeniden en eskiye sıralayalım (kronolojik)
      if (Array.isArray(fetchedTransactions)) {
        const sorted = fetchedTransactions.sort((a: any, b: any) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setTransactions(sorted);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error('Kurumsal işlem geçmişi yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, currentTheme === 'dark' && { backgroundColor: '#0f172a' }]}>
      <StatusBar barStyle={currentTheme === 'dark' ? "light-content" : "dark-content"} />
      
      {/* Şık Header */}
      <View style={[styles.header, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity style={[styles.backButton, currentTheme === 'dark' && { backgroundColor: '#334155' }]} onPress={() => router.replace('/kurumsal/kurumsal-index')}>
          <Ionicons name="arrow-back" size={24} color={currentTheme === 'dark' ? '#fff' : '#1e293b'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, currentTheme === 'dark' && { color: '#fff' }]}>Yapılan Son İşlemler</Text>
        <View style={{ width: 40 }} /> {/* Hizalama için boşluk */}
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2e7d32" />
            <Text style={[styles.loadingText, currentTheme === 'dark' && { color: '#94a3b8' }]}>İşlem geçmişi yükleniyor...</Text>
          </View>
        ) : transactions.length > 0 ? (
          <View style={[styles.transactionsList, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            {transactions.map((item, index) => {
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
                : (isBarcode ? 'barcode' : 'qrcode');

              return (
                <TouchableOpacity 
                  key={item.id} 
                  style={[
                    styles.transactionItem, 
                    index === transactions.length - 1 && { borderBottomWidth: 0 },
                    currentTheme === 'dark' && { borderBottomColor: '#334155' }
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    const cleanDesc = formatTransactionDescription(item.description, item.amount);
                    const parsed = parseTransactionDescription(item.description || 'Atık Toplama/Dönüşüm İşlemi');
                    const conversionLine = isMarket 
                      ? `⚙️ İşlem Türü: ${parsed.option}` 
                      : `⚙️ Dönüştürme Seçeneği: ${parsed.option}`;

                    showCustomAlert(
                      'İşlem Detayları',
                      `📝 Açıklama: ${cleanDesc}\n\n${conversionLine}\n\n🪙 Puan Değişimi: ${pointsPrefix}${item.amount} Puan\n\n📅 İşlem Tarihi: ${formatTransactionDate(item.createdAt)}\n\n🆔 İşlem Numarası: ${item.id}`
                    );
                  }}
                >
                  <View style={[styles.transactionIconContainer, { backgroundColor: iconBgColor }]}>
                    <MaterialCommunityIcons 
                      name={iconName as any} 
                      size={22} 
                      color={iconColor} 
                    />
                  </View>
                  <View style={styles.transactionDetails}>
                    <Text style={[styles.transactionName, currentTheme === 'dark' && { color: '#fff' }]}>
                      {formatTransactionDescription(item.description, item.amount)}
                    </Text>
                    <Text style={[styles.transactionDate, currentTheme === 'dark' && { color: '#94a3b8' }]}>
                      {formatTransactionDate(item.createdAt)}
                    </Text>
                  </View>
                  <Text style={[styles.transactionPoints, { color: pointsColor }]}>
                    {pointsPrefix}{item.amount} Puan
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="history" size={64} color="#94a3b8" />
            <Text style={styles.emptyText}>Henüz yapılmış bir işlem bulunmuyor.</Text>
          </View>
        )}
      </ScrollView>

      {/* ÖZEL ALERT MODALI */}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Ionicons name="information-circle" size={24} color={currentTheme === 'dark' ? '#34d399' : '#2e7d32'} />
              <Text style={{ 
                fontSize: 20, 
                fontWeight: 'bold', 
                color: currentTheme === 'dark' ? '#fff' : '#1e293b',
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  container: {
    padding: 16,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  transactionsList: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
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
    paddingVertical: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 250,
  }
});
