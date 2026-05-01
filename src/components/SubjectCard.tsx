import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, typography } from '../theme';

type SubjectCardProps = {
  name: string;
  noteCount: number;
  accentColor: string;
  active?: boolean;
  onPress?: () => void;
};

export function SubjectCard({ name, noteCount, accentColor, active = false, onPress }: SubjectCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: active ? accentColor : `${accentColor}AA` },
        active && styles.cardActive,
        pressed && styles.cardPressed,
      ]}
    >
      <LinearGradient
        colors={[
          active ? `${accentColor}22` : `${accentColor}12`,
          'rgba(7, 5, 13, 0.96)',
          'rgba(20, 10, 24, 0.72)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      />
      <View style={styles.planetGlow} />
      <View style={styles.topRow}>
        <View style={[styles.accentChip, { backgroundColor: accentColor }]} />
        <Text style={[styles.countText, { color: accentColor }]}>{noteCount} notes</Text>
      </View>

      <Text style={styles.name}>{name}</Text>

      <View style={styles.footerRow}>
        <Text style={styles.footerLabel}>Collection</Text>
        <Text style={[styles.footerValue, { color: accentColor }]}>{active ? 'Active' : 'Open'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 178,
    minHeight: 150,
    padding: 16,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: '#08050D',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardActive: {
    shadowColor: '#FF8427',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 3,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  planetGlow: {
    position: 'absolute',
    right: -44,
    bottom: -44,
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accentChip: {
    width: 44,
    height: 7,
    borderRadius: 999,
  },
  countText: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  name: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.size.xl,
    lineHeight: typography.lineHeight.xl,
    textTransform: 'uppercase',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLabel: {
    color: '#928A94',
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.sm,
  },
  footerValue: {
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
