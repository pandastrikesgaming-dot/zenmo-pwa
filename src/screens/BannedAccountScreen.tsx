import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../hooks';
import { colors, typography } from '../theme';

export function BannedAccountScreen() {
  const { profile, signOut } = useAuth();

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Unable to sign out', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#050206', '#14060A', '#050206']} style={styles.background} />
      <View pointerEvents="none" style={styles.purpleGlow} />
      <View pointerEvents="none" style={styles.orangeGlow} />

      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-outline" size={38} color={colors.primarySoft} />
        </View>
        <Text style={styles.kicker}>ACCOUNT RESTRICTED</Text>
        <Text style={styles.title}>Your account has been restricted due to policy violations.</Text>
        {profile?.bannedReason ? <Text style={styles.reason}>{profile.bannedReason}</Text> : null}
        <Text style={styles.body}>
          Uploading, messaging, requesting notes, reporting, and profile edits are disabled while
          this restriction is active.
        </Text>

        <Pressable style={styles.supportButton} onPress={() => Alert.alert('Contact support', 'Please contact Zenmo support for review.')}>
          <Ionicons name="mail-outline" size={18} color={colors.background} />
          <Text style={styles.supportText}>CONTACT SUPPORT</Text>
        </Pressable>

        <Pressable style={styles.signOutButton} onPress={() => void handleSignOut()}>
          <Ionicons name="log-out-outline" size={18} color="#FF6B4A" />
          <Text style={styles.signOutText}>SIGN OUT</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#030303',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  purpleGlow: {
    position: 'absolute',
    left: -90,
    top: 120,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(142, 44, 255, 0.28)',
  },
  orangeGlow: {
    position: 'absolute',
    right: -110,
    bottom: 80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255, 138, 31, 0.2)',
  },
  card: {
    margin: 24,
    marginTop: 80,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 98, 77, 0.62)',
    backgroundColor: 'rgba(6, 4, 8, 0.94)',
    padding: 24,
    shadowColor: '#FF4D3D',
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrap: {
    width: 74,
    height: 74,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 31, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 82, 56, 0.12)',
    marginBottom: 20,
  },
  kicker: {
    color: '#FF8A1F',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 30,
    lineHeight: 36,
  },
  reason: {
    marginTop: 18,
    color: '#FFD5AE',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 15,
    lineHeight: 22,
  },
  body: {
    marginTop: 18,
    color: '#BBAEBD',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 15,
    lineHeight: 23,
  },
  supportButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 28,
  },
  supportText: {
    color: colors.background,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 13,
    letterSpacing: 1,
  },
  signOutButton: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 56, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  signOutText: {
    color: '#FF6B4A',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 13,
    letterSpacing: 1,
  },
});
