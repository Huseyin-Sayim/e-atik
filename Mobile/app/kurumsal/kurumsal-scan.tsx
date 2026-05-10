import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function KurumsalScanScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kurumsal Tarama Sayfası</Text>
      <Text style={styles.subtitle}>Barkod ve QR işlemleri burada yer alacak.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#7f8c8d',
  }
});
