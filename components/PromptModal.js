import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Button from './Button';
import TextField from './TextField';
import Typography from './Typography';
import { colors, radii, spacing } from '../theme/tokens';

// A single-field dialog. React Native's Alert.prompt is iOS-only, so renaming
// and naming things on Android needs its own.
//
// Drawn as an overlay inside the screen (render it as a child of <Screen>), not
// with React Native's <Modal>: on the new architecture a native Modal that is
// closed or unmounted can leave a ghost window that paints at (0,0) or keeps
// swallowing touches, which froze the app.
export default function PromptModal({ visible, title, label, initial = '', confirmLabel = 'Save', onSubmit, onCancel }) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);

  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [visible, onCancel]);

  const submit = () => {
    if (value.trim()) onSubmit(value.trim());
  };

  if (!visible) return null;

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(150)} style={StyleSheet.absoluteFill}>
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onCancel} accessibilityLabel="Close dialog" />
      </Animated.View>
      <Animated.View entering={FadeIn.duration(150)} style={styles.card}>
        <Typography.Heading style={styles.title}>{title}</Typography.Heading>
        <TextField
          label={label}
          value={value}
          onChangeText={setValue}
          autoFocus
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <View style={styles.actions}>
          <Button variant="ghost" onPress={onCancel}>Cancel</Button>
          <Button onPress={submit} disabled={!value.trim()} style={styles.confirm}>{confirmLabel}</Button>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    padding: spacing.lg,
    zIndex: 50,
    elevation: 50, // Android orders siblings by elevation: stay above the + button
  },
  backdrop: { backgroundColor: colors.overlay },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  title: { marginBottom: spacing.md },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  confirm: { marginLeft: spacing.sm, minWidth: 96 },
});
