import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  Platform, 
  StatusBar, 
  ScrollView,
  Image,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

export default function KisiselSettingsScreen() {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const email = await AsyncStorage.getItem('currentUserEmail');
      const sessionStr = await AsyncStorage.getItem('userSession');
      
      if (email) setUserEmail(email);
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        setUserName(session.name || '');
      }

      if (email) {
        const savedPhoto = await AsyncStorage.getItem(`profileImage_kisisel_${email}`);
        if (savedPhoto) setProfileImage(savedPhoto);
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setProfileImage(uri);
      await AsyncStorage.setItem(`profileImage_kisisel_${userEmail}`, uri);
    }
  };

  const deleteImage = async () => {
    if (!profileImage) return;

    Alert.alert(
      "Fotoğrafı Sil",
      "Profil fotoğrafınızı silmek istediğinize emin misiniz?",
      [
        { text: "Vazgeç", style: "cancel" },
        { 
          text: "Sil", 
          style: "destructive", 
          onPress: async () => {
            setProfileImage(null);
            await AsyncStorage.removeItem(`profileImage_kisisel_${userEmail}`);
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.card}>
          <View style={styles.photoContainer}>
            {/* Profil Fotoğrafı (SAF ÇİZİM) */}
            <View style={styles.imageWrapper}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.profileImage} resizeMode="cover" />
              ) : (
                <View style={styles.drawnAvatarContainer}>
                  <View style={styles.avatarHead} />
                  <View style={styles.avatarBody} />
                </View>
              )}
            </View>

            {/* Butonlar */}
            <View style={styles.buttonWrapper}>
              <Text style={styles.title}>{userName || 'Kullanıcı'} Profili</Text>
              
              <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.btnText}>Fotoğraf Yükle</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.deleteBtn, !profileImage && styles.disabledBtn]} 
                onPress={deleteImage}
                disabled={!profileImage}
              >
                <Ionicons name="trash" size={18} color={profileImage ? "#fff" : "#95a5a6"} />
                <Text style={[styles.btnText, !profileImage && styles.disabledText]}>Fotoğrafı Sil</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={18} color="#7f8c8d" />
            <Text style={styles.infoText}>Görseliniz ana menüde en sol üstte görünecektir.</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContent: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  photoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: '#dcdde1',
    overflow: 'hidden',
  },
  drawnAvatarContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#95a5a6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
    marginTop: 10,
  },
  avatarBody: {
    width: 56,
    height: 36,
    backgroundColor: '#e0e0e0',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: 4,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  buttonWrapper: {
    marginLeft: 20,
    flex: 1,
    gap: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2ecc71',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 8,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e74c3c',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 8,
  },
  disabledBtn: {
    backgroundColor: '#f1f2f6',
  },
  btnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  disabledText: {
    color: '#95a5a6',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f2f6',
    marginVertical: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#7f8c8d',
    flex: 1,
  }
});
