import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform, StatusBar } from 'react-native';

export default function KurumsalStatsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Kurumsal İstatistikler</Text>
        <Text style={styles.subtitle}>Atık toplama verileri ve analizler burada (Yeşil Tema) yer alacak.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f1f8e9', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#2e7d32', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#388e3c', textAlign: 'center' }
});
