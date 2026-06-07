import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StatusBar,
  Image,
  Share,
  LayoutAnimation,
  UIManager
} from 'react-native';
import { MapView, Marker, PROVIDER_DEFAULT, Geojson } from '../../components/MapComponent';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DatabaseService from '../../database/DatabaseService';
import { useBinFullnessLive } from '../../hooks/useBinFullnessLive';
import { toFillPercentage } from '../../utils/fullness';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// GeoJSON verisini import ediyoruz
import campusParcels from '../../assets/kampusParsel.json';

const CAMPUS_CENTER = {
  latitude: 38.4553,
  longitude: 27.2290,
  latitudeDelta: 0.0135,
  longitudeDelta: 0.0135,
};

type FillLevel = 'low' | 'medium' | 'high';

interface TrashBin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  fillPercentage: number;
  lastUpdated: string;
  type: 'plastik' | 'kagit' | 'cam' | 'genel';
  capacity: number;
  isRequest?: boolean;
  dbId?: string;
  note?: string;
  userFullName?: string;
  wasteType?: string;
  status?: string;
  qrCode?: string;
  barCode?: string;
}

function getFillLevel(percentage: number): FillLevel {
  if (percentage < 40) return 'low';
  if (percentage < 75) return 'medium';
  return 'high';
}

function getPinColor(percentage: number): string {
  const level = getFillLevel(percentage);
  if (level === 'low') return '#27ae60';
  if (level === 'medium') return '#f39c12';
  return '#e74c3c';
}



export default function KisiselLocationScreen() {
  const mapRef = useRef<MapView>(null);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const wsRef = useRef<WebSocket | null>(null);

  const [bins, setBins] = useState<TrashBin[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedBin, setSelectedBin] = useState<TrashBin | null>(null);
  const [filterLevel, setFilterLevel] = useState<FillLevel | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [isListModalVisible, setIsListModalVisible] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('light');
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [isInspectMode, setIsInspectMode] = useState(false);

  useBinFullnessLive(bins, setBins, {
    selectedBin,
    onSelectedBinChange: setSelectedBin,
  });

  useEffect(() => {
    const unsubscribe = DatabaseService.subscribeToTheme((theme) => {
      setCurrentTheme(theme);
    });
    return unsubscribe;
  }, []);

  // İlk yükleme ve Pub-Sub aboneliği (Bireysel QR tara veya kurumsal boşalt işleminde harita anında güncellenir!)
  useEffect(() => {
    const initApp = async () => {
      await loadBins();
      setupLocation();
    };

    initApp();

    const unsubscribe = DatabaseService.subscribeToBins(() => {
      loadBins();
    });

    // WebSocket bağlantısı: kutu ve talep değişikliklerini anlık dinle
    const wsUrl = DatabaseService.getWsUrl();
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => console.log('✅ WS Bağlandı (Kişisel Harita)');
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (
          payload.type === 'wasteRequestCreated' ||
          payload.type === 'wasteRequestStatusChanged' ||
          payload.type === 'binCreated' ||
          payload.type === 'binUpdated' ||
          payload.type === 'binDeleted'
        ) {
          loadBins();
        }
      } catch (_) {}
    };
    ws.onerror = (e) => console.warn('WS Hatası (Kişisel Harita):', e);
    wsRef.current = ws;

    return () => {
      unsubscribe();
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, []);

  // Bins listesi güncellendiğinde seçili kutunun da canlı değerlerini besle
  useEffect(() => {
    if (selectedBin) {
      const current = bins.find(b => b.id === selectedBin.id);
      if (current) {
        setSelectedBin(current);
      }
    }
  }, [bins]);

  const setupLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setUserLocation({ latitude: initial.coords.latitude, longitude: initial.coords.longitude });
      }
    } catch (e) {
      console.warn('Konum alınamadı');
    }
  };

  const loadBins = async () => {
    try {
      setLoading(true);
      let fetchedBins = await DatabaseService.getBins();

      const mappedBins: TrashBin[] = fetchedBins.map(b => ({
        id: b.id.toString(),
        name: b.name || 'İsimsiz Kutu',
        latitude: parseFloat(b.latitude),
        longitude: parseFloat(b.longitude),
        fillPercentage: toFillPercentage(b.predictedFullness),
        type: b.wasteCategory === 'PLASTIC' ? 'plastik' : b.wasteCategory === 'GLASS' ? 'cam' : b.wasteCategory === 'PAPER' ? 'kagit' : 'genel',
        capacity: (b.wasteCategory === 'PLASTIC' || b.wasteCategory === 'PAPER') ? 50 : 100,
        lastUpdated: 'Şimdi',
        isRequest: false,
        qrCode: b.qrCode || undefined,
        barCode: b.barCode || undefined
      }));

      setBins(mappedBins);
    } catch (e) {
      console.log('❌ Yükleme hatası (Offline Mod):', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBin) {
      if (!isInspectMode) {
        Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
      } else {
        Animated.timing(cardAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      }
    } else {
      setIsInspectMode(false);
      Animated.timing(cardAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [selectedBin, isInspectMode]);

  useEffect(() => {
    if (selectedBin) {
      fetchRoute(selectedBin);
    } else {
      setRouteCoordinates([]);
    }
  }, [selectedBin]);

  const fetchRoute = useCallback(async (destination: TrashBin) => {
    if (!userLocation) {
      Alert.alert('Konum Bekleniyor', 'GPS konumunuz henüz alınamadı. Lütfen birkaç saniye bekleyip tekrar deneyin.');
      return;
    }
    try {
      const url = `https://router.project-osrm.org/route/v1/foot/${userLocation.longitude},${userLocation.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const json = await response.json();
      if (json.routes && json.routes.length > 0) {
        const coords = json.routes[0].geometry.coordinates.map((c: any[]) => ({
          latitude: c[1],
          longitude: c[0]
        }));
        setRouteCoordinates(coords);
      } else {
        setRouteCoordinates([userLocation, { latitude: destination.latitude, longitude: destination.longitude }]);
      }
      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: destination.latitude,
          longitude: destination.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
      }, 100);
    } catch (e) {
      setRouteCoordinates([userLocation, { latitude: destination.latitude, longitude: destination.longitude }]);
    }
  }, [userLocation]);

  const goToMyLocation = useCallback(async () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.004, longitudeDelta: 0.004 }, 600);
    }
  }, [userLocation]);

  const goToCampus = useCallback(() => {
    setSelectedBin(null);
    mapRef.current?.animateToRegion(CAMPUS_CENTER, 600);
  }, []);

  const goToFullestBin = useCallback(() => {
    const sorted = [...bins].sort((a, b) => b.fillPercentage - a.fillPercentage);
    const fullestBin = sorted[0];
    if (fullestBin) {
      setSelectedBin(fullestBin);
      mapRef.current?.animateToRegion({ latitude: fullestBin.latitude, longitude: fullestBin.longitude, latitudeDelta: 0.002, longitudeDelta: 0.002 }, 800);
    }
  }, [bins]);

  const filteredBins = bins.filter((bin) => filterLevel === 'all' || getFillLevel(bin.fillPercentage) === filterLevel);
  const regularBins = filteredBins;

  if (loading) {
    return <View style={styles.loader}><ActivityIndicator size="large" color="#2e7d32" /></View>;
  }

  const getBinTypeName = (type: string) => {
    if (type === 'plastik') return 'Plastik';
    if (type === 'kagit') return 'Kağıt';
    if (type === 'cam') return 'Cam';
    return 'Genel Atık';
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={CAMPUS_CENTER}
        showsUserLocation={true}
        onPress={() => setSelectedBin(null)}
        campusParcels={campusParcels}
        bins={filteredBins}
        onMarkerPress={(bin) => {
          setSelectedBin(bin);
          setIsInspectMode(false);
          setRouteCoordinates([]);
        }}
        staffLocation={userLocation}
        routeCoordinates={routeCoordinates}
        routeColor="green"
      />

      <View style={[styles.headerBar, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.headerTitle, currentTheme === 'dark' && { color: '#fff' }]}>🗺️ Kampüs Haritası</Text>
            <Text style={[styles.headerSubtitle, currentTheme === 'dark' && { color: '#94a3b8' }]}>{regularBins.length} Kutu</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.binCountBadge, currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569' }]}
              onPress={() => setIsListModalVisible(true)}
            >
              <Text style={[styles.binCountText, currentTheme === 'dark' && { color: '#fff' }]}>{regularBins.length}</Text>
              <Text style={[styles.binCountLabel, currentTheme === 'dark' && { color: '#94a3b8' }]}>Kutu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'low', 'medium', 'high'] as const).map((level) => (
          <TouchableOpacity 
            key={level} 
            style={[styles.filterBtn, currentTheme === 'dark' && { backgroundColor: '#1e293b' }, filterLevel === level && styles.filterBtnActive]} 
            onPress={() => setFilterLevel(level)}
          >
            <Text style={[styles.filterBtnText, currentTheme === 'dark' && { color: '#cbd5e1' }, filterLevel === level && styles.filterBtnTextActive]}>
              {level === 'all' ? 'Tümü' : level === 'low' ? '🟢 Boş' : level === 'medium' ? '🟡 Orta' : '🔴 Dolu'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={[styles.actionBtn, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]} onPress={goToFullestBin}>
          <MaterialCommunityIcons name="alert-rhombus" size={28} color="#e74c3c" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]} onPress={goToMyLocation}>
          <Ionicons name="locate" size={22} color="#2e7d32" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]} onPress={goToCampus}>
          <Ionicons name="map-outline" size={22} color="#2e7d32" />
        </TouchableOpacity>
      </View>

      {selectedBin && (
        <Animated.View style={[styles.detailCard, currentTheme === 'dark' && { backgroundColor: '#1e293b' }, { 
          opacity: cardAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.8, 1] }),
          transform: [
            { translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) },
            { scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] }) },
            { translateX: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [150, 0] }) }
          ] 
        }]}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, marginRight: 32 }}>
              <Text style={[styles.cardName, currentTheme === 'dark' && { color: '#fff' }]}>{selectedBin.name}</Text>
              <Text style={[styles.cardUpdate, currentTheme === 'dark' && { color: '#94a3b8' }]}>
                {getBinTypeName(selectedBin.type)} Atık Kutusu • {selectedBin.capacity}L Kapasite
              </Text>
            </View>
            <TouchableOpacity 
              style={{ position: 'absolute', right: 0, top: 0, padding: 4 }} 
              onPress={() => setSelectedBin(null)}
            >
              <Ionicons name="close-circle" size={26} color={currentTheme === 'dark' ? '#94a3b8' : '#ccc'} />
            </TouchableOpacity>
          </View>
          <View style={styles.cardBody}>
            {selectedBin.isRequest ? (
              <View style={{ marginBottom: 6 }}>
                <View style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', marginBottom: 2 }}>AÇIK ADRES / NOT</Text>
                  <Text style={{ fontSize: 14, color: currentTheme === 'dark' ? '#f8fafc' : '#1e293b' }}>{selectedBin.note || 'Belirtilmedi'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8' }}>DURUM:</Text>
                  <View style={{
                    backgroundColor: selectedBin.status === 'ON_ROUTE' ? '#fffbeb' : '#f0fdf4',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 12
                  }}>
                    <Text style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: selectedBin.status === 'ON_ROUTE' ? '#d97706' : '#16a34a'
                    }}>
                      {selectedBin.status === 'ON_ROUTE' ? 'Yolda (Ekipler Yönlendirildi)' : 'Beklemede'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              /* Koordinat Gösterimi + Rotayı İncele Butonu */
              <>
                <View style={[styles.coordDisplayRow, currentTheme === 'dark' && { backgroundColor: '#334155' }]}>
                  <View style={styles.coordItem}>
                    <Text style={[styles.coordLabel, currentTheme === 'dark' && { color: '#94a3b8' }]}>ENLEM:</Text>
                    <Text style={[styles.coordValue, currentTheme === 'dark' && { color: '#fff' }]}>{selectedBin.latitude.toFixed(6)}</Text>
                  </View>
                  <View style={styles.coordItem}>
                    <Text style={[styles.coordLabel, currentTheme === 'dark' && { color: '#94a3b8' }]}>BOYLAM:</Text>
                    <Text style={[styles.coordValue, currentTheme === 'dark' && { color: '#fff' }]}>{selectedBin.longitude.toFixed(6)}</Text>
                  </View>
                </View>
                <View style={styles.modalActionsMap}>
                  <TouchableOpacity
                    style={[styles.routeBtn, { backgroundColor: getPinColor(selectedBin.fillPercentage), flex: 1 }]}
                    onPress={() => {
                      setIsInspectMode(true);
                    }}
                  >
                    <Ionicons name="map-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.routeBtnText}>Rotayı İncele</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </Animated.View>
      )}

      {/* Rotayı İncele Modu Floating Butonu */}
      {selectedBin && isInspectMode && (
        <Animated.View style={{
          position: 'absolute', bottom: 30, right: 20, zIndex: 100,
          opacity: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [{ scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }) }]
        }}>
          <TouchableOpacity
            style={[
              styles.floatingInspectBtn, 
              { position: 'relative', bottom: 0, right: 0, backgroundColor: getPinColor(selectedBin.fillPercentage) }
            ]}
            onPress={() => setIsInspectMode(false)}
          >
            <Ionicons name="trash-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* LİSTE MODALI */}
      <Modal visible={isListModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, currentTheme === 'dark' && { backgroundColor: '#1e293b' }, { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, currentTheme === 'dark' && { color: '#fff' }]}>Tüm Atık Kutuları</Text>
                <Text style={[styles.headerSubtitle, currentTheme === 'dark' && { color: '#94a3b8' }]}>{regularBins.length} kayıt bulundu</Text>
              </View>
              <TouchableOpacity onPress={() => setIsListModalVisible(false)}>
                <Ionicons name="close" size={28} color={currentTheme === 'dark' ? '#fff' : '#333'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {regularBins.map((bin) => (
                <TouchableOpacity
                  key={`list-bin-${bin.id}`}
                  style={[styles.listItem, currentTheme === 'dark' && { borderBottomColor: '#334155' }]}
                  onPress={() => {
                    setIsListModalVisible(false);
                    setSelectedBin(bin);
                    mapRef.current?.animateToRegion({
                      latitude: bin.latitude,
                      longitude: bin.longitude,
                      latitudeDelta: 0.002,
                      longitudeDelta: 0.002
                    }, 800);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.listColorDot, { backgroundColor: getPinColor(bin.fillPercentage) }]} />
                    <View>
                      <Text style={[styles.listItemName, currentTheme === 'dark' && { color: '#fff' }]}>{bin.name}</Text>
                      <Text style={[styles.listItemCoords, currentTheme === 'dark' && { color: '#94a3b8' }]}>{bin.latitude.toFixed(6)}, {bin.longitude.toFixed(6)}</Text>
                    </View>
                  </View>
                  <Text style={[styles.listFillText, { color: getPinColor(bin.fillPercentage) }]}>%{bin.fillPercentage}</Text>
                </TouchableOpacity>
              ))}
              {regularBins.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#94a3b8', marginTop: 20 }}>Listelenecek kutu yok.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  headerBar: { position: 'absolute', top: 50, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 16, padding: 12, elevation: 8 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 12, color: '#64748b' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  binCountBadge: { backgroundColor: '#e8f5e9', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', minWidth: 40 },
  binCountText: { fontSize: 14, fontWeight: '800', color: '#2e7d32' },
  binCountLabel: { fontSize: 8, color: '#2e7d32', fontWeight: '700', textTransform: 'uppercase' },
  filterRow: { position: 'absolute', top: 120, left: 16, right: 16, flexDirection: 'row', gap: 8 },
  filterBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 20, paddingVertical: 8, alignItems: 'center', elevation: 4 },
  filterBtnActive: { backgroundColor: '#2e7d32' },
  filterBtnText: { fontSize: 11, fontWeight: '600', color: '#555' },
  filterBtnTextActive: { color: '#fff' },
  actionButtons: { position: 'absolute', right: 16, bottom: 200, gap: 12 },
  actionBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 6 },
  detailCard: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 20, padding: 16, elevation: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  cardUpdate: { fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  cardBody: { gap: 10 },
  coordDisplayRow: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 8, borderRadius: 12, gap: 15, marginBottom: 2 },
  coordItem: { flex: 1 },
  coordLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', marginBottom: 2 },
  coordValue: { fontSize: 12, fontWeight: '700', color: '#1e293b', fontFamily: 'monospace' },
  routeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14, elevation: 3 },
  routeBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  floatingInspectBtn: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#2e7d32', justifyContent: 'center', alignItems: 'center', elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  cardQrBtn: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3e8ff',
    borderRadius: 14,
  },
  qrCodeEmptyFrame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: '#7c3aed',
    borderStyle: 'dashed',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  radioGroupMap: {
    flexDirection: 'row',
    gap: 30,
    marginVertical: 30,
  },
  radioButtonMap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioTextMap: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  
  // Badge Stili
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' },

  modalActionsMap: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    paddingHorizontal: 10,
  },
  collectBtnMap: {
    flex: 1,
    backgroundColor: '#7c3aed',
    flexDirection: 'row',
    padding: 16,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  routeBtnMap: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  btnTextMap: {
    color: '#fff',
    fontWeight: 'bold',
  },

  // LİSTE STYLES
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  listColorDot: { width: 12, height: 12, borderRadius: 6 },
  listItemName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  listItemCoords: { fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 },
  listFillText: { fontSize: 14, fontWeight: 'bold' },
});
