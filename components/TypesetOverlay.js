import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { code as ink } from '../theme/tokens';

// The signature moment: on "Looks good" the screen goes to ink and every mark
// lifts off the photo and settles into a line of code, in reading order.
// Marks are drawn at their on-screen positions (item.x/y/w/h) and travel to a
// left-aligned stack where they read as the first tokens of the file.
const ROW_H = 26;
const TOP = 36;
const LEFT = 64;
const MAX_ROWS = 14;
const STAGGER = 45;
const DUR = 450;
const BG_MS = 350;
const TOKEN_W = { Text: 96, Textfield: 168, Button: 128, Image: 112, Switch: 120 };

export function typesetDuration(count) {
  return BG_MS + Math.min(count, MAX_ROWS) * STAGGER + DUR + 120;
}

function Mark({ item, index }) {
  const p = useSharedValue(0);
  const row = Math.min(index, MAX_ROWS);
  const tx = LEFT;
  const ty = TOP + row * ROW_H;
  const tw = TOKEN_W[item.type] || 110;
  const th = 16;

  useEffect(() => {
    p.value = withDelay(
      BG_MS * 0.5 + row * STAGGER,
      withTiming(1, { duration: DUR, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const box = useAnimatedStyle(() => ({
    position: 'absolute',
    left: interpolate(p.value, [0, 1], [item.x, tx]),
    top: interpolate(p.value, [0, 1], [item.y, ty]),
    width: interpolate(p.value, [0, 1], [item.w, tw]),
    height: interpolate(p.value, [0, 1], [item.h, th]),
    borderRadius: interpolate(p.value, [0, 1], [0, 4]),
    opacity: index > MAX_ROWS ? 1 - p.value : 1, // overflow rows dissolve instead of piling up
  }));
  const fill = useAnimatedStyle(() => ({ opacity: p.value }));

  return (
    <Animated.View style={[{ borderWidth: 1.5, borderColor: item.color, overflow: 'hidden' }, box]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: item.color }, fill]} />
    </Animated.View>
  );
}

export default function TypesetOverlay({ items }) {
  const bg = useSharedValue(0);
  useEffect(() => {
    bg.value = withTiming(1, { duration: BG_MS });
  }, []);
  const bgStyle = useAnimatedStyle(() => ({ opacity: bg.value }));

  return (
    <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: ink.background }, bgStyle]} />
      {items.map((it, i) => (
        <Mark key={i} item={it} index={i} />
      ))}
    </View>
  );
}
