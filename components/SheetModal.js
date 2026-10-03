import React, { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import Typography from './Typography';
import { colors, radii, spacing, typography } from '../theme/tokens';

// Bottom action sheet: a title and a list of full-width 56dp rows.
// options: [{ label, destructive?, onPress }]
//
// Drawn as an overlay inside the screen (render it as a child of <Screen>), not
// with React Native's <Modal>: on the new architecture a native Modal that is
// closed or unmounted can leave a ghost window that paints at (0,0) or keeps
// swallowing touches, which froze the app.
export default function SheetModal({ visible, title, options = [], onClose }) {
  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(150)} style={StyleSheet.absoluteFill}>
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(200)} style={styles.sheet}>
        {title ? <Typography.Slug style={styles.title} numberOfLines={1}>{title}</Typography.Slug> : null}
        <ScrollView bounces={false}>
          {options.map((opt) => (
            <Pressable
              key={opt.label}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => {
                onClose();
                opt.onPress();
              }}
              android_ripple={{ color: colors.primaryLight }}
              accessibilityRole="button"
            >
              <Text style={[styles.label, opt.destructive && styles.destructive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable style={[styles.row, styles.cancel]} onPress={onClose} accessibilityRole="button">
          <Text style={styles.label}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 50,
    elevation: 50, // Android orders siblings by elevation: stay above the + button
  },
  backdrop: { backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    maxHeight: '70%',
    paddingBottom: spacing.md,
  },
  title: { padding: spacing.md, paddingBottom: spacing.xs },
  row: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  pressed: { backgroundColor: colors.surface },
  cancel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  label: { ...typography.body, fontSize: 17 },
  destructive: { color: colors.error },
});
