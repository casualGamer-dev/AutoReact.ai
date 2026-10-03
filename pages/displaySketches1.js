import React, { Component } from 'react';
import { StyleSheet, Text, View, Image, Alert, ScrollView, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { genId, listLocal, removeLocal, mergeFromServer, saveLocal } from '../lib/localStore';
import { enqueueDelete, enqueuePush } from '../lib/sync';
import { addScreenToApp, createApp, listApps } from '../lib/appStore';
import OptionsButton from '../components/optionsButton';
import AccountButton from '../components/accountButton';
import Typography from '../components/Typography';
import AnimatedPressable from '../components/AnimatedPressable';
import Screen from '../components/Screen';
import Button from '../components/Button';
import TextField from '../components/TextField';
import Segmented from '../components/Segmented';
import StatusView from '../components/StatusView';
import PromptModal from '../components/PromptModal';
import SheetModal from '../components/SheetModal';
import { colors, spacing, radii, typography } from '../theme/tokens';

const prettyName = (name) => String(name || '').replace(/_/g, ' ');

class Card extends Component {
  render() {
    // Staggered entrance (small per-index delay) instead of the whole grid
    // popping in at once - index comes from the .map() call site below.
    return (
      <Animated.View style={styles.cardCell} entering={FadeInDown.delay((this.props.index || 0) * 60).springify()}>
        <AnimatedPressable onPress={this.props.onPress} onLongPress={this.props.onLongPress}>
          <View style={styles.cardContainer}>
            <View style={styles.card}>
              {this.props.children}
            </View>
          </View>
        </AnimatedPressable>
      </Animated.View>
    );
  }
}

// Local-first: localStore is always read first (instant, works offline);
// if online, the server list is fetched in the background and anything not
// already known on this device is merged in (covers reinstall / a second
// device). Refetches on focus rather than a live listener, matching the old
// Firestore onSnapshot -> fetch-on-focus migration this screen already went through.
export default class DisplaySketches1 extends React.Component {
  focusUnsubscribe = null;

  state = {
    sketches: [],
    apps: [],
    loaded: false,
    signedIn: false,
    mode: 'sketches', // 'sketches' | 'apps'
    query: '',
    actionFor: null, // sketch whose long-press menu is open
    renameFor: null,
    addToAppFor: null,
    newAppFor: undefined, // undefined = closed, null = plain new app, sketch = new app holding it
  };

  componentDidMount() {
    this.fetchSketches();
    this.focusUnsubscribe = this.props.navigation.addListener('focus', this.fetchSketches);
    this.props.navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AccountButton onChange={this.fetchSketches} />
          <OptionsButton onDeleted={this.fetchSketches} />
        </View>
      ),
    });
  }

  componentWillUnmount() {
    if (this.focusUnsubscribe) this.focusUnsubscribe();
  }

  fetchSketches = async () => {
    const email = await api.getEmail();
    const [local, apps] = await Promise.all([listLocal(), listApps()]);
    this.setState({ sketches: local, apps, loaded: true, signedIn: !!email });

    // The server list only exists for signed-in users; a guest's sketches are local.
    if (!email) return;
    const net = await NetInfo.fetch();
    if (!net.isConnected) return;

    try {
      const remote = await api.listSketches();
      await Promise.all(remote.map((s) => mergeFromServer(s)));
      this.setState({ sketches: await listLocal() });
    } catch (err) {
      console.warn('Could not refresh sketches from server (showing local list):', err.message);
    }
  };

  newSketch = () => {
    this.props.navigation.navigate('Sketch');
  };

  showDetails = (sketch) => {
    this.props.navigation.navigate('SketchProfile', { sketchId: sketch._id, sname: sketch.name });
  };

  confirmDelete = (sketch) => {
    Alert.alert(
      'Remove ' + prettyName(sketch.name),
      'Are you sure you want to delete this sketch?',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => this.removeSketch(sketch) },
      ],
      { cancelable: true },
    );
  };

  removeSketch = async (sketch) => {
    await removeLocal(sketch._id);
    await enqueueDelete(sketch._id, sketch.serverId);
    this.fetchSketches();
  };

  rename = async (sketch, name) => {
    await saveLocal(sketch._id, { name: name.replace(/ /g, '_') });
    this.setState({ renameFor: null });
    this.fetchSketches();
  };

  // A copy is a new local sketch: same photo, marks and code, no server link yet.
  duplicate = async (sketch) => {
    const copy = await saveLocal(genId(), {
      name: `${sketch.name}_copy`,
      image_url: sketch.image_url,
      predictions: sketch.predictions,
      num_predictions: sketch.num_predictions,
      code: sketch.code,
      width: sketch.width,
      height: sketch.height,
      enhanced_code: sketch.enhanced_code,
      enhanced_theme: sketch.enhanced_theme,
      enhanced_labels: sketch.enhanced_labels,
    });
    enqueuePush(copy._id);
    this.fetchSketches();
  };

  addToApp = async (sketch, app) => {
    await addScreenToApp(app._id, sketch._id);
    this.fetchSketches();
    Alert.alert('Added', `"${prettyName(sketch.name)}" is now a screen of ${app.name}.`);
  };

  makeApp = async (name) => {
    const holding = this.state.newAppFor;
    const app = await createApp(name);
    if (holding) await addScreenToApp(app._id, holding._id);
    this.setState({ newAppFor: undefined, mode: 'apps' });
    await this.fetchSketches();
    this.props.navigation.navigate('AppDetail', { appId: app._id });
  };

  syncLabel = (item) => {
    if (!this.state.signedIn) return 'On this phone';
    return item.synced ? 'Synced' : 'Waiting to sync';
  };

  renderSketches() {
    const { sketches, query } = this.state;
    const q = query.trim().toLowerCase();
    const shown = q ? sketches.filter((s) => prettyName(s.name).toLowerCase().includes(q)) : sketches;
    return (
      <ScrollView style={styles.grid} contentContainerStyle={styles.gridContent} keyboardShouldPersistTaps="handled">
        {sketches.length > 3 ? (
          <TextField
            label="Search"
            placeholder="Find a sketch by name"
            value={query}
            onChangeText={(text) => this.setState({ query: text })}
            returnKeyType="search"
          />
        ) : null}
        {q && shown.length === 0 ? (
          <Typography.Caption style={styles.none}>No sketch matches "{query.trim()}".</Typography.Caption>
        ) : null}
        <View style={styles.gridRow}>
          {shown.map((item, index) => (
            <Card
              key={item._id}
              index={index}
              onPress={() => this.showDetails(item)}
              onLongPress={() => this.setState({ actionFor: item })}
            >
              {item.image_url ? (
                <Image style={styles.image} source={{ uri: item.image_url }} resizeMode="contain" resizeMethod="resize" />
              ) : (
                <View style={[styles.image, styles.noPhoto]}>
                  <Ionicons name="camera-outline" size={32} color={colors.textSecondary} />
                </View>
              )}
              <Text style={styles.title} numberOfLines={2}>{prettyName(item.name)}</Text>
              <Text style={styles.slug}>
                {item.image_url ? `${item.num_predictions ?? (item.predictions ? item.predictions.length : 0)} marks` : 'No photo yet'}
              </Text>
              <Text style={[styles.slug, styles.slugLast]}>{this.syncLabel(item)}</Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    );
  }

  renderApps() {
    const { apps, sketches } = this.state;
    if (apps.length === 0) {
      return (
        <View style={styles.appsEmpty}>
          <Typography.Heading style={styles.emptyTitle}>One app, many screens</Typography.Heading>
          <Typography.Body style={styles.appsEmptyText}>
            Group sketches into an app: a login, a home, a settings screen. You get one runnable app with a tab bar between them.
          </Typography.Body>
          <Button style={styles.button} onPress={() => this.setState({ newAppFor: null })}>Create your first app</Button>
        </View>
      );
    }
    return (
      <ScrollView style={styles.grid} contentContainerStyle={styles.gridContent}>
        {apps.map((app) => {
          const screens = sketches
            .filter((s) => s.appId === app._id)
            .sort((a, b) => (a.appOrder || 0) - (b.appOrder || 0));
          const cover = screens.find((s) => s.image_url);
          return (
            <Pressable
              key={app._id}
              style={({ pressed }) => [styles.appRow, pressed && styles.appRowPressed]}
              onPress={() => this.props.navigation.navigate('AppDetail', { appId: app._id })}
              accessibilityRole="button"
              accessibilityLabel={`${app.name}, ${screens.length} screens`}
            >
              {cover ? (
                <Image style={styles.appThumb} source={{ uri: cover.image_url }} resizeMode="cover" resizeMethod="resize" />
              ) : (
                <View style={[styles.appThumb, styles.noPhoto]}>
                  <Ionicons name="albums-outline" size={26} color={colors.textSecondary} />
                </View>
              )}
              <View style={styles.appText}>
                <Text style={styles.appName} numberOfLines={1}>{app.name}</Text>
                <Text style={styles.slug}>{screens.length} {screens.length === 1 ? 'screen' : 'screens'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  render() {
    const { sketches, apps, loaded, mode, actionFor, renameFor, addToAppFor, newAppFor } = this.state;
    const nothingYet = loaded && sketches.length === 0 && apps.length === 0;

    return (
      <Screen padded={false} center={false}>
        {nothingYet ? (
          <StatusView image={require('../assets/no_results_found.png')}>
            <Typography.Heading style={styles.emptyTitle}>Paper to React Native</Typography.Heading>
            <View style={styles.steps}>
              {[
                'Draw a screen on paper with the five elements.',
                'Photograph it. Detection runs on your phone, no signal needed.',
                'Fix any marks, then copy the code.',
              ].map((line, i) => (
                <View key={i} style={styles.step}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                  <Typography.Body style={styles.stepText}>{line}</Typography.Body>
                </View>
              ))}
            </View>
            <Button style={styles.button} onPress={this.newSketch}>Start your first sketch</Button>
          </StatusView>
        ) : (
          <View style={styles.flex}>
            <View style={styles.modeBar}>
              <Segmented
                value={mode}
                onChange={(v) => this.setState({ mode: v })}
                options={[{ label: 'Sketches', value: 'sketches' }, { label: 'Apps', value: 'apps' }]}
              />
            </View>
            {mode === 'sketches' ? this.renderSketches() : this.renderApps()}
            <AnimatedPressable
              style={styles.fab}
              onPress={mode === 'apps' ? () => this.setState({ newAppFor: null }) : this.newSketch}
              accessibilityRole="button"
              accessibilityLabel={mode === 'apps' ? 'New app' : 'New sketch'}
            >
              <Ionicons name="add" size={28} color={colors.textOnPrimary} />
            </AnimatedPressable>
          </View>
        )}

        <SheetModal
          visible={!!actionFor}
          title={actionFor ? prettyName(actionFor.name) : ''}
          onClose={() => this.setState({ actionFor: null })}
          options={
            actionFor
              ? [
                  { label: 'Rename', onPress: () => this.setState({ renameFor: actionFor }) },
                  { label: 'Duplicate', onPress: () => this.duplicate(actionFor) },
                  { label: 'Add to an app', onPress: () => this.setState({ addToAppFor: actionFor }) },
                  { label: 'Delete', destructive: true, onPress: () => this.confirmDelete(actionFor) },
                ]
              : []
          }
        />
        <SheetModal
          visible={!!addToAppFor}
          title="Add to an app"
          onClose={() => this.setState({ addToAppFor: null })}
          options={
            addToAppFor
              ? [
                  ...apps.map((app) => ({ label: app.name, onPress: () => this.addToApp(addToAppFor, app) })),
                  { label: 'New app…', onPress: () => this.setState({ newAppFor: addToAppFor }) },
                ]
              : []
          }
        />
        <PromptModal
          visible={!!renameFor}
          title="Rename sketch"
          label="Name"
          initial={renameFor ? prettyName(renameFor.name) : ''}
          onCancel={() => this.setState({ renameFor: null })}
          onSubmit={(name) => this.rename(renameFor, name)}
        />
        <PromptModal
          visible={newAppFor !== undefined}
          title="New app"
          label="App name"
          initial=""
          confirmLabel="Create"
          onCancel={() => this.setState({ newAppFor: undefined })}
          onSubmit={this.makeApp}
        />
      </Screen>
    );
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modeBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  button: {
    width: '100%',
    maxWidth: 320,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  steps: {
    width: '100%',
    maxWidth: 320,
    marginBottom: spacing.lg,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  stepNum: {
    ...typography.slug,
    fontSize: 14,
    width: 24,
    paddingTop: 2,
    color: colors.primary,
  },
  stepText: {
    flex: 1,
    fontWeight: '400',
  },
  grid: {
    flex: 1,
  },
  gridContent: {
    padding: spacing.sm,
    paddingBottom: 88, // clears the new-sketch button
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  none: {
    padding: spacing.md,
  },
  cardCell: {
    width: '50%',
  },
  cardContainer: {
    width: '100%',
    padding: spacing.xs,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'Roboto',
    padding: spacing.sm,
    paddingBottom: spacing.xs,
    color: colors.textPrimary,
  },
  noPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  slug: {
    ...typography.slug,
    paddingHorizontal: spacing.sm,
  },
  slugLast: {
    paddingBottom: spacing.sm,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
  },
  appRowPressed: { backgroundColor: colors.surface },
  appThumb: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    marginRight: spacing.md,
    backgroundColor: colors.surface,
  },
  appText: { flex: 1 },
  appName: {
    ...typography.body,
    fontSize: 17,
    fontWeight: '700',
  },
  appsEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  appsEmptyText: {
    textAlign: 'center',
    fontWeight: '400',
    marginBottom: spacing.lg,
    maxWidth: 320,
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 16,
    elevation: 3,
  },
});
