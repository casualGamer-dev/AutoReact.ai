import React, { Component } from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Login from './pages/login';
import Singup from './pages/singup';
import Landing from './pages/landing';
import ReviewDetections from './pages/reviewDetections';
import Sketch from './pages/Sketch';
import ListSketches from './pages/displaySketches1';
import SketchProfile from './pages/sketchProfile';
import DisplayLayout from './pages/displayLayout';
import DisplaySourceCode from './pages/displaySourceCode';

import * as Font from 'expo-font';
import { colors, typography, shadow, isDark } from './theme/tokens';

const Stack = createStackNavigator();

// react-navigation paints its own card/background; without this the stack
// flashes the default light theme under the proof-white / ink schemes.
const navTheme = {
  dark: isDark,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.error,
  },
  fonts: {
    regular: { fontFamily: 'Roboto', fontWeight: '400' },
    medium: { fontFamily: 'Roboto', fontWeight: '500' },
    bold: { fontFamily: 'Roboto', fontWeight: '700' },
    heavy: { fontFamily: 'Roboto', fontWeight: '700' },
  },
};

// Screens no longer take a `db`/`email` initialParam - identity lives in the
// JWT session (api/client.js), not threaded through route params.
export default class Routes extends Component {
  state = {
    fontLoaded: false,
    // Always the sketch list: capture, review and code generation are
    // offline, so nobody is walled off behind Login. Signing in is optional
    // (Sync and Enhance) and reachable from the list's header.
    initialRoute: null,
  };

  async componentDidMount() {
    await Font.loadAsync({ 'System-code': require('./assets/fonts/code-regular.ttf') });
    this.setState({ fontLoaded: true, initialRoute: 'ListSketches' });
  }

  render() {
    if (!this.state.fontLoaded || !this.state.initialRoute) {
      return null;
    }

    return (
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          initialRouteName={this.state.initialRoute}
          screenOptions={{
            headerStyle: styles.header,
            headerTitleStyle: styles.navTitle,
            headerTintColor: colors.textPrimary,
          }}
        >
          <Stack.Screen
            name="Login"
            component={Login}
            options={{ title: 'Sign in' }}
          />
          <Stack.Screen
            name="Signup"
            component={Singup}
            options={{ title: 'Create account' }}
          />
          <Stack.Screen
            name="Sketch"
            component={Sketch}
            options={{ title: 'New Sketch' }}
          />
          <Stack.Screen
            name="ListSketches"
            component={ListSketches}
            options={{ title: 'Sketches', headerLeft: () => null }}
          />
          <Stack.Screen
            name="Landing"
            component={Landing}
            options={{ title: 'Capture' }}
          />
          <Stack.Screen
            name="ReviewDetections"
            component={ReviewDetections}
            options={{ title: 'Review' }}
          />
          <Stack.Screen
            name="SketchProfile"
            component={SketchProfile}
            options={{ title: 'Sketch Results' }}
          />
          <Stack.Screen
            name="DisplayLayout"
            component={DisplayLayout}
            options={{ title: 'Layout' }}
          />
          <Stack.Screen
            name="DisplaySourceCode"
            component={DisplaySourceCode}
            options={{ title: 'Source Code' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }
}

const styles = StyleSheet.create({
  // Flat proof-white bar with a hairline rule - the galley's running head,
  // not a colored brand slab.
  header: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    ...shadow.header,
  },
  navTitle: {
    ...typography.body,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
