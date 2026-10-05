import type { SessionStatus } from '../protocol/types';

export const colors = {
  bg: '#0A0E13',
  card: '#121922',
  cardBorder: '#1E2833',
  text: '#E9EFF5',
  muted: '#7F8D9C',
  faint: '#46525F',
  charge: '#4ADE80',
  discharge: '#FB923C',
  warn: '#FACC15',
  bad: '#F87171',
  info: '#60A5FA',
};

export const statusColor: Record<SessionStatus, string> = {
  idle: colors.faint,
  connecting: colors.warn,
  waiting: colors.warn,
  connected: colors.charge,
  error: colors.bad,
};

export const statusLabel: Record<SessionStatus, string> = {
  idle: 'Stopped',
  connecting: 'Connecting',
  waiting: 'Retrying',
  connected: 'Live',
  error: 'Error',
};

export function socColor(soc: number): string {
  if (soc < 20) return colors.bad;
  if (soc < 40) return colors.warn;
  return colors.charge;
}

export function ampsColor(amps: number): string {
  if (Math.abs(amps) < 0.05) return colors.text;
  return amps > 0 ? colors.charge : colors.discharge;
}

export function fmt(n: number, digits = 1): string {
  return n.toFixed(digits);
}

export const mono = { fontVariant: ['tabular-nums' as const] };
