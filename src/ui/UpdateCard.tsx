import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchLatestUpdate, type UpdateInfo } from '../updater/github';
import { downloadAndInstall } from '../updater/install';
import { VERSION } from '../version';
import { colors } from './theme';
import { Card } from './widgets';

type State =
  | { kind: 'checking' }
  | { kind: 'uptodate'; checkedAt: number }
  | { kind: 'available'; update: UpdateInfo }
  | { kind: 'downloading'; update: UpdateInfo; fraction: number }
  | { kind: 'error'; message: string; update?: UpdateInfo };

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

/** Looks for a newer GitHub release and installs it. Updates are tagged releases with an APK attached. */
export function UpdateCard() {
  const [state, setState] = useState<State>({ kind: 'checking' });

  const check = useCallback(async () => {
    setState({ kind: 'checking' });
    try {
      const update = await fetchLatestUpdate(VERSION);
      setState(update ? { kind: 'available', update } : { kind: 'uptodate', checkedAt: Date.now() });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const install = async (update: UpdateInfo) => {
    setState({ kind: 'downloading', update, fraction: 0 });
    try {
      await downloadAndInstall(update, (fraction) => setState({ kind: 'downloading', update, fraction }));
      setState({ kind: 'available', update }); // the system installer takes over; offer a retry if it is dismissed
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e), update });
    }
  };

  const update = state.kind === 'available' || state.kind === 'downloading' ? state.update : state.kind === 'error' ? state.update : undefined;

  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.h2}>Software update</Text>
      {state.kind === 'checking' ? <Text style={styles.body}>Checking GitHub for a newer version...</Text> : null}
      {state.kind === 'uptodate' ? <Text style={styles.body}>You have the latest version ({VERSION}).</Text> : null}
      {update ? (
        <View style={{ gap: 6 }}>
          <Text style={styles.item}>
            Version {update.version} is available (you have {VERSION}), {mb(update.sizeBytes)}
          </Text>
          {update.notes ? <Text style={styles.notes}>{update.notes}</Text> : null}
        </View>
      ) : null}
      {state.kind === 'downloading' ? (
        <View style={{ gap: 6 }}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(state.fraction * 100)}%` }]} />
          </View>
          <Text style={styles.body}>Downloading {Math.round(state.fraction * 100)}%</Text>
        </View>
      ) : null}
      {state.kind === 'error' ? <Text style={styles.error}>{state.message}</Text> : null}
      <View style={styles.actions}>
        {update && state.kind !== 'downloading' ? (
          <Pressable style={styles.primary} onPress={() => void install(update)}>
            <Text style={styles.primaryText}>Download and install</Text>
          </Pressable>
        ) : null}
        {state.kind !== 'checking' && state.kind !== 'downloading' ? (
          <Pressable style={styles.secondary} onPress={() => void check()}>
            <Text style={styles.secondaryText}>Check again</Text>
          </Pressable>
        ) : null}
        {update ? (
          <Pressable style={styles.secondary} onPress={() => void Linking.openURL(update.pageUrl)}>
            <Text style={styles.secondaryText}>Release notes</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>
        Android will ask once to allow JeepMonitor to install apps. Your devices and layout are kept.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  h2: { color: colors.text, fontSize: 16, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 14 },
  item: { color: colors.text, fontSize: 15, fontWeight: '600' },
  notes: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  error: { color: colors.bad, fontSize: 13, lineHeight: 18 },
  hint: { color: colors.faint, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { backgroundColor: colors.info, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
  primaryText: { color: '#06121F', fontWeight: '800', fontSize: 14 },
  secondary: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  secondaryText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.cardBorder, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.info },
});
