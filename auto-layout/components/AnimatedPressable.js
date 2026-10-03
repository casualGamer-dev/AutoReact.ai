import React from 'react';
import { Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

// Drop-in replacement for TouchableOpacity's flat opacity-only feedback - a
// small scale-down on press, springing back on release. react-native-reanimated
// is already a project dependency (pulled in for screen transitions); this is
// the actual RN equivalent of what GSAP would do on web, since GSAP itself
// doesn't run in React Native (no DOM/CSS to animate).
export default function AnimatedPressable({ style, children, onPressIn, onPressOut, disabled, ...rest }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (e) => {
    scale.value = withTiming(0.96, { duration: 100 });
    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e) => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    if (onPressOut) onPressOut(e);
  };

  return (
    <AnimatedPressableBase
      style={[style, animatedStyle, disabled && { opacity: 0.5 }]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...rest}
    >
      {children}
    </AnimatedPressableBase>
  );
}
