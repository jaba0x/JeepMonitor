import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { updateDevice, type SavedDevice } from '../state/store';
import { Card } from './widgets';

/** Lets the user pick a picture from the gallery and keeps a private copy of it. */
export async function pickLogo(device: SavedDevice): Promise<void> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
  if (res.canceled || !res.assets[0]) return;
  const from = res.assets[0].uri;
  let uri = from;
  try {
    const to = `${FileSystem.documentDirectory}logo-${device.id}-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from, to });
    uri = to;
  } catch {
    // fall back to the picker's own copy
  }
  updateDevice(device.id, { logoUri: uri });
}

/** A picture on the dashboard: the built-in emblem or an image you pick. Its size follows the widget frame. */
export function LogoWidget({ device, cellHeight, fullscreen }: { device: SavedDevice; cellHeight?: number; fullscreen?: boolean }) {
  const { height: winH } = useWindowDimensions();
  const height = fullscreen ? winH * 0.7 : cellHeight ? Math.max(40, cellHeight - 36) : 150;
  return (
    <Card>
      <View style={[styles.box, { height }]}>
        <Image
          source={device.logoUri ? { uri: device.logoUri } : require('../../assets/emblem.png')}
          style={styles.img}
          resizeMode="contain"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
});
