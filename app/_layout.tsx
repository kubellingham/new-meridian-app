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
import 'react-native-reanimated';

import { colors } from '@/src/theme/theme';

export const unstable_settings = {
  // The tab group is the app's anchor; /setup sits outside it.
  anchor: '(tabs)',
};

/**
 * Root layout: loads the brand fonts, forces the dark stack chrome, and
 * declares the two top-level routes — the main tab group and the temporary
 * setup screen (a stand-in until the scripted onboarding is built).
 */
export default function RootLayout() {
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
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.base },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="setup" />
        <Stack.Screen name="sera" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
