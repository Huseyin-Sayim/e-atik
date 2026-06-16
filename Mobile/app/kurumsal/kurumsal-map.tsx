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
  Image,
  Share,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { MapView, Marker, PROVIDER_DEFAULT, Geojson } from '../../components/MapComponent';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DatabaseService from '../../database/DatabaseService';
import { useBinFullnessLive } from '../../hooks/useBinFullnessLive';
import { toFillPercentage } from '../../utils/fullness';
import { useRouter } from 'expo-router';

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
  capacity?: number;
  countdown?: number;
  isRequest?: boolean;
  dbId?: string;
  note?: string;
  userFullName?: string;
  wasteType?: string;
  status?: string;
  qrCode?: string;
  barCode?: string;
  addressLine?: string;
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

/**
 * QR ve Barkod için dinamik görsel URL'leri
 */
const getQrImageUrl = (code: string) => `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${code}`;
const getBarcodeImageUrl = (code: string) => `https://barcode.tec-it.com/barcode.ashx?data=${code}&code=Code128`;

const handleShareCode = async (bin: TrashBin, type: 'qr' | 'barkod') => {
  try {
    const code = type === 'qr' ? bin.qrCode : bin.barCode;
    if (!code) {
      Alert.alert('Hata', 'Kod bulunamadı.');
      return;
    }
    const url = type === 'qr' ? getQrImageUrl(code) : getBarcodeImageUrl(code);

    if (Platform.OS === 'web') {
      await Share.share({
        message: `${bin.name} - Atık Kutusu ${type.toUpperCase()} Kodu: ${code}\nLink: ${url}`,
        title: 'Atık Kutusu Kodu Paylaş',
      });
      return;
    }

    const safeName = bin.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${safeName}_${type}.png`;
    const fileUri = `${FileSystem.cacheDirectory}${filename}`;

    const downloadResult = await FileSystem.downloadAsync(url, fileUri);
    if (downloadResult.status !== 200) throw new Error('İndirme başarısız.');

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: 'image/png',
        dialogTitle: `${bin.name} ${type.toUpperCase()} Kodunu Paylaş`,
      });
    } else {
      Alert.alert('Hata', 'Bu cihazda paylaşım özelliği desteklenmiyor.');
    }
  } catch (error) {
    console.error('Paylaşım hatası:', error);
    Alert.alert('Hata', 'Paylaşım yapılamadı.');
  }
};

const handlePrintCode = async (bin: TrashBin, type: 'qr' | 'barkod') => {
  const code = type === 'qr' ? bin.qrCode : bin.barCode;
  if (!code) {
    Alert.alert('Hata', 'Kod bulunamadı.');
    return;
  }
  const url = type === 'qr' ? getQrImageUrl(code) : getBarcodeImageUrl(code);
  
  if (Platform.OS === 'web') {
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>${bin.name} - ${type.toUpperCase()}</title>
            </head>
            <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;">
              <h2>${bin.name}</h2>
              <p>${type.toUpperCase()} Kodu: ${code}</p>
              <img src="${url}" style="max-width:90%;max-height:70%;object-fit:contain;" onload="window.print();window.close()"/>
            </body>
          </html>
        `);
        printWindow.document.close();
      } else {
        Alert.alert('Hata', 'Pop-up engelleyici yazdır penceresini engelledi.');
      }
    } catch (e) {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${bin.name}_${type}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } else {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Galeri İzni Gerekli', 'QR/Barkod görselini galerinize kaydedebilmek için galeri erişim izni vermeniz gerekmektedir.');
        return;
      }

      const safeName = bin.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeName}_${type}.png`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      
      const downloadResult = await FileSystem.downloadAsync(url, fileUri);
      
      if (downloadResult.status === 200) {
        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
        Alert.alert(
          'Galeriye Kaydedildi! ✅',
          `${bin.name} kutusunun ${type.toUpperCase()} kodu başarıyla galerinize kaydedildi.\n\nGalerinizi açarak görseli bulabilir ve yazdırabilirsiniz.`,
          [{ text: 'Tamam' }]
        );
      } else {
        throw new Error('İndirme başarısız.');
      }
    } catch (error) {
      console.error('Galeri kaydetme hatası:', error);
      Alert.alert('Hata', 'Kod indirilirken/kaydedilirken bir hata oluştu.');
    }
  }
};


const isPointInPolygon = (latitude: number, longitude: number, polygon: number[][]) => {
  const x = longitude;
  const y = latitude;
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
};

const findParcelForCoords = (lat: number, lng: number): string | null => {
  if (!campusParcels || !campusParcels.features) return null;
  for (const feature of campusParcels.features) {
    if (feature.geometry && feature.geometry.type === 'Polygon') {
      const polygon = feature.geometry.coordinates[0];
      if (isPointInPolygon(lat, lng, polygon)) {
        return feature.id || feature.properties?.id || null;
      }
    }
  }
  return null;
};


export default function KurumsalMapScreen() {
  const mapRef = useRef<MapView>(null);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const currentRegionRef = useRef<{ latitude: number, longitude: number }>(CAMPUS_CENTER);
  const isFirstLoad = useRef(true);
  const leafletMapRef = useRef<any>(null); // Gerçek Leaflet map instance'ı (web only)
  const router = useRouter();

  const [bins, setBins] = useState<TrashBin[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>({ latitude: 38.4595, longitude: 27.2287 });
  const [selectedBin, setSelectedBin] = useState<TrashBin | null>(null);
  const [filterLevel, setFilterLevel] = useState<FillLevel | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isListModalVisible, setIsListModalVisible] = useState(false);
  const [isRequestListModalVisible, setIsRequestListModalVisible] = useState(false);
  const [editBin, setEditBin] = useState<Partial<TrashBin> | null>(null);
  const [pickingMode, setPickingMode] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [coordsDisplay, setCoordsDisplay] = useState({ lat: 0, lng: 0 });
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [isInspectMode, setIsInspectMode] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const locationIntervalRef = useRef<any>(null);
  const [currentTheme, setCurrentTheme] = useState('light');
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [qrModalBin, setQrModalBin] = useState<TrashBin | null>(null);
  const [qrType, setQrType] = useState<'qr' | 'barkod' | null>(null);

  useBinFullnessLive(bins, setBins, {
    selectedBin,
    onSelectedBinChange: setSelectedBin,
  });

  useEffect(() => {
    const initApp = async () => {
      await loadBins();
      setupLocation();
    };

    initApp();

    const unsubscribeBins = DatabaseService.subscribeToBins(() => {
      loadBins();
    });

    const unsubTheme = DatabaseService.subscribeToTheme((theme) => {
      setCurrentTheme(theme);
    });

    // WebSocket Bağlantısı (Canlı Harita Güncellemeleri İçin)
    const wsUrl = DatabaseService.getWsUrl();
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => console.log('✅ WebSocket Bağlantısı Kuruldu (Canlı Harita)');
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (['wasteRequestCreated', 'wasteRequestStatusChanged', 'binCreated', 'binUpdated', 'binDeleted', 'locationUpdate'].includes(payload.type)) {
          console.log('🔄 Yeni evsel atık harita bildirimi algılandı, veriler yenileniyor...');
          loadBins();
        }
      } catch (err) {
        // Yoksay
      }
    };
    ws.onerror = (e) => console.warn('WebSocket Hatası (Canlı Harita):', e);
    wsRef.current = ws;

    return () => {
      unsubscribeBins();
      unsubTheme();
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  const getBinCapacityLabel = (bin: TrashBin) => {
    const cap = bin.capacity || 100;
    const sizeStr = cap === 50 ? 'Küçük Boy' : 'Büyük Boy';
    let typeStr = 'Genel Atık';
    if (bin.type === 'plastik') typeStr = 'Plastik';
    if (bin.type === 'kagit') typeStr = 'Kağıt';
    if (bin.type === 'cam') typeStr = 'Cam';
    return `${sizeStr} ${typeStr} Kutusu (${cap}L)`;
  };

  const handleEmptyBin = async (binId: string) => {
    try {
      setBins(prevBins => prevBins.map(bin => {
        if (bin.id === binId) {
          const updated = { ...bin, fillPercentage: 0 };
          setSelectedBin(updated);
          return updated;
        }
        return bin;
      }));

      await DatabaseService.updateBinFullness(binId, 0);

      Alert.alert(
        'İşlem Başarılı',
        'Akıllı atık kutusu başarıyla boşaltıldı.',
        [{ text: 'Harika', style: 'default' }]
      );
    } catch (err) {
      console.error('Boşaltma hatası:', err);
      Alert.alert('Hata', 'Kutu boşaltılırken veri tabanında bir sorun oluştu.');
    }
  };

  const setupLocation = async () => {
    try {
      // Ege Üniversitesi Metro İstasyonu Konumu (Sabit)
      const staticLoc = { latitude: 38.4595, longitude: 27.2287 };
      setUserLocation(staticLoc);
      
      // Canlı konum yayını (Statik noktadan)
      const sendUpdate = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'locationUpdate',
            staffId: 'kurumsal_personel_1',
            latitude: staticLoc.latitude,
            longitude: staticLoc.longitude
          }));
        }
      };
      
      sendUpdate();
      // Harita ekranındayken de her 4 saniyede bir gönder
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
      locationIntervalRef.current = setInterval(sendUpdate, 4000);
    } catch (e) {
      console.warn('Konum sabitleme hatası');
    }
  };

  const fetchRoute = async (destinationBin: TrashBin | null) => {
    if (!userLocation || !destinationBin) {
      setRouteCoordinates([]);
      return;
    }
    try {
      // OSRM Public API (Yaya Rotası)
      const url = `https://router.project-osrm.org/route/v1/foot/${userLocation.longitude},${userLocation.latitude};${destinationBin.longitude},${destinationBin.latitude}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const json = await response.json();
      
      if (json.routes && json.routes.length > 0) {
        // GeoJSON koordinatları [lng, lat] formatındadır, MapView için {latitude, longitude} objesine çeviriyoruz
        const coords = json.routes[0].geometry.coordinates.map((c: any[]) => ({
          latitude: c[1],
          longitude: c[0]
        }));
        setRouteCoordinates(coords);
      } else {
        // Rota bulunamazsa (veya offline) düz çizgi çek (Fallback)
        setRouteCoordinates([userLocation, { latitude: destinationBin.latitude, longitude: destinationBin.longitude }]);
      }
    } catch (e) {
      console.warn("OSRM Route Error:", e);
      setRouteCoordinates([userLocation, { latitude: destinationBin.latitude, longitude: destinationBin.longitude }]);
    }
  };

  useEffect(() => {
    if (selectedBin) {
      fetchRoute(selectedBin);
    } else {
      setRouteCoordinates([]);
    }
  }, [selectedBin]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const loadBins = async () => {
    try {
      if (isFirstLoad.current) {
        setLoading(true);
      }

      // getBins hata fırlatırsa catch bloğuna düşer, setBins çağrılmaz → mevcut marker'lar korunur
      let fetchedBins = await DatabaseService.getBins();
  
      // Evsel atık bildirimlerini de çekelim
      let fetchedRequests: any[] = [];
      try {
        fetchedRequests = await DatabaseService.getWasteRequests();
      } catch (reqErr) {
        console.warn('Harita: Evsel atıklar çekilirken hata oluştu:', reqErr);
      }
  
      const mappedBins = fetchedBins.map(b => {
        const type = b.wasteCategory === 'PLASTIC' ? 'plastik' : b.wasteCategory === 'GLASS' ? 'cam' : b.wasteCategory === 'PAPER' ? 'kagit' : 'genel';
        const capacity = b.capacityVolume || 100;
        return {
          id: b.id.toString(),
          name: b.name || 'İsimsiz Kutu',
          latitude: parseFloat(b.latitude),
          longitude: parseFloat(b.longitude),
          fillPercentage: toFillPercentage(b.predictedFullness),
          type,
          capacity,
          lastUpdated: 'Şimdi',
          qrCode: b.qrCode || undefined,
          barCode: b.barCode || undefined,
        };
      });
  
      const activeRequests = fetchedRequests.filter(
        (req: any) => req.status === 'PENDING' || req.status === 'ON_ROUTE'
      );
      const mappedRequests = activeRequests.map((req: any) => {
        let catName = 'Evsel Atık';
        if (req.wasteType === 'DOMESTIC') catName = 'Organik Atık';
        else if (req.wasteType === 'ELECTRONIC') catName = 'Elektronik Atık';
        else if (req.wasteType === 'PLASTIC') catName = 'Ambalaj Atığı';
  
        return {
          id: 'req_' + req.id,
          dbId: req.id,
          name: `${catName} (${req.user ? req.user.name : 'Vatandaş'})`,
          latitude: parseFloat(req.latitude),
          longitude: parseFloat(req.longitude),
          fillPercentage: 100, // En yüksek öncelik
          type: 'genel',
          capacity: 100,
          countdown: 0,
          lastUpdated: 'Şimdi',
          isRequest: true,
          note: req.note,
          addressLine: req.addressLine,
          userFullName: req.user ? `${req.user.name} ${req.user.surname || ''}` : 'Kullanıcı',
          wasteType: req.wasteType,
          status: req.status
        };
      });
  
      // Sadece başarılı veri geldiğinde state'i güncelle
      setBins([...mappedRequests, ...mappedBins]);
    } catch (e) {
      // Hata durumunda setBins çağrılmaz → mevcut marker'lar haritada kalır
      console.error('❌ Kutu yükleme hatası (mevcut marker\'lar korunuyor):', e);
    } finally {
      if (isFirstLoad.current) {
        setLoading(false);
        isFirstLoad.current = false;
      }
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

    // Koordinatların hangi parselde (bölgede) olduğunu otomatik tespit et
    const regionId = findParcelForCoords(lat, lng);
    if (!regionId) {
      Alert.alert('Hata', 'Seçtiğiniz konum kampüs sınırları (bölge) dışında! Lütfen kampüs içi bir bölgede seçim yapın.');
      return;
    }

    try {
      const payload = {
        name: editBin.name,
        latitude: lat,
        longitude: lng,
        predictedFullness: editBin.fillPercentage || 0,
        wasteCategory: editBin.type === 'plastik' ? 'PLASTIC' : editBin.type === 'cam' ? 'GLASS' : editBin.type === 'kagit' ? 'PAPER' : 'GENERAL',
        capacityVolume: editBin.capacity || 100,
        type: editBin.capacity === 50 ? 'CONTAINER_SMALL' : 'CONTAINER_LARGE',
        regionId: regionId
      };

      if (editBin.id) {
        // GÜNCELLEME (DB)
        console.log('🔄 DB Güncelleniyor...', editBin.id);
        await DatabaseService.updateBinItem(editBin.id, payload);

        // Optimistik güncelleme: güncel veriyi state'e hemen yansıt (flicker yok)
        const updatedBinId = editBin.id;
        setBins(prev => prev.map(b => b.id === updatedBinId ? {
          ...b,
          name: payload.name,
          latitude: payload.latitude,
          longitude: payload.longitude,
          fillPercentage: toFillPercentage(payload.predictedFullness),
          type: editBin.type || b.type,
          capacity: payload.capacityVolume,
        } : b));
      } else {
        // YENİ EKLEME (DB)
        console.log('➕ DB ye Ekleniyor...');
        await DatabaseService.addBin(payload);
      }

      // UX: Modalı anında kapat ki kullanıcıya hızlı hissettirsin
      setIsModalVisible(false);
      setEditBin(null);
      setSelectedBin(null); // Kartı kapat ki eski ID ile kalmasın

      // Sunucudan taze liste çek (başarısız olursa optimistik güncelleme zaten yapıldı)
      await loadBins();

      Alert.alert('Başarılı', 'Değişiklikler veritabanına kaydedildi.');

    } catch (error: any) {
      console.error('Kayıt hatası:', error);
      Alert.alert('Hata', error.message || 'Veritabanına kaydedilirken sorun oluştu.');
    }
  };

  const executeDelete = async (id: string) => {
    try {
      console.log('🗑️ DB den siliniyor...', id);
      await DatabaseService.deleteBinItem(id);
      
      // Optimistik güncelleme: silinen bin'i state'den hemen çıkar (flicker yok)
      setSelectedBin(null);
      setBins(prev => prev.filter(b => b.id !== id));
      
      // Sunucudan taze liste çek (başarısız olursa optimistik güncelleme zaten yapıldı)
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
  const regularBins = filteredBins.filter(b => !b.isRequest);
  const requestBins = filteredBins.filter(b => b.isRequest);

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
            setCoordsDisplay({ lat: region.latitude, lng: region.longitude });
          }
        }}
        campusParcels={campusParcels}
        bins={filteredBins}
        onMarkerPress={setSelectedBin}
        staffLocation={userLocation}
        routeCoordinates={routeCoordinates}
        routeColor={selectedBin?.isRequest ? 'blue' : 'red'}
      />

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
              { position: 'relative', bottom: 0, right: 0, backgroundColor: selectedBin.isRequest ? '#2563eb' : getPinColor(selectedBin.fillPercentage) }
            ]}
            onPress={() => setIsInspectMode(false)}
          >
            <Ionicons name={selectedBin.isRequest ? "home-outline" : "trash-outline"} size={26} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}
      <View style={[styles.headerBar, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
        <View style={styles.headerContent}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={[styles.headerTitle, currentTheme === 'dark' && { color: '#fff' }]}>🗺️ Kampüs Haritası</Text>
            <Text style={[styles.headerSubtitle, currentTheme === 'dark' && { color: '#94a3b8' }]}>{regularBins.length} Kutu • {requestBins.length} Talep</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.manageBtn, { backgroundColor: '#8b5cf6', marginRight: 2, paddingHorizontal: 10, justifyContent: 'center' }]}
              onPress={() => router.push('/kurumsal/region-select')}
            >
              <Ionicons name="map" size={20} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.binCountBadge, currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569' }]}
              onPress={() => setIsListModalVisible(true)}
            >
              <Text style={[styles.binCountText, currentTheme === 'dark' && { color: '#fff' }]}>{regularBins.length}</Text>
              <Text style={[styles.binCountLabel, currentTheme === 'dark' && { color: '#94a3b8' }]}>Kutu</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.binCountBadge, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }, currentTheme === 'dark' && { backgroundColor: '#1e3a8a', borderColor: '#1e40af' }]}
              onPress={() => setIsRequestListModalVisible(true)}
            >
              <Text style={[styles.binCountText, { color: '#2563eb' }, currentTheme === 'dark' && { color: '#60a5fa' }]}>{requestBins.length}</Text>
              <Text style={[styles.binCountLabel, { color: '#2563eb' }, currentTheme === 'dark' && { color: '#94a3b8' }]}>Talep</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.manageBtn, pickingMode && { backgroundColor: '#e74c3c' }, { paddingHorizontal: 10, justifyContent: 'center' }]}
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
              <Ionicons name={pickingMode ? "pin" : "add-circle"} size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'low', 'medium', 'high'] as const).map((level) => (
          <TouchableOpacity key={level} style={[styles.filterBtn, filterLevel === level && styles.filterBtnActive, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }, filterLevel === level && currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569' }]} onPress={() => setFilterLevel(level)}>
            <Text style={[styles.filterBtnText, filterLevel === level && styles.filterBtnTextActive, currentTheme === 'dark' && { color: '#94a3b8' }, filterLevel === level && currentTheme === 'dark' && { color: '#fff' }]}>
              {level === 'all' ? 'Tümü' : level === 'low' ? '🟢 Boş' : level === 'medium' ? '🟡 Orta' : '🔴 Dolu'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={[styles.actionBtn, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }]} onPress={goToFullestBin}>
          <MaterialCommunityIcons name="alert-rhombus" size={28} color="#e74c3c" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }]} onPress={goToMyLocation}>
          <Ionicons name="locate" size={22} color={currentTheme === 'dark' ? '#34d399' : '#2e7d32'} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }]} onPress={goToCampus}>
          <Ionicons name="map-outline" size={22} color={currentTheme === 'dark' ? '#34d399' : '#2e7d32'} />
        </TouchableOpacity>
      </View>

      {toastMsg && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}

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
                {selectedBin.isRequest 
                  ? `Bildiren Vatandaş: ${selectedBin.userFullName}` 
                  : getBinCapacityLabel(selectedBin)}
              </Text>
            </View>
            <TouchableOpacity 
              style={{ position: 'absolute', right: 0, top: 0, padding: 4 }} 
              onPress={() => setSelectedBin(null)}
            >
              <Ionicons name="close-circle" size={26} color={currentTheme === 'dark' ? '#64748b' : '#ccc'} />
            </TouchableOpacity>
          </View>
          <View style={styles.cardBody}>
            {selectedBin.isRequest ? (
              // Evsel Atık Talebi Kart İçeriği
              <View style={{ marginBottom: 10 }}>
                <View style={styles.infoSectionMap}>
                  <Text style={[styles.infoSectionTitleMap, currentTheme === 'dark' && { color: '#94a3b8' }]}>AÇIK ADRES / NOT</Text>
                  <Text style={[styles.infoSectionValueMap, currentTheme === 'dark' && { color: '#f8fafc' }]}>{selectedBin.addressLine || selectedBin.note || 'Belirtilmedi'}</Text>
                </View>

                <View style={styles.infoSectionMap}>
                  <Text style={[styles.infoSectionTitleMap, currentTheme === 'dark' && { color: '#64748b' }]}>DURUM</Text>
                  <View style={[
                    styles.statusBadgeMap, 
                    { backgroundColor: selectedBin.status === 'ON_ROUTE' ? '#fffbeb' : '#f0fdf4' },
                    currentTheme === 'dark' && { backgroundColor: selectedBin.status === 'ON_ROUTE' ? '#451a03' : '#064e3b' }
                  ]}>
                    <Text style={[
                      styles.statusBadgeTextMap, 
                      { color: selectedBin.status === 'ON_ROUTE' ? '#d97706' : '#16a34a' },
                      currentTheme === 'dark' && { color: selectedBin.status === 'ON_ROUTE' ? '#fcd34d' : '#86efac' }
                    ]}>
                      {selectedBin.status === 'ON_ROUTE' ? 'Yolda (Ekipler Yönlendirildi)' : 'Beklemede'}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActionsMap}>
                  {selectedBin.status !== 'ON_ROUTE' && (
                    <TouchableOpacity 
                      style={styles.routeBtnMap}
                      onPress={async () => {
                        try {
                          if (selectedBin.dbId) {
                            await DatabaseService.updateWasteRequestStatus(selectedBin.dbId, 'ON_ROUTE');
                            await loadBins();
                            // Haritadaki konumu güncelle ve seçili olanı yenile
                            setSelectedBin(prev => prev ? { ...prev, status: 'ON_ROUTE' } : null);
                            Alert.alert('Rota Çizildi', 'Talep konumuna yaya rotası belirlendi. Haritayı inceleyebilirsiniz.');
                          }
                        } catch (err: any) {
                          Alert.alert('Hata', err.message || 'Durum güncellenirken hata oluştu.');
                        }
                      }}
                    >
                      <View style={{ alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="navigate" size={16} color="#fff" style={{ marginRight: 4 }} />
                          <Text style={styles.btnTextMap}>Yol Tarifi Al</Text>
                        </View>
                        <Text style={styles.btnTextMap}>(Rota Çiz)</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {selectedBin.status === 'ON_ROUTE' && (
                    <TouchableOpacity
                      style={[styles.cardInspectBtn, { backgroundColor: '#2563eb', flex: 1, height: '100%', borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                      onPress={() => setIsInspectMode(true)}
                    >
                      <Ionicons name="map-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.cardInspectBtnText}>Rotayı İncele</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity 
                    style={styles.collectBtnMap}
                    onPress={async () => {
                      try {
                        if (selectedBin.dbId) {
                          await DatabaseService.updateWasteRequestStatus(selectedBin.dbId, 'COLLECTED');
                          setSelectedBin(null);
                          await loadBins();
                          Alert.alert('Tebrikler!', 'Evsel atık başarıyla toplandı. Haritadan ve listeden kaldırıldı.');
                        }
                      } catch (err: any) {
                        Alert.alert('Hata', err.message || 'Toplama işlemi tamamlanırken hata oluştu.');
                      }
                    }}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.btnTextMap}>Atığı Topladım</Text>
                      </View>
                      <Text style={styles.btnTextMap}>(Tamamla)</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Normal Akıllı Kutu İçeriği
              <>
                <View style={[styles.countdownBox, currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569' }]}>
                  {selectedBin.fillPercentage < 100 ? (
                    <View style={styles.countdownRow}>
                      <Ionicons name="pulse-outline" size={18} color="#2e7d32" style={{ marginRight: 6 }} />
                      <Text style={[styles.countdownText, currentTheme === 'dark' && { color: '#94a3b8' }]}>
                        Anlık doluluk: <Text style={[styles.countdownValue, currentTheme === 'dark' && { color: '#fff' }]}>%{selectedBin.fillPercentage}</Text>
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.countdownRow}>
                      <Ionicons name="alert-circle" size={18} color="#e74c3c" style={{ marginRight: 6 }} />
                      <Text style={[styles.countdownText, { color: '#e74c3c', fontWeight: 'bold' }, currentTheme === 'dark' && { color: '#f87171' }]}>
                        Kutu tamamen dolmuştur! Lütfen boşaltınız.
                      </Text>
                    </View>
                  )}
                </View>

                <View style={[styles.coordDisplayRow, currentTheme === 'dark' && { backgroundColor: '#334155' }]}>
                  <View style={styles.coordItem}>
                    <Text style={[styles.coordLabel, currentTheme === 'dark' && { color: '#64748b' }]}>ENLEM:</Text>
                    <Text style={[styles.coordValue, currentTheme === 'dark' && { color: '#fff' }]}>{selectedBin.latitude.toFixed(6)}</Text>
                  </View>
                  <View style={styles.coordItem}>
                    <Text style={[styles.coordLabel, currentTheme === 'dark' && { color: '#64748b' }]}>BOYLAM:</Text>
                    <Text style={[styles.coordValue, currentTheme === 'dark' && { color: '#fff' }]}>{selectedBin.longitude.toFixed(6)}</Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.cardEditBtn, currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569' }]}
                    onPress={() => {
                      setEditBin(selectedBin);
                      setIsModalVisible(true);
                    }}
                  >
                    <Ionicons name="create-outline" size={20} color={currentTheme === 'dark' ? '#34d399' : '#2e7d32'} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.cardInspectBtn, { backgroundColor: getPinColor(selectedBin.fillPercentage), flex: 1, height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                    onPress={() => setIsInspectMode(true)}
                  >
                    <Ionicons name="map-outline" size={20} color="#fff" />
                    <Text style={styles.cardInspectBtnText}>Rotayı İncele</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.cardQrBtn]}
                    onPress={() => {
                      setQrModalBin(selectedBin);
                      setQrType(null);
                      setIsQrModalVisible(true);
                    }}
                  >
                    <Ionicons name="qr-code-outline" size={20} color="#7c3aed" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.cardDeleteBtn, currentTheme === 'dark' && { backgroundColor: '#451a03', borderColor: '#7f1d1d' }]}
                    onPress={() => handleDeleteBin(selectedBin.id)}
                  >
                    <Ionicons name="trash-outline" size={20} color={currentTheme === 'dark' ? '#f87171' : '#e74c3c'} />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </Animated.View>
      )}

      {/* LİSTE MODALI (Üst Üste Binen Kutular İçin) */}
      <Modal visible={isListModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsListModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
            <View style={[styles.modalHeader, currentTheme === 'dark' && { borderBottomColor: '#334155' }]}>
              <View>
                <Text style={[styles.modalTitle, currentTheme === 'dark' && { color: '#fff' }]}>Tüm Atık Kutuları</Text>
                <Text style={[styles.headerSubtitle, currentTheme === 'dark' && { color: '#94a3b8' }]}>{regularBins.length} kayıt bulundu</Text>
              </View>
              <TouchableOpacity onPress={() => setIsListModalVisible(false)}>
                <Ionicons name="close" size={28} color={currentTheme === 'dark' ? '#64748b' : '#333'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {regularBins.map((bin) => (
                <TouchableOpacity
                  key={`list-bin-${bin.id}`}
                  style={[styles.listItem, currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569' }]}
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

      {/* EVSEL ATIK TALEPLERİ LİSTE MODALI */}
      <Modal visible={isRequestListModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsRequestListModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
            <View style={[styles.modalHeader, currentTheme === 'dark' && { borderBottomColor: '#334155' }]}>
              <View>
                <Text style={[styles.modalTitle, currentTheme === 'dark' && { color: '#fff' }]}>Evsel Atık Talepleri</Text>
                <Text style={[styles.headerSubtitle, currentTheme === 'dark' && { color: '#94a3b8' }]}>{requestBins.length} aktif talep bulundu</Text>
              </View>
              <TouchableOpacity onPress={() => setIsRequestListModalVisible(false)}>
                <Ionicons name="close" size={28} color={currentTheme === 'dark' ? '#64748b' : '#333'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {requestBins.map((bin) => (
                <TouchableOpacity
                  key={`list-req-${bin.id}`}
                  style={[styles.listItem, currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569' }]}
                  onPress={() => {
                    setIsRequestListModalVisible(false);
                    setSelectedBin(bin);
                    mapRef.current?.animateToRegion({
                      latitude: bin.latitude,
                      longitude: bin.longitude,
                      latitudeDelta: 0.002,
                      longitudeDelta: 0.002
                    }, 800);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Ionicons name="location" size={20} color="#2563eb" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listItemName, currentTheme === 'dark' && { color: '#fff' }]} numberOfLines={1}>{bin.name}</Text>
                      <Text style={[styles.listItemCoords, { fontSize: 12, color: '#64748b' }]} numberOfLines={1}>{bin.addressLine || bin.note || 'Açıklama yok'}</Text>
                    </View>
                  </View>
                  <View style={[
                    styles.statusBadgeMap,
                    { backgroundColor: bin.status === 'ON_ROUTE' ? '#fffbeb' : '#f0fdf4', paddingHorizontal: 6, paddingVertical: 3 },
                    currentTheme === 'dark' && { backgroundColor: bin.status === 'ON_ROUTE' ? '#451a03' : '#064e3b' }
                  ]}>
                    <Text style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: bin.status === 'ON_ROUTE' ? '#d97706' : '#16a34a',
                      color: bin.status === 'ON_ROUTE' ? (currentTheme === 'dark' ? '#fcd34d' : '#d97706') : (currentTheme === 'dark' ? '#86efac' : '#16a34a')
                    }}>
                      {bin.status === 'ON_ROUTE' ? 'Yolda' : 'Bekliyor'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {requestBins.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#94a3b8', marginTop: 20 }}>Listelenecek aktif talep yok.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* YÖNETİM MODALI */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
            <View style={[styles.modalHeader, currentTheme === 'dark' && { borderBottomColor: '#334155' }]}>
              <Text style={[styles.modalTitle, currentTheme === 'dark' && { color: '#fff' }]}>{editBin?.id ? 'Noktayı Düzenle' : 'Yeni Atık Kutusu Ekle'}</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={28} color={currentTheme === 'dark' ? '#64748b' : '#333'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, currentTheme === 'dark' && { color: '#94a3b8' }]}>Atık Kutu İsmi</Text>
                <TextInput
                  style={[styles.input, currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569', color: '#fff' }]}
                  placeholder="Örn: Mühendislik Binası Önü"
                  placeholderTextColor="#94a3b8"
                  value={editBin?.name}
                  onChangeText={(val) => setEditBin({ ...editBin, name: val })}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.label, currentTheme === 'dark' && { color: '#94a3b8' }]}>Enlem (Lat)</Text>
                  <TextInput
                    style={[styles.input, currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569', color: '#fff' }]}
                    placeholder={editBin?.id ? "" : currentRegionRef.current.latitude.toFixed(6)}
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={editBin?.latitude?.toString() || ''}
                    onChangeText={(val) => setEditBin({ ...editBin, latitude: val as any })}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
                  <Text style={[styles.label, currentTheme === 'dark' && { color: '#94a3b8' }]}>Boylam (Lng)</Text>
                  <TextInput
                    style={[styles.input, currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569', color: '#fff' }]}
                    placeholder={editBin?.id ? "" : currentRegionRef.current.longitude.toFixed(6)}
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={editBin?.longitude?.toString() || ''}
                    onChangeText={(val) => setEditBin({ ...editBin, longitude: val as any })}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, currentTheme === 'dark' && { color: '#94a3b8' }]}>Kapasite (Litre)</Text>
                <View style={{ flexDirection: 'row', gap: 15, marginTop: 5 }}>
                  <TouchableOpacity 
                    style={[styles.capacityRadioBtn, editBin?.capacity === 50 && styles.capacityRadioBtnActive, currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569' }]}
                    activeOpacity={0.8}
                    onPress={() => setEditBin({ ...editBin, capacity: 50 })}
                  >
                    <View style={[styles.radioCheckbox, editBin?.capacity === 50 && styles.radioCheckboxActive]}>
                      {editBin?.capacity === 50 && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={[styles.capacityRadioText, editBin?.capacity === 50 && styles.capacityRadioTextActive, currentTheme === 'dark' && { color: '#fff' }]}>Küçük (50L)</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.capacityRadioBtn, (editBin?.capacity === 100 || !editBin?.capacity) && styles.capacityRadioBtnActive, currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569' }]}
                    activeOpacity={0.8}
                    onPress={() => setEditBin({ ...editBin, capacity: 100 })}
                  >
                    <View style={[styles.radioCheckbox, (editBin?.capacity === 100 || !editBin?.capacity) && styles.radioCheckboxActive]}>
                      {(editBin?.capacity === 100 || !editBin?.capacity) && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={[styles.capacityRadioText, (editBin?.capacity === 100 || !editBin?.capacity) && styles.capacityRadioTextActive, currentTheme === 'dark' && { color: '#fff' }]}>Büyük (100L)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, currentTheme === 'dark' && { color: '#94a3b8' }]}>Doluluk Oranı (%)</Text>
                <TextInput
                  style={[styles.input, { fontWeight: '700', fontSize: 16 }, currentTheme === 'dark' && { backgroundColor: '#334155', borderColor: '#475569', color: '#fff' }]}
                  placeholder="Örn: 45"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  maxLength={3}
                  value={editBin?.fillPercentage !== undefined ? editBin.fillPercentage.toString() : ''}
                  onChangeText={(val) => {
                    const cleanVal = val.replace(/[^0-9]/g, '');
                    if (cleanVal === '') {
                      setEditBin({ ...editBin, fillPercentage: 0 });
                      return;
                    }
                    const num = Math.max(0, Math.min(100, parseInt(cleanVal, 10)));
                    setEditBin({ ...editBin, fillPercentage: num });
                  }}
                />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleAddOrUpdateBin}>
                <Text style={styles.saveBtnText}>Değişiklikleri Kaydet</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* QR & BARKOD POPUP MODAL */}
      <Modal visible={isQrModalVisible} animationType="fade" transparent={true} onRequestClose={() => setIsQrModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center', paddingBottom: 40 }, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, currentTheme === 'dark' && { color: '#fff' }]}>Fiziksel Etiket Paneli</Text>
                <Text style={{ fontSize: 12, color: '#64748b' }}>Kutunun üzerine yapıştırılacak kodu seçin</Text>
              </View>
              <TouchableOpacity onPress={() => setIsQrModalVisible(false)}>
                <Ionicons name="close" size={28} color={currentTheme === 'dark' ? '#94a3b8' : '#333'} />
              </TouchableOpacity>
            </View>

            {qrModalBin && (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text style={{ color: '#7c3aed', fontWeight: '700', marginBottom: 20 }}>{qrModalBin.name}</Text>
                
                <View style={styles.qrCodeEmptyFrame}>
                  {qrType ? (
                    <Image 
                      source={{ uri: qrType === 'qr' ? getQrImageUrl(qrModalBin.qrCode || '') : getBarcodeImageUrl(qrModalBin.barCode || '') }}
                      style={{ width: '100%', height: qrType === 'qr' ? '100%' : 80 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="qr-code-outline" size={48} color="#cbd5e1" />
                      <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 10, textAlign: 'center' }}>
                        Lütfen kod türünü seçiniz
                      </Text>
                    </View>
                  )}
                </View>

                {/* Radio Buttons */}
                <View style={styles.radioGroupMap}>
                  <TouchableOpacity style={styles.radioButtonMap} onPress={() => setQrType('qr')}>
                    <Ionicons name={qrType === 'qr' ? "radio-button-on" : "radio-button-off"} size={24} color="#7c3aed" />
                    <Text style={[styles.radioTextMap, currentTheme === 'dark' && { color: '#fff' }]}>QR Kod</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.radioButtonMap} onPress={() => setQrType('barkod')}>
                    <Ionicons name={qrType === 'barkod' ? "radio-button-on" : "radio-button-off"} size={24} color="#7c3aed" />
                    <Text style={[styles.radioTextMap, currentTheme === 'dark' && { color: '#fff' }]}>Barkod</Text>
                  </TouchableOpacity>
                </View>

                {/* Butonlar */}
                <View style={styles.modalActionsMap}>
                  <TouchableOpacity 
                    style={[styles.collectBtnMap, !qrType && { backgroundColor: '#cbd5e1' }]}
                    disabled={!qrType}
                    onPress={() => handlePrintCode(qrModalBin, qrType!)}
                  >
                    <Ionicons name="cloud-download-outline" size={20} color="#fff" />
                    <Text style={styles.btnTextMap}>İndir / Yazdır</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.routeBtnMap, { backgroundColor: '#f1f5f9' }, !qrType && { backgroundColor: '#f8fafc' }]}
                    disabled={!qrType}
                    onPress={() => handleShareCode(qrModalBin, qrType!)}
                  >
                    <Ionicons name="share-social-outline" size={20} color={qrType ? "#334155" : "#cbd5e1"} />
                    <Text style={[styles.btnTextMap, { color: qrType ? '#334155' : '#cbd5e1' }]}>Paylaş</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  pinWrapper: { width: 95, height: 60, alignItems: 'center' },
  tooltipContainer: { width: 95, height: 34, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  tooltipContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  divider: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.4)', marginHorizontal: 6 },
  tooltipText: { width: 36, textAlign: 'center', color: '#fff', fontSize: 13, fontWeight: 'bold' },
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
  cardEditBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8f5e9', borderRadius: 12 },
  cardEditBtnText: { color: '#2e7d32', fontWeight: '700' },
  cardEmptyBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8f5e9', borderRadius: 12 },
  cardDeleteBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1f2', borderRadius: 12 },
  cardInspectBtn: { backgroundColor: '#2e7d32', elevation: 2, height: 44, justifyContent: 'center' },
  cardInspectBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  floatingInspectBtn: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  fillBarContainer: { marginVertical: 4 },
  fillBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  fillBarLabel: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  fillBarValue: { fontSize: 14, fontWeight: 'bold' },
  countdownBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#e2e8f0', marginVertical: 4 },
  countdownRow: { flexDirection: 'row', alignItems: 'center' },
  countdownText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  countdownValue: { fontWeight: '800', color: '#2e7d32', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

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

  // Evsel Atık Talebi Harita Kartı Stilleri
  infoSectionMap: {
    marginBottom: 10,
  },
  infoSectionTitleMap: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 4,
  },
  infoSectionValueMap: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
  },
  statusBadgeMap: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusBadgeTextMap: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalActionsMap: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  routeBtnMap: {
    flex: 1,
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  collectBtnMap: {
    flex: 1,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnTextMap: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    flexShrink: 1,
  },
  cardQrBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3e8ff',
    borderRadius: 12,
  },
  capacityRadioBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  capacityRadioBtnActive: {
    borderColor: '#2e7d32',
    backgroundColor: '#e8f5e9',
  },
  radioCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCheckboxActive: {
    borderColor: '#2e7d32',
    backgroundColor: '#2e7d32',
  },
  capacityRadioText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  capacityRadioTextActive: {
    color: '#2e7d32',
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
  qrCodeEmptyFrame: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: '#7c3aed',
    borderStyle: 'dashed',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  radioGroupMap: {
    flexDirection: 'row',
    gap: 30,
    marginVertical: 25,
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
  cardQrBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3e8ff',
    borderRadius: 12,
  },
});
