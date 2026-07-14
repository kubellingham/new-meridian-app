import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { colors } from '@/src/theme/theme';

// Crash reporting: temporarily stripped. The @sentry/react-native + Expo
// config plugin caused an instant boot crash on the first standalone
// build (JS↔native binding). Reintroduce with a working setup once we
// can iterate on device — until then the app must ship bootable.

export const unstable_settings = {
  // The tab group is the app's anchor; /onboarding sits outside it.
  anchor: '(tabs)',
};

/**
 * Root layout: loads the brand fonts, forces the dark stack chrome, and
 * declares the top-level routes — the main tab group, the scripted
 * onboarding (first-run), and the pushed character/food screens.
 */
function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_700Bold,
  });

  // Hold on the (dark) splash background until fonts are ready so text
  // never flashes in a system font.
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.base }} />;
  }

  return (
    // GestureHandlerRootView is required for RNGH gestures (e.g. the
    // swipe-to-delete on workout set rows) to receive touches.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.base },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="sera" />
        <Stack.Screen name="kael" />
        <Stack.Screen name="trainer" />
        <Stack.Screen name="workout/[sessionId]" />
        <Stack.Screen name="history" />
        <Stack.Screen name="diet-chat" />
        <Stack.Screen name="food/manual" />
        <Stack.Screen name="food/search" />
        <Stack.Screen name="food/scan" />
        <Stack.Screen name="food/photo" />
      </Stack>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}

export default RootLayout;
