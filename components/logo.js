import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

// Wordmark set as a proof slug: mono name over a hairline rule, with the
// product's one-line promise as the running head.
export default class Logo extends React.Component {
  render() {
    return (
      <View style={styles.container} accessibilityRole="header" accessibilityLabel="auto layout. Paper to code, offline.">
        <Text style={styles.logoText}>&lt;auto layout/&gt;</Text>
        <View style={styles.rule} />
        <Text style={styles.slug}>PAPER → CODE · OFFLINE</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  logoText: {
    ...typography.brand,
    fontSize: 40,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  rule: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  slug: {
    ...typography.slug,
  },
});
