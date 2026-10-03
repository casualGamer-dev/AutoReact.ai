import React from 'react';
import { StyleSheet, View, Image, ActivityIndicator } from 'react-native';
import Typography from './Typography';
import { colors, spacing } from '../theme/tokens';

// The "centered image + message + optional spinner" pattern repeated in
// landing.js's uploading state and sketchProfile.js's loading/empty states.
export default function StatusView({ image, text, loading, children }) {
  return (
    <View style={styles.container}>
      {image ? (
        <View style={styles.sheet}>
          <Image style={styles.image} source={image} resizeMode="contain" />
        </View>
      ) : null}
      {text ? <Typography.Body style={styles.text}>{text}</Typography.Body> : null}
      {loading ? <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Legacy illustrations are dark ink on transparent: they sit on a proof-white
  // sheet so they stay legible under the dark scheme too.
  sheet: {
    backgroundColor: '#F3F5F8',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  image: {
    width: 160,
    height: 160,
  },
  text: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  spinner: {
    marginTop: spacing.sm,
  },
});
