import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform, StatusBar } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

export default function KisiselMarketScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBarContainer}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}></View>
          <View style={styles.topBarRight}>
            <Text style={styles.coinText}>50</Text>
            <FontAwesome5 name="coins" size={28} color="#FFD700" />
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Market Sayfası</Text>
      </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  }
});
