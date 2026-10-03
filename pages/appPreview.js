import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appScreens, getApp } from '../lib/appStore';
import LayoutPreview from '../components/LayoutPreview';
import Screen from '../components/Screen';
import Typography from '../components/Typography';
import { colors, radii, spacing, typography } from '../theme/tokens';

const prettyName = (name) => String(name || '').replace(/_/g, ' ');

// The whole app as it will behave: pick a screen on the tab bar, see its layout
// rendered with real components. Mirrors the tab bar in the generated App.js.
export default function AppPreview({ route, navigation }) {
  const { appId } = route.params;
  const [screens, setScreens] = useState([]);
  const [active, setActive] = useState(0);

  const [appName, setAppName] = useState(null);

  useEffect(() => {
    (async () => {
      const [app, all] = await Promise.all([getApp(appId), appScreens(appId)]);
      setAppName(app ? app.name : null);
      setScreens(all.filter((s) => s.predictions && s.predictions.length > 0));
    })();
  }, [appId]);

  useEffect(() => {
    if (appName) navigation.setOptions({ title: `${appName} · preview` });
  }, [appName, navigation]);

  const current = screens[Math.min(active, screens.length - 1)];

  return (
    <Screen padded={false} center={false} style={styles.screen}>
      {current ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Typography.Caption style={styles.caption}>
            Screen {screens.indexOf(current) + 1} of {screens.length} · placeholder copy
          </Typography.Caption>
          <View style={styles.card}>
            <LayoutPreview predictions={current.predictions} theme={current.enhanced_theme} labels={current.enhanced_labels} />
          </View>
        </ScrollView>
      ) : (
        <View style={styles.body}>
          <Typography.Body style={styles.none}>No screen has marks yet.</Typography.Body>
        </View>
      )}

      <View style={styles.bar} accessibilityRole="tablist">
        {screens.map((s, i) => {
          const on = s === current;
          return (
            <Pressable
              key={s._id}
              style={styles.tab}
              onPress={() => setActive(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>{prettyName(s.name)}</Text>
              <View style={[styles.underline, on && styles.underlineOn]} />
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.surface },
  body: { flexGrow: 1, padding: spacing.md },
  caption: { marginBottom: spacing.md },
  none: { textAlign: 'center', marginTop: spacing.xl },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  label: { ...typography.slug, fontSize: 12 },
  labelOn: { color: colors.primary, fontWeight: '700' },
  underline: { height: 3, width: 24, borderRadius: 2, marginTop: 6, backgroundColor: 'transparent' },
  underlineOn: { backgroundColor: colors.primary },
});
