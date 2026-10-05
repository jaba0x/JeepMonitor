import { useKeepAwake } from 'expo-keep-awake';
import type { ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './theme';
import { Button } from './widgets';

function Keep() {
  useKeepAwake();
  return null;
}

/** Full-screen view of one widget. */
export function Fullscreen({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Keep />
      <SafeAreaView style={styles.root}>
        <View style={styles.top}>
          <Button title="Close" tone="ghost" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', justifyContent: 'flex-end', padding: 12 },
  body: { padding: 16, flexGrow: 1, justifyContent: 'center' },
});
