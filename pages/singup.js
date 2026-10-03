import React, { Component } from 'react';
import { StyleSheet, View, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import Logo from '../components/logo';
import { api } from '../api/client';
import { adoptGuestAndSync } from '../lib/sync';
import Screen from '../components/Screen';
import Button from '../components/Button';
import TextField from '../components/TextField';
import Typography from '../components/Typography';
import { colors, spacing } from '../theme/tokens';

export default class Signup extends Component {
  state = {
    email: '',
    password: '',
    message: '',
  };

  createUser = async () => {
    const { email, password } = this.state;
    const { navigation } = this.props;

    if (email === "" || password === "") {
      this.setState({ message: 'Enter an email and a password.' });
      return;
    }

    try {
      await api.signup(email, password);
      await adoptGuestAndSync();
      navigation.navigate('ListSketches');
    } catch (error) {
      console.warn('Signup Error:', error.message);
      this.setState({
        message: error.status
          ? error.message
          : "Can't reach the server. Check your connection. Your sketches work offline."
      });
    }
  };

  goBack = () => {
    this.props.navigation.goBack();
  };

  render() {
    return (
      <Screen>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <Logo width={120} height={120} />
          <TextField
            style={styles.input}
            underlineColorAndroid="rgba(0,0,0,0)"
            label="Email"
            placeholder="you@example.com"
            selectionColor={colors.primary}
            keyboardType="email-address"
            autoCapitalize="none"
            onSubmitEditing={() => this.password.focus()}
            ref={(input) => (this.email = input)}
            onChangeText={(text) => this.setState({ email: text })}
          />
          <TextField
            style={styles.input}
            underlineColorAndroid="rgba(0,0,0,0)"
            label="Password"
            placeholder="Password"
            secureTextEntry={true}
            autoCapitalize="none"
            ref={(input) => (this.password = input)}
            onChangeText={(text) => this.setState({ password: text })}
          />
          {this.state.message ? <Typography.ErrorText>{this.state.message}</Typography.ErrorText> : null}
          <Button style={styles.button} onPress={this.createUser}>Create account</Button>
          <View style={styles.signupTextContent}>
            <Typography.Caption>Already have an account?</Typography.Caption>
            <TouchableOpacity onPress={this.goBack}>
              <Typography.Caption style={styles.signupButton}>Sign In</Typography.Caption>
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
  input: {
    width: '100%',
  },
  signupTextContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingBottom: spacing.lg,
    flexDirection: 'row',
  },
  signupButton: {
    color: colors.primary,
    fontWeight: '600',
    marginHorizontal: spacing.xs,
    paddingVertical: spacing.md,
  },
  button: {
    width: '100%',
    marginVertical: spacing.sm,
  },
});
