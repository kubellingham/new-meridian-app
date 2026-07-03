import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';

import { useUserStore } from '@/src/store/user-store';
import { colors, fonts } from '@/src/theme/theme';

/**
 * The five-space navigation from the brief (§8):
 * Home | Training | Diet | Insights | Profile.
 *
 * Also acts as the entry gate: until the (temporary) setup has been
 * completed there is no team to talk to, so we redirect to /setup.
 */
export default function TabLayout() {
  const hasHydrated = useUserStore((s) => s.hasHydrated);
  const setupComplete = useUserStore((s) => s.setupComplete);

  // Wait for AsyncStorage rehydration before deciding where to send the user.
  if (!hasHydrated) {
    return <View style={{ flex: 1, backgroundColor: colors.base }} />;
  }

  if (!setupComplete) {
    return <Redirect href="/setup" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: 'Training',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barbell-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="diet"
        options={{
          title: 'Diet',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pulse-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
