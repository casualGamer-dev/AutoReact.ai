import React from 'react';
import { StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { clearAllLocal } from '../lib/localStore';
import { enqueueDelete } from '../lib/sync';
import { spacing, colors } from '../theme/tokens';

// "Remove all sketches" menu button, wired into ListSketches' header (Routes.js).
// Clears localStore immediately (works offline) and queues a server delete
// for anything that had ever synced - see lib/sync.js.
export default class OptionsButton extends React.Component {
  show = () => {
    Alert.alert(
      'Remove all your Sketches?',
      'Are you sure you would like to completely remove all your sketches? You can tap and hold a sketch to remove it.',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: () => this.removeAllSketches() },
      ],
      { cancelable: true },
    );
  };

  removeAllSketches = async () => {
    try {
      const synced = await clearAllLocal();
      for (const sketch of synced) await enqueueDelete(sketch._id, sketch.serverId);
      if (this.props.onDeleted) this.props.onDeleted();
    } catch (error) {
      console.error("Error removing sketches:", error);
    }
  };

  render() {
    return (
      <TouchableOpacity
        style={styles.button}
        onPress={this.show}
        accessibilityRole="button"
        accessibilityLabel="Remove all sketches"
      >
        <Ionicons name="trash-outline" size={22} color={colors.error} />
      </TouchableOpacity>
    );
  }
}

const styles = StyleSheet.create({
  // No flexGrow here - headerRight sizes to its content; flexGrow was
  // stretching/misaligning this within the header slot instead of just
  // sitting centered next to the title.
  button: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
