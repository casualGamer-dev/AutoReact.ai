import Logo from '../components/logo';
import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, KeyboardAvoidingView } from 'react-native';
import { api } from '../api/client';
import { adoptGuestAndSync } from '../lib/sync';
import Screen from '../components/Screen';
import Button from '../components/Button';
import TextField from '../components/TextField';
import Typography from '../components/Typography';
import { colors, spacing } from '../theme/tokens';

export default class Login extends React.Component {
  state = {
    email: '',
    password: '',
    message: ''
  };

  loginUser = async () => {
    const { email, password } = this.state;

    if (email === '' || password === '') {
      this.setState({ message: 'Please fill out both fields' });
      return;
    }

    try {
      await api.login(email, password);
      await adoptGuestAndSync();
      this.props.navigation.navigate('ListSketches');
    } catch (error) {
      console.warn('Login Error:', error.message);
      // A status means the server answered: only a 401 is a credentials problem.
      // No status means the request never got there.
      this.setState({
        message: error.status === 401
          ? 'Incorrect email or password.'
          : error.status
            ? 'Something went wrong on our side. Try again in a moment.'
            : "Can't reach the server. Check your connection. Your sketches work offline."
      });
    }
  };

  signup = () => {
    this.props.navigation.navigate('Signup');
  };

  render() {
    return (
      <Screen>
        <KeyboardAvoidingView style={styles.container} behavior="padding">
          <Logo />
          <View style={styles.formContainer}>
            <TextField
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              onChangeText={(text) => this.setState({ email: text })}
              value={this.state.email}
            />

            <TextField
              label="Password"
              placeholder="Password"
              secureTextEntry={true}
              autoCapitalize="none"
              returnKeyType="go"
              onChangeText={(text) => this.setState({ password: text })}
              value={this.state.password}
            />

            {this.state.message ? <Typography.ErrorText style={styles.error}>{this.state.message}</Typography.ErrorText> : null}

            <Button style={styles.button} onPress={this.loginUser}>Sign in</Button>
          </View>

          <Typography.Caption style={styles.why}>Optional. Sign in to sync sketches and use Enhance.</Typography.Caption>
          <View style={styles.singupTextContent}>
            <Typography.Caption>New here?</Typography.Caption>
            <TouchableOpacity onPress={this.signup}>
              <Text style={styles.singupButton}>Create account</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  formContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  button: {
    width: '100%',
    marginVertical: spacing.sm,
  },
  error: {
    marginVertical: spacing.sm,
  },
  why: {
    textAlign: 'center',
    marginTop: spacing.md,
  },
  singupTextContent: {
    flexDirection: 'row',
    paddingBottom: spacing.lg,
  },
  singupButton: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
});
