import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DatabaseService from '../../database/DatabaseService';

interface TrashBin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  fillPercentage: number;
  type: 'plastik' | 'kagit' | 'cam' | 'genel';
  capacity: number;
}

export default function KisiselScanScreen() {
  const [bins, setBins] = useState<TrashBin[]>([]);
  const [loadingBins, setLoadingBins] = useState(false);
  const [selectedBin, setSelectedBin] = useState<TrashBin | null>(null);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('light');

  useEffect(() => {
    const unsubscribe = DatabaseService.subscribeToTheme((theme) => {
      setCurrentTheme(theme);
    });
    return unsubscribe;
  }, []);

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanMode, setScanMode] = useState<'qr' | 'barcode' | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const processingRef = useRef(false);

  const laserAnim = useRef(new Animated.Value(0)).current;

  // Özel Radiuslu Alert Yapısı
  const [alertInfo, setAlertInfo] = useState({
    visible: false,
    type: 'success', // 'success' | 'error'
    title: '',
    message: ''
  });

  useEffect(() => {
    loadBins();
    const unsubscribe = DatabaseService.subscribeToBins(() => {
      loadBins();
    });
    return unsubscribe;
  }, []);

  const loadBins = async () => {
    try {
      setLoadingBins(true);
      const fetched = await DatabaseService.getBins();
      const mappedBins: TrashBin[] = fetched.map(b => ({
        id: b.id.toString(),
        name: b.name || 'İsimsiz Kutu',
        latitude: parseFloat(b.latitude),
        longitude: parseFloat(b.longitude),
        fillPercentage: b.predictedFullness || 0,
        type: b.wasteCategory === 'PLASTIC' ? 'plastik' : b.wasteCategory === 'GLASS' ? 'cam' : b.wasteCategory === 'PAPER' ? 'kagit' : 'genel',
        capacity: (b.wasteCategory === 'PLASTIC' || b.wasteCategory === 'PAPER') ? 50 : 100
      }));
      setBins(mappedBins);

      // Selected bin güncel durumunu koru
      if (selectedBin) {
        const updated = mappedBins.find(b => b.id === selectedBin.id);
        if (updated) setSelectedBin(updated);
      }
    } catch (e) {
      console.log('Bireysel tarafta kutular yüklenemedi:', e);
    } finally {
      setLoadingBins(false);
    }
  };

  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      laserAnim.setValue(0);
    }
  }, [isScanning]);

  const startScanning = async (mode: 'qr' | 'barcode') => {
    setScanned(false);
    setScanMode(mode);
    
    if (!permission?.granted) {
      const status = await requestPermission();
      if (!status.granted) {
        setAlertInfo({
          visible: true,
          type: 'error',
          title: 'Kamera İzni Gerekli',
          message: 'Tarama yapabilmek için kamera izni vermeniz gerekmektedir.'
        });
        return;
      }
    }
    setIsScanning(true);
  };

  // Taranan kodla eşleşen kutuyu bulan yardımcı metod
  const matchScannedBin = (data: string) => {
    // 1. Önce doğrudan ID eşleşmesi ara
    let found = bins.find(b => b.id.toString() === data.trim());
    if (!found) {
      // 2. Kutu adında taranan kodun geçip geçmediğine bak (harf duyarsız)
      found = bins.find(b => b.name.toLowerCase().includes(data.trim().toLowerCase()));
    }
    return found;
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string, data: string }) => {
    if (scanned || processingRef.current) return;
    setScanned(true);
    processingRef.current = true;
    setIsScanning(false);

    try {
      const matched = matchScannedBin(data);
      if (matched) {
        setSelectedBin(matched);
        // Gerçekten taranırsa otomatik olarak atık ekle (%5 artır)
        await handleAddWaste(matched.id);
      } else {
        setAlertInfo({
          visible: true,
          type: 'error',
          title: 'Kutu Bulunamadı',
          message: `Taranan kod ile eşleşen bir atık kutusu bulunamadı.\n\nKod: ${data}`
        });
      }
    } catch (error: any) {
      setAlertInfo({
        visible: true,
        type: 'error',
        title: 'Hata',
        message: error.message || 'Okuma işlemi sırasında bir hata oluştu.'
      });
    } finally {
      processingRef.current = false;
    }
  };

  const handleAddWaste = async (binId: string) => {
    try {
      const targetBin = bins.find(b => b.id === binId);
      if (!targetBin) return;

      const currentPercentage = targetBin.fillPercentage;
      const newPercentage = Math.min(100, currentPercentage + 5);

      const payload = {
        name: targetBin.name,
        latitude: targetBin.latitude,
        longitude: targetBin.longitude,
        predictedFullness: newPercentage,
        wasteCategory: targetBin.type === 'plastik' ? 'PLASTIC' : targetBin.type === 'cam' ? 'GLASS' : targetBin.type === 'kagit' ? 'PAPER' : 'GENERAL'
      };

      await DatabaseService.updateBinItem(binId, payload);
      
      // Local state güncelle
      setBins(prev => prev.map(b => b.id === binId ? { ...b, fillPercentage: newPercentage } : b));
      if (selectedBin?.id === binId) {
        setSelectedBin(prev => prev ? { ...prev, fillPercentage: newPercentage } : null);
      }

      // TÜM EKRANLARA CANLI SENKRONİZASYON YAYINI YAP!
      DatabaseService.notifyBinsChanged();

      setAlertInfo({
        visible: true,
        type: 'success',
        title: 'Atık Bildirimi Yapıldı!',
        message: `"${targetBin.name}" kutusuna atık başarıyla bırakıldı.\n\nDoluluk Oranı: %${currentPercentage} ➜ %${newPercentage} (+%5)`
      });
    } catch (error: any) {
      setAlertInfo({
        visible: true,
        type: 'error',
        title: 'Hata',
        message: error.message || 'Atık bildirimi yapılırken bir hata oluştu.'
      });
    }
  };

  const getPinColor = (percentage: number): string => {
    if (percentage < 40) return '#27ae60';
    if (percentage < 75) return '#f39c12';
    return '#e74c3c';
  };

  const getBinTypeName = (type: string) => {
    if (type === 'plastik') return 'Plastik';
    if (type === 'kagit') return 'Kağıt';
    if (type === 'cam') return 'Cam';
    return 'Genel Atık';
  };

  const translateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [15, 155]
  });

  return (
    <SafeAreaView style={[styles.container, currentTheme === 'dark' && { backgroundColor: '#0f172a' }]}>
      <StatusBar barStyle={currentTheme === 'dark' ? "light-content" : "dark-content"} />
      
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={[styles.header, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
          <Text style={[styles.headerTitle, currentTheme === 'dark' && { color: '#fff' }]}>Atık Bildirimi</Text>
          <Text style={[styles.headerSubtitle, currentTheme === 'dark' && { color: '#cbd5e1' }]}>
            Atık kutusunun üzerindeki QR/Barkodu taratarak ya da listeden seçerek atık atım bildirimi yapın. Her atımda kutu doluluk oranı %5 artar.
          </Text>
        </View>

        {/* Atık Kutusu Seçim Dropdown */}
        <View style={styles.selectorSection}>
          <Text style={[styles.sectionLabel, currentTheme === 'dark' && { color: '#fff' }]}>Atık Kutusu Seçin</Text>
          <TouchableOpacity 
            style={[styles.dropdownTrigger, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderColor: '#334155' }]}
            onPress={() => setIsDropdownVisible(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Ionicons name="location-outline" size={20} color="#2e7d32" />
              <Text style={[styles.dropdownTriggerText, currentTheme === 'dark' && { color: '#fff' }, !selectedBin && { color: '#94a3b8' }]} numberOfLines={1}>
                {selectedBin ? `${selectedBin.name} (%${selectedBin.fillPercentage})` : 'Listeden bir atık kutusu seçin'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Viewfinder Frame */}
        <View style={[styles.scannerFrame, !isScanning && styles.placeholderFrame, currentTheme === 'dark' && !isScanning && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
          {isScanning ? (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              onBarcodeScanned={handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: scanMode === 'qr' ? ['qr'] : ['ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
              }}
            >
              <View style={styles.scannerOverlayCompact}>
                <Text style={styles.scannerTextCompact}>
                  {scanMode === 'qr' ? 'QR Kodunu Çerçeveye Hizalayın' : 'Barkodu Çerçeveye Hizalayın'}
                </Text>

                {/* Viewfinder visual box */}
                <View style={styles.scanTargetBoxCompact}>
                  <View style={[styles.scanCornerCompact, styles.topLeftCornerCompact]} />
                  <View style={[styles.scanCornerCompact, styles.topRightCornerCompact]} />
                  <View style={[styles.scanCornerCompact, styles.bottomLeftCornerCompact]} />
                  <View style={[styles.scanCornerCompact, styles.bottomRightCornerCompact]} />

                  {/* Neon laser line */}
                  <Animated.View
                    style={[
                      styles.laserLineCompact,
                      {
                        transform: [{ translateY }]
                      }
                    ]}
                  />
                </View>
              </View>
            </CameraView>
          ) : (
            <View style={[styles.placeholderContainerCompact, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
              <View style={styles.cameraIconBg}>
                <Ionicons name="qr-code" size={32} color="#2e7d32" />
              </View>
              <Text style={[styles.placeholderTextCompact, currentTheme === 'dark' && { color: '#fff' }]}>Tarayıcı Hazır</Text>
              <Text style={[styles.placeholderSubtextCompact, currentTheme === 'dark' && { color: '#94a3b8' }]}>
                Kutunun üzerindeki etiketi taratarak otomatik seçmek için bir tarama modu başlatın.
              </Text>
            </View>
          )}
        </View>

        {/* Control Buttons */}
        {isScanning ? (
          <TouchableOpacity
            style={styles.cancelScanButtonCompact}
            onPress={() => setIsScanning(false)}
          >
            <Ionicons name="close-circle" size={20} color="#fff" />
            <Text style={styles.compactActionButtonText}>Taramayı İptal Et</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.buttonRowCompact}>
            <TouchableOpacity
              style={[styles.compactActionButton, { backgroundColor: '#2e7d32' }]}
              onPress={() => startScanning('qr')}
            >
              <Ionicons name="qr-code-outline" size={18} color="#fff" />
              <Text style={styles.compactActionButtonText}>Kutu QR Tara</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.compactActionButton, { backgroundColor: '#1e293b' }]}
              onPress={() => startScanning('barcode')}
            >
              <Ionicons name="barcode-outline" size={18} color="#fff" />
              <Text style={styles.compactActionButtonText}>Kutu Barkod Tara</Text>
            </TouchableOpacity>
          </View>
        )}



      </ScrollView>

      {/* DROPDOWN PICKER MODAL (Premium Alt Sheet Tasarımı) */}
      <Modal
        visible={isDropdownVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDropdownVisible(false)}
      >
        <View style={styles.dropdownOverlay}>
          <View style={[styles.dropdownSheet, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
            <View style={[styles.dropdownHeader, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
              <View>
                <Text style={[styles.dropdownTitle, currentTheme === 'dark' && { color: '#fff' }]}>Atık Kutusu Seçin</Text>
                <Text style={[styles.dropdownSubtitle, currentTheme === 'dark' && { color: '#94a3b8' }]}>{bins.length} adet akıllı kutu listeleniyor</Text>
              </View>
              <TouchableOpacity 
                style={[styles.dropdownCloseBtn, currentTheme === 'dark' && { backgroundColor: '#334155' }]}
                onPress={() => setIsDropdownVisible(false)}
              >
                <Ionicons name="close" size={24} color={currentTheme === 'dark' ? '#fff' : '#333'} />
              </TouchableOpacity>
            </View>

            {loadingBins ? (
              <ActivityIndicator size="large" color="#2e7d32" style={{ marginVertical: 40 }} />
            ) : (
              <FlatList
                data={bins}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 30 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.dropdownItem, currentTheme === 'dark' && { borderBottomColor: '#334155' }]}
                    onPress={() => {
                      setSelectedBin(item);
                      setIsDropdownVisible(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View style={[styles.statusDot, { backgroundColor: getPinColor(item.fillPercentage) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemName, currentTheme === 'dark' && { color: '#fff' }]}>{item.name}</Text>
                        <Text style={[styles.itemMeta, currentTheme === 'dark' && { color: '#94a3b8' }]}>
                          {getBinTypeName(item.type)} • {item.capacity}L Kapasite
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.itemPercentText, { color: getPinColor(item.fillPercentage) }]}>
                      %{item.fillPercentage}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Premium Custom Alert Modal (28px border-radius) */}
      <Modal
        visible={alertInfo.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setAlertInfo({ ...alertInfo, visible: false })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertBox}>
            <View style={[
              styles.alertHeaderBadge,
              { backgroundColor: alertInfo.type === 'success' ? '#e8f5e9' : '#fee2e2' }
            ]}>
              <Ionicons
                name={alertInfo.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={44}
                color={alertInfo.type === 'success' ? '#2e7d32' : '#ef4444'}
              />
            </View>

            <Text style={styles.alertTitle}>{alertInfo.title}</Text>
            <Text style={styles.alertMessage}>{alertInfo.message}</Text>

            <TouchableOpacity
              style={[
                styles.alertCloseButton,
                { backgroundColor: alertInfo.type === 'success' ? '#2e7d32' : '#ef4444' }
              ]}
              onPress={() => setAlertInfo({ ...alertInfo, visible: false })}
            >
              <Text style={styles.alertCloseButtonText}>Anlaşıldı</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 25 : 55) : 30,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginTop: 6,
  },
  selectorSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
    paddingLeft: 4,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  dropdownTriggerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  scannerFrame: {
    width: '100%',
    height: 270,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  placeholderFrame: {
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  placeholderContainerCompact: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cameraIconBg: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  placeholderTextCompact: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  placeholderSubtextCompact: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  scannerOverlayCompact: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  scannerTextCompact: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    position: 'absolute',
    top: 15,
    backgroundColor: 'rgba(15,23,42,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
  },
  scanTargetBoxCompact: {
    width: 170,
    height: 170,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanCornerCompact: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#2e7d32',
    borderWidth: 4,
  },
  topLeftCornerCompact: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  topRightCornerCompact: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  bottomLeftCornerCompact: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  bottomRightCornerCompact: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  laserLineCompact: {
    width: '90%',
    height: 3,
    backgroundColor: '#2e7d32',
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 8,
    position: 'absolute',
  },
  buttonRowCompact: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  compactActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  compactActionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  cancelScanButtonCompact: {
    backgroundColor: '#ef4444',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  // Kutu Yönetim Kartı Styles
  binManageCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  binManageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  binManageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  binManageSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    fontWeight: '600',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressContainer: {
    height: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBar: {
    height: '100%',
    borderRadius: 5,
  },
  emptyActionBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 15,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledEmptyActionBtn: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  emptyActionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  // Dropdown Modal Styles
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  dropdownSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 24,
    maxHeight: '75%',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dropdownTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  dropdownSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  dropdownCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  itemMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  itemPercentText: {
    fontSize: 15,
    fontWeight: '800',
  },
  // Alert Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertBox: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  alertHeaderBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  alertCloseButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  alertCloseButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  }
});
