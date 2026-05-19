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
  Dimensions, 
  Modal, 
  Pressable,
  Image,
  Alert,
  Animated
} from 'react-native';
import { 
  FontAwesome6,
  FontAwesome5, 
  MaterialCommunityIcons, 
  Ionicons, 
  Entypo, 
  MaterialIcons,
  SimpleLineIcons
} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DatabaseService from '../../database/DatabaseService';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 60) / 3;

const WASTE_ITEMS = [
  { id: 9, name: 'Plastik Kapak', icon: 'database', library: 'MaterialCommunityIcons', coins: 2, color: '#06b6d4', description: 'Renkli kapaklar tekerlekli sandalye gibi projelere kaynak olur.', image: require('../../assets/images/plastic-cap.png') },
  { id: 3, name: 'Kağıt', icon: 'file-alt', library: 'FontAwesome5', coins: 3, color: '#f59e0b', description: 'Kağıt atıklar ormanlarımızı korur and enerji tasarrufu sağlar.', image: require('../../assets/images/paper-icon.png') },
  { id: 11, name: 'Naylon Poşet', icon: 'bag', library: 'SimpleLineIcons', coins: 3, color: '#94a3b8', description: 'Naylon poşetler doğada çok geç çözünür, mutlaka geri dönüştürülmelidir.', image: require('../../assets/images/plastic-bag-icon.png') },
  { id: 4, name: 'Karton', icon: 'box-open', library: 'FontAwesome5', coins: 4, color: '#8b4513', description: 'Karton ambalajlar geri kazanılarak yeni koli ve kutulara dönüşür.', image: require('../../assets/images/cardboard-icon.png') },
  { id: 15, name: 'Cam Kavanoz', icon: 'jar', library: 'FontAwesome6', coins: 4, color: '#475569', description: 'Cam kavanozlar sterilize edilerek tekrar kullanılabilir veya geri dönüştürülebilir.', image: require('../../assets/images/jar-icon.png') },
  { id: 1, name: 'Pet Şişe', icon: 'bottle-water', library: 'FontAwesome6', coins: 5, color: '#3b82f6', description: 'Plastik pet şişeler geri dönüştürülerek yeni tekstil ürünleri ve ambalajlar üretilir.', image: require('../../assets/images/pet-bottle-icon.png') },
  { id: 14, name: 'Floresan Lamba', icon: 'lightbulb-variant-outline', library: 'MaterialCommunityIcons', coins: 5, color: '#f43f5e', description: 'Aydınlatma ürünleri içerdikleri civa nedeniyle özel işlemlerle geri dönüştürülmelidir.', image: require('../../assets/images/bulb-icon.png') },
  { id: 5, name: 'Metal Kutu', icon: 'can-food', library: 'FontAwesome6', coins: 7, color: '#64748b', description: 'Alüminyum içecek kutuları %100 geri dönüştürülebilir.', image: require('../../assets/images/metal-can.png') },
  { id: 2, name: 'Cam Şişe', icon: 'wine-bottle', library: 'FontAwesome6', coins: 8, color: '#10b981', description: 'Cam sonsuz kez geri dönüştürülebilir ve doğaya zarar vermez.', image: require('../../assets/images/glass-bottle-icon.png') },
  { id: 12, name: 'Atık Lastik', icon: 'tire', library: 'MaterialCommunityIcons', coins: 10, color: '#4b5563', description: 'Kullanım ömrünü tamamlamış lastikler, asfalt ve zemin kaplama malzemelerine dönüştürülür.', image: require('../../assets/images/tire-icon.png') },
  { id: 10, name: 'Tekstil', icon: 'tshirt', library: 'FontAwesome5', coins: 12, color: '#ec4899', description: 'Eski kıyafetler yalıtım malzemesi veya yeni iplik olabilir.', image: require('../../assets/images/shirt-icon.png') },
  { id: 6, name: 'Pil', icon: 'battery-charging-100', library: 'MaterialCommunityIcons', coins: 15, color: '#ef4444', description: 'Atık pillerdeki ağır metaller toprağa karışmadan toplanmalıdır.', image: require('../../assets/images/battery-icon.png') },
  { id: 13, name: 'Ahşap', icon: 'fence', library: 'MaterialCommunityIcons', coins: 15, color: '#a855f7', description: 'Ahşap parçaları mobilya veya yakacak peleti olur.', image: require('../../assets/images/wood-icon.png') },
  { id: 8, name: 'Bitkisel Yağ', icon: 'tint', library: 'FontAwesome5', coins: 20, color: '#d97706', description: 'Atık yağlar biyodizel yakıta dönüştürülür.', image: require('../../assets/images/oil-icon.png') },
  { id: 7, name: 'E-Atık', icon: 'laptop', library: 'FontAwesome5', coins: 50, color: '#6366f1', description: 'Eski elektronik cihazlar değerli madenler içerir.', image: require('../../assets/images/laptop-icon.png') },
];

export default function KurumsalMarketScreen() {
  const [points, setPoints] = useState(0);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanMode, setScanMode] = useState<'qr' | 'barcode' | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [currentTheme, setCurrentTheme] = useState('light');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = DatabaseService.subscribeToTheme((t) => {
      setCurrentTheme(t);
    });
    return () => unsubscribe();
  }, []);
  const processingRef = React.useRef(false);

  const laserAnim = useRef(new Animated.Value(0)).current;

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

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const email = await AsyncStorage.getItem('currentUserEmail');
      if (email) {
        const lowerEmail = email.toLowerCase();
        const savedPoints = await AsyncStorage.getItem(`userPoints_${lowerEmail}`);
        if (savedPoints) setPoints(parseInt(savedPoints));
      }
    } catch (error) {
      console.error('Market veri yükleme hatası:', error);
    }
  };

  const handleItemPress = (item: any) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string, data: string }) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setScanned(true);
    setIsScanning(false);
    try {
      const scanLabel = scanMode === 'barcode' ? 'barkod' : 'qr';
      const displayCode = scanMode === 'barcode' 
        ? data 
        : (data.length > 8 ? data.substring(0, 8) + '...' : data);
      const formattedDesc = `${selectedItem.name} Geri Dönüştürme Ödülü (${scanLabel} | ${displayCode})`;

      const result = await DatabaseService.scanQrCode(
        data, 
        selectedItem.coins, 
        formattedDesc,
        scanMode || 'qr'
      );
      setPoints(result.balance); 
      const email = await AsyncStorage.getItem('currentUserEmail');
      if (email) {
        await AsyncStorage.setItem(`userPoints_${email.toLowerCase()}`, result.balance.toString());
      }
      const scanTypeLabel = scanMode === 'barcode' ? 'Barkod' : 'QR Kod';
      Alert.alert('Başarılı!', `${scanTypeLabel} başarıyla okundu ve puanlar hesabınıza eklendi.`, [
        { text: 'Harika', onPress: () => setModalVisible(false) }
      ]);
    } catch (error: any) {
      processingRef.current = false;
      Alert.alert('Hata', error.message, [
        { text: 'Tamam', onPress: () => setScanned(false) }
      ]);
    }
  };

  const openScanner = async (mode: 'qr' | 'barcode') => {
    if (!permission?.granted) {
       const res = await requestPermission();
       if (!res.granted) {
          Alert.alert("Hata", "Kamera izni verilmedi.");
          return;
       }
    }
    processingRef.current = false;
    setScanned(false);
    setScanMode(mode);
    setIsScanning(true);
  };

  const renderIcon = (item: any, size: number = 32) => {
    const shouldHaveRadius = ['Cam Kavanoz', 'Metal Kutu', 'Atık Lastik', 'Plastik Kapak', 'Bitkisel Yağ'].includes(item.name);
    
    if (item.name === 'Naylon Poşet') {
      return (
        <View style={{
          width: 56,
          height: 56,
          borderRadius: 20,
          backgroundColor: item.color + '20',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden' // Clip the white background of the image
        }}>
          <Image 
            source={item.image} 
            style={{ 
              width: size, 
              height: size,
              borderRadius: 20 // Round the image itself
            }} 
            resizeMode="contain" 
          />
        </View>
      );
    }

    if (item.image) {
      return (
        <View style={{
          width: size,
          height: size,
          borderRadius: 20,
          backgroundColor: currentTheme === 'dark' ? '#334155' : '#f1f5f9',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden'
        }}>
          <Image 
            source={item.image} 
            style={{ 
              width: size * 0.8, 
              height: size * 0.8,
              borderRadius: 10,
            }} 
            resizeMode="contain" 
          />
        </View>
      );
    }

    switch (item.library) {
      case 'MaterialCommunityIcons':
        return <MaterialCommunityIcons name={item.icon} size={size} color={item.color} />;
      case 'Ionicons':
        return <Ionicons name={item.icon} size={size} color={item.color} />;
      case 'Entypo':
        return <Entypo name={item.icon} size={size} color={item.color} />;
      case 'MaterialIcons':
        return <MaterialIcons name={item.icon} size={size} color={item.color} />;
      case 'FontAwesome6':
        return <FontAwesome6 name={item.icon} size={size} color={item.color} />;
      case 'SimpleLineIcons':
        return <SimpleLineIcons name={item.icon} size={size} color={item.color} />;
      case 'FontAwesome5':
        return <FontAwesome5 name={item.icon} size={size} color={item.color} />;
      default:
        return <FontAwesome5 name={item.icon} size={size} color={item.color} />;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, currentTheme === 'dark' && { backgroundColor: '#0f172a' }]}>
      <StatusBar barStyle={currentTheme === 'dark' ? "light-content" : "dark-content"} />
      
      <View style={[styles.topBar, currentTheme === 'dark' && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <Text style={[styles.headerTitle, currentTheme === 'dark' && { color: '#fff' }]}>Atık Marketi</Text>
        <View style={[styles.coinBadge, currentTheme === 'dark' && { backgroundColor: '#334155' }]}>
          <Text style={[styles.coinText, currentTheme === 'dark' && { color: '#fff' }]}>{points}</Text>
          <FontAwesome5 name="coins" size={22} color="#facc15" />
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={[{
            flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 20,
            marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1,
            shadowRadius: 10, elevation: 5, justifyContent: 'center', gap: 10
          }, currentTheme === 'dark' && { backgroundColor: '#1e293b', shadowOpacity: 0.3 }]}
          onPress={() => router.push('/market-map?type=kurumsal')}
          activeOpacity={0.8}
        >
          <Ionicons name="map-outline" size={24} color="#10b981" />
          <Text style={[{ fontSize: 16, fontWeight: 'bold', color: '#1e293b' }, currentTheme === 'dark' && { color: '#fff' }]}>Anlaşmalı Mağazalar Haritası</Text>
        </TouchableOpacity>

        <View style={[styles.infoBox, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
          <Text style={[styles.infoTitle, currentTheme === 'dark' && { color: '#fff' }]}>Geri Dönüştür, Kazan!</Text>
          <Text style={[styles.infoSubtitle, currentTheme === 'dark' && { color: '#94a3b8' }]}>Gelecek nesillere temiz bir dünya bırakın! Atıklarınızı geri dönüştürün, çevreye katkı sağlarken ödüller kazanın!</Text>
        </View>

        <View style={styles.gridContainer}>
          {WASTE_ITEMS.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={[styles.card, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, currentTheme === 'dark' && { backgroundColor: '#0f172a' }]}>
                {renderIcon(item, item.name === 'Naylon Poşet' ? 84 : 56)}
              </View>
              <Text style={[styles.itemName, currentTheme === 'dark' && { color: '#fff' }]} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.itemCoinContainer, currentTheme === 'dark' && { backgroundColor: '#334155' }]}>
                <Text style={[styles.itemCoinText, { color: '#facc15' }]}>{item.coins}</Text>
                <FontAwesome5 name="coins" size={10} color="#facc15" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          setIsScanning(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
            <View style={[styles.modalHeader, currentTheme === 'dark' && { borderBottomColor: '#334155' }]}>
              <Text style={[styles.modalHeaderTitle, currentTheme === 'dark' && { color: '#fff' }]}>
                {selectedItem ? selectedItem.name : 'Geri Dönüşüm Detayı'}
              </Text>
              <TouchableOpacity 
                style={[styles.closeButton, currentTheme === 'dark' && { backgroundColor: '#334155' }]}
                onPress={() => {
                  setModalVisible(false);
                  setIsScanning(false);
                }}
              >
                <Ionicons name="close" size={24} color={currentTheme === 'dark' ? '#fff' : '#64748b'} />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <View style={styles.modalBody}>
                {/* Atık Üst Bilgileri */}
                <View style={[styles.itemInfoRowCompact, currentTheme === 'dark' && { backgroundColor: '#0f172a', borderColor: '#334155' }]}>
                  <View style={[styles.largeIconContainerCompact, { backgroundColor: selectedItem.color + '15' }]}>
                    {renderIcon(selectedItem, 36)}
                  </View>
                  <View style={styles.itemInfoTextContainerCompact}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.modalCoinText, { color: '#eab308', fontSize: 18 }]}>
                        {selectedItem.coins}
                      </Text>
                      <FontAwesome5 name="coins" size={13} color="#eab308" />
                      <Text style={[styles.pointsSuffixText, currentTheme === 'dark' && { color: '#64748b' }]}>Puan Kazandırır</Text>
                    </View>
                    <Text style={[styles.modalDescriptionCompact, currentTheme === 'dark' && { color: '#94a3b8' }]}>{selectedItem.description}</Text>
                  </View>
                </View>

                {/* Ortabölme: Sabit Çerçeveli Tarayıcı Penceresi */}
                <View style={[styles.scannerFrame, !isScanning && styles.placeholderFrame, currentTheme === 'dark' && !isScanning && { backgroundColor: '#0f172a', borderColor: '#334155' }]}>
                  {isScanning ? (
                    <>
                      <CameraView
                        onBarcodeScanned={scanned ? undefined : (handleBarCodeScanned as any)}
                        barcodeScannerSettings={{
                          barcodeTypes: scanMode === 'qr' ? ["qr"] : ["ean13", "ean8", "code128", "code39", "upc_a", "upc_e"],
                        }}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <View style={styles.scannerOverlayCompact}>
                        <Text style={styles.scannerTextCompact}>
                          {scanMode === 'qr' ? 'QR Kodu çerçeveye ortalayın' : 'Barkodu çerçeveye ortalayın'}
                        </Text>
                        
                        <View style={styles.scanTargetBoxCompact}>
                          <View style={[styles.scanCornerCompact, styles.topLeftCornerCompact]} />
                          <View style={[styles.scanCornerCompact, styles.topRightCornerCompact]} />
                          <View style={[styles.scanCornerCompact, styles.bottomLeftCornerCompact]} />
                          <View style={[styles.scanCornerCompact, styles.bottomRightCornerCompact]} />
                          <Animated.View 
                            style={[
                              styles.laserLineCompact,
                              {
                                transform: [{
                                  translateY: laserAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-75, 75]
                                  })
                                }]
                              }
                            ]} 
                          />
                        </View>
                      </View>
                    </>
                  ) : (
                    <View style={styles.placeholderContainerCompact}>
                      <View style={[styles.cameraIconBg, { backgroundColor: selectedItem.color + '10' }]}>
                        <Ionicons name="camera" size={28} color={selectedItem.color} />
                      </View>
                      <Text style={[styles.placeholderTextCompact, currentTheme === 'dark' && { color: '#fff' }]}>Tarayıcı Hazır</Text>
                      <Text style={[styles.placeholderSubtextCompact, currentTheme === 'dark' && { color: '#64748b' }]}>Lütfen taratmak için aşağıdaki butonlardan birini seçin.</Text>
                    </View>
                  )}
                </View>

                {/* Alt Bölme: Butonlar */}
                {isScanning ? (
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.cancelScanButtonCompact]}
                    onPress={() => setIsScanning(false)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="close-circle-outline" size={18} color="#fff" />
                      <Text style={styles.actionButtonText}>Taramayı İptal Et</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.buttonRowCompact}>
                    <TouchableOpacity 
                      style={[styles.compactActionButton, { backgroundColor: selectedItem.color }]}
                      onPress={() => openScanner('qr')}
                    >
                      <Ionicons name="qr-code-outline" size={16} color="#fff" />
                      <Text style={styles.compactActionButtonText}>QR ile Tarat</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.compactActionButton, { backgroundColor: currentTheme === 'dark' ? '#334155' : '#1e293b' }]}
                      onPress={() => openScanner('barcode')}
                    >
                      <Ionicons name="barcode-outline" size={16} color="#fff" />
                      <Text style={styles.compactActionButtonText}>Barkod ile Tarat</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
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
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coinText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginRight: 8,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  infoBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 24,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: ITEM_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 12,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  iconContainer: {
    width: 64,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'visible',
  },
  itemName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textAlign: 'center',
  },
  itemCoinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  itemCoinText: {
    fontSize: 11,
    fontWeight: '800',
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  modalBody: {
    alignItems: 'center',
    width: '100%',
  },
  largeIconContainer: {
    width: 110,
    height: 110,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  modalCoinBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    marginBottom: 20,
  },
  modalCoinText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalDescription: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  actionButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  itemInfoRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  largeIconContainerCompact: {
    width: 72,
    height: 72,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfoTextContainerCompact: {
    flex: 1,
    justifyContent: 'center',
  },
  pointsSuffixText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  modalDescriptionCompact: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  scannerFrame: {
    width: '100%',
    height: 260,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 15,
    borderWidth: 2.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderFrame: {
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  placeholderContainerCompact: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cameraIconBg: {
    width: 68,
    height: 68,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  placeholderTextCompact: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
  },
  placeholderSubtextCompact: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
    paddingHorizontal: 20,
  },
  scannerOverlayCompact: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  scannerTextCompact: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    position: 'absolute',
    top: 15,
    backgroundColor: 'rgba(15,23,42,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
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
    shadowRadius: 6,
    elevation: 8,
    position: 'absolute',
  },
  buttonRowCompact: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 15,
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
    marginTop: 15,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
});
