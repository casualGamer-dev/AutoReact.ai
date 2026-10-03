import React from 'react';
import { StyleSheet, Text } from 'react-native';
import AnimatedPressable from './AnimatedPressable';
import { colors, spacing, radii, typography } from '../theme/tokens';

// Shared button primitive - replaces the button/buttonText StyleSheet pair
// that was duplicated (with drifting radii/shadows) in login.js, landing.js,
// sketchProfile.js, etc. Press feedback still comes from AnimatedPressable.
export default function Button({ variant = 'primary', disabled, style, textStyle, children, onPress, ...rest }) {
  return (
    <AnimatedPressable
      style={[styles.base, variantStyles[variant], style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      android_ripple={{ color: variant === 'primary' ? 'rgba(255,255,255,0.25)' : colors.primaryLight }}
      accessibilityState={{ disabled: !!disabled }}
      {...rest}
    >
      <Text style={[styles.text, variant === 'primary' ? styles.solidText : styles.tintedText, textStyle]}>
        {children}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    minHeight: 48,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.body,
    fontSize: 17,
    fontWeight: '600',
  },
  solidText: {
    color: colors.textOnPrimary,
  },
  tintedText: {
    color: colors.primary,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.sm,
  },
});
