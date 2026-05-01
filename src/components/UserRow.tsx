import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, typography } from '../theme';

type UserRowProps = {
  title: string;
  subtitle: string;
  helper?: string;
  initials: string;
  isActive?: boolean;
  showPresence?: boolean;
  accentColor?: string;
  badgeLabel?: string;
  unreadCount?: number;
  onPress?: () => void;
  actionLabel?: string;
  onActionPress?: () => void;
};

export function UserRow({
  actionLabel,
  accentColor = colors.primary,
  badgeLabel,
  helper,
  initials,
  isActive = false,
  onActionPress,
  onPress,
  showPresence = false,
  subtitle,
  title,
  unreadCount = 0,
}: UserRowProps) {
  const content = (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(168, 85, 247, 0.13)', 'rgba(255, 138, 26, 0.06)', 'rgba(4, 3, 11, 0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.rowGradient}
      />

      <View style={[styles.avatar, { borderColor: accentColor, shadowColor: accentColor }]}>
        <Text style={styles.avatarText}>{initials}</Text>
        {showPresence ? (
          <View style={[styles.onlineDot, isActive ? styles.onlineDotActive : styles.onlineDotOffline]} />
        ) : null}
      </View>

      <View style={styles.copy}>
        <View style={styles.topLine}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {badgeLabel ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeLabel}</Text>
            </View>
          ) : null}
        </View>

        <Text numberOfLines={1} style={styles.subtitle}>
          {subtitle}
        </Text>

        {helper ? (
          <Text numberOfLines={1} style={styles.helper}>
            {helper}
          </Text>
        ) : null}

        {showPresence ? (
          <View style={styles.presenceRow}>
            <View style={[styles.presenceDot, isActive ? styles.presenceDotActive : styles.presenceDotOffline]} />
            <Text style={[styles.presenceText, isActive ? styles.presenceTextActive : styles.presenceTextOffline]}>
              {isActive ? 'Active now' : 'Offline'}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.trailing}>
        {unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        ) : null}

        {actionLabel && onActionPress ? (
          <Pressable
            onPress={onActionPress}
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
          >
            <Text style={styles.actionButtonText}>{actionLabel}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primarySoft} />
          </Pressable>
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.44)',
    backgroundColor: 'rgba(8, 6, 18, 0.92)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#A855F7',
    shadowOpacity: 0.17,
    shadowRadius: 18,
    elevation: 4,
  },
  rowPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  rowGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 17,
    borderWidth: 1,
    backgroundColor: 'rgba(12, 8, 28, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.34,
    shadowRadius: 14,
    elevation: 5,
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#07040F',
  },
  onlineDotActive: {
    backgroundColor: '#17E88C',
  },
  onlineDotOffline: {
    backgroundColor: 'rgba(145, 132, 151, 0.72)',
  },
  avatarText: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.lg,
    textTransform: 'uppercase',
  },
  copy: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.lg,
  },
  subtitle: {
    color: colors.primary,
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.sm,
  },
  helper: {
    color: colors.textMuted,
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: typography.size.sm,
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presenceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  presenceDotActive: {
    backgroundColor: '#17E88C',
  },
  presenceDotOffline: {
    backgroundColor: 'rgba(145, 132, 151, 0.7)',
  },
  presenceText: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.xs,
  },
  presenceTextActive: {
    color: '#8EFFC6',
  },
  presenceTextOffline: {
    color: 'rgba(199, 186, 205, 0.58)',
  },
  badge: {
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.55)',
    backgroundColor: 'rgba(255, 138, 26, 0.08)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  badgeText: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 8,
  },
  unreadBadge: {
    minWidth: 26,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: colors.background,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 26, 0.68)',
    backgroundColor: 'rgba(255, 138, 26, 0.08)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 9,
    shadowColor: '#FF8A1A',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  actionButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  actionButtonText: {
    color: colors.primarySoft,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
