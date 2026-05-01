import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { SharedNoteCard } from './SharedNoteCard';
import { colors, typography } from '../theme';
import type { DirectMessage } from '../types';

type MessageBubbleProps = {
  message: DirectMessage;
  mine: boolean;
  onOpenNote?: (message: DirectMessage) => void;
};

export function MessageBubble({ message, mine, onOpenNote }: MessageBubbleProps) {
  const entrance = useRef(new Animated.Value(0)).current;
  const formattedDate = formatBubbleDate(message.createdAt);

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const animatedStyle = {
    opacity: entrance,
    transform: [
      {
        translateY: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
      {
        scale: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [0.98, 1],
        }),
      },
    ],
  };

  if (message.messageType === 'note') {
    return (
      <Animated.View style={[styles.row, mine ? styles.rowMine : styles.rowOther, animatedStyle]}>
        <SharedNoteCard
          note={message.sharedNote}
          errorMessage={message.noteLoadError}
          timestamp={message.createdLabel}
          mine={mine}
          onPress={() => onOpenNote?.(message)}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.row, mine ? styles.rowMine : styles.rowOther, animatedStyle]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
        <LinearGradient
          colors={
            mine
              ? ['rgba(255, 138, 26, 0.2)', 'rgba(34, 16, 6, 0.94)', 'rgba(255, 138, 26, 0.12)']
              : ['rgba(166, 92, 255, 0.2)', 'rgba(9, 6, 20, 0.94)', 'rgba(76, 46, 122, 0.12)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bubbleGradient}
        />
        <View style={[styles.corner, mine ? styles.cornerMine : styles.cornerOther]} />

        <Text style={[styles.content, mine ? styles.contentMine : styles.contentOther]}>
          {message.content}
        </Text>

        <View style={styles.metaRow}>
          <Text style={[styles.timestamp, mine ? styles.timestampMine : styles.timestampOther]}>
            {formattedDate}  •  {message.createdLabel}
          </Text>
          {mine ? <Ionicons name="checkmark-done" size={16} color={colors.primarySoft} /> : null}
        </View>
      </View>
    </Animated.View>
  );
}

function formatBubbleDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date
    .toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase();
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
  },
  rowMine: {
    alignItems: 'flex-end',
  },
  rowOther: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 19,
    paddingVertical: 17,
    gap: 13,
    overflow: 'hidden',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 4,
  },
  bubbleMine: {
    borderColor: 'rgba(255, 138, 26, 0.88)',
    backgroundColor: 'rgba(36, 16, 6, 0.95)',
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  bubbleOther: {
    borderColor: 'rgba(166, 92, 255, 0.68)',
    backgroundColor: 'rgba(12, 8, 28, 0.95)',
    shadowColor: '#A66BFF',
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  bubbleGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  corner: {
    position: 'absolute',
    width: 14,
    height: 14,
    top: -1,
  },
  cornerMine: {
    right: -1,
    backgroundColor: colors.primary,
  },
  cornerOther: {
    left: -1,
    backgroundColor: '#A66BFF',
  },
  content: {
    fontFamily: typography.fontFamily.bodyRegular,
    fontSize: 18,
    lineHeight: 26,
  },
  contentMine: {
    color: colors.text,
  },
  contentOther: {
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  timestamp: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timestampMine: {
    color: colors.primarySoft,
  },
  timestampOther: {
    color: '#C89BFF',
  },
});
