import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { stopAllSessions, syncSessions } from './src/ble/sessionManager';
import { loadDevices, store, useAppState } from './src/state/store';
import { AboutScreen } from './src/ui/AboutScreen';
import { DashboardScreen } from './src/ui/DashboardScreen';
import { DevicesScreen } from './src/ui/DevicesScreen';
import { ExplorerScreen } from './src/ui/ExplorerScreen';
import { colors } from './src/ui/theme';

type Tab = 'dashboard' | 'devices' | 'explorer' | 'about';
const TABS: { key: Tab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'devices', label: 'Devices' },
  { key: 'explorer', label: 'Explorer' },
  { key: 'about', label: 'About' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const ready = useAppState((s) => s.ready);
  const [immersive, setImmersive] = useState(false);
  const full = immersive && tab === 'dashboard';

  useEffect(() => {
    void loadDevices();
    return stopAllSessions;
  }, []);

  // Keep live connections in step with the saved device list.
  useEffect(() => {
    if (!ready) return;
    syncSessions(store.get().devices);
    let prev = store.get().devices;
    return store.subscribe(() => {
      const next = store.get().devices;
      if (next !== prev) {
        prev = next;
        syncSessions(next);
      }
    });
  }, [ready]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar style="light" hidden={full} />
        {full ? (
          <Pressable onPress={() => setImmersive(false)} style={styles.floatingLogo} hitSlop={12}>
            <Image source={require('./assets/emblem.png')} style={styles.logo} />
          </Pressable>
        ) : (
          <Pressable onPress={() => { setTab('dashboard'); setImmersive(true); }} style={styles.header}>
            <Image source={require('./assets/emblem.png')} style={styles.logo} />
            <Text style={styles.brand}>JeepMonitor</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          {tab === 'dashboard' ? <DashboardScreen onGoToDevices={() => setTab('devices')} /> : null}
          {tab === 'devices' ? <DevicesScreen /> : null}
          {tab === 'explorer' ? <ExplorerScreen /> : null}
          {tab === 'about' ? <AboutScreen /> : null}
        </View>
        {full ? null : (
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tab}>
              <Text style={[styles.tabText, tab === t.key && styles.tabActive]}>{t.label}</Text>
              <View style={[styles.tabBar, tab === t.key && { backgroundColor: colors.info }]} />
            </Pressable>
          ))}
        </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 2 },
  logo: { width: 24, height: 24, borderRadius: 12 },
  floatingLogo: { position: 'absolute', top: 10, right: 12, zIndex: 20, opacity: 0.55 },
  brand: { color: colors.muted, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700' },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.cardBorder, backgroundColor: colors.card },
  tab: { flex: 1, alignItems: 'center', paddingTop: 12, gap: 8 },
  tabText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  tabActive: { color: colors.text },
  tabBar: { height: 3, width: 36, borderRadius: 2, backgroundColor: 'transparent', marginBottom: 6 },
});
