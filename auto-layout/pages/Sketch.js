import React from 'react';
import { StyleSheet, View, Image, KeyboardAvoidingView, BackHandler } from 'react-native';
import { genId, saveLocal } from '../lib/localStore';
import { enqueuePush } from '../lib/sync';
import Screen from '../components/Screen';
import Button from '../components/Button';
import TextField from '../components/TextField';
import Typography from '../components/Typography';
import { spacing } from '../theme/tokens';

// "Sketch Oct 3, 14:05" - a name is never a reason to stop before the camera.
function defaultName() {
  const d = new Date();
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `Sketch ${day}, ${time}`;
}

export default class Sketch extends React.Component {
  state = {
    name: '',
    message: ''
  };

  componentDidMount() {
    // Handle hardware back press on Android devices
    this.backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      this.goBack(); // Go back to the list of sketches
      return true;
    });
  }

  componentWillUnmount() {
    this.backHandler.remove(); // Clean up back handler when the component unmounts
  }

  goBack() {
    this.props.navigation.navigate('ListSketches');
  }

  // Creates the sketch entirely on-device (localStore is the source of
  // truth - see lib/localStore.js) and queues a background push to the
  // server. No network needed to get started; sync.js retries the push
  // whenever a connection shows up.
  createSketch = async () => {
    let { name } = this.state;
    name = name.trim() || defaultName();
    name = name.replace(/ /g, "_");

    try {
      const id = genId();
      const sketch = await saveLocal(id, { name });
      enqueuePush(id);
      this.props.navigation.navigate('Landing', { sketchId: sketch._id, sname: sketch.name });
    } catch (error) {
      console.error("Error creating sketch: ", error);
      this.setState({ message: 'Error creating sketch' });
    }
  };

  render() {
    return (
      <Screen>
        <KeyboardAvoidingView behavior="padding" style={styles.container}>
          <View style={styles.formContainer}>
            <Image style={styles.infoImg} source={require('../assets/idea.png')} />
            <Typography.Slug style={styles.step}>STEP 1 OF 3 · NAME IT, THEN SKETCH, THEN REVIEW</Typography.Slug>
            <TextField
              style={styles.input}
              underlineColorAndroid="rgba(0,0,0,0)"
              label="Name (optional)"
              placeholder={defaultName().replace(/_/g, " ")}
              onChangeText={(text) => this.setState({ name: text })}
            />
            {this.state.message ? <Typography.ErrorText>{this.state.message}</Typography.ErrorText> : null}
            <Button style={styles.button} onPress={this.createSketch}>Continue to camera</Button>
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
  },
  formContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    width: '100%',
  },
  button: {
    width: '100%',
    marginVertical: spacing.sm,
  },
  step: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  infoImg: {
    width: 150,
    height: 150,
    margin: spacing.lg,
  },
});
