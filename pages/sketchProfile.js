import React, { Component } from 'react';
import { StyleSheet, View, useWindowDimensions, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api } from '../api/client';
import { getLocal, saveLocal, mergeFromServer } from '../lib/localStore';
import Screen from '../components/Screen';
import Button from '../components/Button';
import TextField from '../components/TextField';
import Typography from '../components/Typography';
import StatusView from '../components/StatusView';
import CompareSlider from '../components/CompareSlider';
import LayoutPreview from '../components/LayoutPreview';
import { colors, spacing } from '../theme/tokens';

// Detection now completes synchronously on-device (landing.js), so this screen
// no longer polls Firestore waiting for a Cloud Function - it either receives
// the result directly via route.params (fresh capture) or fetches the saved
// doc once (reopening an older sketch from history). The "Enhance" step is the
// only thing that still touches the network here, and it's non-blocking: it
// fires in the background, times out fast, and fails silently if offline.
class SketchProfile extends Component {
  state = {
    isLoading: false,
    isEmpty: false,
    imageUri: '',
    predictions: [],
    width: 0,
    height: 0,
    code: '',
    enhancedCode: '',
    enhancedTheme: null,
    enhancedLabels: null,
    enhancing: false,
    enhanceError: '',
    styleInstruction: '',
    needsSignIn: false,
  };

  componentDidMount() {
    const { sketchId, predictions, imageUri, width, height, code } = this.props.route.params;

    if (predictions) {
      this.setState({ imageUri, predictions, width, height, code, isEmpty: predictions.length === 0 });
      this.loadCachedEnhance(sketchId);
    } else {
      this.loadSketch(sketchId);
    }

    this.backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      this.goBack();
      return true;
    });
  }

  componentWillUnmount() {
    if (this.backHandler) this.backHandler.remove();
  }

  // Reopening a sketch (from the list, or a deep link) - localStore is
  // checked first so this works offline for anything ever created or synced
  // on this device. The server is only consulted for a sketch this device
  // has never seen (e.g. synced from elsewhere), and the result is cached
  // locally so the next open is offline-safe too.
  loadSketch = async (sketchId) => {
    this.setState({ isLoading: true });

    const local = await getLocal(sketchId);
    if (local) {
      this.setState({
        imageUri: local.image_url,
        predictions: local.predictions,
        width: local.width,
        height: local.height,
        code: local.code,
        enhancedCode: local.enhanced_code,
        enhancedTheme: local.enhanced_theme,
        enhancedLabels: local.enhanced_labels,
        isEmpty: local.predictions.length === 0,
        isLoading: false,
      });
      if (!local.enhanced_code) this.loadCachedEnhance(sketchId);
      return;
    }

    try {
      const sketch = await api.getSketch(sketchId);
      await mergeFromServer(sketch);
      this.setState({
        imageUri: sketch.image_url,
        predictions: sketch.predictions,
        width: sketch.width,
        height: sketch.height,
        code: sketch.code,
        enhancedCode: sketch.enhanced_code,
        enhancedTheme: sketch.enhanced_theme,
        enhancedLabels: sketch.enhanced_labels,
        isEmpty: sketch.predictions.length === 0,
        isLoading: false,
      });
      if (!sketch.enhanced_code) this.loadCachedEnhance(sketchId);
    } catch (err) {
      console.error(err);
      this.setState({ isLoading: false, isEmpty: true });
    }
  };

  // Enhance never runs on its own: opening a sketch must not upload it or call
  // Gemini. This only restores a previous Enhance result from the device cache
  // (no network), so reopening an enhanced sketch still shows it offline.
  loadCachedEnhance = async (sketchId) => {
    const cached = await AsyncStorage.getItem(`enhance:${sketchId}`);
    if (!cached) return;
    try {
      const { code: enhancedCode, theme, labels } = JSON.parse(cached);
      this.setState({ enhancedCode, enhancedTheme: theme, enhancedLabels: labels });
    } catch {
      this.setState({ enhancedCode: cached });
    }
  };

  // instruction: optional free-text styling direction ("more minimalist", "dark
  // mode") from the input in render(). Plain calls (no instruction) use the
  // AsyncStorage cache and skip a repeat network call; an instruction always
  // re-runs, since the user is explicitly asking for a different result.
  // userInitiated: true only when triggered by the "Go" button (restyle()) -
  // that call should tell the user *something* on failure. The automatic
  // background call on screen load stays silent by design (see class comment)
  // so a bare offline reopen doesn't greet the user with an error.
  maybeEnhance = async (sketchId, instruction, { userInitiated = false } = {}) => {
    if (userInitiated) this.setState({ enhanceError: '', needsSignIn: false });

    const cacheKey = `enhance:${sketchId}`;
    if (!instruction) {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        // Older cache entries (pre theme/labels) are a bare code string, not
        // JSON - fall back to treating them as offline-theme code rather than
        // crashing on JSON.parse.
        try {
          const { code: enhancedCode, theme, labels } = JSON.parse(cached);
          this.setState({ enhancedCode, enhancedTheme: theme, enhancedLabels: labels });
        } catch {
          this.setState({ enhancedCode: cached });
        }
        return;
      }
    }

    // Enhance runs on the server, so it needs an account.
    if (!(await api.getEmail())) {
      if (userInitiated) this.setState({ enhanceError: 'Enhance needs an account. Your sketch stays on this phone until you sign in.', needsSignIn: true });
      return;
    }

    // /enhance is keyed by the server's Mongo _id, not the client-generated
    // local id (sketchId here) - sending the local id crashed the server
    // (Sketch.findOne({_id: <non-ObjectId>}) threw outside any try/catch).
    // Until this sketch has synced (image + predictions on R2/Mongo), there's
    // nothing for Gemini to read anyway, so skip rather than guess.
    const local = await getLocal(sketchId);
    const serverId = local?.serverId;
    if (!serverId) {
      if (userInitiated) this.setState({ enhanceError: "Still syncing to the server - try again in a moment." });
      return;
    }

    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      if (userInitiated) this.setState({ enhanceError: "You're offline - can't enhance right now." });
      return; // offline is a normal path, not an error
    }

    this.setState({ enhancing: true });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const { enhanced_code, theme, labels } = await api.enhance(serverId, { signal: controller.signal, instruction });
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ code: enhanced_code, theme, labels }));
      // best-effort - sketch may not be local yet if it's mid-sync
      await saveLocal(sketchId, { enhanced_code, enhanced_theme: theme, enhanced_labels: labels }).catch(() => {});
      this.setState({ enhancedCode: enhanced_code, enhancedTheme: theme, enhancedLabels: labels });
    } catch (err) {
      console.warn('enhance skipped (offline/slow/failed, keeping local result):', err.message);
      if (userInitiated) {
        this.setState({
          enhanceError:
            err.name === 'AbortError' ? 'Enhance timed out. Try again.'
            : err.status === 401 ? 'Your session expired. Sign in again to use Enhance.'
            : err.status ? 'Enhance failed on the server. Try again in a moment.'
            : "Can't reach the server. Check your connection.",
          needsSignIn: err.status === 401,
        });
      }
    } finally {
      clearTimeout(timeout);
      this.setState({ enhancing: false });
    }
  };

  restyle = () => {
    const { sketchId } = this.props.route.params;
    this.maybeEnhance(sketchId, this.state.styleInstruction.trim(), { userInitiated: true });
  };

  goBack() {
    this.props.navigation.navigate('ListSketches');
  }

  displayLayout = () => {
    const { predictions, width, height, enhancedCode, enhancedTheme, enhancedLabels } = this.state;
    this.props.navigation.navigate('DisplayLayout', {
      predictions,
      width,
      height,
      enhancedCode,
      theme: enhancedTheme,
      labels: enhancedLabels,
    });
  };

  displayCode = () => {
    const { code, enhancedCode } = this.state;
    const { sname } = this.props.route.params;
    this.props.navigation.navigate('DisplaySourceCode', { sname, code, enhancedCode });
  };

  render() {
    const { isLoading, isEmpty, imageUri, code, enhancing, enhancedCode, enhanceError, styleInstruction, predictions, width, height, enhancedTheme, enhancedLabels } = this.state;
    const frameW = this.props.windowWidth - spacing.lg * 2;
    const aspect = width && height ? width / height : 0.75;
    const frameH = Math.min(frameW / aspect, this.props.windowHeight * 0.42);

    return (
      <Screen>
        {isLoading ? (
          <StatusView image={require('../assets/ml.png')} text="Please wait while your sketch is being processed." loading />
        ) : isEmpty ? (
          <StatusView image={require('../assets/no_predictions.png')} text="No results found" />
        ) : (
          <View style={styles.content}>
            <View style={styles.imageWrap}>
              <CompareSlider imageUri={imageUri} width={frameW} height={frameH}>
                <LayoutPreview predictions={predictions} theme={enhancedTheme} labels={enhancedLabels} />
              </CompareSlider>
            </View>
            <View style={styles.statusRow}>
              {enhancing ? <Typography.Slug>Enhancing…</Typography.Slug> : null}
              {enhancedCode ? <Typography.Slug>Enhanced copy ready</Typography.Slug> : null}
              {enhanceError ? <Typography.ErrorText>{enhanceError}</Typography.ErrorText> : null}
              {this.state.needsSignIn ? (
                <Button variant="ghost" onPress={() => this.props.navigation.navigate('Login')}>Sign in</Button>
              ) : null}
            </View>
            {code ? (
              <Button style={styles.button} onPress={this.displayCode}>View code</Button>
            ) : (
              <Typography.Caption>No code available</Typography.Caption>
            )}
            <Button variant="secondary" style={styles.button} onPress={this.displayLayout}>Preview layout</Button>
            <View style={styles.restyleRow}>
              <View style={styles.restyleInput}>
                <TextField
                  label="Optional · restyle with Enhance"
                  placeholder="e.g. dark mode, minimalist"
                  value={styleInstruction}
                  onChangeText={(text) => this.setState({ styleInstruction: text })}
                />
              </View>
              <Button variant="secondary" style={styles.restyleButton} onPress={this.restyle} disabled={enhancing}>Enhance</Button>
            </View>
          </View>
        )}
      </Screen>
    );
  }
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'stretch',
    width: '100%',
  },
  imageWrap: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  statusRow: {
    minHeight: 32,
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  button: {
    marginVertical: spacing.xs,
  },
  restyleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.md,
  },
  restyleInput: {
    flex: 1,
    marginRight: spacing.sm,
  },
  restyleButton: {
    marginBottom: spacing.sm,
  },
});

// Class component: window size comes in as props so rotation / split-screen re-layout.
export default function SketchProfileScreen(props) {
  const { width, height } = useWindowDimensions();
  return <SketchProfile {...props} windowWidth={width} windowHeight={height} />;
}
