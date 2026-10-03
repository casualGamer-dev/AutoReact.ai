import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import { colors, spacing, typography } from '../theme/tokens';

// Header action for the sketch list. Signed out: "Sign in" (optional - needed
// only for sync and Enhance). Signed in: shows who, and offers Sign out.
export default function AccountButton({ onChange }) {
  const navigation = useNavigation();
  const [email, setEmail] = useState(null);

  useEffect(() => {
    const load = () => api.getEmail().then(setEmail);
    load();
    return navigation.addListener('focus', load);
  }, [navigation]);

  const press = () => {
    if (!email) {
      navigation.navigate('Login');
      return;
    }
    Alert.alert('Signed in', email, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await api.logout();
          setEmail(null);
          if (onChange) onChange();
        },
      },
    ]);
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={email ? `Account ${email}` : 'Sign in'}
    >
      <Text style={styles.text}>{email ? 'Account' : 'Sign in'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    ...typography.slug,
    fontSize: 13,
    color: colors.primary,
    textTransform: 'uppercase',
  },
});
