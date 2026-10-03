import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import Screen from '../components/Screen';
import Typography from '../components/Typography';
import Segmented from '../components/Segmented';
import LayoutPreview from '../components/LayoutPreview';
import { colors, spacing, radii } from '../theme/tokens';

export default function DisplayLayout({ route }) {
  const { predictions = [], enhancedCode, theme, labels } = route.params;
  const [showEnhanced, setShowEnhanced] = useState(!!enhancedCode);

  const activeTheme = showEnhanced ? theme : null;
  const activeLabels = showEnhanced ? labels : null;

  return (
    <Screen padded={false} center={false} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {enhancedCode ? (
          <Segmented
            value={showEnhanced}
            onChange={setShowEnhanced}
            options={[{ label: 'Offline', value: false }, { label: 'Enhanced', value: true }]}
          />
        ) : null}

        <Typography.Caption style={styles.caption}>Live preview · placeholder copy until Enhanced</Typography.Caption>

        <View style={styles.card}>
          <LayoutPreview predictions={predictions} theme={activeTheme} labels={activeLabels} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'flex-start',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  caption: {
    marginBottom: spacing.md,
  },
  card: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
