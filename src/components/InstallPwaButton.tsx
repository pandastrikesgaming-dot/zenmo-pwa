import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, typography } from '../theme';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isStandaloneDisplay() {
  if (typeof window === 'undefined') {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    Boolean(navigatorWithStandalone.standalone)
  );
}

export function InstallPwaButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [fallbackVisible, setFallbackVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    setIsInstalled(isStandaloneDisplay());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setFallbackVisible(false);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setFallbackVisible(false);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (Platform.OS !== 'web' || isInstalled) {
    return null;
  }

  async function handleInstallPress() {
    if (!installPrompt) {
      setFallbackVisible(true);
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => void handleInstallPress()}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Ionicons name="download-outline" size={18} color="#140A05" />
        <Text style={styles.buttonText}>Install Zenmo</Text>
      </Pressable>

      {fallbackVisible ? (
        <Text style={styles.fallbackText}>
          Open this site in Chrome or Edge and choose Add to Home Screen.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  button: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    shadowColor: colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  buttonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: '#140A05',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fallbackText: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
});
