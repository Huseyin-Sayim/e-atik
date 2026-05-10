import { Tabs } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function KurumsalLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#2e7d32', // Yeşile sadık kalıyoruz
        tabBarStyle: { height: 70, paddingBottom: 10, paddingTop: 10 },
      }}
    >
      <Tabs.Screen
        name="kurumsal-map"
        options={{
          title: 'Kova Takibi',
          tabBarIcon: ({ color }) => <Ionicons name="map-outline" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="kurumsal-stats"
        options={{
          title: 'İstatistik',
          tabBarIcon: ({ color }) => <Ionicons name="stats-chart-outline" size={28} color={color} />,
        }}
      />
      {/* EKSİK OLAN 5. BUTON: SCAN (TARAMA) */}
      <Tabs.Screen
        name="kurumsal-scan"
        options={{
          title: 'Tarama',
          tabBarIcon: ({ color }) => <Ionicons name="scan-outline" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="kurumsal-index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="view-dashboard-outline" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="kurumsal-settings"
        options={{
          title: 'Ayarlar',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
