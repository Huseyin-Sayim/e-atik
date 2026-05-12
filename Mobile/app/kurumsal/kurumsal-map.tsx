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
}

const MOCK_TRASH_BINS: TrashBin[] = [
  { id: '1', name: 'Fen Fakültesi', latitude: 38.4590, longitude: 27.2285, fillPercentage: 85, lastUpdated: '5 dk önce', type: 'genel' },
  { id: '2', name: 'Metro Girişi', latitude: 38.4595, longitude: 27.2287, fillPercentage: 42, lastUpdated: '12 dk önce', type: 'plastik' },
  { id: '3', name: 'Merkez Kütüphane', latitude: 38.4570, longitude: 27.2315, fillPercentage: 25, lastUpdated: '3 dk önce', type: 'kagit' },
  { id: '4', name: 'Elektrik-Elektronik Mühendisliği', latitude: 38.4530, longitude: 27.2260, fillPercentage: 67, lastUpdated: '8 dk önce', type: 'cam' },
  { id: '5', name: 'Makine Mühendisliği', latitude: 38.4525, longitude: 27.2275, fillPercentage: 91, lastUpdated: '2 dk önce', type: 'genel' },
  { id: '6', name: 'İnşaat Mühendisliği', latitude: 38.4515, longitude: 27.2270, fillPercentage: 18, lastUpdated: '20 dk önce', type: 'plastik' },
  { id: '7', name: 'Merkez Kafeterya', latitude: 38.4555, longitude: 27.2295, fillPercentage: 55, lastUpdated: '6 dk önce', type: 'genel' },
  { id: '8', name: 'Spor Kompleksi', latitude: 38.4545, longitude: 27.2250, fillPercentage: 73, lastUpdated: '15 dk önce', type: 'genel' },
  { id: '9', name: 'Diş Hekimliği Fakültesi', latitude: 38.4565, longitude: 27.2255, fillPercentage: 30, lastUpdated: '9 dk önce', type: 'kagit' },
  { id: '10', name: 'Eczacılık Fakültesi', latitude: 38.4555, longitude: 27.2250, fillPercentage: 60, lastUpdated: '11 dk önce', type: 'cam' },
  { id: '11', name: 'Ege Meslek Yüksekokulu', latitude: 38.4510, longitude: 27.2285, fillPercentage: 12, lastUpdated: '30 dk önce', type: 'plastik' },
];

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

export default function KurumsalMapScreen() {
  const mapRef = useRef<MapView>(null);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedBin, setSelectedBin] = useState<TrashBin | null>(null);
  const [filterLevel, setFilterLevel] = useState<FillLevel | 'all'>('all');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setUserLocation({ latitude: initial.coords.latitude, longitude: initial.coords.longitude });
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedBin) {
      Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
    } else {
      Animated.timing(cardAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [selectedBin]);

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
    const fullestBin = [...MOCK_TRASH_BINS].sort((a, b) => b.fillPercentage - a.fillPercentage)[0];
    if (fullestBin) {
      setSelectedBin(fullestBin);
      mapRef.current?.animateToRegion({ latitude: fullestBin.latitude, longitude: fullestBin.longitude, latitudeDelta: 0.002, longitudeDelta: 0.002 }, 800);
    }
  }, []);

  const filteredBins = MOCK_TRASH_BINS.filter((bin) => filterLevel === 'all' || getFillLevel(bin.fillPercentage) === filterLevel);

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} initialRegion={CAMPUS_CENTER} showsUserLocation={true} onPress={() => setSelectedBin(null)}>
        <Geojson geojson={campusParcels as any} strokeColor="#ff7800" fillColor="rgba(255, 120, 0, 0.1)" strokeWidth={2} />
        {filteredBins.map((bin) => (
          <Marker key={`bin-${bin.id}`} coordinate={{ latitude: bin.latitude, longitude: bin.longitude }} onPress={() => setSelectedBin(bin)}>
            <View style={styles.pinWrapper}>
              <View style={[styles.tooltipContainer, { backgroundColor: getPinColor(bin.fillPercentage) }]}>
                <View style={styles.tooltipContent}>
                  <MaterialCommunityIcons name="trash-can" size={18} color="#fff" />
                  <View style={styles.divider} />
                  <Text style={styles.tooltipText}>%{bin.fillPercentage}</Text>
                </View>
              </View>
              <View style={[styles.tooltipTail, { borderTopColor: getPinColor(bin.fillPercentage) }]} />
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={styles.headerBar}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>🗺️ Kampüs Haritası</Text>
            <Text style={styles.headerSubtitle}>Ege Üniversitesi</Text>
          </View>
          <View style={styles.binCountBadge}>
            <Text style={styles.binCountText}>{filteredBins.length}</Text>
            <Text style={styles.binCountLabel}>kutu</Text>
          </View>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'low', 'medium', 'high'] as const).map((level) => (
          <TouchableOpacity key={level} style={[styles.filterBtn, filterLevel === level && styles.filterBtnActive]} onPress={() => setFilterLevel(level)}>
            <Text style={[styles.filterBtnText, filterLevel === level && styles.filterBtnTextActive]}>
              {level === 'all' ? 'Tümü' : level === 'low' ? '🟢 Boş' : level === 'medium' ? '🟡 Orta' : '🔴 Dolu'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionBtn} onPress={goToFullestBin}>
          <MaterialCommunityIcons name="alert-rhombus" size={28} color="#e74c3c" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={goToMyLocation}>
          <Ionicons name="locate" size={22} color="#2e7d32" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={goToCampus}>
          <Ionicons name="map-outline" size={22} color="#2e7d32" />
        </TouchableOpacity>
      </View>

      {selectedBin && (
        <Animated.View style={[styles.detailCard, { transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] }) }] }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardName}>{selectedBin.name}</Text>
            <TouchableOpacity onPress={() => setSelectedBin(null)}><Ionicons name="close-circle" size={26} color="#ccc" /></TouchableOpacity>
          </View>
          <View style={styles.cardBody}>
            <Text style={{color: getPinColor(selectedBin.fillPercentage), fontWeight: 'bold'}}>Doluluk: %{selectedBin.fillPercentage}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  map: { flex: 1 },
  headerBar: { position: 'absolute', top: 50, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 16, padding: 12, elevation: 8 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  binCountBadge: { backgroundColor: '#e8f5e9', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, alignItems: 'center' },
  binCountText: { fontSize: 16, fontWeight: '800', color: '#2e7d32' },
  binCountLabel: { fontSize: 10, color: '#2e7d32', fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, color: '#888' },
  filterRow: { position: 'absolute', top: 120, left: 16, right: 16, flexDirection: 'row', gap: 8 },
  filterBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 20, paddingVertical: 8, alignItems: 'center', elevation: 4 },
  filterBtnActive: { backgroundColor: '#2e7d32' },
  filterBtnText: { fontSize: 11, fontWeight: '600', color: '#555' },
  filterBtnTextActive: { color: '#fff' },
  actionButtons: { position: 'absolute', right: 16, bottom: 200, gap: 12 },
  actionBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 6 },
  pinWrapper: { alignItems: 'center' },
  tooltipContainer: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, minWidth: 65 },
  tooltipContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.4)' },
  tooltipText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  tooltipTail: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -2 },
  detailCard: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 20, padding: 16, elevation: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardName: { fontSize: 16, fontWeight: 'bold' },
  cardBody: { paddingBottom: 10 }
});
