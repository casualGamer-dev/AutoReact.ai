import { Vibration } from 'react-native';

// Short, sparing feedback for the moments that matter. Vibration is built into
// React Native (VIBRATE permission is already in the manifest) and silently
// does nothing on devices without a vibrator, so no capability checks here.
const buzz = (pattern) => {
  try {
    Vibration.vibrate(pattern);
  } catch {}
};

export const haptics = {
  marksAppear: () => buzz([0, 14, 70, 14]), // "it saw my sketch"
  correct: () => buzz(10),
  add: () => buzz(12),
  remove: () => buzz(22),
  typeset: () => buzz([0, 18, 50, 28]), // marks have become code
};
