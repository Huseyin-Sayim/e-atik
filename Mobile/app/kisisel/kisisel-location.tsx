import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { MapView, Marker, PROVIDER_DEFAULT, Geojson } from '../../components/MapComponent';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DatabaseService from '../../database/DatabaseService';

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

  const [bins, setBins] = useState<TrashBin[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedBin, setSelectedBin] = useState<TrashBin | null>(null);
  const [filterLevel, setFilterLevel] = useState<FillLevel | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [isListModalVisible, setIsListModalVisible] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      await loadBins();
      setupLocation();
    };
    
    initApp();
  }, []);

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
      
      const mappedBins = fetchedBins.map(b => ({
        id: b.id.toString(),
        name: b.name || 'İsimsiz Kutu',
        latitude: parseFloat(b.latitude),
        longitude: parseFloat(b.longitude),
        fillPercentage: b.predictedFullness || 0,
        type: b.wasteCategory === 'PLASTIC' ? 'plastik' : b.wasteCategory === 'GLASS' ? 'cam' : b.wasteCategory === 'PAPER' ? 'kagit' : 'genel',
        lastUpdated: 'Şimdi'
      }));

      setBins(mappedBins);
    } catch (e) {
      console.error('❌ Yükleme hatası:', e);
    } finally {
      setLoading(false);
    }
  };

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
    const sorted = [...bins].sort((a, b) => b.fillPercentage - a.fillPercentage);
    const fullestBin = sorted[0];
    if (fullestBin) {
      setSelectedBin(fullestBin);
      mapRef.current?.animateToRegion({ latitude: fullestBin.latitude, longitude: fullestBin.longitude, latitudeDelta: 0.002, longitudeDelta: 0.002 }, 800);
    }
  }, [bins]);

  const filteredBins = bins.filter((bin) => filterLevel === 'all' || getFillLevel(bin.fillPercentage) === filterLevel);

  if (loading) {
    return <View style={styles.loader}><ActivityIndicator size="large" color="#2e7d32" /></View>;
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={CAMPUS_CENTER}
        showsUserLocation={true}
        onPress={() => setSelectedBin(null)}
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
            <Text style={styles.headerSubtitle}>{filteredBins.length} Aktif Kutu</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.binCountBadge}
              onPress={() => setIsListModalVisible(true)}
            >
              <Text style={styles.binCountText}>{filteredBins.length}</Text>
              <Text style={styles.binCountLabel}>Kutu</Text>
            </TouchableOpacity>
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
            <View>
              <Text style={styles.cardName}>{selectedBin.name}</Text>
              <Text style={styles.cardUpdate}>{selectedBin.lastUpdated} güncellendi</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedBin(null)}><Ionicons name="close-circle" size={26} color="#ccc" /></TouchableOpacity>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.coordDisplayRow}>
              <View style={styles.coordItem}>
                <Text style={styles.coordLabel}>ENLEM:</Text>
                <Text style={styles.coordValue}>{selectedBin.latitude.toFixed(6)}</Text>
              </View>
              <View style={styles.coordItem}>
                <Text style={styles.coordLabel}>BOYLAM:</Text>
                <Text style={styles.coordValue}>{selectedBin.longitude.toFixed(6)}</Text>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${selectedBin.fillPercentage}%`, backgroundColor: getPinColor(selectedBin.fillPercentage) }]} />
            </View>
          </View>
        </Animated.View>
      )}

      {/* LİSTE MODALI (Üst Üste Binen Kutular İçin) */}
      <Modal visible={isListModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Tüm Atık Kutuları</Text>
                <Text style={styles.headerSubtitle}>{filteredBins.length} kayıt bulundu</Text>
              </View>
              <TouchableOpacity onPress={() => setIsListModalVisible(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredBins.map((bin) => (
                <TouchableOpacity 
                  key={`list-bin-${bin.id}`} 
                  style={styles.listItem}
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
                      <Text style={styles.listItemName}>{bin.name}</Text>
                      <Text style={styles.listItemCoords}>{bin.latitude.toFixed(6)}, {bin.longitude.toFixed(6)}</Text>
                    </View>
                  </View>
                  <Text style={[styles.listFillText, { color: getPinColor(bin.fillPercentage) }]}>%{bin.fillPercentage}</Text>
                </TouchableOpacity>
              ))}
              {filteredBins.length === 0 && (
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
  pinWrapper: { alignItems: 'center' },
  tooltipContainer: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, minWidth: 65 },
  tooltipContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.4)' },
  tooltipText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  tooltipTail: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -2 },
  detailCard: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 20, padding: 16, elevation: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  cardUpdate: { fontSize: 12, color: '#94a3b8' },
  cardBody: { gap: 12 },
  coordDisplayRow: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 10, borderRadius: 12, gap: 15, marginBottom: 5 },
  coordItem: { flex: 1 },
  coordLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', marginBottom: 2 },
  coordValue: { fontSize: 13, fontWeight: '700', color: '#1e293b', fontFamily: 'monospace' },
  progressContainer: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 4 },
  
  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  
  // LİSTE STYLES
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  listColorDot: { width: 12, height: 12, borderRadius: 6 },
  listItemName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  listItemCoords: { fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 },
  listFillText: { fontSize: 14, fontWeight: 'bold' },
});
