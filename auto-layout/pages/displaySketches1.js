import React, { Component } from 'react';
import { StyleSheet, Text, View, Image, Alert, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import NetInfo from '@react-native-community/netinfo';
import { api } from '../api/client';
import { listLocal, removeLocal, mergeFromServer } from '../lib/localStore';
import { enqueueDelete } from '../lib/sync';
import OptionsButton from '../components/optionsButton';
import AccountButton from '../components/accountButton';
import Typography from '../components/Typography';
import AnimatedPressable from '../components/AnimatedPressable';
import Screen from '../components/Screen';
import Button from '../components/Button';
import StatusView from '../components/StatusView';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '../theme/tokens';

class Container extends Component {
  render() {
    return (
      <View style={styles.container2}>
        {this.props.children}
      </View>
    );
  }
}

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
    isEmpty: false,
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
    const local = await listLocal();
    this.setState({ sketches: local, isEmpty: local.length === 0 });

    // The server list only exists for signed-in users; a guest's sketches are local.
    if (!(await api.getEmail())) return;
    const net = await NetInfo.fetch();
    if (!net.isConnected) return;

    try {
      const remote = await api.listSketches();
      await Promise.all(remote.map((s) => mergeFromServer(s)));
      const merged = await listLocal();
      this.setState({ sketches: merged, isEmpty: merged.length === 0 });
    } catch (err) {
      console.error('Error fetching sketches from server (showing local list):', err);
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
      'Remove ' + sketch.name.replace(/_/g, " "),
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

  render() {
    const { sketches, isEmpty } = this.state;

    return (
      <Screen padded={false} center={false}>
        {isEmpty ? (
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
          <Container>
            <ScrollView style={styles.grid} contentContainerStyle={styles.gridContent}>
              <View style={styles.gridRow}>
                {sketches.map((item, index) => (
                  <Card
                    key={item._id}
                    index={index}
                    onPress={() => this.showDetails(item)}
                    onLongPress={() => this.confirmDelete(item)}
                  >
                    {item.image_url ? (
                      <Image style={styles.image} source={{ uri: item.image_url }} resizeMode="contain" />
                    ) : (
                      <View style={[styles.image, styles.noPhoto]}>
                        <Ionicons name="camera-outline" size={32} color={colors.textSecondary} />
                      </View>
                    )}
                    <Text style={styles.title} numberOfLines={2}>{item.name.replace(/_/g, " ")}</Text>
                    <Text style={styles.slug}>{item.image_url ? `${item.num_predictions ?? (item.predictions ? item.predictions.length : 0)} marks` : 'No photo yet'}</Text>
                  </Card>
                ))}
              </View>
            </ScrollView>
            <AnimatedPressable style={styles.fab} onPress={this.newSketch} accessibilityRole="button" accessibilityLabel="New sketch">
              <Ionicons name="add" size={28} color={colors.textOnPrimary} />
            </AnimatedPressable>
          </Container>
        )}
      </Screen>
    );
  }
}

const styles = StyleSheet.create({
  container2: {
    flex: 1,
    flexDirection: 'row',
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
  fabIcon: {
    resizeMode: 'contain',
    width: 28,
    height: 28,
    tintColor: colors.textOnPrimary,
  },
});
