import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { code as ink, marksOnInk, spacing, typography } from '../theme/tokens';

// Opening sequence: the five element marks the app recognises land one after
// another, then the wordmark and the promise settle in beneath them, then the
// whole screen lifts away to the app. Ink from the first frame, so it takes
// over from the native splash (same near-black) without a flash.
const TOTAL_MS = 2000;
const REDUCED_MS = 700;

// width of each bar echoes how big that element typically is on paper
const BARS = [
  { type: 'Text', width: 96 },
  { type: 'Textfield', width: 196 },
  { type: 'Button', width: 132 },
  { type: 'Image', width: 148 },
  { type: 'Switch', width: 72 },
];

// Runs inside useAnimatedStyle (UI thread), so it must be a worklet.
function range(t, from, to) {
  'worklet';
  return interpolate(t, [from, to], [0, 1], Extrapolation.CLAMP);
}

function Bar({ index, bar, t }) {
  const start = 0.06 + index * 0.075;
  const mark = marksOnInk[bar.type];
  const style = useAnimatedStyle(() => {
    const p = range(t.value, start, start + 0.16);
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * 14 }, { scaleX: 0.7 + 0.3 * p }],
    };
  });
  return (
    <Animated.View style={[styles.bar, { width: bar.width, borderColor: mark.color }, style]}>
      <Text style={[styles.abbr, { color: mark.color }]}>{mark.abbr}</Text>
    </Animated.View>
  );
}

export default function Splash({ fontReady, onDone }) {
  const t = useSharedValue(0);
  const [reduced, setReduced] = useState(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
  }, []);

  useEffect(() => {
    if (reduced === null) return;
    t.value = withTiming(
      1,
      { duration: reduced ? REDUCED_MS : TOTAL_MS, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(onDone)();
      }
    );
  }, [reduced]);

  const wordmark = useAnimatedStyle(() => {
    const p = range(t.value, 0.52, 0.7);
    return { opacity: p, transform: [{ translateY: (1 - p) * 10 }] };
  });
  const tagline = useAnimatedStyle(() => ({ opacity: range(t.value, 0.68, 0.84) }));
  const exit = useAnimatedStyle(() => ({ opacity: 1 - range(t.value, 0.93, 1) }));

  // Reduce Motion: no travel, no stagger - everything simply present.
  const still = reduced === true;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, exit]}
      accessibilityLabel="autoreact. Paper to code, offline."
      accessibilityRole="header"
    >
      <View style={styles.stack}>
        {BARS.map((bar, i) => (
          <Bar key={bar.type} index={i} bar={still ? { ...bar } : bar} t={still ? { value: 1 } : t} />
        ))}
      </View>
      <Animated.Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.wordmark, still ? null : wordmark, fontReady ? null : styles.hidden]}
      >
        &lt;autoreact/&gt;
      </Animated.Text>
      <Animated.Text style={[styles.tagline, still ? null : tagline]}>PAPER → CODE · OFFLINE</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: ink.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  stack: {
    width: 220,
    marginBottom: spacing.xl,
  },
  bar: {
    height: 28,
    borderWidth: 1.5,
    borderRadius: 4,
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginBottom: spacing.sm,
  },
  abbr: {
    ...typography.slug,
    fontSize: 12,
  },
  wordmark: {
    ...typography.brand,
    fontSize: 40,
    lineHeight: 64, // this face is tall; the default line box clipped it
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    maxWidth: '100%',
    color: ink.text,
  },
  hidden: {
    opacity: 0,
  },
  tagline: {
    ...typography.slug,
    color: ink.gutter,
    marginTop: spacing.sm,
  },
});
