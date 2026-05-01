import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedImage = Animated.createAnimatedComponent(Image);

type ZoomableImageViewerProps = {
  accentColor: string;
  caption?: string;
  controlledScale?: number;
  height?: number;
  imageUrl: string;
  onScaleChanged?: (scale: number) => void;
  onSingleTap?: () => void;
  pageKey: string;
  width?: number;
};

export function ZoomableImageViewer({
  controlledScale,
  height,
  imageUrl,
  onScaleChanged,
  onSingleTap,
  pageKey,
  width,
}: ZoomableImageViewerProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    opacity.value = 0.35;
    opacity.value = withTiming(1, { duration: 180 });
  }, [opacity, pageKey, savedScale, scale, translateX, translateY]);

  useEffect(() => {
    if (typeof controlledScale !== 'number') {
      return;
    }

    const nextScale = Math.min(Math.max(controlledScale, 1), 4);
    savedScale.value = nextScale;
    scale.value = withTiming(nextScale, { duration: 160 });

    if (nextScale <= 1.02) {
      translateX.value = withTiming(0, { duration: 160 });
      translateY.value = withTiming(0, { duration: 160 });
    }
  }, [controlledScale, savedScale, scale, translateX, translateY]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const nextScale = Math.min(Math.max(savedScale.value * event.scale, 1), 4);
      scale.value = nextScale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;

      if (savedScale.value <= 1.02) {
        savedScale.value = 1;
        scale.value = withTiming(1, { duration: 120 });
        translateX.value = withTiming(0, { duration: 120 });
        translateY.value = withTiming(0, { duration: 120 });
      }

      if (onScaleChanged) {
        runOnJS(onScaleChanged)(savedScale.value);
      }
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value <= 1) {
        translateX.value = 0;
        translateY.value = 0;
        return;
      }

      translateX.value = panStartX.value + event.translationX;
      translateY.value = panStartY.value + event.translationY;
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        translateX.value = withTiming(0, { duration: 120 });
        translateY.value = withTiming(0, { duration: 120 });
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd(() => {
      const shouldZoomIn = savedScale.value <= 1.2;
      const nextScale = shouldZoomIn ? 2 : 1;

      savedScale.value = nextScale;
      scale.value = withTiming(nextScale, { duration: 140 });

      if (!shouldZoomIn) {
        translateX.value = withTiming(0, { duration: 140 });
        translateY.value = withTiming(0, { duration: 140 });
      }

      if (onScaleChanged) {
        runOnJS(onScaleChanged)(nextScale);
      }
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(240)
    .onEnd(() => {
      if (onSingleTap) {
        runOnJS(onSingleTap)();
      }
    });

  const combinedGesture = Gesture.Simultaneous(
    Gesture.Exclusive(doubleTapGesture, singleTapGesture),
    pinchGesture,
    panGesture
  );

  const animatedImageStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.container}>
      <GestureDetector gesture={combinedGesture}>
        <View
          style={[
            styles.zoomFrame,
            {
              height: height ?? '100%',
              width: width ?? '100%',
            },
          ]}
        >
          <AnimatedImage
            key={pageKey}
            source={{ uri: imageUrl }}
            style={[
              styles.zoomedImage,
              animatedImageStyle,
              {
                width: width ?? '100%',
                height: height ?? '100%',
              },
            ]}
            resizeMode="contain"
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  zoomFrame: {
    backgroundColor: '#090706',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  zoomedImage: {
    flex: 1,
  },
});
