import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme/tokens';

// Before/after wipe: the user's photo on the left, the app it became on the
// right (children), split by a draggable handle. Opens on the photo, then
// sweeps to the middle once so the transformation is seen, not described.
export default function CompareSlider({ imageUri, width, height, children }) {
  const split = useRef(new Animated.Value(width)).current;
  const current = useRef(width);
  const startX = useRef(0);

  useEffect(() => {
    const id = split.addListener(({ value }) => { current.current = value; });
    return () => split.removeListener(id);
  }, [split]);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        split.setValue(width * 0.5);
        return;
      }
      split.setValue(width);
      Animated.timing(split, {
        toValue: width * 0.5,
        duration: 900,
        delay: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // animates layout (left/width)
      }).start();
    });
    return () => {
      cancelled = true;
      split.stopAnimation();
    };
  }, [width, split]);

  const clamp = (x) => Math.min(width, Math.max(0, x));

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          split.stopAnimation();
          startX.current = current.current;
        },
        onPanResponderMove: (_, g) => split.setValue(clamp(startX.current + g.dx)),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, split]
  );

  const nudge = (dir) =>
    Animated.timing(split, {
      toValue: clamp(current.current + dir * width * 0.25),
      duration: 160,
      useNativeDriver: false,
    }).start();

  return (
    <View style={[styles.frame, { width, height }]}>
      <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="contain" resizeMethod="resize" />

      <Animated.View pointerEvents="none" style={[styles.layer, { left: split }]}>
        <Animated.View style={[styles.inner, { width, height, left: Animated.multiply(split, -1) }]}>
          {children}
        </Animated.View>
      </Animated.View>

      <Text style={[styles.tag, styles.tagLeft]}>SKETCH</Text>
      <Text style={[styles.tag, styles.tagRight]}>APP</Text>

      <Animated.View
        {...pan.panHandlers}
        style={[styles.handle, { left: Animated.subtract(split, 24) }]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Compare sketch and app. Drag to reveal more of either."
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      >
        <View style={styles.line} />
        <View style={styles.knob}>
          <Ionicons name="swap-horizontal" size={22} color={colors.textOnPrimary} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  layer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  inner: {
    position: 'absolute',
    top: 0,
    padding: spacing.sm,
    overflow: 'hidden',
  },
  tag: {
    ...typography.slug,
    position: 'absolute',
    top: spacing.sm,
    paddingHorizontal: 6,
    backgroundColor: colors.overlay,
    color: '#FFFFFF',
    overflow: 'hidden',
    borderRadius: 4,
  },
  tagLeft: { left: spacing.sm },
  tagRight: { right: spacing.sm },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.primary,
  },
  knob: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
