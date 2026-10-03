import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/tokens';

// Safe-area + background wrapper - replaces each screen's own top-level
// <View style={styles.container}> with a consistent background/padding.
export default function Screen({ center = true, padded = true, style, children }) {
  return (
    <SafeAreaView
      style={[styles.safeArea, style && style.backgroundColor ? { backgroundColor: style.backgroundColor } : null]}
      edges={['bottom', 'left', 'right']}
    >
      <View
        style={[
          styles.container,
          center && styles.centered,
          padded && styles.padded,
          style,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
});
