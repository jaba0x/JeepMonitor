import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../ble/manager';
import { GattExplorer } from '../ble/explorer';
import type { ScanResult } from '../ble/scan';
import { ScanList } from './ScanList';
import { colors } from './theme';
import { Button, Card } from './widgets';

const MAX_LINES = 600;

/**
 * Reverse-engineering helper: connect to any BLE device (e.g. the Renogy ONE Core while DC Home is closed),
 * subscribe to all notifications and share the log. Compare the packets with what the official app shows.
 */
export function ExplorerScreen() {
  const [target, setTarget] = useState<ScanResult | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const explorer = useRef<GattExplorer | null>(null);

  const log = useCallback((line: string) => {
    setLines((prev) => (prev.length >= MAX_LINES ? [...prev.slice(prev.length - MAX_LINES + 1), line] : [...prev, line]));
  }, []);

  useEffect(
    () => () => {
      void explorer.current?.disconnect();
    },
    [],
  );

  const connect = async (r: ScanResult) => {
    setTarget(r);
    setLines([]);
    setBusy(true);
    try {
      const ex = new GattExplorer(r.id, log);
      explorer.current = ex;
      await ex.connect();
      ex.subscribeAll();
      setConnected(true);
      log('-- subscribed to all notifying characteristics. Use the official app features now and watch the log --');
    } catch (e) {
      log(`Connection failed: ${errorMessage(e)}`);
      explorer.current = null;
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    await explorer.current?.disconnect();
    explorer.current = null;
    setConnected(false);
    log('-- disconnected --');
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.h1}>Explorer</Text>
      <Text style={styles.hint}>
        Inspect an unknown device such as the Renogy ONE Core. Close the DC Home app first so the device accepts this
        connection, connect, then share the log.
      </Text>

      {!connected ? (
        <Card>
          <ScanList actionLabel={busy ? '...' : 'Connect'} onPick={(r) => !busy && void connect(r)} />
        </Card>
      ) : (
        <View style={styles.actions}>
          <Button title="Read all" tone="ghost" onPress={() => void explorer.current?.readAll()} />
          <Button title="Share log" onPress={() => void Share.share({ message: lines.join('\n') })} />
          <Button title="Disconnect" tone="danger" onPress={() => void disconnect()} />
        </View>
      )}

      {target ? (
        <Text style={styles.meta}>
          {target.name}  |  {target.id}
        </Text>
      ) : null}

      {lines.length > 0 ? (
        <Card>
          <Text selectable style={styles.log}>
            {lines.join('\n')}
          </Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14 },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  meta: { color: colors.faint, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  log: { color: '#B7C4D1', fontFamily: 'monospace', fontSize: 11, lineHeight: 16 },
});
