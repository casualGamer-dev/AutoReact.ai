import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, Switch, Image } from 'react-native';
import { sortIntoRows } from '../lib/layoutSort';
import { colors, spacing, radii } from '../theme/tokens';

// Live component preview from predictions - same row/col grouping the codegen
// path uses, rendered as real components instead of generated text.
// theme/labels are the same data enhance.js fed into codeGen.generateCode() to
// produce enhanced_code, so the preview mirrors the Offline/Enhanced toggle.

// Button text color follows the generated button's own fill (any hex from
// Enhance), not the app scheme, so it stays legible in light and dark.
function onFill(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.4 ? '#12151C' : '#FFFFFF';
}

function createUIElement(item, theme, labels, onNavigate) {
  const label = (labels && item._idx !== undefined ? labels[item._idx] : undefined) || item.label;
  const primaryColor = theme?.primaryColor || colors.primary;
  const borderRadius = theme?.borderRadius ?? radii.sm;

  switch (item.object) {
    case 'Textfield':
      return (
        <TextInput
          key={item._idx}
          style={[styles.input, { borderRadius }]}
          placeholder={label || 'Enter text here'}
          placeholderTextColor={colors.textSecondary}
          underlineColorAndroid="transparent"
        />
      );
    case 'Text':
      return <Text key={item._idx} style={styles.label}>{label || 'Lorem Ipsum'}</Text>;
    case 'Button':
      return (
        <TouchableOpacity
          key={item._idx}
          style={[styles.button, { backgroundColor: primaryColor, borderRadius }]}
          onPress={item.goesTo && onNavigate ? () => onNavigate(item.goesTo) : undefined}
        >
          <Text style={[styles.buttonText, { color: onFill(primaryColor) }]}>{label || 'Button'}</Text>
        </TouchableOpacity>
      );
    case 'Image':
      return <Image key={item._idx} style={[styles.img, { borderRadius }]} source={require('../assets/img-placeholder.png')} />;
    case 'Switch':
      return <Switch key={item._idx} style={styles.switch} thumbTintColor={primaryColor} />;
    default:
      return null;
  }
}

export default function LayoutPreview({ predictions = [], theme, labels, onNavigate }) {
  // _idx attached before sorting so it survives sortIntoRows' reordering -
  // matches how enhance.js tags predictions before generating labels
  // server-side, so labels[item._idx] lines up with the right element here.
  const rows = sortIntoRows(predictions.map((p, i) => ({ ...p, _idx: i })));
  return (
    <>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.rows}>
          {row.map((item) => createUIElement(item, theme, labels, onNavigate))}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  rows: {
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginVertical: spacing.xs + 2,
  },
  input: {
    flex: 1,
    minWidth: 120,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
    margin: spacing.xs + 2,
    paddingHorizontal: spacing.md - 2,
  },
  button: {
    margin: spacing.xs + 2,
    height: 44,
    minWidth: 110,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: 'Roboto',
  },
  switch: {
    margin: spacing.sm,
  },
  img: {
    width: 100,
    height: 100,
    margin: spacing.xs + 2,
    backgroundColor: colors.surface,
  },
  label: {
    margin: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: 'Roboto',
  },
});
