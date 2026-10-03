import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, code, spacing, radii, typography } from '../theme/tokens';

// Two-or-more way switch (Offline / Enhanced). Was copy-pasted in
// displayLayout.js and displaySourceCode.js; one control now, with a visible
// selected state that does not depend on color alone (filled + ruled).
export default function Segmented({ options, value, onChange, tone = 'light' }) {
  const onInk = tone === 'ink';
  return (
    <View style={[styles.row, onInk && styles.rowInk]} accessibilityRole="tablist">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <TouchableOpacity
            key={String(opt.value)}
            style={[styles.item, selected && (onInk ? styles.itemSelectedInk : styles.itemSelected)]}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.text, onInk && styles.textInk, selected && (onInk ? styles.textSelectedInk : styles.textSelected)]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  rowInk: { borderColor: code.edge },
  item: {
    minHeight: 48,
    minWidth: 96,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemSelected: { backgroundColor: colors.primary },
  itemSelectedInk: { backgroundColor: code.accent },
  text: { ...typography.slug, fontSize: 13, color: colors.textPrimary, textTransform: 'uppercase' },
  textInk: { color: code.text },
  textSelected: { color: colors.textOnPrimary },
  textSelectedInk: { color: code.onAccent },
});
