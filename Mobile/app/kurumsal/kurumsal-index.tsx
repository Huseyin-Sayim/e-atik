import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Platform, StatusBar, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function KurumsalIndexScreen() {
  const [corpName, setCorpName] = useState('Kurumsal Firma');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    loadCorpData();
  }, []);

  const loadCorpData = async () => {
    try {
      const email = await AsyncStorage.getItem('currentUserEmail');
      const sessionStr = await AsyncStorage.getItem('userSession');
      
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        setCorpName(session.name || 'Kurumsal Firma');
      }

      if (email) {
        const savedPhoto = await AsyncStorage.getItem(`profileImage_kurumsal_${email}`);
        if (savedPhoto) setProfileImage(savedPhoto);
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    }
  };

  const StatCard = ({ title, value, icon, color }: any) => (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.profileIconContainer}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileIcon} resizeMode="cover" />
            ) : (
              <View style={styles.drawnAvatarContainer}>
                <View style={styles.avatarHead} />
                <View style={styles.avatarBody} />
              </View>
            )}
          </TouchableOpacity>
          <View>
            <Text style={styles.corpNameText}>Hoş Geldin,</Text>
            <Text style={styles.corpNameText}>{corpName}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.bellButton}>
          <Ionicons name="notifications-outline" size={24} color="#334155" />
          <View style={styles.dot} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          {/* YEŞİL TEMA UYGULANDI */}
          <StatCard title="Toplam Atık" value="1,250 kg" icon="recycle" color="#2e7d32" />
          <StatCard title="Aktif Kovalar" value="24" icon="trash-can-outline" color="#388e3c" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title="Doluluk Oranı" value="%68" icon="trending-up" color="#43a047" />
          <StatCard title="Puan Kazanımı" value="4.8k" icon="star-outline" color="#66bb6a" />
        </View>

        <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
        <View style={styles.actionPanel}>
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: '#e8f5e9' }]}>
              <Ionicons name="add-circle" size={28} color="#2e7d32" />
            </View>
            <Text style={styles.actionLabel}>Yeni Kova Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: '#f1f8e9' }]}>
              <Ionicons name="document-text" size={28} color="#2e7d32" />
            </View>
            <Text style={styles.actionLabel}>Rapor Al</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  profileIconContainer: { marginRight: 12 },
  profileIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  drawnAvatarContainer: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#95a5a6', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  avatarHead: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#e0e0e0', marginTop: 6 },
  avatarBody: { width: 28, height: 18, backgroundColor: '#e0e0e0', borderTopLeftRadius: 14, borderTopRightRadius: 14, marginTop: 2 },
  welcomeText: { fontSize: 12, color: '#64748b' },
  corpNameText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  bellButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  dot: { position: 'absolute', top: 10, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#d32f2f', borderWidth: 2, borderColor: '#fff' },
  container: { padding: 20 },
  statsRow: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 15, borderWidth: 1, borderColor: '#f1f5f9' },
  statIconContainer: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  statTitle: { fontSize: 12, color: '#64748b' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginTop: 20, marginBottom: 15 },
  actionPanel: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 20 },
  actionItem: { alignItems: 'center', flex: 1 },
  actionIcon: { width: 55, height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionLabel: { fontSize: 12, fontWeight: '600', color: '#475569' }
});
