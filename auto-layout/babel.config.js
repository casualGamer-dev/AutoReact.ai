// Didn't exist before - Metro/Expo were falling back to some implicit
// default. react-native-reanimated's worklets (useAnimatedStyle etc., used
// by components/AnimatedPressable.js and the entering animations in
// displaySketches1.js/reviewDetections.js) need its babel plugin explicitly
// configured, and it must be listed last per reanimated's own docs.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
