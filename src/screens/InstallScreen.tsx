import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography } from '../theme';
import type { RootStackParamList } from '../types';

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

export function InstallScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [deviceType, setDeviceType] = useState<'desktop' | 'android' | 'ios' | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installFailed, setInstallFailed] = useState(false);
  
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    if (isStandaloneDisplay()) {
      window.location.replace('/onboarding');
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setDeviceType('ios');
    } else if (/android/.test(ua)) {
      setDeviceType('android');
    } else {
      setDeviceType('desktop');
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) {
      setInstallFailed(true);
      return;
    }

    setIsInstalling(true);
    setInstallFailed(false);
    
    // Simulate progress 0 -> 30 immediately
    Animated.timing(progressAnim, {
      toValue: 30,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start(() => {
      // 30 -> 80 slowly
      Animated.timing(progressAnim, {
        toValue: 80,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    });

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      
      if (choice.outcome === 'accepted') {
        // Jump to 100 on success
        Animated.timing(progressAnim, {
          toValue: 100,
          duration: 200,
          useNativeDriver: false,
        }).start(() => {
          setTimeout(() => {
            setIsInstalling(false);
          }, 400);
        });
        setInstallPrompt(null);
      } else {
        // Dismissed
        setIsInstalling(false);
        progressAnim.setValue(0);
      }
    } catch (e) {
      setIsInstalling(false);
      progressAnim.setValue(0);
      setInstallFailed(true);
    }
  }

  const renderAndroidDesktop = () => (
    <View style={styles.actionSection}>
      <Pressable 
        style={({ pressed }) => [styles.installButton, pressed && styles.installButtonPressed]}
        onPress={() => void handleInstall()}
        disabled={isInstalling}
      >
        <Text style={styles.installButtonText}>
          {isInstalling ? 'Installing...' : 'Install Zenmo'}
        </Text>
        {!isInstalling && <Ionicons name="download-outline" size={20} color="#0B0B0B" />}
      </Pressable>
      
      <Text style={styles.helperText}>
        {isInstalling ? 'Please wait...' : 'Takes a few seconds'}
      </Text>

      {isInstalling && (
        <View style={styles.loaderContainer}>
          <View style={styles.loaderTrack}>
            <Animated.View 
              style={[
                styles.loaderFill, 
                { 
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }) 
                }
              ]} 
            />
          </View>
          <Text style={styles.loaderText}>Preparing Zenmo...</Text>
        </View>
      )}

      {installFailed && !isInstalling && (
        <Text style={styles.fallbackText}>
          Use Chrome or Edge and choose Add to Home Screen
        </Text>
      )}
    </View>
  );

  const renderIOS = () => (
    <View style={styles.iosCard}>
      <Text style={styles.iosCardTitle}>Install on iPhone</Text>
      
      <View style={styles.iosSteps}>
        <View style={styles.iosStep}>
          <View style={styles.iosStepNumber}><Text style={styles.iosStepNumberText}>1</Text></View>
          <Text style={styles.iosStepText}>
            Tap the Share button (<Ionicons name="share-outline" size={16} color="#4A90E2" />)
          </Text>
        </View>
        
        <View style={styles.iosStep}>
          <View style={styles.iosStepNumber}><Text style={styles.iosStepNumberText}>2</Text></View>
          <Text style={styles.iosStepText}>
            Scroll and tap <Text style={styles.highlightText}>"Add to Home Screen"</Text>
          </Text>
        </View>
        
        <View style={styles.iosStep}>
          <View style={styles.iosStepNumber}><Text style={styles.iosStepNumberText}>3</Text></View>
          <Text style={styles.iosStepText}>
            Open Zenmo from your home screen
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Z</Text>
          </View>
          <Text style={styles.title}>Flash Install</Text>
          <Text style={styles.subtitle}>Install Zenmo in seconds and use it like an app</Text>
          {deviceType && (
            <View style={styles.deviceLabel}>
              <Text style={styles.deviceLabelText}>
                {deviceType === 'ios' ? 'iPhone detected' : 
                 deviceType === 'android' ? 'Android detected' : 'Desktop detected'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.middle}>
          {deviceType === 'ios' ? renderIOS() : renderAndroidDesktop()}
        </View>
        
        <View style={styles.footer}>
          <Pressable 
            onPress={() => window.location.href = '/onboarding'}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.footerText}>Continue to Web App</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070707',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: 'rgba(255, 150, 40, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#FF9628',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  logoText: {
    fontFamily: typography.fontFamily.display,
    fontSize: 36,
    color: '#FF9628',
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 32,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 16,
    color: '#A0A0A0',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  deviceLabel: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.3)',
  },
  deviceLabelText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
    color: '#4A90E2',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  middle: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  actionSection: {
    width: '100%',
    alignItems: 'center',
  },
  installButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9628',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    shadowColor: '#FF9628',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    marginBottom: 12,
    gap: 10,
  },
  installButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  installButtonText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 18,
    color: '#0B0B0B',
  },
  helperText: {
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 14,
    color: '#666666',
  },
  loaderContainer: {
    width: '100%',
    marginTop: 32,
    alignItems: 'center',
  },
  loaderTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#1A1A1A',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  loaderFill: {
    height: '100%',
    backgroundColor: '#4A90E2',
    borderRadius: 2,
  },
  loaderText: {
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 14,
    color: '#888888',
  },
  fallbackText: {
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 14,
    color: '#FFB287',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  iosCard: {
    width: '100%',
    backgroundColor: '#0F0F0F',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 24,
  },
  iosCardTitle: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  iosSteps: {
    gap: 20,
  },
  iosStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iosStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(74, 144, 226, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosStepNumberText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 14,
    color: '#4A90E2',
  },
  iosStepText: {
    flex: 1,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 15,
    color: '#D0D0D0',
    lineHeight: 22,
  },
  highlightText: {
    fontFamily: typography.fontFamily.bodyBold,
    color: '#FFFFFF',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
  },
  footerText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 14,
    color: '#666666',
    textDecorationLine: 'underline',
  },
});
