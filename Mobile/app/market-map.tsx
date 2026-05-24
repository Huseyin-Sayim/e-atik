import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  TextInput,
  ScrollView,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { MapView, Marker, PROVIDER_DEFAULT, Geojson, Polyline } from '../components/MapComponent';
import * as Location from 'expo-location';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Ionicons } from '@expo/vector-icons';
import DatabaseService from '../database/DatabaseService';
import { useRouter, useLocalSearchParams } from 'expo-router';

// GeoJSON verisi
import campusParcels from '../assets/kampusParsel.json';

const CAMPUS_CENTER = {
  latitude: 38.4553,
  longitude: 27.2290,
  latitudeDelta: 0.0135,
  longitudeDelta: 0.0135,
};

interface PartnerStore {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export default function MarketMapScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams();
  const isCorporate = type === 'kurumsal';
  const mapRef = useRef<any>(null);
  const [stores, setStores] = useState<PartnerStore[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<PartnerStore | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isListModalVisible, setIsListModalVisible] = useState(false);
  const [editStore, setEditStore] = useState<Partial<PartnerStore> | null>(null);
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [currentTheme, setCurrentTheme] = useState('light');
  const [isCardMinimized, setIsCardMinimized] = useState(false);

  useEffect(() => {
    loadStores();
    
    // Simulate getting user location
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // İzin yoksa kampüs merkezini fallback olarak kullan
        setUserLocation({ latitude: 38.4595, longitude: 27.2287 });
        setIsLocationLoading(false);
        return;
      }
      try {
        let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      } catch(e) {
        // GPS alınamazsa kampüs merkezini fallback olarak kullan
        setUserLocation({ latitude: 38.4595, longitude: 27.2287 });
      } finally {
        setIsLocationLoading(false);
      }
    })();

    const unsubTheme = DatabaseService.subscribeToTheme((theme) => {
      setCurrentTheme(theme);
    });

    return () => {
      unsubTheme();
    };
  }, []);

  const loadStores = async () => {
    try {
      const fetchedStores = await DatabaseService.getPartnerStores();
      setStores(fetchedStores);
    } catch (error) {
      console.warn('Mağazalar yüklenemedi:', error);
    }
  };

  const fetchRoute = async (destinationStore: PartnerStore | null) => {
    if (!destinationStore) {
      setRouteCoordinates([]);
      return;
    }
    if (!userLocation) {
      Alert.alert('Konum Bekleniyor', 'GPS konumunuz henüz alınamadı. Lütfen birkaç saniye bekleyip tekrar deneyin.');
      return;
    }
    try {
      const url = `https://router.project-osrm.org/route/v1/foot/${userLocation.longitude},${userLocation.latitude};${destinationStore.longitude},${destinationStore.latitude}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const json = await response.json();
      
      if (json.routes && json.routes.length > 0) {
        const coords = json.routes[0].geometry.coordinates.map((c: any[]) => ({
          latitude: c[1],
          longitude: c[0]
        }));
        setRouteCoordinates(coords);
        setTimeout(() => {
          mapRef.current?.animateToRegion({
            latitude: destinationStore.latitude,
            longitude: destinationStore.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        }, 100);
      } else {
        const fallbackCoords = [userLocation, { latitude: destinationStore.latitude, longitude: destinationStore.longitude }];
        setRouteCoordinates(fallbackCoords);
        setTimeout(() => {
          mapRef.current?.animateToRegion({
            latitude: destinationStore.latitude,
            longitude: destinationStore.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        }, 100);
      }
    } catch (e) {
      const fallbackCoords = [userLocation, { latitude: destinationStore.latitude, longitude: destinationStore.longitude }];
      setRouteCoordinates(fallbackCoords);
      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: destinationStore.latitude,
          longitude: destinationStore.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
      }, 100);
    }
  };

  useEffect(() => {
    if (selectedStore) {
      fetchRoute(selectedStore);
    } else {
      setRouteCoordinates([]);
    }
  }, [selectedStore]);

  const handleMapPress = (e: any) => {
    // Haritada boş bir yere tıklandığında popup'ı kapat
    setSelectedStore(null);
  };

  const saveStore = async () => {
    const parsedLat = parseFloat(editLat.replace(',', '.'));
    const parsedLng = parseFloat(editLng.replace(',', '.'));

    if (!editStore?.name || isNaN(parsedLat) || isNaN(parsedLng)) {
      Alert.alert('Hata', 'Lütfen mağaza adı ve geçerli koordinat girin.');
      return;
    }
    
    try {
      const newStore = { ...editStore, latitude: parsedLat, longitude: parsedLng } as PartnerStore;
      if (newStore.id) {
        await DatabaseService.deletePartnerStore(newStore.id);
      }
      const addedStore = await DatabaseService.addPartnerStore(newStore);
      await loadStores();
      if (selectedStore && selectedStore.id === newStore.id) {
        setSelectedStore(addedStore);
      }
      setIsModalVisible(false);
      setEditStore(null);
    } catch (e) {
      Alert.alert('Hata', 'Mağaza kaydedilirken hata oluştu.');
    }
  };

  const deleteStore = async (id: string) => {
    try {
      await DatabaseService.deletePartnerStore(id);
      setSelectedStore(null);
      await loadStores();
    } catch (e) {
      Alert.alert('Hata', 'Silinemedi.');
    }
  };

  return (
    <View style={[styles.container, currentTheme === 'dark' && { backgroundColor: '#0f172a' }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={CAMPUS_CENTER}
        showsUserLocation={true}
        onPress={handleMapPress}
        campusParcels={campusParcels}
        bins={stores.map(s => ({ ...s, isStore: true, fillPercentage: 0 }))}
        onMarkerPress={(store) => {
          setSelectedStore(store);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setIsCardMinimized(false);
          setTimeout(() => {
            mapRef.current?.animateToRegion({
              latitude: store.latitude,
              longitude: store.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            });
          }, 100);
        }}
        staffLocation={userLocation}
        routeCoordinates={routeCoordinates}
        routeColor="green"
      />

      {/* Top Bar */}
      <View style={[styles.headerBar, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={currentTheme === 'dark' ? '#fff' : '#1e293b'} />
          </TouchableOpacity>
          <View style={{ flex: 1, paddingHorizontal: 10 }}>
            <Text style={[styles.headerTitle, currentTheme === 'dark' && { color: '#fff' }]}>Anlaşmalı Mağazalar</Text>
          </View>
          <TouchableOpacity
            style={[styles.binCountBadge, currentTheme === 'dark' && { backgroundColor: '#334155' }]}
            onPress={() => setIsListModalVisible(true)}
          >
            <Text style={[styles.binCountText, currentTheme === 'dark' && { color: '#fff' }]}>{stores.length}</Text>
            <Text style={[styles.binCountLabel, currentTheme === 'dark' && { color: '#94a3b8' }]}>Mağaza</Text>
          </TouchableOpacity>
          {isCorporate && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => {
                setEditStore({ name: '' });
                setEditLat('');
                setEditLng('');
                setIsModalVisible(true);
              }}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Ekle</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Selected Store Popup */}
      {selectedStore && (
        isCardMinimized ? (
          <TouchableOpacity
            style={{
              position: 'absolute',
              bottom: 30,
              right: 20,
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: '#10b981',
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 5,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 3,
            }}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setIsCardMinimized(false);
            }}
          >
            <Ionicons name="storefront" size={28} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.detailCard, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardName, currentTheme === 'dark' && { color: '#fff' }]}>{selectedStore.name}</Text>
              <TouchableOpacity onPress={() => setSelectedStore(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={currentTheme === 'dark' ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <View style={[styles.coordDisplayRow, currentTheme === 'dark' && { backgroundColor: '#334155' }]}>
              <View style={styles.coordItem}>
                <Text style={[styles.coordLabel, currentTheme === 'dark' && { color: '#64748b' }]}>ENLEM:</Text>
                <Text style={[styles.coordValue, currentTheme === 'dark' && { color: '#fff' }]}>{selectedStore.latitude.toFixed(6)}</Text>
              </View>
              <View style={styles.coordItem}>
                <Text style={[styles.coordLabel, currentTheme === 'dark' && { color: '#64748b' }]}>BOYLAM:</Text>
                <Text style={[styles.coordValue, currentTheme === 'dark' && { color: '#fff' }]}>{selectedStore.longitude.toFixed(6)}</Text>
              </View>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.cardInspectBtn, { backgroundColor: '#10b981', flex: 1, height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                onPress={() => {
                  fetchRoute(selectedStore);
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setIsCardMinimized(true);
                }}
              >
                <Ionicons name="map-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.cardInspectBtnText}>Rotayı İncele</Text>
              </TouchableOpacity>

              {isCorporate && (
                <>
                  <TouchableOpacity
                    style={[styles.cardEditBtn, currentTheme === 'dark' && { backgroundColor: '#1e3a8a', borderColor: '#1e40af' }]}
                    onPress={() => {
                      setEditStore(selectedStore);
                      setEditLat(selectedStore.latitude.toString());
                      setEditLng(selectedStore.longitude.toString());
                      setIsModalVisible(true);
                    }}
                  >
                    <Ionicons name="pencil" size={20} color={currentTheme === 'dark' ? '#60a5fa' : '#3b82f6'} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.cardDeleteBtn, currentTheme === 'dark' && { backgroundColor: '#451a03', borderColor: '#7f1d1d' }]}
                    onPress={() => deleteStore(selectedStore.id)}
                  >
                    <Ionicons name="trash-outline" size={20} color={currentTheme === 'dark' ? '#f87171' : '#e74c3c'} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )
      )}

      {/* Add Store Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, currentTheme === 'dark' && { color: '#fff' }]}>Anlaşmalı Mağaza Ekle</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={24} color={currentTheme === 'dark' ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, currentTheme === 'dark' && { color: '#94a3b8' }]}>Mağaza Adı</Text>
              <TextInput
                style={[styles.input, currentTheme === 'dark' && { backgroundColor: '#334155', color: '#fff', borderColor: '#475569' }]}
                value={editStore?.name || ''}
                onChangeText={(t) => setEditStore({ ...editStore, name: t })}
                placeholder="Örn: Ege Market"
                placeholderTextColor={currentTheme === 'dark' ? '#94a3b8' : '#aaa'}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 15 }}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.label, currentTheme === 'dark' && { color: '#94a3b8' }]}>Enlem (Latitude)</Text>
                <TextInput
                  style={[styles.input, currentTheme === 'dark' && { backgroundColor: '#334155', color: '#fff', borderColor: '#475569' }]}
                  value={editLat}
                  onChangeText={setEditLat}
                  keyboardType="numeric"
                  placeholder="38.4553"
                  placeholderTextColor={currentTheme === 'dark' ? '#94a3b8' : '#aaa'}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.label, currentTheme === 'dark' && { color: '#94a3b8' }]}>Boylam (Longitude)</Text>
                <TextInput
                  style={[styles.input, currentTheme === 'dark' && { backgroundColor: '#334155', color: '#fff', borderColor: '#475569' }]}
                  value={editLng}
                  onChangeText={setEditLng}
                  keyboardType="numeric"
                  placeholder="27.2290"
                  placeholderTextColor={currentTheme === 'dark' ? '#94a3b8' : '#aaa'}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={saveStore}>
              <Text style={styles.saveBtnText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Store List Modal */}
      <Modal visible={isListModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '60%' }, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, currentTheme === 'dark' && { color: '#fff' }]}>Tüm Mağazalar</Text>
              <TouchableOpacity onPress={() => setIsListModalVisible(false)}>
                <Ionicons name="close" size={24} color={currentTheme === 'dark' ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {stores.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#94a3b8', marginTop: 20 }}>Henüz mağaza eklenmemiş.</Text>
              )}
              {stores.map(store => (
                <TouchableOpacity
                  key={store.id}
                  style={[styles.listItem, currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569' }]}
                  onPress={() => {
                    setIsListModalVisible(false);
                    setSelectedStore(store);
                    mapRef.current?.animateToRegion({ latitude: store.latitude, longitude: store.longitude, latitudeDelta: 0.002, longitudeDelta: 0.002 }, 800);
                  }}
                >
                  <View style={[styles.listIconBox, { backgroundColor: '#d1fae5' }, currentTheme === 'dark' && { backgroundColor: '#064e3b' }]}>
                    <Ionicons name="storefront" size={20} color="#10b981" />
                  </View>
                  <View style={styles.listContent}>
                    <Text style={[styles.listTitle, currentTheme === 'dark' && { color: '#fff' }]}>{store.name}</Text>
                    <Text style={[styles.listSubtitle, currentTheme === 'dark' && { color: '#94a3b8' }]}>{store.latitude.toFixed(4)}, {store.longitude.toFixed(4)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={currentTheme === 'dark' ? '#94a3b8' : '#cbd5e1'} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  headerBar: { position: 'absolute', top: 50, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 16, padding: 12, elevation: 8 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  backBtn: { padding: 4 },
  addBtn: { backgroundColor: '#10b981', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, gap: 4 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  pinWrapper: { width: 120, height: 60, alignItems: 'center' },
  tooltipContainer: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  tooltipText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  pickingBanner: { position: 'absolute', top: 120, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.8)', padding: 15, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  pickingText: { color: '#fff', fontWeight: 'bold', flex: 1 },
  cancelBtn: { backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  cancelBtnText: { color: '#fff', fontWeight: 'bold' },
  detailCard: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 20, padding: 16, elevation: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  coordDisplayRow: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 10, borderRadius: 12, gap: 15, marginBottom: 15 },
  coordItem: { flex: 1 },
  coordLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', marginBottom: 2 },
  coordValue: { fontSize: 13, fontWeight: '700', color: '#1e293b', fontFamily: 'monospace' },
  cardActions: { flexDirection: 'row', gap: 10 },
  cardInspectBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  cardEditBtn: { width: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff', borderRadius: 12 },
  cardDeleteBtn: { width: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1f2', borderRadius: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: '#64748b', marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 16 },
  saveBtn: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  binCountBadge: { backgroundColor: '#d1fae5', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', minWidth: 40, marginRight: 10 },
  binCountText: { fontSize: 14, fontWeight: '800', color: '#10b981' },
  binCountLabel: { fontSize: 8, color: '#10b981', fontWeight: '700', textTransform: 'uppercase' },
  listItem: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#f8fafc', borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  listIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  listContent: { flex: 1 },
  listTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  listSubtitle: { fontSize: 12, color: '#64748b' },
});
