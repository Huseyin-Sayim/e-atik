import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapView } from '../../components/MapComponent';
import campusParcels from '../../assets/kampusParsel.json';
import DatabaseService from '../../database/DatabaseService';

const CAMPUS_CENTER = {
  latitude: 38.4553,
  longitude: 27.2290,
  latitudeDelta: 0.0135,
  longitudeDelta: 0.0135,
};

export default function RegionSelectScreen() {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [selectedParcelName, setSelectedParcelName] = useState<string | null>(null);

  useEffect(() => {
    const loadSavedRegion = async () => {
      try {
        let savedId = await AsyncStorage.getItem('@staff_selected_region');
        
        if (!savedId) {
          const user = await DatabaseService.getCurrentUser();
          if (user && user.region) {
            savedId = user.region.region_id;
            if (savedId) {
              await AsyncStorage.setItem('@staff_selected_region', savedId);
            }
          }
        }

        if (savedId) {
          setSelectedParcelId(savedId);
          const feature = campusParcels.features.find((f: any) => f.id === savedId);
          if (feature) {
            setSelectedParcelName(feature.properties.name);
          }
        }
      } catch (e) {
        console.warn('Error loading saved region', e);
      }
    };
    
    loadSavedRegion();
  }, []);

  const handleParcelPress = (parcelId: string, parcelName: string) => {
    setSelectedParcelId(parcelId);
    setSelectedParcelName(parcelName);
  };

  const handleSave = async () => {
    try {
      if (selectedParcelId) {
        await AsyncStorage.setItem('@staff_selected_region', selectedParcelId);
        const currentUser = await DatabaseService.getCurrentUser();
        if (currentUser && currentUser.email) {
          await DatabaseService.updateUser(currentUser.email, { regionId: selectedParcelId });
        }
      } else {
        await AsyncStorage.removeItem('@staff_selected_region');
        const currentUser = await DatabaseService.getCurrentUser();
        if (currentUser && currentUser.email) {
          await DatabaseService.updateUser(currentUser.email, { regionId: null });
        }
      }
      router.back();
    } catch (e) {
      console.warn('Error saving region', e);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      {/* Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Bölge Seçimi</Text>
          <Text style={styles.headerSubtitle}>Numaralı alanlardan birini seçiniz</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={CAMPUS_CENTER}
          campusParcels={campusParcels}
          selectedParcelId={selectedParcelId}
          onParcelPress={handleParcelPress}
          bins={[]} /* No bins on region select */
          showRegionLabels={true}
        />
        
        {selectedParcelName && (
          <View style={styles.selectionInfo}>
            <Text style={styles.selectionLabel}>Seçilen Bölge:</Text>
            <Text style={styles.selectionText}>{selectedParcelName}</Text>
          </View>
        )}
      </View>

      {/* Bottom Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.saveButton, !selectedParcelId && { opacity: 0.5 }]} 
          onPress={handleSave}
          disabled={!selectedParcelId}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.saveButtonText}>Seç ve Kaydet</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  selectionInfo: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectionLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    marginRight: 8,
  },
  selectionText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: 'bold',
    flex: 1,
  },
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
