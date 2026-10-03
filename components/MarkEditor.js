import React, { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../theme/tokens';

const MIN = 24; // smallest a mark can be dragged down to, in screen px

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

// The selected mark, made editable in place: drag the body to move it, pull the
// corner knob to resize it. Works in screen px against `bounds` (the photo);
// the parent converts back to photo pixels. onGesture(true/false) lets the
// parent freeze scrolling while a finger is down.
export default function MarkEditor({ box, bounds, color, abbr, onChange, onGesture }) {
  const live = useRef(box);
  const start = useRef(box);
  const cb = useRef({ onChange, onGesture });
  live.current = box;
  cb.current = { onChange, onGesture };

  const grab = () => {
    start.current = { ...live.current };
    cb.current.onGesture(true);
  };
  const drop = () => cb.current.onGesture(false);

  const body = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: grab,
        onPanResponderMove: (_, g) => {
          const s = start.current;
          cb.current.onChange({
            ...s,
            x: clamp(s.x + g.dx, 0, bounds.w - s.w),
            y: clamp(s.y + g.dy, 0, bounds.h - s.h),
          });
        },
        onPanResponderRelease: drop,
        onPanResponderTerminate: drop,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bounds.w, bounds.h]
  );

  const corner = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: grab,
        onPanResponderMove: (_, g) => {
          const s = start.current;
          cb.current.onChange({
            ...s,
            w: clamp(s.w + g.dx, MIN, bounds.w - s.x),
            h: clamp(s.h + g.dy, MIN, bounds.h - s.y),
          });
        },
        onPanResponderRelease: drop,
        onPanResponderTerminate: drop,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bounds.w, bounds.h]
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View
        {...body.panHandlers}
        style={[styles.body, { borderColor: color }]}
        accessible
        accessibilityLabel={`${abbr} mark selected. Drag to move.`}
      >
        <Text style={[styles.flag, { backgroundColor: color }]}>{abbr}</Text>
      </View>
      <View
        {...corner.panHandlers}
        style={styles.cornerHit}
        accessible
        accessibilityLabel={`Resize ${abbr} mark`}
      >
        <View style={[styles.knob, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    backgroundColor: 'rgba(31,79,209,0.10)',
  },
  flag: {
    position: 'absolute',
    top: 0,
    left: -1.5,
    ...typography.slug,
    fontSize: 12,
    color: colors.textOnPrimary,
    paddingHorizontal: 5,
    overflow: 'hidden',
  },
  // 48dp touch target centred on the box's bottom-right corner
  cornerHit: {
    position: 'absolute',
    width: 48,
    height: 48,
    right: -24,
    bottom: -24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
