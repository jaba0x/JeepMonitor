import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { calibrate, DEFAULT_TILT, formatAngle, tilt, type Gravity, type TiltSettings } from '../protocol/tilt';
import { updateDevice, type SavedDevice } from '../state/store';
import { gravityBus } from './gravityBus';
import { colors, mono } from './theme';
import { Card, WidgetTitle } from './widgets';

const RANGE = 30; // degrees shown from centre to edge of the bubble level
const ALPHA = 0.18; // smoothing

/** Pitch and roll from the tablet's tilt sensor. Adapts to how the tablet is mounted; has a fullscreen mode. */
export function ClinometerWidget({ device, cellHeight, fullscreen }: { device: SavedDevice; cellHeight?: number; fullscreen?: boolean }) {
  const { width: winW, height: winH } = useWindowDimensions();
  const cfg: TiltSettings = { ...DEFAULT_TILT, ...device.tilt };
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const g = useRef<Gravity | null>(null);
  const [angles, setAngles] = useState({ pitch: 0, roll: 0 });
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    void Accelerometer.isAvailableAsync().then((ok) => {
      if (cancelled) return;
      setAvailable(ok);
      if (!ok) return;
      Accelerometer.setUpdateInterval(100);
      sub = Accelerometer.addListener((d) => {
        const prev = g.current;
        const next = prev
          ? { x: prev.x + ALPHA * (d.x - prev.x), y: prev.y + ALPHA * (d.y - prev.y), z: prev.z + ALPHA * (d.z - prev.z) }
          : { x: d.x, y: d.y, z: d.z };
        g.current = next;
        gravityBus.latest = next;
        if (!prev && !cfgRef.current.auto) {
          // first reading: adapt to the way the tablet is mounted
          updateDevice(device.id, { tilt: { ...cfgRef.current, ...calibrate(next, cfgRef.current), zeroPitch: 0, zeroRoll: 0 } });
        }
        setAngles(tilt(next, cfgRef.current));
      });
    });
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [device.id]);

  const worst = Math.max(Math.abs(angles.pitch), Math.abs(angles.roll));
  const color = worst >= cfg.warnDeg ? colors.bad : worst >= cfg.warnDeg * 0.7 ? colors.discharge : colors.charge;
  const height = fullscreen ? Math.max(260, winH * 0.62) : cellHeight ? Math.max(40, cellHeight - 70) : 240;
  const area = Math.min(height, fullscreen ? winW - 40 : 9999);
  const compact = !fullscreen && cellHeight !== undefined && cellHeight < 170;

  if (compact) {
    const fs = Math.max(14, Math.min(40, (cellHeight ?? 60) * 0.4));
    return (
      <Card style={{ padding: 6, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
          <Text style={[mono, { color, fontWeight: '800', fontSize: fs }]}>P {formatAngle(angles.pitch, cfg.unit)}</Text>
          <Text style={[mono, { color, fontWeight: '800', fontSize: fs }]}>R {formatAngle(angles.roll, cfg.unit)}</Text>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.titleRow}>
        <WidgetTitle>{device.alias}</WidgetTitle>
        {device.label ? <Text style={styles.label}>{device.label}</Text> : null}
      </View>

      {!available ? (
        <Text style={styles.hint}>This device has no motion sensor.</Text>
      ) : cfg.style === 'numbers' ? (
        <Numbers angles={angles} cfg={cfg} color={color} height={height} />
      ) : cfg.style === 'vehicle' ? (
        <Vehicle angles={angles} cfg={cfg} color={color} height={height} />
      ) : (
        <Bubble angles={angles} cfg={cfg} color={color} diameter={area - 16} height={height} />
      )}
    </Card>
  );
}

type Angles = { pitch: number; roll: number };
type Props = { angles: Angles; cfg: TiltSettings; color: string; height: number };

function Readout({ label, value, color, big }: { label: string; value: string; color: string; big?: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[mono, { color, fontWeight: '800', fontSize: big ? 56 : 30 }]}>{value}</Text>
    </View>
  );
}

function Numbers({ angles, cfg, color, height }: Props) {
  const big = height > 260;
  return (
    <View style={[styles.center, { minHeight: height, flexDirection: 'row', justifyContent: 'space-around' }]}>
      <Readout label="Pitch" value={formatAngle(angles.pitch, cfg.unit)} color={color} big={big} />
      <Readout label="Roll" value={formatAngle(angles.roll, cfg.unit)} color={color} big={big} />
    </View>
  );
}

function Bubble({ angles, cfg, color, diameter, height }: Props & { diameter: number }) {
  const d = Math.max(60, Math.min(diameter, height - 8));
  const r = d / 2;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v / RANGE));
  const bx = clamp(angles.roll) * (r - 14);
  const by = -clamp(angles.pitch) * (r - 14);
  return (
    <View style={[styles.center, { minHeight: height, flexDirection: 'row', gap: 20, flexWrap: 'wrap' }]}>
      <View style={{ width: d, height: d }}>
        {[1, 2 / 3, 1 / 3].map((f) => (
          <View
            key={f}
            style={{
              position: 'absolute',
              left: r - r * f,
              top: r - r * f,
              width: d * f,
              height: d * f,
              borderRadius: d,
              borderWidth: 1.5,
              borderColor: f === 1 ? colors.faint : colors.cardBorder,
            }}
          />
        ))}
        <View style={{ position: 'absolute', left: r - 0.5, top: 0, width: 1, height: d, backgroundColor: colors.cardBorder }} />
        <View style={{ position: 'absolute', top: r - 0.5, left: 0, height: 1, width: d, backgroundColor: colors.cardBorder }} />
        <View
          style={{
            position: 'absolute',
            left: r + bx - 14,
            top: r + by - 14,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: color,
            borderWidth: 2,
            borderColor: colors.bg,
          }}
        />
      </View>
      <View style={{ gap: 10 }}>
        <Readout label="Pitch" value={formatAngle(angles.pitch, cfg.unit)} color={color} big={d > 220} />
        <Readout label="Roll" value={formatAngle(angles.roll, cfg.unit)} color={color} big={d > 220} />
      </View>
    </View>
  );
}

function Truck({ side, deg, color, scale }: { side: boolean; deg: number; color: string; scale: number }) {
  return (
    <View style={{ width: 220 * scale, height: 150 * scale, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 220, height: 150, transform: [{ scale }, { rotate: `${deg}deg` }] }}>
        {side ? (
          <>
            <View style={{ position: 'absolute', left: 20, top: 70, width: 180, height: 36, borderRadius: 10, backgroundColor: color }} />
            <View style={{ position: 'absolute', left: 60, top: 34, width: 100, height: 40, borderRadius: 8, backgroundColor: color }} />
            <View style={{ position: 'absolute', left: 68, top: 42, width: 36, height: 26, borderRadius: 4, backgroundColor: colors.bg }} />
            <View style={{ position: 'absolute', left: 112, top: 42, width: 40, height: 26, borderRadius: 4, backgroundColor: colors.bg }} />
            <View style={{ position: 'absolute', left: 38, top: 92, width: 44, height: 44, borderRadius: 22, backgroundColor: '#05080C', borderWidth: 5, borderColor: colors.faint }} />
            <View style={{ position: 'absolute', left: 142, top: 92, width: 44, height: 44, borderRadius: 22, backgroundColor: '#05080C', borderWidth: 5, borderColor: colors.faint }} />
          </>
        ) : (
          <>
            <View style={{ position: 'absolute', left: 50, top: 60, width: 120, height: 56, borderRadius: 10, backgroundColor: color }} />
            <View style={{ position: 'absolute', left: 62, top: 22, width: 96, height: 42, borderRadius: 8, backgroundColor: color }} />
            <View style={{ position: 'absolute', left: 72, top: 30, width: 76, height: 26, borderRadius: 4, backgroundColor: colors.bg }} />
            <View style={{ position: 'absolute', left: 34, top: 82, width: 24, height: 54, borderRadius: 8, backgroundColor: '#05080C', borderWidth: 4, borderColor: colors.faint }} />
            <View style={{ position: 'absolute', left: 162, top: 82, width: 24, height: 54, borderRadius: 8, backgroundColor: '#05080C', borderWidth: 4, borderColor: colors.faint }} />
          </>
        )}
      </View>
    </View>
  );
}

function Vehicle({ angles, cfg, color, height }: Props) {
  const scale = Math.max(0.6, Math.min(1.6, (height - 70) / 150));
  return (
    <View style={[styles.center, { minHeight: height, flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap' }]}>
      <View style={{ alignItems: 'center' }}>
        <Truck side deg={-angles.pitch} color={color} scale={scale} />
        <Readout label="Pitch" value={formatAngle(angles.pitch, cfg.unit)} color={color} />
      </View>
      <View style={{ alignItems: 'center' }}>
        <Truck side={false} deg={angles.roll} color={color} scale={scale} />
        <Readout label="Roll" value={formatAngle(angles.roll, cfg.unit)} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  label: { color: colors.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
