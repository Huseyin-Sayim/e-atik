import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#2e7d32',
        tabBarStyle: { height: 70, paddingBottom: 10, paddingTop: 10 },
      }}
    >
      <Tabs.Screen
        name="location"
        options={{
          title: 'Konum',
          tabBarIcon: ({ color }) => <Ionicons name="location-outline" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Tarama',
          tabBarIcon: ({ color }) => <Ionicons name="scan-outline" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: 'Market',
          tabBarIcon: ({ color }) => <Ionicons name="storefront-outline" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ayarlar',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
