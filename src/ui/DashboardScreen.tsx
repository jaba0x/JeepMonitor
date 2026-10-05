import { useKeepAwake } from 'expo-keep-awake';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { estimateTime, formatDuration } from '../protocol/estimate';
import { addDevice, setUnlocked, updateDevice, useAppState, type SavedDevice } from '../state/store';
import { driverFor } from '../ble/registry';
import { ClinometerWidget } from './ClinometerWidget';
import { DeviceCard } from './DeviceCard';
import { Fullscreen } from './Fullscreen';
import { LogoWidget } from './LogoWidget';
import { placeAll, type GridItem } from './gridLayout';
import { BASE_W, WidgetFrame, type Preview } from './WidgetFrame';
import { WidgetOptions } from './WidgetOptions';
import { ampsColor, colors, fmt, mono, socColor } from './theme';
import { Card, Chip, SocBar } from './widgets';

const GAP = 14;
const PAD = 16;
const UNIT = 36;
const COLS = 6;

const isWidget = (d: SavedDevice): boolean => d.kind === 'logo' || d.kind === 'clinometer';

function WidgetView({ device, cellHeight, fullscreen }: { device: SavedDevice; cellHeight?: number; fullscreen?: boolean }) {
  if (device.kind === 'logo') return <LogoWidget device={device} cellHeight={cellHeight} fullscreen={fullscreen} />;
  if (device.kind === 'clinometer') return <ClinometerWidget device={device} cellHeight={cellHeight} fullscreen={fullscreen} />;
  return <DeviceCard device={device} cellHeight={cellHeight} />;
}

export function DashboardScreen({ onGoToDevices }: { onGoToDevices: () => void }) {
  useKeepAwake();
  const { width } = useWindowDimensions();
  const unlocked = useAppState((s) => s.unlocked);
  const devices = useAppState((s) => s.devices).filter((d) => isWidget(d) || driverFor(d.kind).create);
  const [full, setFull] = useState<string | null>(null);
  const [optionsId, setOptionsId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<{ id: string; col: number; row: number; w: number; h: number } | null>(null);
  const phone = width < 640;
  const gridW = width - PAD * 2;
  const colW = (gridW - GAP * (COLS - 1)) / COLS;
  const spanToWidth = (n: number) => n * colW + (n - 1) * GAP;
  const rowsToHeight = (r: number) => r * UNIT + (r - 1) * GAP;
  const effSpan = (n: number) => (phone ? (n <= 3 ? 3 : 6) : Math.max(1, Math.min(COLS, n)));
  const defaultSpan = (d: SavedDevice) => (phone || d.size === 'wide' ? 6 : width >= 1000 ? 2 : 3);
  // Natural content height (at the 360 px base width) per kind, scaled to the widget's width so nothing is cut off.
  const NATURAL: Record<string, number> = { clinometer: 430, logo: 200, thermometer: 250, shunt300: 330, 'renogy-dcc': 520 };
  const defaultRows = (d: SavedDevice) => {
    const sc = spanToWidth(spanOf(d)) / BASE_W;
    return Math.max(2, Math.ceil(((NATURAL[d.kind] ?? 300) * sc + GAP) / (UNIT + GAP)));
  };
  const spanOf = (d: SavedDevice) => effSpan(d.span ?? defaultSpan(d));
  const rowsOf = (d: SavedDevice) => d.rows ?? defaultRows(d);
  const items: GridItem[] = devices.map((d) => ({ id: d.id, col: d.col, row: d.row, w: spanOf(d), h: rowsOf(d) }));
  const cells = placeAll(items, COLS);
  const bottom = items.reduce((m, it) => Math.max(m, (cells[it.id]?.row ?? 0) + it.h), 0);
  const gridH = bottom > 0 ? bottom * (UNIT + GAP) - GAP : 0;
  const px = (col: number) => col * (colW + GAP);
  const py = (row: number) => row * (UNIT + GAP);
  // Fits a requested span next to a widget at `col`; on phones only half or full width exist.
  const fitSpan = (raw: number, col: number) => {
    const room = COLS - col;
    const n = effSpan(Math.max(1, Math.min(raw, room)));
    return Math.min(n, room >= n ? n : phone ? 3 : room);
  };
  const snapCol = (col: number) => (phone ? (col >= 2 ? 3 : 0) : col);

  /** Applies a new position/size for one widget and persists where everything else ends up. */
  const commit = (id: string, patch: { col: number; row: number; w: number; h: number }) => {
    const next = items.map((it) => (it.id === id ? { ...it, col: patch.col, row: patch.row, w: patch.w, h: patch.h } : it));
    const res = placeAll(next, COLS, id);
    for (const it of next) {
      const c = res[it.id];
      if (!c) continue;
      if (it.id === id) updateDevice(id, { col: c.col, row: c.row, span: patch.w, rows: patch.h });
      else if (c.col !== it.col || c.row !== it.row) updateDevice(it.id, { col: c.col, row: c.row });
    }
  };

  const onPreview = (d: SavedDevice, pv: Preview) => {
    if (!pv) return setPreview(null);
    const c = cells[d.id] ?? { col: 0, row: 0 };
    if (pv.kind === 'move') {
      const w = spanOf(d);
      const col = Math.max(0, Math.min(COLS - w, snapCol(Math.round((px(c.col) + pv.dx) / (colW + GAP)))));
      const row = Math.max(0, Math.round((py(c.row) + pv.dy) / (UNIT + GAP)));
      setPreview({ id: d.id, col, row, w, h: rowsOf(d) });
    } else setPreview({ id: d.id, col: c.col, row: c.row, w: pv.span, h: pv.rows });
  };

  const fullDevice = devices.find((d) => d.id === full);
  const optionsDevice = devices.find((d) => d.id === optionsId);

  const addWidget = (kind: 'logo' | 'clinometer') =>
    addDevice({
      id: `${kind}-${Date.now()}`,
      name: kind === 'logo' ? 'Logo' : 'Clinometer',
      alias: kind === 'logo' ? 'Logo' : 'Clinometer',
      kind,
    });

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: PAD, paddingTop: 6, gap: GAP }} scrollEnabled={!dragging}>
        {unlocked ? (
          <View style={styles.topRow}>
            <Text style={styles.hint}>Drag the grip to move, the corner to resize, tap a widget for options.</Text>
            <Pressable onPress={() => setUnlocked(false)} style={styles.done}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        ) : null}
        {unlocked ? (
          <Card style={{ gap: 10 }}>
            <Text style={styles.emptyTitle}>Add a widget</Text>
            <View style={styles.chips}>
              <Chip label="+ Clinometer" onPress={() => addWidget('clinometer')} />
              <Chip label="+ Logo / picture" onPress={() => addWidget('logo')} />
            </View>
          </Card>
        ) : null}
        <Hero devices={devices} />
        {devices.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>No devices yet</Text>
            <Text style={styles.emptyText}>
              Add your Smart Shunt (or any other supported device) in the Devices tab to see live data here.
            </Text>
            <Text style={[styles.emptyText, styles.link]} onPress={onGoToDevices}>
              Go to Devices
            </Text>
          </Card>
        ) : (
          <View style={{ height: gridH + (unlocked ? UNIT : 0) }}>
            {unlocked && preview ? (
              <View
                pointerEvents="none"
                style={[
                  styles.ghost,
                  { left: px(preview.col), top: py(preview.row), width: spanToWidth(preview.w), height: rowsToHeight(preview.h) },
                ]}
              />
            ) : null}
            {devices.map((d) => {
              const c = cells[d.id] ?? { col: 0, row: 0 };
              const span = spanOf(d);
              const rows = rowsOf(d);
              return (
                <WidgetFrame
                  key={d.id}
                  id={d.id}
                  x={px(c.col)}
                  y={py(c.row)}
                  width={spanToWidth(span)}
                  height={rowsToHeight(rows)}
                  editing={unlocked}
                  spanToWidth={spanToWidth}
                  rowsToHeight={rowsToHeight}
                  fitSpan={fitSpan}
                  col={c.col}
                  span={span}
                  rows={rows}
                  colW={colW}
                  gap={GAP}
                  unit={UNIT}
                  onMove={(id, dx, dy) => {
                    const col = Math.max(0, Math.min(COLS - span, snapCol(Math.round((px(c.col) + dx) / (colW + GAP)))));
                    const row = Math.max(0, Math.round((py(c.row) + dy) / (UNIT + GAP)));
                    commit(id, { col, row, w: span, h: rows });
                  }}
                  onResize={(id, sp, rs) => commit(id, { col: c.col, row: c.row, w: sp, h: rs })}
                  onPreview={(pv) => onPreview(d, pv)}
                  onDragState={setDragging}
                  onOpen={() => setOptionsId(d.id)}
                >
                  {(ch) =>
                    unlocked ? (
                      <WidgetView device={d} cellHeight={ch} />
                    ) : (
                      <Pressable onPress={() => setFull(d.id)} onLongPress={() => setUnlocked(true)} style={{ flexGrow: 1 }}>
                        <WidgetView device={d} cellHeight={ch} />
                      </Pressable>
                    )
                  }
                </WidgetFrame>
              );
            })}
          </View>
        )}
      </ScrollView>
      {fullDevice ? (
        <Fullscreen onClose={() => setFull(null)}>
          <WidgetView device={fullDevice} fullscreen />
        </Fullscreen>
      ) : null}
      {optionsDevice ? <WidgetOptions device={optionsDevice} onClose={() => setOptionsId(null)} /> : null}
    </>
  );
}

/** Big battery summary, driven by the first Smart Shunt that has reported. */
function Hero({ devices }: { devices: SavedDevice[] }) {
  const shunt = devices.find((d) => d.kind === 'shunt300');
  const reading = useAppState((s) => (shunt ? s.readings[shunt.id] : undefined));
  if (!shunt || !reading || reading.kind !== 'shunt300') return null;

  const est = estimateTime(reading.socPercent, shunt.capacityAh, reading.amps);
  const color = socColor(reading.socPercent);
  const state =
    Math.abs(reading.amps) < 0.05
      ? 'Idle'
      : reading.amps > 0
        ? `Charging ${fmt(reading.amps, 1)} A`
        : `Discharging ${fmt(-reading.amps, 1)} A`;

  return (
    <Card style={styles.hero}>
      <View style={{ flex: 1, minWidth: 180 }}>
        <Text style={styles.heroLabel}>Battery</Text>
        <Text style={[styles.heroSoc, mono, { color }]}>{fmt(reading.socPercent, 0)}%</Text>
        <SocBar percent={reading.socPercent} color={color} height={18} />
      </View>
      <View style={{ flex: 1, minWidth: 180, justifyContent: 'center', gap: 6 }}>
        <Text style={[styles.heroState, { color: ampsColor(reading.amps) }]}>{state}</Text>
        <Text style={styles.heroSub}>
          {fmt(reading.batteryVolts, 2)} V  |  {fmt(reading.watts, 0)} W
        </Text>
        {est.hours !== null ? (
          <Text style={styles.heroSub}>
            {est.mode === 'discharging' ? 'Remaining' : 'Full in'} {formatDuration(est.hours)}
          </Text>
        ) : (
          <Text style={styles.heroHint}>Set the battery capacity in Devices for a time estimate</Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  hint: { color: colors.faint, fontSize: 12, flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  done: { backgroundColor: colors.info, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  doneText: { color: '#06121F', fontWeight: '800', fontSize: 14 },
  lock: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  lockOn: { backgroundColor: colors.info, borderColor: colors.info },
  lockText: { color: colors.text, fontWeight: '800', fontSize: 14 },
  ghost: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.info,
    backgroundColor: 'rgba(56,189,248,0.18)',
  },
  hero: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingVertical: 20 },
  heroLabel: { color: colors.muted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6 },
  heroSoc: { fontSize: 72, fontWeight: '800', lineHeight: 80 },
  heroState: { fontSize: 26, fontWeight: '700' },
  heroSub: { color: colors.muted, fontSize: 16 },
  heroHint: { color: colors.faint, fontSize: 13 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  link: { color: colors.info, marginTop: 10, fontWeight: '600' },
});
