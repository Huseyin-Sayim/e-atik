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
  Animated,
  TextInput,
  ActivityIndicator
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
import * as ImagePicker from 'expo-image-picker';
import DatabaseService from '../../database/DatabaseService';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 60) / 3;

const LOCAL_IMAGES: any = {
  'Plastik Kapak': require('../../assets/images/plastic-cap.png'),
  'Kağıt': require('../../assets/images/paper-icon.png'),
  'Naylon Poşet': require('../../assets/images/plastic-bag-icon.png'),
  'Karton': require('../../assets/images/cardboard-icon.png'),
  'Cam Kavanoz': require('../../assets/images/jar-icon.png'),
  'Pet Şişe': require('../../assets/images/pet-bottle-icon.png'),
  'Floresan Lamba': require('../../assets/images/bulb-icon.png'),
  'Metal Kutu': require('../../assets/images/metal-can.png'),
  'Cam Şişe': require('../../assets/images/glass-bottle-icon.png'),
  'Atık Lastik': require('../../assets/images/tire-icon.png'),
  'Tekstil': require('../../assets/images/shirt-icon.png'),
  'Pil': require('../../assets/images/battery-icon.png'),
  'Ahşap': require('../../assets/images/wood-icon.png'),
  'Bitkisel Yağ': require('../../assets/images/oil-icon.png'),
  'E-Atık': require('../../assets/images/laptop-icon.png'),
};

const COLOR_OPTIONS = [
  '#06b6d4', // Plastik / Cyan
  '#10b981', // Cam / Emerald
  '#84cc16', // Organik / Lime
  '#facc15', // Kağıt & Karton / Yellow
  '#d97706', // Atık Yağ / Amber
  '#ef4444', // Tehlikeli / Red
  '#ec4899', // Tekstil / Pink
  '#a855f7', // Ahşap / Purple
  '#6366f1', // Elektronik / Indigo
  '#3b82f6', // Blue
  '#64748b', // Metal / Slate
  '#4b5563', // Lastik / Grey
];

export default function KurumsalMarketScreen() {
  const [points, setPoints] = useState(0);
  const [coinTooltipVisible, setCoinTooltipVisible] = useState(false);
  const [wasteItems, setWasteItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCoins, setNewItemCoins] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemImageUrl, setNewItemImageUrl] = useState('');
  const [newItemColor, setNewItemColor] = useState('#14b8a6');
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editItemName, setEditItemName] = useState('');
  const [editItemCoins, setEditItemCoins] = useState('');
  const [editItemDescription, setEditItemDescription] = useState('');
  const [editItemImageUrl, setEditItemImageUrl] = useState('');
  const [editItemOrder, setEditItemOrder] = useState('');
  const [editItemColor, setEditItemColor] = useState('#14b8a6');
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [editErrorText, setEditErrorText] = useState('');
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

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
      
      const items = await DatabaseService.getWasteItems();
      setWasteItems(items);
    } catch (error) {
      console.error('Market veri yükleme hatası:', error);
    }
  };

  const openAddModal = () => {
    setNewItemName('');
    setNewItemCoins('');
    setNewItemDescription('');
    setNewItemImageUrl('');
    setErrorText('');
    setAddModalVisible(true);
  };

  const handleAddItem = async () => {
    if (!newItemName || !newItemCoins || !newItemDescription) {
      setErrorText('Lütfen isim, coin ve açıklama alanlarını doldurun.');
      return;
    }
    setIsSaving(true);
    setErrorText('');
    try {
      await DatabaseService.createWasteItem({
        name: newItemName,
        coins: parseInt(newItemCoins),
        description: newItemDescription,
        color: newItemColor,
        imageUrl: newItemImageUrl
      });
      setAddModalVisible(false);
      setNewItemName('');
      setNewItemCoins('');
      setNewItemDescription('');
      setNewItemImageUrl('');
      await loadData(); // await ile senkron güncelleme — buton pozisyonu anında düzelir
    } catch (err: any) {
      const msg = err.message || '';
      setErrorText(msg.includes('Failed to fetch') ? 'Sunucu bağlantı hatası, lütfen internet bağlantınızı kontrol edin.' : msg || 'Eklenemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  const pickImage = async (setImageUrl: (url: string) => void) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Fotoğraf yüklemek için galeri erişimine izin vermeniz gerekmektedir.');
        return;
      }
      
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        setImageUrl(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      console.warn("Resim seçilirken hata:", error);
    }
  };

  const openEditModal = () => {
    if (!selectedItem) return;
    setEditItemName(selectedItem.name);
    setEditItemCoins(selectedItem.coins.toString());
    setEditItemDescription(selectedItem.description || '');
    setEditItemImageUrl(selectedItem.imageUrl || '');
    setEditItemColor(selectedItem.color || '#14b8a6');
    const order = (selectedItem.row * 3) + selectedItem.column + 1;
    setEditItemOrder(order.toString());
    setEditErrorText('');
    setDeleteConfirmVisible(false);
    setEditModalVisible(true);
  };

  const handleEditItem = async () => {
    if (!editItemName || !editItemCoins || !editItemDescription) {
      setEditErrorText('Lütfen gerekli alanları doldurun.');
      return;
    }
    setIsSaving(true);
    setEditErrorText('');
    try {
      const orderNum = parseInt(editItemOrder);
      const r = Math.floor((orderNum - 1) / 3);
      const c = (orderNum - 1) % 3;
      
      await DatabaseService.updateWasteItem(selectedItem.id, {
        name: editItemName,
        coins: parseInt(editItemCoins),
        description: editItemDescription,
        imageUrl: editItemImageUrl,
        color: editItemColor,
        row: isNaN(r) ? selectedItem.row : r,
        column: isNaN(c) ? selectedItem.column : c,
      });
      setEditModalVisible(false);
      setModalVisible(false);
      await loadData(); // await ile senkron güncelleme
    } catch (err: any) {
      const msg = err.message || '';
      setEditErrorText(msg.includes('Failed to fetch') ? 'Sunucu bağlantı hatası, lütfen internet bağlantınızı kontrol edin.' : msg || 'Güncellenemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    setDeleteConfirmVisible(true);
  };

  const confirmDelete = async () => {
    setIsSaving(true);
    const deletedId = selectedItem.id;
    try {
      await DatabaseService.deleteWasteItem(deletedId);
      // Optimistik güncelleme: silinen item'ı hemen listeden çıkar — buton anında kayar
      setWasteItems(prev => prev.filter(item => item.id !== deletedId));
      setDeleteConfirmVisible(false);
      setEditModalVisible(false);
      setModalVisible(false);
      await loadData(); // Sunucudan güncel listeyi çek — kesin senkronizasyon
    } catch (err: any) {
      const msg = err.message || '';
      setEditErrorText(msg.includes('Failed to fetch') ? 'Sunucu bağlantı hatası, lütfen internet bağlantınızı kontrol edin.' : msg || 'Silinemedi.');
      setDeleteConfirmVisible(false);
    } finally {
      setIsSaving(false);
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
       const userApproved = await new Promise((resolve) => {
         Alert.alert(
           "Kamera İzni Gerekli",
           "Geri dönüşüm atıklarının QR veya Barkod kodlarını okutabilmek için kamera erişimine ihtiyacımız var. Kamera izni vermek istiyor musunuz?",
           [
             { text: "Vazgeç", onPress: () => resolve(false), style: "cancel" },
             { text: "İzin Ver", onPress: () => resolve(true) }
           ]
         );
       });
       if (!userApproved) return;

       const res = await requestPermission();
       if (!res.granted) {
          Alert.alert("Hata", "Kamera izni verilmedi. Ayarlardan kamera iznini etkinleştirmeniz gerekmektedir.");
          return;
       }
    }
    processingRef.current = false;
    setScanned(false);
    setScanMode(mode);
    setIsScanning(true);
  };

  const renderIcon = (item: any, size: number = 32) => {
    const localImg = LOCAL_IMAGES[item.name];

    if (item.imageUrl) {
      return (
        <View style={{ width: size, height: size, borderRadius: 20, backgroundColor: currentTheme === 'dark' ? '#334155' : '#f1f5f9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
          <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%', borderRadius: 20 }} resizeMode="cover" />
        </View>
      );
    }

    if (item.name === 'Naylon Poşet' && localImg) {
      return (
        <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: item.color + '20', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
          <Image source={localImg} style={{ width: '100%', height: '100%', borderRadius: 20 }} resizeMode="cover" />
        </View>
      );
    }

    if (localImg) {
      return (
        <View style={{ width: size, height: size, borderRadius: 20, backgroundColor: currentTheme === 'dark' ? '#334155' : '#f1f5f9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
          <Image source={localImg} style={{ width: '100%', height: '100%', borderRadius: 10 }} resizeMode="cover" />
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
        <TouchableOpacity
          style={[styles.coinBadge, currentTheme === 'dark' && { backgroundColor: '#334155' }]}
          onPress={() => setCoinTooltipVisible(true)}
          activeOpacity={0.75}
        >
          <Text style={[styles.coinText, currentTheme === 'dark' && { color: '#fff' }]}>{points}</Text>
          <FontAwesome5 name="coins" size={22} color="#facc15" />
        </TouchableOpacity>
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
          {wasteItems.map((item) => (
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

          <TouchableOpacity
            style={[styles.card, currentTheme === 'dark' && { backgroundColor: '#1e293b' }, { borderWidth: 1.5, borderColor: currentTheme === 'dark' ? '#334155' : '#e2e8f0', borderStyle: 'dashed', backgroundColor: currentTheme === 'dark' ? '#0f172a' : '#f8fafc', justifyContent: 'center' }]}
            onPress={openAddModal}
            activeOpacity={0.7}
          >
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#10b98120', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="add" size={32} color="#10b981" />
            </View>
            <Text style={[styles.itemName, { textAlign: 'center', color: currentTheme === 'dark' ? '#94a3b8' : '#64748b' }]} numberOfLines={2}>Yeni Atık Ekle</Text>
          </TouchableOpacity>
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
                {/* Düzenle Butonu */}
                <View style={{ alignItems: 'flex-end', marginBottom: 10 }}>
                  <TouchableOpacity onPress={openEditModal} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#3b82f620', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                    <Ionicons name="pencil" size={16} color="#3b82f6" />
                    <Text style={{ color: '#3b82f6', fontWeight: 'bold', marginLeft: 6 }}>Düzenle</Text>
                  </TouchableOpacity>
                </View>

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
                      <Text style={[styles.pointsSuffixText, currentTheme === 'dark' && { color: '#64748b' }]}>Coin Kazandırır</Text>
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
      <Modal
        animationType="slide"
        transparent={true}
        visible={addModalVisible}
        onRequestClose={() => !isSaving && setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
            <View style={[styles.modalHeader, currentTheme === 'dark' && { borderBottomColor: '#334155' }]}>
              <Text style={[styles.modalHeaderTitle, currentTheme === 'dark' && { color: '#fff' }]}>
                Yeni Atık Öğesi Ekle
              </Text>
              <TouchableOpacity 
                style={[styles.closeButton, currentTheme === 'dark' && { backgroundColor: '#334155' }]}
                onPress={() => !isSaving && setAddModalVisible(false)}
                disabled={isSaving}
              >
                <Ionicons name="close" size={24} color={currentTheme === 'dark' ? '#fff' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <View style={{ width: '100%', gap: 12 }}>
              {errorText ? (
                <View style={{ backgroundColor: '#fef2f2', borderColor: '#fee2e2', borderWidth: 1, padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
                  <Ionicons name="alert-circle" size={20} color="#ef4444" />
                  <Text style={{ color: '#b91c1c', fontSize: 13, fontWeight: '600', flex: 1 }}>{errorText}</Text>
                </View>
              ) : null}
              <TextInput
                style={[styles.input, currentTheme === 'dark' && { backgroundColor: '#0f172a', color: '#fff', borderColor: '#334155' }]}
                placeholder="Atık İsmi"
                placeholderTextColor={currentTheme === 'dark' ? '#64748b' : '#94a3b8'}
                value={newItemName}
                onChangeText={setNewItemName}
                editable={!isSaving}
              />
              <TextInput
                style={[styles.input, currentTheme === 'dark' && { backgroundColor: '#0f172a', color: '#fff', borderColor: '#334155' }]}
                placeholder="Coin Değeri (Örn: 10)"
                placeholderTextColor={currentTheme === 'dark' ? '#64748b' : '#94a3b8'}
                value={newItemCoins}
                keyboardType="numeric"
                onChangeText={setNewItemCoins}
                editable={!isSaving}
              />
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }, currentTheme === 'dark' && { backgroundColor: '#0f172a', color: '#fff', borderColor: '#334155' }]}
                placeholder="Açıklama"
                placeholderTextColor={currentTheme === 'dark' ? '#64748b' : '#94a3b8'}
                value={newItemDescription}
                multiline
                onChangeText={setNewItemDescription}
                editable={!isSaving}
              />

              <Text style={{ fontSize: 14, fontWeight: 'bold', color: currentTheme === 'dark' ? '#cbd5e1' : '#475569', marginTop: 4, width: '100%' }}>
                Öğe Vurgu Rengi (QR/Buton Rengi)
              </Text>
              {/* Renk Daireleri + Foto yan yana */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {COLOR_OPTIONS.map((color) => {
                    const isSelected = newItemColor === color;
                    return (
                      <TouchableOpacity
                        key={color}
                        onPress={() => setNewItemColor(color)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: color,
                          borderWidth: isSelected ? 3 : 0,
                          borderColor: currentTheme === 'dark' ? '#fff' : '#000',
                          transform: [{ scale: isSelected ? 1.15 : 1 }],
                        }}
                      />
                    );
                  })}
                </View>
                <TouchableOpacity 
                  style={{ width: 100, height: 100, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: currentTheme === 'dark' ? '#334155' : '#cbd5e1', backgroundColor: currentTheme === 'dark' ? '#0f172a' : '#f8fafc', overflow: 'hidden' }}
                  onPress={() => pickImage(setNewItemImageUrl)}
                  disabled={isSaving}
                >
                  {newItemImageUrl ? (
                    <Image source={{ uri: newItemImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Ionicons name="camera-outline" size={28} color={currentTheme === 'dark' ? '#64748b' : '#94a3b8'} style={{ marginBottom: 6 }} />
                      <Text style={{ color: currentTheme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 12, textAlign: 'center' }}>Fotoğraf{"\n"}Yükle</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              {/* HEX Kodu + Küre - kısa input */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: /^#([0-9A-Fa-f]{3}){1,2}$/.test(newItemColor) ? newItemColor : '#14b8a6',
                    shadowColor: newItemColor,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.6,
                    shadowRadius: 5,
                    elevation: 4,
                  }}
                />
                <TextInput
                  style={[styles.input, { width: 160, marginBottom: 0 }, currentTheme === 'dark' && { backgroundColor: '#0f172a', color: '#fff', borderColor: '#334155' }]}
                  placeholder="#RRGGBB"
                  placeholderTextColor={currentTheme === 'dark' ? '#64748b' : '#94a3b8'}
                  value={newItemColor}
                  onChangeText={(text) => {
                    const val = text.startsWith('#') ? text : '#' + text;
                    setNewItemColor(val);
                  }}
                  autoCapitalize="none"
                  maxLength={7}
                  editable={!isSaving}
                />
              </View>

              <TouchableOpacity 
                style={[{ backgroundColor: '#10b981', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 }, isSaving && { backgroundColor: '#86efac' }]}
                onPress={handleAddItem}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Kaydet ve Ekle</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Düzenleme Modalı */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => !isSaving && setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, currentTheme === 'dark' && { backgroundColor: '#1e293b' }]}>
            <View style={[styles.modalHeader, currentTheme === 'dark' && { borderBottomColor: '#334155' }]}>
              <Text style={[styles.modalHeaderTitle, currentTheme === 'dark' && { color: '#fff' }]}>
                Atık Düzenle
              </Text>
              <TouchableOpacity 
                style={[styles.closeButton, currentTheme === 'dark' && { backgroundColor: '#334155' }]}
                onPress={() => !isSaving && setEditModalVisible(false)}
                disabled={isSaving}
              >
                <Ionicons name="close" size={24} color={currentTheme === 'dark' ? '#fff' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <View style={{ width: '100%', gap: 12 }}>
              {editErrorText ? (
                <View style={{ backgroundColor: '#fef2f2', borderColor: '#fee2e2', borderWidth: 1, padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
                  <Ionicons name="alert-circle" size={20} color="#ef4444" />
                  <Text style={{ color: '#b91c1c', fontSize: 13, fontWeight: '600', flex: 1 }}>{editErrorText}</Text>
                </View>
              ) : null}
              <TextInput
                style={[styles.input, currentTheme === 'dark' && { backgroundColor: '#0f172a', color: '#fff', borderColor: '#334155' }]}
                placeholder="Atık İsmi"
                placeholderTextColor={currentTheme === 'dark' ? '#64748b' : '#94a3b8'}
                value={editItemName}
                onChangeText={setEditItemName}
                editable={!isSaving}
              />
              <TextInput
                style={[styles.input, currentTheme === 'dark' && { backgroundColor: '#0f172a', color: '#fff', borderColor: '#334155' }]}
                placeholder="Coin Değeri (Örn: 10)"
                placeholderTextColor={currentTheme === 'dark' ? '#64748b' : '#94a3b8'}
                value={editItemCoins}
                keyboardType="numeric"
                onChangeText={setEditItemCoins}
                editable={!isSaving}
              />
              <TextInput
                style={[styles.input, currentTheme === 'dark' && { backgroundColor: '#0f172a', color: '#fff', borderColor: '#334155' }]}
                placeholder="Sıralama (Örn: 1)"
                placeholderTextColor={currentTheme === 'dark' ? '#64748b' : '#94a3b8'}
                value={editItemOrder}
                keyboardType="numeric"
                onChangeText={setEditItemOrder}
                editable={!isSaving}
              />
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }, currentTheme === 'dark' && { backgroundColor: '#0f172a', color: '#fff', borderColor: '#334155' }]}
                placeholder="Açıklama"
                placeholderTextColor={currentTheme === 'dark' ? '#64748b' : '#94a3b8'}
                value={editItemDescription}
                multiline
                onChangeText={setEditItemDescription}
                editable={!isSaving}
              />

              <Text style={{ fontSize: 14, fontWeight: 'bold', color: currentTheme === 'dark' ? '#cbd5e1' : '#475569', marginTop: 4, width: '100%' }}>
                Öğe Vurgu Rengi (QR/Buton Rengi)
              </Text>
              {/* Renk Daireleri + Foto yan yana */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {COLOR_OPTIONS.map((color) => {
                    const isSelected = editItemColor === color;
                    return (
                      <TouchableOpacity
                        key={color}
                        onPress={() => setEditItemColor(color)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: color,
                          borderWidth: isSelected ? 3 : 0,
                          borderColor: currentTheme === 'dark' ? '#fff' : '#000',
                          transform: [{ scale: isSelected ? 1.15 : 1 }],
                        }}
                      />
                    );
                  })}
                </View>
                <TouchableOpacity 
                  style={{ width: 100, height: 100, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: currentTheme === 'dark' ? '#334155' : '#cbd5e1', backgroundColor: currentTheme === 'dark' ? '#0f172a' : '#f8fafc', overflow: 'hidden' }}
                  onPress={() => pickImage(setEditItemImageUrl)}
                  disabled={isSaving}
                >
                  {editItemImageUrl ? (
                    <Image source={{ uri: editItemImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Ionicons name="camera-outline" size={28} color={currentTheme === 'dark' ? '#64748b' : '#94a3b8'} style={{ marginBottom: 6 }} />
                      <Text style={{ color: currentTheme === 'dark' ? '#64748b' : '#94a3b8', fontSize: 12, textAlign: 'center' }}>Fotoğraf{"\n"}Yükle</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              {/* HEX Kodu + Küre - kısa input */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: /^#([0-9A-Fa-f]{3}){1,2}$/.test(editItemColor) ? editItemColor : '#14b8a6',
                    shadowColor: editItemColor,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.6,
                    shadowRadius: 5,
                    elevation: 4,
                  }}
                />
                <TextInput
                  style={[styles.input, { width: 160, marginBottom: 0 }, currentTheme === 'dark' && { backgroundColor: '#0f172a', color: '#fff', borderColor: '#334155' }]}
                  placeholder="#RRGGBB"
                  placeholderTextColor={currentTheme === 'dark' ? '#64748b' : '#94a3b8'}
                  value={editItemColor}
                  onChangeText={(text) => {
                    const val = text.startsWith('#') ? text : '#' + text;
                    setEditItemColor(val);
                  }}
                  autoCapitalize="none"
                  maxLength={7}
                  editable={!isSaving}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity 
                  style={[{ backgroundColor: '#ef4444', padding: 16, borderRadius: 16, alignItems: 'center', flex: 1 }, isSaving && { backgroundColor: '#fca5a5' }]}
                  onPress={handleDeleteItem}
                  disabled={isSaving}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Sil</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[{ backgroundColor: '#3b82f6', padding: 16, borderRadius: 16, alignItems: 'center', flex: 1 }, isSaving && { backgroundColor: '#93c5fd' }]}
                  onPress={handleEditItem}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Kaydet</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {deleteConfirmVisible && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', borderRadius: 24, zIndex: 100 }]}>
                <View style={{ width: '85%', maxWidth: 340, backgroundColor: currentTheme === 'dark' ? '#1e293b' : '#fff', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: currentTheme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                    <Ionicons name="trash-outline" size={32} color="#ef4444" />
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: currentTheme === 'dark' ? '#fff' : '#1e293b', marginBottom: 8, textAlign: 'center' }}>Atığı Sil</Text>
                  <Text style={{ fontSize: 15, color: currentTheme === 'dark' ? '#94a3b8' : '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>Bu atığı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</Text>
                  
                  <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                    <TouchableOpacity 
                      style={{ flex: 1, backgroundColor: currentTheme === 'dark' ? '#334155' : '#f1f5f9', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
                      onPress={() => setDeleteConfirmVisible(false)}
                      disabled={isSaving}
                    >
                      <Text style={{ color: currentTheme === 'dark' ? '#cbd5e1' : '#475569', fontWeight: 'bold', fontSize: 15 }}>İptal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={{ flex: 1, backgroundColor: '#ef4444', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
                      onPress={confirmDelete}
                      disabled={isSaving}
                    >
                      {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Sil</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

          </View>
        </View>
      </Modal>

      <Modal
        visible={coinTooltipVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCoinTooltipVisible(false)}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }} 
          onPress={() => setCoinTooltipVisible(false)}
        >
          <View style={{
            position: 'absolute',
            top: Platform.OS === 'ios' ? 105 : (StatusBar.currentHeight ? StatusBar.currentHeight + 60 : 75),
            right: 20,
            width: 260,
            backgroundColor: currentTheme === 'dark' ? '#1e293b' : '#fff',
            borderRadius: 16,
            padding: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 10,
            borderWidth: 1,
            borderColor: currentTheme === 'dark' ? '#334155' : '#f1f5f9',
          }}>
            {/* Arrow */}
            <View style={{
              position: 'absolute',
              top: -6,
              right: 24,
              width: 12,
              height: 12,
              backgroundColor: currentTheme === 'dark' ? '#1e293b' : '#fff',
              transform: [{ rotate: '45deg' }],
              borderTopWidth: 1,
              borderLeftWidth: 1,
              borderColor: currentTheme === 'dark' ? '#334155' : '#f1f5f9',
            }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              <FontAwesome5 name="coins" size={16} color="#facc15" />
              <Text style={{ fontWeight: '700', fontSize: 14, color: currentTheme === 'dark' ? '#fff' : '#1e293b' }}>
                E-Atık Coin Nedir?
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: currentTheme === 'dark' ? '#94a3b8' : '#64748b', lineHeight: 18 }}>
              Atıklarınızı geri dönüştürerek kazandığınız puanlardır. Anlaşmalı mağazalarda indirim ve ödüller için kullanabilirsiniz. Ne kadar çok geri dönüştürürseniz, o kadar çok coin kazanırsınız! 🌱
            </Text>
            <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: currentTheme === 'dark' ? '#334155' : '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="checkmark-circle" size={14} color="#10b981" />
              <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '600' }}>Mevcut bakiyeniz: {points} coin</Text>
            </View>
          </View>
        </Pressable>
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
    justifyContent: 'flex-start',
    columnGap: 10,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 16,
    marginBottom: 15,
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
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
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
  },
});
