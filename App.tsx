import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation';
import { useAppFonts } from './src/hooks';
import { AuthProvider, ClassPresenceProvider, NotificationsProvider } from './src/providers';
import { registerServiceWorker } from './src/lib/registerServiceWorker';
import { colors, typography } from './src/theme';

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const { fontError, fontsLoaded } = useAppFonts();
  const appReady = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  if (__DEV__) {
    console.log('[startup][App]', {
      appReady,
      fontError: fontError ? String(fontError) : null,
      fontsLoaded,
    });
  }

  if (!appReady) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <View style={styles.loadingScreen}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading Zenmo...</Text>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthProvider>
          <ClassPresenceProvider>
            <NotificationsProvider>
              <AppNavigator />
            </NotificationsProvider>
          </ClassPresenceProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.sm,
  },
});
