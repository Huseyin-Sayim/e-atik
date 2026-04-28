import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Platform, StatusBar } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

export default function MainScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar */}
      <View style={styles.topBarContainer}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}></View>
          <View style={styles.topBarRight}>
            <Text style={styles.coinText}>50</Text>
            <FontAwesome5 name="coins" size={28} color="#FFD700" />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Yapılan Son İşlemler Paneli */}
        <View style={styles.transactionsPanel}>
          <View style={styles.transactionsBadgeContainer}>
            <View style={styles.transactionsBadge}>
              <Text style={styles.transactionsBadgeText}>Yapılan Son İşlemler</Text>
            </View>
          </View>

          <View style={styles.listContainer}>
            <Text style={styles.listItem}>• A4 Fotokopi Kağıdı <Text style={styles.boldText}>x</Text> 1 Adet</Text>
            <Text style={styles.listItem}>• </Text>
            <Text style={styles.listItem}>• </Text>
            <Text style={styles.listItem}>• </Text>
            <Text style={styles.listItem}>• </Text>
            <Text style={styles.listItem}>• </Text>
            <Text style={styles.listItem}>• </Text>
          </View>
        </View>

        {/* Çevre Sözü Paneli */}
        <View style={styles.quotePanel}>
          <Text style={styles.quoteText}>
            Geri dönüşüme giden her atık, enerji kullanımını %80 azaltan ve her tonuyla 17 ağacı hayata bağlayan bir kazanımdır.
          </Text>
          <Text style={styles.treeEmoji}>🌳</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  topBarContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 30,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  topBarLeft: {
    flex: 1,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
    color: '#333',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  transactionsPanel: {
    borderWidth: 1.5,
    borderColor: '#FF9800',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 20,
    backgroundColor: '#fafafa',
  },
  transactionsBadgeContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  transactionsBadge: {
    backgroundColor: '#FF9800',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  transactionsBadgeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  listContainer: {
    marginTop: 10,
  },
  listItem: {
    fontSize: 16,
    color: '#111',
    marginBottom: 12,
  },
  boldText: {
    fontWeight: 'bold',
  },
  quotePanel: {
    backgroundColor: '#e8f5e9',
    borderRadius: 20,
    padding: 24,
    position: 'relative',
    marginBottom: 20,
  },
  quoteText: {
    fontSize: 18,
    color: '#4caf50',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 26,
  },
  treeEmoji: {
    position: 'absolute',
    bottom: 10,
    right: 15,
    fontSize: 32,
  },
});