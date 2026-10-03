import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, Image, Text, TouchableOpacity, useWindowDimensions, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';

import { ELEMENT_TYPES } from '../lib/elementTypes';
import { sortIntoRows } from '../lib/layoutSort';
import { generateCode } from '../lib/codeGen';
import { getLocal, saveLocal } from '../lib/localStore';
import { appScreens } from '../lib/appStore';
import { enqueuePush, enqueueCorrections } from '../lib/sync';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Typography from '../components/Typography';
import TextField from '../components/TextField';
import MarkEditor from '../components/MarkEditor';
import TypesetOverlay, { typesetDuration } from '../components/TypesetOverlay';
import { haptics } from '../lib/haptics';
import { colors, marks, spacing, radii, typography } from '../theme/tokens';

// Typical size of each element as a fraction of the photo (medians from the
// training set), used when the user adds a mark the detector missed.
const DEFAULT_SIZE = {
  Text: { w: 0.22, h: 0.06 },
  Textfield: { w: 0.6, h: 0.08 },
  Button: { w: 0.4, h: 0.07 },
  Image: { w: 0.45, h: 0.22 },
  Switch: { w: 0.14, h: 0.045 },
};

// Box of `type` centered on (cx, cy), in original-photo pixels, kept inside the photo.
function boxAt(type, cx, cy, imgW, imgH) {
  const w = DEFAULT_SIZE[type].w * imgW;
  const h = DEFAULT_SIZE[type].h * imgH;
  const x0 = Math.min(Math.max(0, cx - w / 2), imgW - w);
  const y0 = Math.min(Math.max(0, cy - h / 2), imgH - h);
  return { x0, y0, x1: x0 + w, y1: y0 + h, width: w, height: h };
}

// Sits between landing.js's raw on-device detection and everything downstream:
// lets the user tap a wrong mark and pick the right class from a labelled
// tray before code gets generated. A 342-image model will misfire sometimes -
// this is the safety net, and it doubles as free labeled training data (see
// api.submitCorrections below / server's Correction model) for a future retrain.
export default function ReviewDetections({ route }) {
  const { sketchId, sname, imageUri, predictions: initialPredictions, width: originalWidth, height: originalHeight, detectMs } = route.params;
  const [predictions, setPredictions] = useState(initialPredictions);
  const [corrections, setCorrections] = useState([]); // { index, from, to, box }
  // Indices into `predictions` for marks the user removed as spurious
  // detections - kept as a set of indices rather than splicing the array so
  // setClass/corrections (also indexed against initialPredictions) don't
  // need to be renumbered every time something's deleted.
  const [deletedIndices, setDeletedIndices] = useState(() => new Set());
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [typeset, setTypeset] = useState(null); // marks flying into code, set on confirm
  const reduceMotion = React.useRef(false);
  const scrollY = React.useRef(0);
  const headerH = React.useRef(0);
  const navigation = useNavigation();
  const [siblings, setSiblings] = useState([]); // other screens of this sketch's app, for "goes to"
  const scrollRef = React.useRef(null);

  useEffect(() => {
    (async () => {
      const me = await getLocal(sketchId);
      if (me && me.appId) setSiblings((await appScreens(me.appId)).filter((s) => s._id !== sketchId));
    })();
  }, [sketchId]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduceMotion.current = v; });
    // the "it saw my sketch" moment, timed with the first marks landing
    const t = setTimeout(haptics.marksAppear, 250);
    return () => clearTimeout(t);
  }, []);

  const { width: displayWidth } = useWindowDimensions();
  const scale = displayWidth / originalWidth;
  const displayHeight = originalHeight * scale;

  // Tap on the photo in add mode: drop a Text-sized mark centered on the tap
  // and open the tray so the user picks its real type right away.
  const addMark = (locationX, locationY) => {
    const cx = locationX / scale;
    const cy = locationY / scale;
    const index = predictions.length;
    setPredictions((prev) => [
      ...prev,
      { object: 'Text', accuracy: 1, added: true, ...boxAt('Text', cx, cy, originalWidth, originalHeight) },
    ]);
    setAddMode(false);
    setSelected(index);
    haptics.add();
  };

  const setClass = (index, nextType) => {
    const original = initialPredictions[index];
    haptics.correct();

    setPredictions((prev) => {
      const next = [...prev];
      const cur = next[index];
      // A user-added mark has no detector guess to correct: resize it to the
      // new type's typical size around the same center instead.
      const resized = cur.added
        ? boxAt(nextType, (cur.x0 + cur.x1) / 2, (cur.y0 + cur.y1) / 2, originalWidth, originalHeight)
        : null;
      next[index] = { ...cur, object: nextType, ...resized };
      return next;
    });

    if (!original) return; // added marks are not detector corrections

    setCorrections((prev) => {
      const withoutThis = prev.filter((c) => c.index !== index);
      if (nextType === original.object) return withoutThis; // back to what the model said - not a correction anymore
      return [...withoutThis, { index, from: original.object, to: nextType, box: original }];
    });
  };

  // Move / resize from MarkEditor: screen px in, photo px stored.
  const editBox = (index, b) => {
    setPredictions((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        x0: b.x / scale,
        y0: b.y / scale,
        x1: (b.x + b.w) / scale,
        y1: (b.y + b.h) / scale,
        width: b.w / scale,
        height: b.h / scale,
      };
      return next;
    });
  };

  const patchMark = (index, fields) => {
    setPredictions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...fields };
      return next;
    });
  };

  const deleteBox = (index) => {
    setDeletedIndices((prev) => new Set(prev).add(index));
    setSelected(null);
    haptics.remove();
  };

  const undoDeletes = () => setDeletedIndices(new Set());

  // Writes the finished sketch to localStore (source of truth, works
  // offline) and queues the server push instead of racing a single network
  // attempt - sync.js retries until it lands, so a sketch confirmed offline
  // isn't lost the way the old one-shot syncInBackground would lose it.
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    const activePredictions = predictions.filter((_, i) => !deletedIndices.has(i));
    const rows = sortIntoRows(activePredictions);
    const code = generateCode(rows, { name: sname, imageWidth: originalWidth });

    // Marks lift off the photo and settle into lines of code (skipped when the
    // user has Reduce Motion on, or there is nothing to typeset).
    let animDone = Promise.resolve();
    if (!reduceMotion.current && activePredictions.length > 0) {
      const ordered = [...activePredictions].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
      setTypeset(
        ordered.map((p) => ({
          type: p.object,
          color: (marks[p.object] || {}).color || colors.textPrimary,
          x: p.x0 * scale,
          y: headerH.current + p.y0 * scale - scrollY.current,
          w: p.width * scale,
          h: p.height * scale,
        }))
      );
      animDone = new Promise((resolve) => setTimeout(resolve, typesetDuration(activePredictions.length)));
    }

    try {
      await saveLocal(sketchId, {
        image_url: imageUri,
        predictions: activePredictions,
        num_predictions: activePredictions.length,
        code,
        width: originalWidth,
        height: originalHeight,
      });
    } catch (e) {
      setTypeset(null);
      setBusy(false);
      throw e;
    }
    enqueuePush(sketchId);

    // A deleted mark's class correction (if any) no longer means anything -
    // the mark itself was wrong, not just its label.
    const activeCorrections = corrections.filter((c) => !deletedIndices.has(c.index));
    if (activeCorrections.length > 0) {
      enqueueCorrections(
        sketchId,
        activeCorrections.map((c) => ({
          originalObject: c.from,
          correctedObject: c.to,
          x0: c.box.x0,
          y0: c.box.y0,
          x1: c.box.x1,
          y1: c.box.y1,
        }))
      );
    }

    await animDone;
    haptics.typeset();
    navigation.navigate('SketchProfile', {
      sketchId,
      sname,
      imageUri,
      predictions: activePredictions,
      width: originalWidth,
      height: originalHeight,
      code,
    });
    setBusy(false);
    setTimeout(() => setTypeset(null), 600); // after the screen transition, so Back returns to a clean review
  };

  const activeCount = predictions.length - deletedIndices.size;
  const sel = selected !== null ? predictions[selected] : null;

  return (
    <Screen padded={false} center={false}>
      <View style={styles.slugBar} onLayout={(e) => { headerH.current = e.nativeEvent.layout.height; }}>
        <View style={styles.slugText}>
          <Typography.Slug>
            {activeCount} {activeCount === 1 ? 'mark' : 'marks'} · {corrections.length} corrected
          </Typography.Slug>
          {detectMs ? (
            <Typography.Slug style={styles.badge}>On-device · {detectMs} ms · offline</Typography.Slug>
          ) : null}
          <Typography.Caption>
            {addMode ? 'Tap the photo where the missing element is.' : 'Tap a mark to set its type and text.'}
          </Typography.Caption>
        </View>
        <TouchableOpacity
          style={styles.undo}
          onPress={() => {
            setAddMode((m) => !m);
            setSelected(null);
          }}
          accessibilityRole="button"
          accessibilityLabel={addMode ? 'Cancel adding a mark' : 'Add a missing mark'}
        >
          <Text style={styles.undoText}>{addMode ? 'Cancel' : '+ Add'}</Text>
        </TouchableOpacity>
        {deletedIndices.size > 0 ? (
          <TouchableOpacity
            style={styles.undo}
            onPress={undoDeletes}
            accessibilityRole="button"
            accessibilityLabel={`Restore ${deletedIndices.size} removed marks`}
          >
            <Text style={styles.undoText}>Restore {deletedIndices.size}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        scrollEnabled={!dragging}
        scrollEventThrottle={16}
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
      >
        <View style={{ width: displayWidth, height: displayHeight }}>
          <Image source={{ uri: imageUri }} style={{ width: displayWidth, height: displayHeight }} resizeMode="contain" resizeMethod="resize" />
          {predictions.map((p, i) => {
            if (deletedIndices.has(i)) return null;
            const mark = marks[p.object] || { color: colors.textPrimary, abbr: '???' };
            const top = p.y0 * scale;
            const flagInside = true; // inside the box: the flag stays part of the tap target
            return (
              // Marks land one after another: the "it saw my sketch" moment.
              <Animated.View
                key={i}
                entering={FadeIn.delay(i * 70).duration(250)}
                style={{
                  position: 'absolute',
                  left: p.x0 * scale,
                  top,
                  width: p.width * scale,
                  height: p.height * scale,
                }}
              >
                {selected === i ? (
                  <MarkEditor
                    box={{ x: p.x0 * scale, y: p.y0 * scale, w: p.width * scale, h: p.height * scale }}
                    bounds={{ w: displayWidth, h: displayHeight }}
                    color={mark.color}
                    abbr={mark.abbr}
                    onChange={(b) => editBox(i, b)}
                    onGesture={setDragging}
                  />
                ) : (
                <TouchableOpacity
                  onPress={() => {
                    setSelected(i);
                    scrollRef.current?.scrollTo({ y: Math.max(0, top - 60), animated: true });
                  }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.object} mark ${i + 1}. Tap to change type or remove.`}
                  style={[styles.box, { borderColor: mark.color }, selected === i && styles.boxSelected]}
                >
                  <Text
                    style={[
                      styles.flag,
                      flagInside ? styles.flagInside : styles.flagAbove,
                      { backgroundColor: mark.color },
                    ]}
                  >
                    {mark.abbr}
                  </Text>
                </TouchableOpacity>
                )}
              </Animated.View>
            );
          })}
          {addMode ? (
            <TouchableOpacity
              activeOpacity={1}
              style={styles.addLayer}
              onPress={(e) => addMark(e.nativeEvent.locationX, e.nativeEvent.locationY)}
              accessibilityRole="button"
              accessibilityLabel="Photo. Tap where the missing element is."
            />
          ) : null}
        </View>
      </ScrollView>

      {sel ? (
        <View style={styles.tray}>
         <ScrollView style={styles.trayScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.trayHead}>
            <View style={styles.trayTitle}>
              <Typography.Slug>Mark {selected + 1} is a…</Typography.Slug>
              <Typography.Caption>Drag it to move. Pull the dot to resize.</Typography.Caption>
            </View>
            <TouchableOpacity
              onPress={() => setSelected(null)}
              style={styles.trayClose}
              accessibilityRole="button"
              accessibilityLabel="Close mark tray"
            >
              <Text style={styles.trayCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chips}>
            {ELEMENT_TYPES.map((type) => {
              const on = sel.object === type;
              const mark = marks[type];
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => setClass(selected, type)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.chip, { borderColor: mark.color }, on && { backgroundColor: mark.color }]}
                >
                  <Text style={[styles.chipAbbr, { color: on ? colors.textOnPrimary : mark.color }]}>{mark.abbr}</Text>
                  <Text style={[styles.chipText, on && { color: colors.textOnPrimary }]}>{type}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => deleteBox(selected)}
              accessibilityRole="button"
              accessibilityLabel="Remove this mark"
              style={[styles.chip, styles.removeChip]}
            >
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>

          {sel.object === 'Text' || sel.object === 'Button' || sel.object === 'Textfield' ? (
            <TextField
              label={sel.object === 'Button' ? 'Text on the button' : sel.object === 'Textfield' ? 'Hint inside the field' : 'Text'}
              placeholder={sel.object === 'Button' ? 'Button' : sel.object === 'Textfield' ? 'e.g. Email' : 'Text'}
              value={sel.label || ''}
              onChangeText={(t) => patchMark(selected, { label: t })}
            />
          ) : null}

          {sel.object === 'Button' && siblings.length > 0 ? (
            <View>
              <Typography.Slug style={styles.goesLabel}>When tapped, go to</Typography.Slug>
              <View style={styles.chips}>
                {[{ _id: null, name: 'Nowhere' }, ...siblings].map((s) => {
                  const on = (sel.goesTo || null) === s._id;
                  return (
                    <TouchableOpacity
                      key={String(s._id)}
                      onPress={() => patchMark(selected, { goesTo: s._id })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[styles.chip, { borderColor: colors.primary }, on && { backgroundColor: colors.primary }]}
                    >
                      <Text style={[styles.chipText, on && { color: colors.textOnPrimary }]} numberOfLines={1}>
                        {String(s.name).replace(/_/g, ' ')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}
         </ScrollView>
        </View>
      ) : null}

      <Button style={styles.confirmButton} onPress={confirm} disabled={busy}>
        {busy ? 'Typesetting…' : activeCount === 0 ? 'Continue with no marks' : 'Looks good'}
      </Button>

      {typeset ? <TypesetOverlay items={typeset} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  slugBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  slugText: { flex: 1 },
  badge: { color: colors.primary, marginBottom: 2 },
  trayTitle: { flex: 1 },
  trayScroll: { maxHeight: 340 },
  goesLabel: { marginBottom: spacing.xs },
  undo: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm },
  undoText: { ...typography.slug, fontSize: 13, color: colors.primary, textTransform: 'uppercase' },
  box: {
    width: '100%',
    height: '100%',
    borderWidth: 1.5,
  },
  addLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primaryLight,
    opacity: 0.45,
  },
  boxSelected: {
    borderWidth: 3,
  },
  flag: {
    position: 'absolute',
    left: -1.5,
    ...typography.slug,
    fontSize: 12,
    color: colors.textOnPrimary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  flagAbove: { top: -18 },
  flagInside: { top: 0 },
  tray: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  trayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trayClose: { minHeight: 48, minWidth: 48, alignItems: 'flex-end', justifyContent: 'center' },
  trayCloseText: { ...typography.slug, fontSize: 13, color: colors.primary, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md - 2,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  chipAbbr: { ...typography.slug, fontSize: 12, marginRight: 6 },
  chipText: { ...typography.body, fontSize: 15, fontWeight: '600' },
  removeChip: { borderColor: colors.error },
  removeText: { ...typography.body, fontSize: 15, fontWeight: '600', color: colors.error },
  confirmButton: {
    margin: spacing.md,
  },
});
