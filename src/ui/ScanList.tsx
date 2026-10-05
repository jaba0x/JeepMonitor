import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { guessKind, isKnownName, startScan, type ScanResult } from '../ble/scan';
import { driverFor } from '../ble/registry';
import { colors } from './theme';
import { Button } from './widgets';

/** Scans for nearby BLE devices and lets the caller pick one. */
export function ScanList({
  actionLabel,
  onPick,
  excludeIds = [],
}: {
  actionLabel: string;
  onPick: (r: ScanResult) => void;
  excludeIds?: string[];
}) {
  const [scanning, setScanning] = useState(false);
  const [renogyOnly, setRenogyOnly] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ScanResult>>({});
  const stopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setScanning(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setScanning(true);
    stopRef.current = await startScan(
      (r) => setResults((prev) => ({ ...prev, [r.id]: r })),
      (m) => {
        setError(m);
        setScanning(false);
      },
    );
  }, []);

  useEffect(() => () => stopRef.current?.(), []);

  const rows = Object.values(results)
    .filter((r) => !excludeIds.includes(r.id))
    .filter((r) => !renogyOnly || isKnownName(r.name))
    .sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.bar}>
        <Button title={scanning ? 'Stop scan' : 'Scan'} onPress={scanning ? stop : start} tone={scanning ? 'ghost' : 'primary'} />
        <View style={styles.toggle}>
          <Text style={styles.toggleText}>Known devices only</Text>
          <Switch value={renogyOnly} onValueChange={setRenogyOnly} />
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {rows.length === 0 ? (
        <Text style={styles.hint}>
          {scanning ? 'Searching...' : 'Nothing found yet. Press Scan.'}
          {renogyOnly ? ' Turn off "Known devices only" to see every Bluetooth device, e.g. the ONE Core.' : ''}
        </Text>
      ) : (
        rows.map((r) => (
          <View key={r.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{r.name}</Text>
              <Text style={styles.meta}>
                {r.id}  |  {r.rssi ?? '?'} dBm  |  {driverFor(guessKind(r.name)).label}
              </Text>
            </View>
            <Button title={actionLabel} tone="ghost" onPress={() => onPick(r)} />
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleText: { color: colors.muted },
  error: { color: colors.bad },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.faint, fontSize: 11, marginTop: 2 },
});
