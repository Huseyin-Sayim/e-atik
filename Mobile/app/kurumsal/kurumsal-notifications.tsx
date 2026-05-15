import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Platform, StatusBar, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DatabaseService from '../../database/DatabaseService';

interface TrashBin {
  id: string;
  name: string;
  fillPercentage: number;
  latitude: number;
  longitude: number;
}

export default function KurumsalNotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<TrashBin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const fetchedBins = await DatabaseService.getBins();
      
      const mappedBins = fetchedBins.map(b => ({
        id: b.id.toString(),
        name: b.name || 'İsimsiz Kutu',
        fillPercentage: b.predictedFullness || 0,
        latitude: parseFloat(b.latitude),
        longitude: parseFloat(b.longitude),
      }));

      // Doluluk oranına göre büyükten küçüğe sırala
      const sortedBins = mappedBins.sort((a, b) => b.fillPercentage - a.fillPercentage);
      setNotifications(sortedBins);
    } catch (e) {
      console.error('Bildirimler yüklenirken hata:', e);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (percentage: number) => {
    if (percentage >= 75) return '#e74c3c'; // Kırmızı (Acil)
    if (percentage >= 40) return '#f39c12'; // Turuncu (Orta)
    return '#27ae60'; // Yeşil (Düşük)
  };

  const getPriorityIcon = (percentage: number) => {
    if (percentage >= 75) return 'alert-circle';
    if (percentage >= 40) return 'warning';
    return 'checkmark-circle';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tüm Bildirimler</Text>
        <View style={{ width: 40 }} /> {/* Sağ tarafta denge için boşluk */}
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={styles.loaderText}>Bildirimler yükleniyor...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {notifications.map((bin, index) => (
            <View key={bin.id} style={styles.notificationCard}>
              <View style={styles.priorityBar(getPriorityColor(bin.fillPercentage))} />
              <View style={styles.iconContainer(getPriorityColor(bin.fillPercentage))}>
                <Ionicons name={getPriorityIcon(bin.fillPercentage) as any} size={24} color={getPriorityColor(bin.fillPercentage)} />
              </View>
              <View style={styles.contentContainer}>
                <Text style={styles.messageText}>
                  Lütfen <Text style={styles.boldText}>{bin.name}</Text> konumundaki atık kutusuna gidiniz.
                </Text>
                <View style={styles.detailsRow}>
                  <Text style={[styles.percentageText, { color: getPriorityColor(bin.fillPercentage) }]}>
                    Doluluk: %{bin.fillPercentage}
                  </Text>
                  <Text style={styles.coordsText}>
                    {bin.latitude.toFixed(5)}, {bin.longitude.toFixed(5)}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          {notifications.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={60} color="#cbd5e1" />
              <Text style={styles.emptyText}>Henüz hiç bildirim yok.</Text>
            </View>
          )}
        </ScrollView>
      )}
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
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  priorityBar: (color: string) => ({
    width: 6,
    backgroundColor: color,
  }),
  iconContainer: (color: string) => ({
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: color + '15', // %15 opacity
  }),
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  messageText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
    marginBottom: 8,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#0f172a',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  coordsText: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
  }
});
