import type { ChangeEvent, RefObject } from 'react';
import type { CSSProperties } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, typography } from '../theme';

type WebFileInputProps = {
  accept: string;
  disabled?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  multiple?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

type UploadActionCardProps = {
  title: string;
  description: string;
  icon: string;
  accentColor: string;
  active?: boolean;
  onPress?: () => void;
  webFileInputProps?: WebFileInputProps;
};

export function UploadActionCard({
  title,
  description,
  icon,
  accentColor,
  active = false,
  onPress,
  webFileInputProps,
}: UploadActionCardProps) {
  return (
    <Pressable
      onPress={webFileInputProps ? undefined : onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: `${accentColor}77` },
        active && styles.cardActive,
        active && { borderColor: accentColor, shadowColor: accentColor },
        pressed && styles.cardPressed,
      ]}
    >
      <LinearGradient
        colors={[`${accentColor}18`, 'rgba(13, 8, 13, 0.95)', 'rgba(255, 132, 39, 0.06)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      />
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { backgroundColor: `${accentColor}16`, borderColor: `${accentColor}55` }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={[styles.accentBar, { backgroundColor: accentColor, shadowColor: accentColor }]} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      {webFileInputProps ? (
        <input
          ref={webFileInputProps.inputRef}
          aria-label={title}
          accept={webFileInputProps.accept}
          disabled={webFileInputProps.disabled}
          multiple={webFileInputProps.multiple}
          onChange={webFileInputProps.onChange}
          style={webFileInputStyle}
          type="file"
        />
      ) : null}
    </Pressable>
  );
}

const webFileInputStyle: CSSProperties = {
  cursor: 'pointer',
  height: '100%',
  inset: 0,
  opacity: 0,
  position: 'absolute',
  width: '100%',
  zIndex: 5,
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: '#100B10',
    padding: 18,
    gap: 18,
    overflow: 'hidden',
    shadowColor: '#8F2CFF',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  cardActive: {
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 4,
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: colors.text,
    fontFamily: typography.fontFamily.display,
    fontSize: 17,
    lineHeight: 20,
  },
  accentBar: {
    width: 34,
    height: 8,
    borderRadius: 999,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  copy: {
    gap: 8,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyBold,
    fontSize: 17,
    textTransform: 'uppercase',
  },
  description: {
    color: '#B4AAA8',
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 15,
    lineHeight: 21,
  },
});
