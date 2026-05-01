import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../theme';

type ScreenPlaceholderProps = {
  label: string;
};

export function ScreenPlaceholder({ label }: ScreenPlaceholderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  label: {
    color: colors.text,
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.lg,
  },
});
