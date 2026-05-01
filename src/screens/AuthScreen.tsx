import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InstallPwaButton } from '../components';
import { useAuth } from '../hooks';
import { colors, typography } from '../theme';

const featureRows = [
  {
    icon: 'flash-outline' as const,
    title: 'Upload Notes In Seconds',
    description: 'Capture handwritten pages, screenshots, and class PDFs without friction.',
  },
  {
    icon: 'people-outline' as const,
    title: 'Access Notes From Your Class',
    description: 'See shared material from students in the same school and same class.',
  },
  {
    icon: 'sparkles-outline' as const,
    title: 'Study Smarter With AI Tools',
    description: 'Unlock summaries, revision help, and question generation from every note.',
  },
];

const trustRows = [
  {
    icon: 'shield-checkmark-outline' as const,
    label: 'Same school, same class visibility',
  },
  {
    icon: 'locate-outline' as const,
    label: 'Focused note sharing for students',
  },
  {
    icon: 'rocket-outline' as const,
    label: 'Built for fast revision on mobile',
  },
];

const stars = [
  { top: 24, left: 42, size: 2, opacity: 0.6 },
  { top: 42, left: 156, size: 2, opacity: 0.75 },
  { top: 58, left: 270, size: 1.5, opacity: 0.55 },
  { top: 98, left: 102, size: 1.5, opacity: 0.65 },
  { top: 132, left: 214, size: 2, opacity: 0.7 },
  { top: 164, left: 312, size: 2, opacity: 0.75 },
  { top: 232, left: 68, size: 1.5, opacity: 0.45 },
  { top: 266, left: 170, size: 2, opacity: 0.8 },
  { top: 322, left: 256, size: 1.5, opacity: 0.7 },
  { top: 380, left: 120, size: 2, opacity: 0.55 },
  { top: 404, left: 336, size: 2, opacity: 0.6 },
];

function LogoGradientText() {
  return (
    <Text style={styles.logoText}>
      <Text style={styles.logoLetterPurple}>Z</Text>
      <Text style={styles.logoLetterPurpleSoft}>E</Text>
      <Text style={styles.logoLetterPink}>N</Text>
      <Text style={styles.logoLetterPeach}>M</Text>
      <Text style={styles.logoLetterOrange}>O</Text>
    </Text>
  );
}

export function AuthScreen() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { loading, signInWithGoogle } = useAuth();
  const isBusy = loading || isSubmitting;

  async function handleGoogleSignIn() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to start Google sign-in right now.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cosmicBackdrop}>
          <View style={styles.backdropPurpleGlow} />
          <View style={styles.backdropOrangeGlow} />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroBorderGlowPurple} />
          <View style={styles.heroBorderGlowOrange} />
          <View style={styles.heroLargePlanet} />
          <View style={styles.heroLargePlanetGlow} />
          <View style={styles.heroSmallPlanet} />
          <View style={styles.heroOrbitalArc} />
          <View style={styles.heroOrbitalArcGlow} />
          <View style={styles.heroDustLeft} />
          <View style={styles.heroDustRight} />

          {stars.map((star, index) => (
            <View
              key={`${star.top}-${star.left}-${index}`}
              style={[
                styles.star,
                {
                  top: star.top,
                  left: star.left,
                  width: star.size,
                  height: star.size,
                  opacity: star.opacity,
                },
              ]}
            />
          ))}

          <View style={styles.logoCard}>
            <View style={styles.logoCardGlowPurple} />
            <View style={styles.logoCardGlowOrange} />
            <LogoGradientText />
            <Text style={styles.logoSubtext}>SHARED CLASS ARCHIVE</Text>
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.heroTag}>
              <Ionicons name="rocket-outline" size={19} color="#F6ECFF" />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                style={styles.heroTagText}
              >
                FOR STUDENTS, BY STUDENTS
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              <Text style={styles.sectionTitlePurple}>THE ZENMO </Text>
              <Text style={styles.sectionTitleOrange}>ADVANTAGE</Text>
            </Text>
            <View style={styles.sectionLineRow}>
              <View style={styles.sectionLine} />
              <View style={styles.sectionLineGlow} />
            </View>
          </View>

          <View style={styles.featurePanel}>
            {featureRows.map((item, index) => (
              <View key={item.title} style={styles.featureRowWrap}>
                <View style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <Ionicons name={item.icon} size={28} color="#B756FF" />
                    <View style={styles.featureIconGlow} />
                  </View>

                  <View style={styles.featureCopy}>
                    <Text style={styles.featureTitle}>{item.title}</Text>
                    <Text style={styles.featureDescription}>{item.description}</Text>
                  </View>
                </View>

                {index < featureRows.length - 1 ? <View style={styles.featureDivider} /> : null}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              <Text style={styles.sectionTitlePurple}>ACCESS THE </Text>
              <Text style={styles.sectionTitleOrange}>VAULT</Text>
            </Text>
          </View>

          <View style={styles.authPanel}>
            <Text style={styles.authIntro}>
              Sign in with Google to access class-based notes, trusted uploads, and smarter study tools.
            </Text>

            <Pressable
              disabled={isBusy}
              onPress={() => void handleGoogleSignIn()}
              style={[styles.googleButton, isBusy && styles.googleButtonDisabled]}
            >
              <View style={styles.googleButtonGlowLeft} />
              <View style={styles.googleButtonGlowRight} />

              {isBusy ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.text} />
                  <Text style={styles.googleButtonText}>Connecting...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.googleMark}>
                    <Text style={styles.googleMarkText}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <InstallPwaButton />

            <View style={styles.trustBlock}>
              <View style={styles.trustPlanetGlow} />
              <View style={styles.trustPlanet} />

              <Text style={styles.trustTitle}>
                <Text style={styles.sectionTitlePurple}>BUILT FOR </Text>
                <Text style={styles.sectionTitlePink}>CLASS-BASED </Text>
                <Text style={styles.sectionTitleOrange}>SHARING</Text>
              </Text>

              <View style={styles.trustRows}>
                {trustRows.map((item) => (
                  <View key={item.label} style={styles.trustRow}>
                    <Ionicons name={item.icon} size={20} color="#F3F0EB" />
                    <Text style={styles.trustText}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footerStrip}>
          <View style={styles.footerLine} />
          <View style={styles.footerMeta}>
            <Text style={styles.footerText}>EST. 2026</Text>
            <Text style={styles.footerText}>VERIFIED CLASS DATA</Text>
            <Text style={styles.footerText}>SECURE ACCESS</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#030106',
  },
  screen: {
    flex: 1,
    backgroundColor: '#030106',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 20,
  },
  cosmicBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdropPurpleGlow: {
    position: 'absolute',
    top: 120,
    left: -100,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(148, 63, 255, 0.15)',
  },
  backdropOrangeGlow: {
    position: 'absolute',
    bottom: 120,
    right: -90,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255, 128, 28, 0.1)',
  },
  heroCard: {
    minHeight: 520,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(155, 93, 255, 0.45)',
    backgroundColor: '#08050D',
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  heroBorderGlowPurple: {
    position: 'absolute',
    top: -80,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(137, 63, 255, 0.13)',
  },
  heroBorderGlowOrange: {
    position: 'absolute',
    bottom: -90,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 140, 31, 0.14)',
  },
  star: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#F5C9FF',
  },
  heroLargePlanet: {
    position: 'absolute',
    left: -148,
    bottom: -122,
    width: 304,
    height: 304,
    borderRadius: 152,
    backgroundColor: '#090510',
    borderWidth: 1,
    borderColor: 'rgba(186, 93, 255, 0.24)',
  },
  heroLargePlanetGlow: {
    position: 'absolute',
    left: -134,
    bottom: 6,
    width: 280,
    height: 140,
    borderTopLeftRadius: 140,
    borderTopRightRadius: 140,
    borderBottomLeftRadius: 140,
    borderBottomRightRadius: 140,
    borderWidth: 3,
    borderColor: 'rgba(189, 90, 255, 0.0)',
    borderTopColor: '#D36AFF',
    opacity: 0.85,
  },
  heroSmallPlanet: {
    position: 'absolute',
    top: 34,
    right: 22,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#12081D',
    borderWidth: 1,
    borderColor: 'rgba(221, 112, 255, 0.55)',
  },
  heroOrbitalArc: {
    position: 'absolute',
    right: -6,
    top: 190,
    width: 282,
    height: 198,
    borderRadius: 180,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: 'rgba(255, 146, 41, 0.92)',
    transform: [{ rotate: '17deg' }],
  },
  heroOrbitalArcGlow: {
    position: 'absolute',
    right: 18,
    top: 246,
    width: 150,
    height: 30,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 124, 24, 0.35)',
    transform: [{ rotate: '19deg' }],
  },
  heroDustLeft: {
    position: 'absolute',
    left: 24,
    top: 180,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(157, 77, 255, 0.12)',
  },
  heroDustRight: {
    position: 'absolute',
    right: 82,
    top: 286,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 118, 31, 0.09)',
  },
  logoCard: {
    alignSelf: 'center',
    marginTop: 34,
    minWidth: 282,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#A94EFF',
    backgroundColor: '#07040B',
    paddingHorizontal: 22,
    paddingVertical: 24,
    transform: [{ rotate: '-4deg' }],
    shadowColor: '#CB5DFF',
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 12,
  },
  logoCardGlowPurple: {
    position: 'absolute',
    left: -30,
    top: -28,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(145, 70, 255, 0.13)',
  },
  logoCardGlowOrange: {
    position: 'absolute',
    right: -28,
    bottom: -36,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 138, 27, 0.16)',
  },
  logoText: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.display,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  logoLetterPurple: {
    color: '#8D44FF',
  },
  logoLetterPurpleSoft: {
    color: '#A64EFF',
  },
  logoLetterPink: {
    color: '#D962D4',
  },
  logoLetterPeach: {
    color: '#F28A79',
  },
  logoLetterOrange: {
    color: '#FF981D',
  },
  logoSubtext: {
    marginTop: 10,
    textAlign: 'center',
    color: '#F2EAE3',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  heroFooter: {
    marginTop: 'auto',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 167, 73, 0.75)',
    backgroundColor: '#8E37FF',
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#A74DFF',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 9,
  },
  heroTagText: {
    flex: 1,
    minWidth: 0,
    color: '#FFF6FF',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    gap: 6,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.display,
    fontSize: 28,
    lineHeight: 32,
    textTransform: 'uppercase',
  },
  sectionTitlePurple: {
    color: '#9B52FF',
  },
  sectionTitlePink: {
    color: '#E56BB6',
  },
  sectionTitleOrange: {
    color: '#FF9641',
  },
  sectionLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionLine: {
    width: 108,
    height: 2,
    backgroundColor: '#8C44FF',
  },
  sectionLineGlow: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 132, 43, 0.55)',
    marginLeft: -4,
  },
  featurePanel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(111, 88, 122, 0.6)',
    backgroundColor: '#08050D',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 2,
  },
  featureRowWrap: {
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  featureDivider: {
    height: 1,
    backgroundColor: 'rgba(116, 94, 122, 0.5)',
  },
  featureIcon: {
    width: 62,
    height: 62,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(158, 81, 255, 0.65)',
    backgroundColor: '#120C18',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  featureIconGlow: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 132, 43, 0.12)',
  },
  featureCopy: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  featureTitle: {
    color: '#FFF5EC',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 17,
    lineHeight: 22,
  },
  featureDescription: {
    color: '#D4C9C2',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 22,
  },
  authPanel: {
    gap: 16,
  },
  authIntro: {
    color: '#CFC4BE',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
  },
  googleButton: {
    minHeight: 86,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(178, 89, 255, 0.7)',
    backgroundColor: '#09060C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  googleButtonGlowLeft: {
    position: 'absolute',
    left: -14,
    top: 0,
    bottom: 0,
    width: 46,
    backgroundColor: 'rgba(145, 76, 255, 0.18)',
  },
  googleButtonGlowRight: {
    position: 'absolute',
    right: -14,
    top: 0,
    bottom: 0,
    width: 52,
    backgroundColor: 'rgba(255, 144, 39, 0.16)',
  },
  googleButtonDisabled: {
    opacity: 0.82,
  },
  googleMark: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleMarkText: {
    color: '#111111',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 34,
    lineHeight: 38,
  },
  googleButtonText: {
    color: '#F9F2EC',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 18,
    textTransform: 'none',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    color: '#FFB287',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  trustBlock: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(98, 82, 108, 0.68)',
    backgroundColor: '#0A0610',
    paddingHorizontal: 18,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  trustPlanetGlow: {
    position: 'absolute',
    right: -64,
    bottom: -34,
    width: 236,
    height: 236,
    borderRadius: 118,
    backgroundColor: 'rgba(146, 68, 255, 0.28)',
  },
  trustPlanet: {
    position: 'absolute',
    right: -42,
    bottom: -86,
    width: 224,
    height: 224,
    borderRadius: 112,
    backgroundColor: '#180C24',
    borderWidth: 1,
    borderColor: 'rgba(229, 117, 255, 0.38)',
  },
  trustTitle: {
    fontFamily: typography.fontFamily.display,
    fontSize: 18,
    lineHeight: 24,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  trustRows: {
    gap: 12,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 110,
  },
  trustText: {
    flex: 1,
    color: '#D4C8C2',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  footerStrip: {
    gap: 10,
    paddingBottom: 8,
  },
  footerLine: {
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  footerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerText: {
    color: '#8F7E74',
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
