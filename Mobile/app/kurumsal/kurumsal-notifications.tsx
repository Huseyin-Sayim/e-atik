import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Platform, StatusBar, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DatabaseService from '../../database/DatabaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import campusParcels from '../../assets/kampusParsel.json';

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

interface TrashBin {
  id: string;
  name: string;
  fillPercentage: number;
  latitude: number;
  longitude: number;
  isRequest?: boolean;
  status?: string;
  note?: string;
  userFullName?: string;
  wasteType?: string;
}

export default function KurumsalNotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<TrashBin[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTheme, setCurrentTheme] = useState('light');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [showRegionPrompt, setShowRegionPrompt] = useState(false);

  useEffect(() => {
    loadNotifications();

    const unsubscribe = DatabaseService.subscribeToBins(() => {
      loadNotifications();
    });

    const unsubTheme = DatabaseService.subscribeToTheme((theme) => {
      setCurrentTheme(theme);
    });

    // WebSocket Bağlantısı (Canlı Bildirim Güncellemeleri İçin)
    const wsUrl = DatabaseService.getWsUrl();
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => console.log('✅ WebSocket Bağlantısı Kuruldu (Tüm Bildirimler)');
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'wasteRequestCreated' || payload.type === 'wasteRequestStatusChanged') {
          console.log('🔄 Yeni evsel atık bildirim listesi güncellemesi algılandı...');
          loadNotifications();
        }
      } catch (err) {
        // Yoksay
      }
    };
    ws.onerror = (e) => console.warn('WebSocket Hatası (Tüm Bildirimler):', e);

    return () => {
      unsubscribe();
      unsubTheme();
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const fetchedBins = await DatabaseService.getBins();
      
      const mappedBins = fetchedBins.map(b => ({
        id: b.id.toString(),
        name: b.name || 'İsimsiz Kutu',
        fillPercentage: b.predictedFullness || 0,
        latitude: parseFloat(b.latitude),
        longitude: parseFloat(b.longitude),
        isRequest: false,
      }));

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
        console.warn('Evsel atıklar çekilirken hata oluştu:', reqErr);
      }
      // --- YENİ BÖLGE TABANLI FİLTRELEME MANTIĞI ---
      const selectedRegionId = await AsyncStorage.getItem('@staff_selected_region');
      
      let filteredBins = mappedBins;

      if (selectedRegionId) {
        const selectedFeature = campusParcels.features.find((f: any) => f.id === selectedRegionId);
        if (selectedFeature) {
          const polyCoords = selectedFeature.geometry.coordinates;
          filteredBins = mappedBins.filter(bin => isPointInPolygon(bin.latitude, bin.longitude, polyCoords));
        }
      }

      // Evsel atık taleplerini ilk gelen (en eski) en üstte kalacak şekilde sırala (Bölgeden bağımsız, tüm talepler gösterilir)
      const domesticRequests = [...mappedRequests].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Kutuları doluluk oranlarına göre sırala (büyükten küçüğe)
      const sortedBins = [...filteredBins].sort((a, b) => b.fillPercentage - a.fillPercentage);

      // Kırmızı kutuların hepsi temizlendiyse ve bölge seçilmişse "Başka bölge seçin" uyarısını tetikle
      const redBins = sortedBins.filter(b => b.fillPercentage >= 75);
      if (selectedRegionId && redBins.length === 0) {
        setShowRegionPrompt(true);
      } else {
        setShowRegionPrompt(false);
      }

      // Öncelik Sıralaması:
      // 1. Seçilen Bölgenin Atık Kutuları (Azalan doluluk oranına göre)
      // 2. Evsel Atık Talepleri (Bölgeden bağımsız, en eski gelen üstte)
      let combined: any[] = [
        ...sortedBins,
        ...domesticRequests
      ];

      setNotifications(combined);
    } catch (e) {
      console.error('Bildirimler yüklenirken hata:', e);
    } finally {
      setLoading(false);
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
        <TouchableOpacity style={[styles.backButton, currentTheme === 'dark' && { backgroundColor: '#334155' }]} onPress={() => router.replace('/kurumsal/kurumsal-index')}>
          <Ionicons name="arrow-back" size={24} color={currentTheme === 'dark' ? '#fff' : '#1e293b'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, currentTheme === 'dark' && { color: '#fff' }]}>Tüm Bildirimler</Text>
        <View style={{ width: 40 }} /> {/* Sağ tarafta denge için boşluk */}
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={[styles.loaderText, currentTheme === 'dark' && { color: '#94a3b8' }]}>Bildirimler yükleniyor...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {showRegionPrompt && (
            <View style={[styles.regionPromptBanner, currentTheme === 'dark' && { backgroundColor: '#1e3a8a', borderColor: '#1e40af' }]}>
              <Ionicons name="information-circle" size={24} color={currentTheme === 'dark' ? '#60a5fa' : '#2563eb'} />
              <Text style={[styles.regionPromptText, currentTheme === 'dark' && { color: '#bfdbfe' }]}>
                Seçili bölgedeki acil atıklar toplandı, lütfen başka bir bölge seçiniz.
              </Text>
            </View>
          )}
          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {notifications.map((bin, index) => {
            const isReq = bin.isRequest;
            const priorityColor = isReq ? '#2563eb' : getPriorityColor(bin.fillPercentage);
            const iconName = isReq ? 'home' : getPriorityIcon(bin.fillPercentage);

            return (
              <TouchableOpacity 
                key={bin.id} 
                style={[styles.notificationCard, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}
                onPress={() => {
                  if (isReq) {
                    setSelectedItem(bin);
                    setModalVisible(true);
                  }
                }}
                activeOpacity={isReq ? 0.7 : 1}
              >
                <View style={styles.priorityBar(priorityColor)} />
                <View style={styles.iconContainer(priorityColor)}>
                  <Ionicons name={iconName as any} size={24} color={priorityColor} />
                </View>
                <View style={styles.contentContainer}>
                  {isReq ? (
                    <Text style={[styles.messageText, currentTheme === 'dark' && { color: '#cbd5e1' }]}>
                      <Text style={{ fontWeight: 'bold', color: '#2563eb' }}>[EVSEL ATIK] </Text>
                      <Text style={currentTheme === 'dark' && { color: '#94a3b8' }}>Lütfen </Text>
                      <Text style={[styles.boldText, currentTheme === 'dark' && { color: '#fff' }]}>{bin.name}</Text>
                      <Text style={currentTheme === 'dark' && { color: '#94a3b8' }}> konumundaki atık talebine yol alınız.</Text>
                    </Text>
                  ) : (
                    <Text style={[styles.messageText, currentTheme === 'dark' && { color: '#cbd5e1' }]}>
                      <Text style={currentTheme === 'dark' && { color: '#94a3b8' }}>Lütfen </Text>
                      <Text style={[styles.boldText, currentTheme === 'dark' && { color: '#fff' }]}>{bin.name}</Text>
                      <Text style={currentTheme === 'dark' && { color: '#94a3b8' }}> konumundaki atık kutusuna gidiniz.</Text>
                    </Text>
                  )}
                  <View style={styles.detailsRow}>
                    {isReq ? (
                      <Text style={[styles.percentageText, { color: '#2563eb', fontSize: 12 }]}>
                        TALEP: {bin.status === 'PENDING' ? 'BEKLEMEDE' : 'YOLDA'}
                      </Text>
                    ) : (
                      <Text style={[styles.percentageText, { color: priorityColor }]}>
                        Doluluk: %{bin.fillPercentage}
                      </Text>
                    )}
                    <Text style={[styles.coordsText, currentTheme === 'dark' && { color: '#64748b' }]}>
                      {bin.latitude.toFixed(5)}, {bin.longitude.toFixed(5)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {notifications.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={60} color="#cbd5e1" />
              <Text style={styles.emptyText}>Henüz hiç bildirim yok.</Text>
            </View>
          )}
        </ScrollView>
        </View>
      )}

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
                          await DatabaseService.updateWasteRequestStatus(selectedItem.id.replace('req_', ''), 'ON_ROUTE');
                          loadNotifications();
                          setModalVisible(false);
                          Alert.alert('Durum Güncellendi', 'Talep durumu "Yolda" olarak güncellendi.');
                        } catch (err: any) {
                          Alert.alert('Hata', err.message || 'Durum güncellenirken hata oluştu.');
                        }
                      }}
                    >
                      <Ionicons name="navigate" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.btnText}>Yolda Olarak İşaretle</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity 
                    style={styles.collectBtn}
                    onPress={async () => {
                      try {
                        await DatabaseService.updateWasteRequestStatus(selectedItem.id.replace('req_', ''), 'COLLECTED');
                        loadNotifications();
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },
  regionPromptBanner: {
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
    padding: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  regionPromptText: {
    flex: 1,
    color: '#1e3a8a',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  priorityBar: (color: string) => ({
    width: 6,
    backgroundColor: color,
  }),
  iconContainer: (color: string) => ({
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: color + '15', // %15 opacity
  }),
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  messageText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
    marginBottom: 8,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#0f172a',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  coordsText: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
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
