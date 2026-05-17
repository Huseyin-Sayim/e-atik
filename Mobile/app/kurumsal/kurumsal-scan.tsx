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
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DatabaseService from '../../database/DatabaseService';

export default function KurumsalScanScreen() {
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

  const handleBarCodeScanned = async ({ type, data }: { type: string, data: string }) => {
    if (scanned || processingRef.current) return;
    setScanned(true);
    processingRef.current = true;
    setIsScanning(false);

    try {
      await DatabaseService.scanQrCode(
        data,
        10, // Genel kurumsal dönüşüm ödülü 10 Puan
        "Kurumsal Geri Dönüştürme Ödülü",
        scanMode || 'qr'
      );

      // Başarılı Özel Popup
      setAlertInfo({
        visible: true,
        type: 'success',
        title: 'Başarılı!',
        message: `Geri dönüşüm başarıyla tamamlandı!\n\nHesabınıza 10 Puan eklendi.\n\nKod: ${data.substring(0, 20)}${data.length > 20 ? '...' : ''}`
      });
    } catch (error: any) {
      // Hata Özel Popup
      setAlertInfo({
        visible: true,
        type: 'error',
        title: 'Başarısız',
        message: error.message || 'Geri dönüştürme işlemi sırasında bir hata oluştu.'
      });
    } finally {
      processingRef.current = false;
    }
  };

  const translateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [15, 155]
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>QR | Barkod</Text>
          <Text style={styles.headerSubtitle}>
            QR kodunuzu veya barkodunuzu çerçeve içine gelecek şekilde taratarak geri dönüştürme işlemini hemen başlatın.
          </Text>
        </View>

        {/* Viewfinder Frame */}
        <View style={[styles.scannerFrame, !isScanning && styles.placeholderFrame]}>
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
            <View style={styles.placeholderContainerCompact}>
              <View style={styles.cameraIconBg}>
                <Ionicons name="camera" size={32} color="#10b981" />
              </View>
              <Text style={styles.placeholderTextCompact}>Tarayıcı Hazır</Text>
              <Text style={styles.placeholderSubtextCompact}>
                QR veya barkod taramaya başlamak için aşağıdaki butonlardan bir yöntem seçin.
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
              style={[styles.compactActionButton, { backgroundColor: '#10b981' }]}
              onPress={() => startScanning('qr')}
            >
              <Ionicons name="qr-code-outline" size={18} color="#fff" />
              <Text style={styles.compactActionButtonText}>QR ile Tarat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.compactActionButton, { backgroundColor: '#1e293b' }]}
              onPress={() => startScanning('barcode')}
            >
              <Ionicons name="barcode-outline" size={18} color="#fff" />
              <Text style={styles.compactActionButtonText}>Barkod ile Tarat</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* Premium Custom Alert Modal (noticeable 28px border-radius) */}
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
              { backgroundColor: alertInfo.type === 'success' ? '#dcfce7' : '#fee2e2' }
            ]}>
              <Ionicons
                name={alertInfo.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={44}
                color={alertInfo.type === 'success' ? '#10b981' : '#ef4444'}
              />
            </View>

            <Text style={styles.alertTitle}>{alertInfo.title}</Text>
            <Text style={styles.alertMessage}>{alertInfo.message}</Text>

            <TouchableOpacity
              style={[
                styles.alertCloseButton,
                { backgroundColor: alertInfo.type === 'success' ? '#10b981' : '#ef4444' }
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
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 25,
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
    backgroundColor: '#10b98115',
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
    borderColor: '#10b981',
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
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
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
  // Modal Styles
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
    borderRadius: 28, // Noticeable custom radius
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
