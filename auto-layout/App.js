import React from 'react';
import { StyleSheet, View} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Routes from './Routes';
import { startSyncListener } from './lib/sync';
import { colors } from './theme/tokens';


export default class App extends React.Component {
  unsubscribe = null;
  componentDidMount(){
    this.unsubscribe = startSyncListener();
  }
  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe();
  }
  render() {
    return (
      <SafeAreaProvider>
        <View style={styles.container}>
         {/* Dark icons/text - every screen in this app is light-themed
             (#fff/#FAFAFA backgrounds), which app.json's userInterfaceStyle
             didn't match (was "dark", making status bar icons default to a
             light color that's invisible against a light header). */}
         <StatusBar style="auto" />
         <Routes/>
        </View>
      </SafeAreaProvider>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  }
});
