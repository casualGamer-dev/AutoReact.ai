import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';

// Shared input primitive - replaces the inputBox/restyleInput styles
// duplicated across login.js, singup.js, and sketchProfile.js. Forwards
// `ref` to the underlying TextInput so singup.js's focus-next-field chain
// keeps working.
const TextField = React.forwardRef(function TextField({ label, error, style, ...rest }, ref) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        style={[styles.input, style]}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={label || rest.placeholder}
        selectionColor={colors.primary}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

export default TextField;

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  label: {
    ...typography.slug,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.textPrimary,
    marginVertical: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
});
