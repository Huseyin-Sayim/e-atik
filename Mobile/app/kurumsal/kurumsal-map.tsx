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
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { MapView, Marker, PROVIDER_DEFAULT, Geojson } from '../../components/MapComponent';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DatabaseService from '../../database/DatabaseService';

// GeoJSON verisini import ediyoruz
import campusParcels from '../../assets/kampusParsel.json';

// Web'de react-leaflet'in useMap hook'u ile gerçek Leaflet map instance'ına erişim
let WebMapCapture: React.FC<{ onMapReady: (map: any, data?: any) => void }> = () => null;
if (Platform.OS === 'web') {
  try {
    const { useMap, useMapEvents } = require('react-leaflet');
    WebMapCapture = ({ onMapReady }) => {
      const map = useMap();

      useMapEvents({
        mousemove: (e: any) => {
          onMapReady(map, { latitude: e.latlng.lat, longitude: e.latlng.lng, x: e.containerPoint.x, y: e.containerPoint.y });
        }
      });

      useEffect(() => {
        if (map) {
          const center = map.getCenter();
          onMapReady(map, { latitude: center.lat, longitude: center.lng });
        }
      }, [map]);

      return null;
    };
  } catch (e) {
    console.warn('react-leaflet useMap bulunamadı:', e);
  }
}

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

// Özel Slider Bileşeni
const CustomPercentageSlider = ({ value, onChange }: { value: number, onChange: (val: number) => void }) => {
  const [sliderWidth, setSliderWidth] = useState(0);

  const handleTouch = (event: any) => {
    const x = event.nativeEvent.locationX;
    let newValue = Math.round((x / sliderWidth) * 100);
    newValue = Math.max(0, Math.min(100, newValue));
    onChange(newValue);
  };

  return (
    <View style={styles.sliderContainer}>
      <View
        style={styles.sliderTrack}
        onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
      >
        <View style={[styles.sliderFill, { width: `${value}%` }]} />
        <View style={[styles.sliderHandle, { left: `${value}%` }]} />
      </View>
      <Text style={styles.sliderValueText}>%{value}</Text>
    </View>
  );
};

export default function KurumsalMapScreen() {
  const mapRef = useRef<MapView>(null);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const currentRegionRef = useRef<{ latitude: number, longitude: number }>(CAMPUS_CENTER);
  const leafletMapRef = useRef<any>(null); // Gerçek Leaflet map instance'ı (web only)

  const [bins, setBins] = useState<TrashBin[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedBin, setSelectedBin] = useState<TrashBin | null>(null);
  const [filterLevel, setFilterLevel] = useState<FillLevel | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isListModalVisible, setIsListModalVisible] = useState(false);
  const [editBin, setEditBin] = useState<Partial<TrashBin> | null>(null);
  const [pickingMode, setPickingMode] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [coordsDisplay, setCoordsDisplay] = useState({ lat: 0, lng: 0 });

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

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const loadBins = async () => {
    try {
      setLoading(true);
      let fetchedBins = await DatabaseService.getBins();
      
      console.log('--- MEVCUT KUTULARIN DÖKÜMÜ ---');
      console.table(fetchedBins.map(b => ({ isim: b.name, enlem: b.latitude, boylam: b.longitude })));
      console.log('✅ Toplam', fetchedBins.length, 'Atık Kutusu yüklendi.');

      const mappedBins = fetchedBins.map(b => ({
        id: b.id.toString(),
        name: b.name || 'İsimsiz Kutu',
        latitude: parseFloat(b.latitude),
        longitude: parseFloat(b.longitude),
        fillPercentage: b.predictedFullness || 0,
        type: b.wasteCategory === 'PLASTIC' ? 'plastik' : b.wasteCategory === 'GLASS' ? 'cam' : b.wasteCategory === 'PAPER' ? 'kagit' : 'genel',
        lastUpdated: 'Şimdi' // Şimdilik basit tutuldu
      }));

      setBins(mappedBins);
    } catch (e) {
      console.error('❌ Yükleme hatası:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOrUpdateBin = async () => {
    if (!editBin?.name) {
      Alert.alert('Uyarı', 'Lütfen Atık Kutusu ismini doldurunuz.');
      return;
    }

    // Kullanıcı değer girdiyse onu kullan, girmediyse ref'ten o anki harita merkezini al
    const rawLat = (editBin?.latitude !== undefined && editBin?.latitude !== '')
      ? editBin.latitude
      : (editBin?.id ? bins.find(b => b.id === editBin.id)?.latitude : currentRegionRef.current.latitude);

    const rawLng = (editBin?.longitude !== undefined && editBin?.longitude !== '')
      ? editBin.longitude
      : (editBin?.id ? bins.find(b => b.id === editBin.id)?.longitude : currentRegionRef.current.longitude);

    const lat = Number(rawLat);
    const lng = Number(rawLng);

    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir koordinat giriniz.');
      return;
    }

    try {
      const payload = {
        name: editBin.name,
        latitude: lat,
        longitude: lng,
        predictedFullness: editBin.fillPercentage || 0,
        wasteCategory: editBin.type === 'plastik' ? 'PLASTIC' : editBin.type === 'cam' ? 'GLASS' : editBin.type === 'kagit' ? 'PAPER' : 'GENERAL'
      };

      if (editBin.id) {
        // GÜNCELLEME (DB)
        console.log('🔄 DB Güncelleniyor...', editBin.id);
        await DatabaseService.updateBinItem(editBin.id, payload);
      } else {
        // YENİ EKLEME (DB)
        console.log('➕ DB ye Ekleniyor...');
        await DatabaseService.addBin(payload);
      }

      // UX: Modalı anında kapat ki kullanıcıya hızlı hissettirsin
      setIsModalVisible(false);

      // Arkada sessizce taze verileri çek
      await loadBins();

      setEditBin(null);
      setSelectedBin(null); // Kartı kapat ki eski ID ile kalmasın
      Alert.alert('Başarılı', 'Değişiklikler veritabanına kaydedildi.');

    } catch (error) {
      console.error('Kayıt hatası:', error);
      Alert.alert('Hata', 'Veritabanına kaydedilirken sorun oluştu.');
    }
  };

  const executeDelete = async (id: string) => {
    try {
      console.log('🗑️ DB den siliniyor...', id);
      await DatabaseService.deleteBinItem(id);
      setSelectedBin(null);
      await loadBins();
      if (Platform.OS === 'web') {
        window.alert('Atık Kutusu veritabanından silindi.');
      } else {
        Alert.alert('Başarılı', 'Atık Kutusu veritabanından silindi.');
      }
    } catch (error) {
      console.error('Silme hatası:', error);
      if (Platform.OS === 'web') {
        window.alert('Atık Kutusu silinirken bir sorun oluştu.');
      } else {
        Alert.alert('Hata', 'Atık Kutusu silinirken bir sorun oluştu.');
      }
    }
  };

  const handleDeleteBin = (id: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Bu harita noktasını silmek istediğinize emin misiniz?')) {
        executeDelete(id);
      }
    } else {
      Alert.alert(
        'Noktayı Sil',
        'Bu harita noktasını silmek istediğinize emin misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: () => executeDelete(id)
          }
        ]
      );
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
        onRegionChangeComplete={(region) => {
          if (region?.latitude) {
            currentRegionRef.current = region;
            // Uzak zoom'larda kaybolmayı önlemek için state'i sadece hareket bitince güncelle
            setCoordsDisplay({ lat: region.latitude, lng: region.longitude });
          }
        }}
        onLongPress={(e) => {
          const coord = e.nativeEvent?.coordinate;
          if (coord) {
            setEditBin({ latitude: coord.latitude, longitude: coord.longitude, fillPercentage: 0 });
            setIsModalVisible(true);
          }
        }}
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
            <TouchableOpacity
              style={[styles.manageBtn, pickingMode && { backgroundColor: '#e74c3c' }]}
              onPress={() => {
                if (Platform.OS === 'web') {
                  const leafletMap = leafletMapRef.current;
                  if (leafletMap) {
                    setPickingMode(true);
                    leafletMap.once('click', (e: any) => {
                      setPickingMode(false);
                      setEditBin({ latitude: e.latlng.lat, longitude: e.latlng.lng, fillPercentage: 0 });
                      setIsModalVisible(true);
                    });
                  } else {
                    setEditBin({ fillPercentage: 0 });
                    setIsModalVisible(true);
                  }
                } else {
                  setEditBin({ fillPercentage: 0 });
                  setIsModalVisible(true);
                }
              }}
            >
              <Ionicons name="add-circle" size={22} color="#fff" />
              <Text style={styles.manageBtnText}>{pickingMode ? '📍 Haritaya Tıkla' : 'Atık Kutusu Ekle'}</Text>
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






      {toastMsg && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}

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
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.cardEditBtn}
                onPress={() => {
                  setEditBin(selectedBin);
                  setIsModalVisible(true);
                }}
              >
                <Ionicons name="create-outline" size={20} color="#2e7d32" />
                <Text style={styles.cardEditBtnText}>Düzenle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardDeleteBtn}
                onPress={() => handleDeleteBin(selectedBin.id)}
              >
                <Ionicons name="trash-outline" size={20} color="#e74c3c" />
              </TouchableOpacity>
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

      {/* YÖNETİM MODALI */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editBin?.id ? 'Noktayı Düzenle' : 'Yeni Atık Kutusu Ekle'}</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Atık Kutu İsmi</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Örn: Mühendislik Binası Önü"
                  placeholderTextColor="#94a3b8"
                  value={editBin?.name}
                  onChangeText={(val) => setEditBin({ ...editBin, name: val })}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Enlem (Lat)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={editBin?.id ? "" : currentRegionRef.current.latitude.toFixed(6)}
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={editBin?.latitude?.toString() || ''}
                    onChangeText={(val) => setEditBin({ ...editBin, latitude: val as any })}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
                  <Text style={styles.label}>Boylam (Lng)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={editBin?.id ? "" : currentRegionRef.current.longitude.toFixed(6)}
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={editBin?.longitude?.toString() || ''}
                    onChangeText={(val) => setEditBin({ ...editBin, longitude: val as any })}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Doluluk Oranı: <Text style={{ fontWeight: '900', color: '#2e7d32' }}>%{editBin?.fillPercentage ?? 0}</Text></Text>
                {Platform.OS === 'web' ? (
                  <TextInput
                    style={[styles.input, { textAlign: 'center', fontSize: 18, fontWeight: 'bold' }]}
                    placeholder="0-100 arası bir sayı girin"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={editBin?.fillPercentage?.toString() ?? '0'}
                    onChangeText={(val) => {
                      const num = Math.max(0, Math.min(100, parseInt(val) || 0));
                      setEditBin({ ...editBin, fillPercentage: num });
                    }}
                  />
                ) : (
                  <CustomPercentageSlider
                    value={editBin?.fillPercentage || 0}
                    onChange={(val) => setEditBin({ ...editBin, fillPercentage: val })}
                  />
                )}
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleAddOrUpdateBin}>
                <Text style={styles.saveBtnText}>Değişiklikleri Kaydet</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  centerCrosshair: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  coordsBadge: {
    position: 'absolute',
    bottom: 100,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 10,
  },
  coordsText: { color: '#fff', fontSize: 11, fontWeight: '600', fontFamily: 'monospace' },
  headerBar: { position: 'absolute', top: 50, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 16, padding: 12, elevation: 8 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 12, color: '#64748b' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resetBtn: { padding: 4 },
  binCountBadge: { backgroundColor: '#e8f5e9', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', minWidth: 40 },
  binCountText: { fontSize: 14, fontWeight: '800', color: '#2e7d32' },
  binCountLabel: { fontSize: 8, color: '#2e7d32', fontWeight: '700', textTransform: 'uppercase' },
  manageBtn: { backgroundColor: '#2e7d32', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, gap: 4 },
  manageBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
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
  cardActions: { flexDirection: 'row', gap: 10 },
  cardEditBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8f5e9', paddingVertical: 10, borderRadius: 12, gap: 6 },
  cardEditBtnText: { color: '#2e7d32', fontWeight: '700' },
  cardDeleteBtn: { width: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1f2', borderRadius: 12 },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: '#64748b', marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row' },
  saveBtn: { backgroundColor: '#2e7d32', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // SLIDER STYLES
  sliderContainer: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 5 },
  sliderTrack: { flex: 1, height: 12, backgroundColor: '#f1f5f9', borderRadius: 6, position: 'relative' },
  sliderFill: { height: '100%', backgroundColor: '#2e7d32', borderRadius: 6 },
  sliderHandle: { position: 'absolute', top: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', borderWidth: 3, borderColor: '#2e7d32', marginLeft: -12, elevation: 4 },
  sliderValueText: { fontSize: 16, fontWeight: '800', color: '#2e7d32', minWidth: 45 },
  toast: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(46, 125, 50, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    zIndex: 1000,
    elevation: 10,
  },
  toastText: { color: '#fff', fontWeight: 'bold' },
  pasteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  pasteText: { fontSize: 10, fontWeight: '700', color: '#2e7d32' },
  // LİSTE STYLES
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  listColorDot: { width: 12, height: 12, borderRadius: 6 },
  listItemName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  listItemCoords: { fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 },
  listFillText: { fontSize: 14, fontWeight: 'bold' },
});
