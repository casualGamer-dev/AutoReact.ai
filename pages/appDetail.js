import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { listLocal } from '../lib/localStore';
import { appScreens, buildAppCode, deleteApp, getApp, moveScreen, removeScreenFromApp, renameApp, addScreenToApp } from '../lib/appStore';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Typography from '../components/Typography';
import PromptModal from '../components/PromptModal';
import SheetModal from '../components/SheetModal';
import { colors, radii, spacing, typography } from '../theme/tokens';

const prettyName = (name) => String(name || '').replace(/_/g, ' ');

// One app = an ordered list of screens (sketches). From here you add and order
// screens, preview the whole app, and get a single runnable App.js for it.
export default function AppDetail({ route, navigation }) {
  const { appId } = route.params;
  const [app, setApp] = useState(null);
  const [screens, setScreens] = useState([]);
  const [pickable, setPickable] = useState([]);
  const [renaming, setRenaming] = useState(false);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    const [a, s, all] = await Promise.all([getApp(appId), appScreens(appId), listLocal()]);
    setApp(a);
    setScreens(s);
    setPickable(all.filter((x) => !x.appId));
  }, [appId]);

  // Three small effects on purpose: loading, reloading on focus, and the header
  // title must not feed each other (setOptions re-renders the screen).
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);
  const appName = app ? app.name : null;
  useEffect(() => {
    if (appName) navigation.setOptions({ title: appName });
  }, [appName, navigation]);

  const usable = screens.filter((s) => s.predictions && s.predictions.length > 0);

  const viewCode = () => {
    const code = buildAppCode(app, screens);
    if (!code) {
      Alert.alert('Nothing to build yet', 'Add a screen and take its photo first.');
      return;
    }
    navigation.navigate('DisplaySourceCode', { sname: app.name.replace(/ /g, '_'), code });
  };

  const confirmDelete = () =>
    Alert.alert(
      `Delete ${app.name}?`,
      'The app is removed. Its screens stay in your sketches.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteApp(appId);
            navigation.goBack();
          },
        },
      ],
      { cancelable: true }
    );

  const mutate = (fn) => async () => {
    await fn();
    load();
  };

  if (!app) {
    return (
      <Screen>
        <Typography.Caption>This app no longer exists.</Typography.Caption>
      </Screen>
    );
  }

  return (
    <Screen padded={false} center={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Typography.Slug style={styles.count}>
          {screens.length} {screens.length === 1 ? 'screen' : 'screens'} · {usable.length} with marks
        </Typography.Slug>

        {screens.length === 0 ? (
          <Typography.Body style={styles.empty}>
            An app is a few screens in a row. Add the first one: draw it, photograph it, and it shows up here.
          </Typography.Body>
        ) : (
          screens.map((s, i) => (
            <View key={s._id} style={styles.row}>
              <Pressable
                style={styles.rowMain}
                onPress={() => navigation.navigate('SketchProfile', { sketchId: s._id, sname: s.name, appId })}
                accessibilityRole="button"
                accessibilityLabel={`${prettyName(s.name)}, screen ${i + 1}`}
              >
                {s.image_url ? (
                  <Image style={styles.thumb} source={{ uri: s.image_url }} resizeMode="cover" resizeMethod="resize" />
                ) : (
                  <View style={[styles.thumb, styles.noPhoto]}>
                    <Ionicons name="camera-outline" size={22} color={colors.textSecondary} />
                  </View>
                )}
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>{prettyName(s.name)}</Text>
                  <Text style={typography.slug}>
                    {s.image_url ? `${s.num_predictions || 0} marks` : 'No photo yet'}
                  </Text>
                </View>
              </Pressable>
              <IconButton
                name="chevron-up"
                label={`Move ${prettyName(s.name)} up`}
                disabled={i === 0}
                onPress={mutate(() => moveScreen(appId, s._id, -1))}
              />
              <IconButton
                name="chevron-down"
                label={`Move ${prettyName(s.name)} down`}
                disabled={i === screens.length - 1}
                onPress={mutate(() => moveScreen(appId, s._id, 1))}
              />
              <IconButton
                name="close"
                label={`Remove ${prettyName(s.name)} from the app`}
                onPress={mutate(() => removeScreenFromApp(s._id))}
              />
            </View>
          ))
        )}

        <Button variant="secondary" style={styles.btn} onPress={() => navigation.navigate('Sketch', { appId })}>
          Add a new screen
        </Button>
        <Button
          variant="ghost"
          style={styles.btn}
          onPress={() =>
            pickable.length ? setPicking(true) : Alert.alert('No loose sketches', 'Every sketch is already in an app.')
          }
        >
          Add an existing sketch
        </Button>

        <View style={styles.divider} />

        <Button style={styles.btn} disabled={usable.length === 0} onPress={() => navigation.navigate('AppPreview', { appId })}>
          Preview app
        </Button>
        <Button variant="secondary" style={styles.btn} disabled={usable.length === 0} onPress={viewCode}>
          View app code
        </Button>

        <View style={styles.footer}>
          <Button variant="ghost" onPress={() => setRenaming(true)}>Rename app</Button>
          <Button variant="ghost" textStyle={styles.danger} onPress={confirmDelete}>Delete app</Button>
        </View>
      </ScrollView>

      <PromptModal
        visible={renaming}
        title="Rename app"
        label="App name"
        initial={app.name}
        onCancel={() => setRenaming(false)}
        onSubmit={async (name) => {
          setRenaming(false);
          await renameApp(appId, name);
          load();
        }}
      />
      <SheetModal
        visible={picking}
        title="Add an existing sketch"
        onClose={() => setPicking(false)}
        options={pickable.map((s) => ({
          label: prettyName(s.name),
          onPress: async () => {
            await addScreenToApp(appId, s._id);
            load();
          },
        }))}
      />
    </Screen>
  );
}

function IconButton({ name, label, onPress, disabled }) {
  return (
    <Pressable
      style={[styles.icon, disabled && styles.iconDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Ionicons name={name} size={22} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  count: { marginBottom: spacing.md },
  empty: { fontWeight: '400', marginBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: spacing.sm, minHeight: 64 },
  thumb: { width: 48, height: 48, borderRadius: radii.sm, backgroundColor: colors.surface, marginRight: spacing.md },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowName: { ...typography.body, fontWeight: '700' },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  iconDisabled: { opacity: 0.3 },
  btn: { marginTop: spacing.sm },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  danger: { color: colors.error },
});
