export interface TimeEstimate {
  mode: 'discharging' | 'charging' | 'idle';
  hours: number | null;
}

/**
 * Remaining runtime (discharging) or time to full (charging) from SOC, capacity and current.
 * Positive amps = charging. Returns null hours when the capacity is unknown or the current is ~0.
 */
export function estimateTime(socPercent: number, capacityAh: number | undefined, amps: number): TimeEstimate {
  if (!capacityAh || capacityAh <= 0 || Math.abs(amps) < 0.05) return { mode: 'idle', hours: null };
  if (amps < 0) return { mode: 'discharging', hours: ((socPercent / 100) * capacityAh) / -amps };
  return { mode: 'charging', hours: (((100 - socPercent) / 100) * capacityAh) / amps };
}

export function formatDuration(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return '--';
  if (hours >= 240) return '10d+';
  if (hours >= 48) return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
  if (hours >= 1) return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
  return `${Math.max(1, Math.round(hours * 60))}m`;
}
