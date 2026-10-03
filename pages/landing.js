import React, { useState } from 'react';
import { StyleSheet, View, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { useNavigation } from '@react-navigation/native';

import { detect, INPUT_SIZE } from '../lib/detect';
import { pixelsFromBase64Jpeg } from '../lib/decodeImage';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Typography from '../components/Typography';
import StatusView from '../components/StatusView';
import { spacing } from '../theme/tokens';

const SKETCHES_DIR = `${FileSystem.documentDirectory}sketches/`;

// ImagePicker's returned uri is a cache path the OS can reclaim - copying it
// into documentDirectory makes it the durable, offline-safe copy the rest of
// the app (reviewDetections, sketchProfile, the sketch list) reads from,
// independent of whether/when it's ever uploaded to R2.
const MAX_SIDE = 2048;

async function persistLocally(uri, sketchId, width, height) {
  await FileSystem.makeDirectoryAsync(SKETCHES_DIR, { intermediates: true }).catch(() => {});
  const dest = `${SKETCHES_DIR}${sketchId}.jpg`;
  try {
    // A full camera frame can be 50 MP (200 MB decoded). Keep the aspect, cap the long side.
    const actions = [];
    if (Math.max(width, height) > MAX_SIDE) {
      actions.push({ resize: width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE } });
    }
    const out = await ImageManipulator.manipulateAsync(uri, actions, { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
    await FileSystem.copyAsync({ from: out.uri, to: dest });
  } catch (e) {
    console.warn('photo downscale failed, keeping the original:', e.message);
    await FileSystem.copyAsync({ from: uri, to: dest });
  }
  return dest;
}

// Capture screen: photo -> on-device TFLite detection, all in memory, no
// network required. Hands raw predictions to ReviewDetections for tap-to-correct
// before sort/codegen/sync happens there - keeps this screen just "get boxes".
export default function Landing({ route }) {
  const { sketchId, sname } = route.params;
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const navigation = useNavigation();

  const requestPermissions = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraPermission.status !== 'granted' || galleryPermission.status !== 'granted') {
      Alert.alert('Permission Denied', 'You need to grant camera and gallery permissions.');
      return false;
    }
    return true;
  };

  // No allowsEditing/aspect crop here on purpose: the model sees the full original
  // photo, letterboxed to INPUT_SIZE (see handleImagePicked). Forcing a 10:16 crop
  // here reframed the sketch before the model ever saw it - a real mismatch from the
  // Python pipeline, confirmed by the held-out eval image IMG_20190308_205452.jpg
  // barely detecting anything on-device until the crop was removed.
  const takePicture = async () => {
    const permissionsGranted = await requestPermissions();
    if (!permissionsGranted) return;
    const result = await ImagePicker.launchCameraAsync();
    handleImagePicked(result);
  };

  const chooseFromGallery = async () => {
    const permissionsGranted = await requestPermissions();
    if (!permissionsGranted) return;
    const result = await ImagePicker.launchImageLibraryAsync();
    handleImagePicked(result);
  };

  // The bundled example runs through exactly the same on-device pipeline as a photo.
  const useSample = async () => {
    try {
      const asset = Asset.fromModule(require('../assets/demo/sample-sketch.jpg'));
      await asset.downloadAsync();
      handleImagePicked({ assets: [{ uri: asset.localUri || asset.uri, width: asset.width, height: asset.height }] });
    } catch (e) {
      Alert.alert('Could not load the sample', e.message);
    }
  };

  const handleImagePicked = async (pickerResult) => {
    try {
      setUploading(true);
      setStatusText('Saving photo…');
      if (pickerResult.canceled || pickerResult.cancelled || !pickerResult.assets || pickerResult.assets.length === 0) return;

      const { uri, width: originalWidth, height: originalHeight } = pickerResult.assets[0];
      if (typeof uri !== 'string') {
        console.error('Invalid URI:', uri);
        return;
      }

      const localUri = await persistLocally(uri, sketchId, originalWidth, originalHeight);

      setStatusText('Detecting elements...');
      // Letterbox, don't stretch: scale the long side to INPUT_SIZE, keep aspect,
      // pad the rest with zeros (decodeImage.js). model/eval_tflite.py: recall
      // 1.00 padded vs 0.93 stretched on the held-out set.
      const t0 = Date.now();
      const k = INPUT_SIZE / Math.max(originalWidth, originalHeight);
      const contentW = Math.max(1, Math.round(originalWidth * k));
      const contentH = Math.max(1, Math.round(originalHeight * k));
      const detectionInput = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: contentW, height: contentH } }],
        { compress: 1, format: 'jpeg', base64: true }
      );
      const pixelData = pixelsFromBase64Jpeg(detectionInput.base64, contentW, contentH, INPUT_SIZE);
      const predictions = await detect(pixelData, originalWidth, originalHeight, contentW, contentH);
      const detectMs = Date.now() - t0;

      navigation.navigate('ReviewDetections', {
        sketchId,
        sname,
        imageUri: localUri,
        predictions,
        width: originalWidth,
        height: originalHeight,
        detectMs,
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Detection failed', e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen>
      {uploading ? (
        <StatusView text={statusText} loading />
      ) : (
        <View style={styles.content}>
          <Typography.Body style={styles.infoText}>
            Bring your idea to life by drawing any of the following elements:
          </Typography.Body>
          <View style={styles.sheet}>
            <Image style={styles.infoImg} source={require('../assets/guidelines.png')} />
          </View>
          <View style={styles.buttonsContainer}>
            <Button style={styles.button} onPress={takePicture}>Take picture</Button>
            <Button variant="secondary" style={styles.button} onPress={chooseFromGallery}>Upload picture</Button>
          </View>
          <Button variant="ghost" onPress={useSample}>No sketch handy? Try a sample</Button>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    alignItems: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  button: {
    flex: 1,
    minWidth: 150,
    marginHorizontal: spacing.sm,
  },
  infoText: {
    textAlign: 'center',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#F3F5F8',
    borderRadius: 12,
    marginVertical: spacing.lg,
  },
  infoImg: {
    width: '100%',
    height: 380,
    resizeMode: 'contain',
  },
});
