import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { MapView, Marker, PROVIDER_DEFAULT, Geojson } from '../../components/MapComponent';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// GeoJSON verisini import ediyoruz
import campusParcels from '../../assets/kampusParsel.json';

const CAMPUS_BOUNDS = {
  northEast: { latitude: 38.4620, longitude: 27.2360 },
  southWest: { latitude: 38.4490, longitude: 27.2220 },
};

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
  fillPercentage: number; // 0-100
  lastUpdated: string;
  type: 'plastik' | 'kagit' | 'cam' | 'genel';
}


const MOCK_TRASH_BINS: TrashBin[] = [
  {
    id: '1',
    name: 'Metro Girişi — Genel',
    latitude: 38.4595,
    longitude: 27.2287,
    fillPercentage: 85,
    lastUpdated: '5 dk önce',
    type: 'genel',
  },
  {
    id: '2',
    name: 'Fen Fakültesi — Plastik',
    latitude: 38.4578,
    longitude: 27.2295,
    fillPercentage: 42,
    lastUpdated: '12 dk önce',
    type: 'plastik',
  },
  {
    id: '3',
    name: 'Kütüphane Önü — Kağıt',
    latitude: 38.4562,
    longitude: 27.2310,
    fillPercentage: 25,
    lastUpdated: '3 dk önce',
    type: 'kagit',
  },
  {
    id: '4',
    name: 'Merkez Kafeterya — Cam',
    latitude: 38.4553,
    longitude: 27.2278,
    fillPercentage: 67,
    lastUpdated: '8 dk önce',
    type: 'cam',
  },
  {
    id: '5',
    name: 'Tıp Fakültesi — Genel',
    latitude: 38.4538,
    longitude: 27.2302,
    fillPercentage: 91,
    lastUpdated: '2 dk önce',
    type: 'genel',
  },
  {
    id: '6',
    name: 'Spor Kompleksi — Plastik',
    latitude: 38.4543,
    longitude: 27.2258,
    fillPercentage: 18,
    lastUpdated: '20 dk önce',
    type: 'plastik',
  },
  {
    id: '7',
    name: 'Mühendislik Fakültesi',
    latitude: 38.4568,
    longitude: 27.2332,
    fillPercentage: 55,
    lastUpdated: '6 dk önce',
    type: 'genel',
  },
  {
    id: '8',
    name: 'Ege MYO — Ana Giriş',
    latitude: 38.4515,
    longitude: 27.2289,
    fillPercentage: 73,
    lastUpdated: '15 dk önce',
    type: 'genel',
  },
  {
    id: '9',
    name: 'İktisadi İdari Bilimler',
    latitude: 38.4585,
    longitude: 27.2265,
    fillPercentage: 30,
    lastUpdated: '9 dk önce',
    type: 'kagit',
  },
  {
    id: '10',
    name: 'Eczacılık Fakültesi',
    latitude: 38.4527,
    longitude: 27.2318,
    fillPercentage: 60,
    lastUpdated: '11 dk önce',
    type: 'cam',
  },
];

// ─────────────────────────────────────────────
// Yardımcı Fonksiyonlar
// ─────────────────────────────────────────────
function getFillLevel(percentage: number): FillLevel {
  if (percentage < 40) return 'low';
  if (percentage < 75) return 'medium';
  return 'high';
}

function getPinColor(percentage: number): string {
  const level = getFillLevel(percentage);
  if (level === 'low') return '#27ae60';    // Yeşil
  if (level === 'medium') return '#f39c12'; // Sarı/Turuncu
  return '#e74c3c';                         // Kırmızı
}

function getTypeIcon(type: TrashBin['type']): any {
  // Kullanıcı tüm ikonların çöp kutusu olmasını istedi
  return 'trash-can';
}

function getLevelLabel(level: FillLevel): string {
  if (level === 'low') return 'Boş';
  if (level === 'medium') return 'Orta';
  return 'Dolu';
}

export default function LocationScreen() {
  const mapRef = useRef<MapView>(null);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [selectedBin, setSelectedBin] = useState<TrashBin | null>(null);
  const [trashBins] = useState<TrashBin[]>(MOCK_TRASH_BINS);
  const [isLocating, setIsLocating] = useState(false);
  const [filterLevel, setFilterLevel] = useState<FillLevel | 'all'>('all');
  const [tracksViewChanges, setTracksViewChanges] = useState(true);


  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermission(false);
        Alert.alert(
          'Konum İzni Gerekli',
          'Haritada konumunuzu görebilmek için konum iznine ihtiyacımız var.',
          [{ text: 'Tamam' }]
        );
        return;
      }
      setLocationPermission(true);

      // İlk konum
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserLocation({
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
      });

      // Canlı takip
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => {
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      );
    })();

    return () => {
      subscription?.remove();
    };
  }, []);

  // Pinlerin her zaman görünür kalması için tracksViewChanges optimizasyonunu kaldırdık
  useEffect(() => {
    setTracksViewChanges(true);
  }, [filterLevel]);

  // ── Pin Seçilince Kart Animasyonu
  useEffect(() => {
    if (selectedBin) {
      Animated.spring(cardAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }).start();
    } else {
      Animated.timing(cardAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedBin]);

  // ── Konuma Git Butonu
  const goToMyLocation = useCallback(async () => {
    setIsLocating(true);
    try {
      if (userLocation) {
        mapRef.current?.animateToRegion(
          {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.004,
            longitudeDelta: 0.004,
          },
          600
        );
      } else {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        mapRef.current?.animateToRegion(
          {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.004,
            longitudeDelta: 0.004,
          },
          600
        );
      }
    } catch {
      Alert.alert('Hata', 'Konum alınamadı.');
    }
    setIsLocating(false);
  }, [userLocation]);

  // ── Kampüs Geneline Zoom
  const goToCampus = useCallback(() => {
    setSelectedBin(null);
    mapRef.current?.animateToRegion(CAMPUS_CENTER, 600);
  }, []);

  // ── En Dolu Kutuyu Bul ve Oraya Git
  const goToFullestBin = useCallback(() => {
    if (trashBins.length === 0) return;

    // En yüksek doluluk oranına sahip kutuyu bul
    const fullestBin = [...trashBins].sort((a, b) => b.fillPercentage - a.fillPercentage)[0];

    if (fullestBin) {
      setSelectedBin(fullestBin);
      mapRef.current?.animateToRegion({
        latitude: fullestBin.latitude,
        longitude: fullestBin.longitude,
        latitudeDelta: 0.002, // Daha yakından bakmak için delta düştü
        longitudeDelta: 0.002,
      }, 800);
    }
  }, [trashBins]);

  // ── Filtreleme Mantığı (Garantiye Alındı)
  const filteredBins = React.useMemo(() => {
    if (filterLevel === 'all') return trashBins;
    return trashBins.filter((bin) => getFillLevel(bin.fillPercentage) === filterLevel);
  }, [trashBins, filterLevel]);

  // ── Harita Sınır Kontrolü
  const onRegionChangeComplete = useCallback((region: any) => {
    const { latitude, longitude } = region;
    const { northEast, southWest } = CAMPUS_BOUNDS;
    let clampedLat = Math.max(southWest.latitude, Math.min(northEast.latitude, latitude));
    let clampedLng = Math.max(southWest.longitude, Math.min(northEast.longitude, longitude));

    if (clampedLat !== latitude || clampedLng !== longitude) {
      mapRef.current?.animateToRegion(
        { ...region, latitude: clampedLat, longitude: clampedLng },
        200
      );
    }
  }, []);

  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [200, 0],
  });

  const cardOpacity = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container}>
      {/* ── Harita ── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={CAMPUS_CENTER}
        showsUserLocation={locationPermission === true}
        showsMyLocationButton={false}
        showsCompass={false}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={() => setSelectedBin(null)}
        mapType="standard"
      >
        {/* Kampüs Parselleri (GeoJSON) */}
        <Geojson
          geojson={campusParcels as any}
          strokeColor="#ff7800"
          fillColor="rgba(255, 120, 0, 0.1)"
          strokeWidth={2}
        />

        {/* Çöp Kutusu Pinleri */}
        {filteredBins.map((bin) => {
          const color = getPinColor(bin.fillPercentage);
          const isSelected = selectedBin?.id === bin.id;

          return (
            <Marker
              key={`bin-${bin.id}`}
              coordinate={{ latitude: bin.latitude, longitude: bin.longitude }}
              onPress={() => setSelectedBin(bin)}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={true}
            >
              <View style={styles.pinWrapper}>
                <View style={[
                  styles.tooltipContainer, 
                  isSelected && styles.tooltipSelected,
                  { backgroundColor: color }
                ]}>
                  <View style={styles.tooltipContent}>
                    <MaterialCommunityIcons 
                      name={getTypeIcon(bin.type)} 
                      size={18} 
                      color="#fff" 
                    />
                    <View style={styles.divider} />
                    <Text style={styles.tooltipText}>%{bin.fillPercentage}</Text>
                  </View>
                </View>
                {/* Keskin Kuyruk */}
                <View style={[styles.tooltipTail, { borderTopColor: color }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* ── Başlık Şeridi ── */}
      <View style={styles.headerBar}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>🗺️ Kampüs Haritası</Text>
            <Text style={styles.headerSubtitle}>Ege Üniversitesi</Text>
          </View>
          <View style={styles.binCountBadge}>
            <Text style={styles.binCountText}>{filteredBins.length}</Text>
            <Text style={styles.binCountLabel}>kutu</Text>
          </View>
        </View>
      </View>

      {/* ── Filtre Butonları ── */}
      <View style={styles.filterRow}>
        {(['all', 'low', 'medium', 'high'] as const).map((level) => {
          const labels = { all: 'Tümü', low: '🟢 Boş', medium: '🟡 Orta', high: '🔴 Dolu' };
          const isActive = filterLevel === level;
          return (
            <TouchableOpacity
              key={level}
              style={[styles.filterBtn, isActive && styles.filterBtnActive]}
              onPress={() => setFilterLevel(level)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterBtnText, isActive && styles.filterBtnTextActive]}>
                {labels[level]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Sağ Aksiyon Butonları ── */}
      <View style={styles.actionButtons}>
        <View style={styles.actionItem}>
          <Text style={styles.actionLabel}>En Dolu</Text>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#e74c3c' }]} onPress={goToFullestBin} activeOpacity={0.8}>
            <Ionicons name="alert-circle" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.actionItem}>
          <Text style={styles.actionLabel}>Konumum</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={goToMyLocation} activeOpacity={0.8}>
            {isLocating ? (
              <ActivityIndicator size="small" color="#2e7d32" />
            ) : (
              <Ionicons name="locate" size={22} color="#2e7d32" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.actionItem}>
          <Text style={styles.actionLabel}>Kampüs</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={goToCampus} activeOpacity={0.8}>
            <Ionicons name="map-outline" size={22} color="#2e7d32" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Legend ── */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#27ae60' }]} />
          <Text style={styles.legendText}>Boş (&lt;40%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#f39c12' }]} />
          <Text style={styles.legendText}>Orta (40-75%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#e74c3c' }]} />
          <Text style={styles.legendText}>Dolu (&gt;75%)</Text>
        </View>
      </View>

      {/* ── Seçili Çöp Kutusu Kartı ── */}
      {selectedBin && (
        <Animated.View
          style={[
            styles.detailCard,
            { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.cardIconBg, { backgroundColor: getPinColor(selectedBin.fillPercentage) }]}>
                <MaterialCommunityIcons name="trash-can" size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{selectedBin.name}</Text>
                <Text style={styles.cardType}>
                  {selectedBin.type.toUpperCase()} ATIK KUTUSU
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedBin(null)} style={styles.cardClose}>
                <Ionicons name="close-circle" size={26} color="#ccc" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.cardBody}>
            {/* Doluluk Bar */}
            <View style={styles.fillSection}>
              <View style={styles.fillLabelRow}>
                <Text style={styles.fillLabel}>Doluluk Oranı</Text>
                <View style={[styles.levelBadge, {
                  backgroundColor: getPinColor(selectedBin.fillPercentage) + '22',
                }]}>
                  <Text style={[styles.levelBadgeText, {
                    color: getPinColor(selectedBin.fillPercentage),
                  }]}>
                    {getLevelLabel(getFillLevel(selectedBin.fillPercentage))}
                  </Text>
                </View>
              </View>

              <View style={styles.progressBg}>
                <View style={[
                  styles.progressFill,
                  {
                    width: `${selectedBin.fillPercentage}%` as any,
                    backgroundColor: getPinColor(selectedBin.fillPercentage),
                  },
                ]} />
              </View>
              <Text style={[styles.percentText, { color: getPinColor(selectedBin.fillPercentage) }]}>
                %{selectedBin.fillPercentage}
              </Text>
            </View>

            {/* Son Güncelleme */}
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color="#888" />
              <Text style={styles.metaText}>Son güncelleme: {selectedBin.lastUpdated}</Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// Stiller
// ─────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  map: {
    flex: 1,
    height: Platform.OS === 'web' ? 'calc(100vh - 70px)' : '100%',
  },

  // Header
  headerBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 44,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  binCountBadge: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  binCountText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2e7d32',
  },
  binCountLabel: {
    fontSize: 10,
    color: '#2e7d32',
    fontWeight: '600',
  },

  // Filtreler
  filterRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 130 : 120,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingVertical: 7,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  filterBtnActive: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  filterBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555',
  },
  filterBtnTextActive: {
    color: '#fff',
  },

  // Aksiyon Butonları
  actionButtons: {
    position: 'absolute',
    right: 16,
    bottom: 220,
    gap: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionLabel: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.97)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },

  // Legend
  legend: {
    position: 'absolute',
    bottom: 160,
    left: 16,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#555',
    fontWeight: '500',
  },

  // Tooltip Pin Tasarımı (Final Premium)
  pinWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipContainer: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 65,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  tooltipSelected: {
    transform: [{ scale: 1.2 }],
    borderWidth: 3,
    zIndex: 999,
  },
  tooltipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  tooltipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tooltipTail: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },

  // Detay Kartı
  detailCard: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  cardType: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  cardClose: {
    padding: 2,
  },
  cardBody: {
    padding: 16,
    gap: 12,
  },
  fillSection: {
    gap: 8,
  },
  fillLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fillLabel: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
  },
  levelBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBg: {
    height: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  percentText: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'right',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#888',
  },

  // İzin Banner
  permissionBanner: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(243, 156, 18, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.4)',
  },
  permissionText: {
    fontSize: 12,
    color: '#d68910',
    fontWeight: '600',
  },
});
