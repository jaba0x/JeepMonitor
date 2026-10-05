import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { SessionStatus } from '../protocol/types';
import { colors, mono, statusColor, statusLabel } from './theme';

/** Scale factor the dashboard applies to a widget; 1 outside the dashboard grid. */
export const ScaleContext = createContext(1);

/** Widget heading: the same on-screen size whatever size the widget is resized to. */
export function WidgetTitle({ children }: { children: ReactNode }) {
  const scale = useContext(ScaleContext);
  const size = 17 / scale;
  return (
    <Text style={{ color: colors.text, fontSize: size, lineHeight: size * 1.25, fontWeight: '700' }} numberOfLines={1}>
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Stat({
  label,
  value,
  unit,
  color = colors.text,
  big = false,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
  big?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statRow}>
        <Text style={[styles.statValue, mono, big && styles.statBig, { color }]}>{value}</Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

export function SocBar({ percent, color, height = 14 }: { percent: number; color: string; height?: number }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View style={[styles.barTrack, { height, borderRadius: height / 2 }]}>
      <View style={{ width: `${p}%`, height: '100%', backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

/** Two-sided bar chart of recent current: charging above the centre line, discharging below. */
export function Sparkline({ values, height = 52 }: { values: number[]; height?: number }) {
  const shown = values.slice(-90);
  const max = Math.max(1, ...shown.map((v) => Math.abs(v)));
  const half = height / 2;
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'stretch', gap: 1 }}>
      {shown.map((v, i) => {
        const h = Math.max(1, (Math.abs(v) / max) * half);
        return (
          <View key={i} style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ height: half, justifyContent: 'flex-end' }}>
              {v > 0.02 ? <View style={{ height: h, backgroundColor: colors.charge, opacity: 0.9 }} /> : null}
            </View>
            <View style={{ height: 1, backgroundColor: colors.cardBorder }} />
            <View style={{ height: half }}>
              {v < -0.02 ? <View style={{ height: h, backgroundColor: colors.discharge, opacity: 0.9 }} /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function StatusPill({ status, message }: { status: SessionStatus; message?: string }) {
  return (
    <View style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: statusColor[status] }]} />
      <Text style={styles.pillText} numberOfLines={1}>
        {statusLabel[status]}
        {status === 'error' && message ? `: ${message}` : ''}
      </Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  tone = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  tone?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  const bg = tone === 'primary' ? colors.info : tone === 'danger' ? '#3A1A1A' : 'transparent';
  const fg = tone === 'primary' ? '#06121F' : tone === 'danger' ? colors.bad : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        tone === 'ghost' && { borderWidth: 1, borderColor: colors.cardBorder },
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

/** Re-renders every second so "updated Ns ago" stays current. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function ageText(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  return s < 2 ? 'now' : s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
  },
  stat: { minWidth: 88, flexGrow: 1, flexBasis: 88, paddingVertical: 4 },
  statLabel: { color: colors.muted, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '600' },
  statBig: { fontSize: 44, fontWeight: '700' },
  statUnit: { color: colors.muted, fontSize: 14 },
  barTrack: { backgroundColor: '#1B2530', overflow: 'hidden' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  button: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600' },
});

export function Chip({ label, active, onPress, tone }: { label: string; active?: boolean; onPress: () => void; tone?: 'danger' }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.info : colors.cardBorder,
        backgroundColor: active ? 'rgba(56,189,248,0.15)' : 'transparent',
      }}
    >
      <Text style={{ color: tone === 'danger' ? colors.bad : active ? colors.info : colors.muted, fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Small history chart. `signed` data (current) is centred on zero; other data is scaled to its own range. */
export function MiniChart({
  values,
  type,
  signed,
  color = colors.info,
  height = 56,
}: {
  values: number[];
  type: 'bars' | 'line' | 'area' | 'off';
  signed: boolean;
  color?: string;
  height?: number;
}) {
  const [w, setW] = useState(0);
  if (type === 'off') return null;
  if (signed && type === 'bars') return <Sparkline values={values} height={height} />;
  const shown = values.slice(-90);
  if (shown.length < 2) return <View style={{ height }} />;
  let lo: number;
  let hi: number;
  if (signed) {
    const m = Math.max(1, ...shown.map((v) => Math.abs(v)));
    lo = -m;
    hi = m;
  } else {
    lo = Math.min(...shown);
    hi = Math.max(...shown);
    const pad = Math.max(0.5, (hi - lo) * 0.15);
    lo -= pad;
    hi += pad;
  }
  const n = (v: number): number => (v - lo) / (hi - lo);
  const base = signed ? n(0) : 0;

  if (type === 'line') {
    const step = w / (shown.length - 1);
    return (
      <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {signed ? <View style={{ position: 'absolute', left: 0, right: 0, top: height / 2, height: 1, backgroundColor: colors.cardBorder }} /> : null}
        {w > 0
          ? shown.slice(1).map((v, i) => {
              const x0 = i * step;
              const y0 = (1 - n(shown[i])) * (height - 2) + 1;
              const x1 = (i + 1) * step;
              const y1 = (1 - n(v)) * (height - 2) + 1;
              const len = Math.hypot(x1 - x0, y1 - y0);
              return (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: x0,
                    top: y0 - 1,
                    width: len + 0.5,
                    height: 2.5,
                    borderRadius: 2,
                    backgroundColor: color,
                    transformOrigin: '0% 50%',
                    transform: [{ rotate: `${Math.atan2(y1 - y0, x1 - x0)}rad` }],
                  }}
                />
              );
            })
          : null}
      </View>
    );
  }

  const gap = type === 'bars' ? 1 : 0;
  return (
    <View style={{ height, flexDirection: 'row', gap }}>
      {shown.map((v, i) => {
        const a = Math.min(n(v), base);
        const b = Math.max(n(v), base);
        return (
          <View key={i} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View
              style={{
                marginBottom: a * height,
                height: Math.max(1.5, (b - a) * height),
                backgroundColor: color,
                opacity: type === 'area' ? 0.45 : 0.9,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}
