import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { DeviceKind, Reading, SessionStatus } from '../protocol/types';
import type { TiltSettings } from '../protocol/tilt';

export type ChartType = 'bars' | 'line' | 'area' | 'off';

export interface SavedDevice {
  id: string;
  name: string;
  alias: string;
  kind: DeviceKind;
  /** Modbus unit id for Renogy controllers (255 = broadcast, fine for a single device). */
  modbusId?: number;
  /** Battery capacity, used only to estimate remaining time from the shunt. */
  capacityAh?: number;
  /** Free-text place or purpose, e.g. "Trunk" or "Fridge". */
  label?: string;
  /** Thermometers: display unit and calibration offsets applied when showing values. */
  tempUnit?: 'C' | 'F';
  tempOffset?: number;
  humOffset?: number;
  /** Widget options on the dashboard. */
  chart?: ChartType;
  /** Legacy: replaced by span. */
  size?: 'normal' | 'wide';
  /** Dashboard widget size, set by dragging: width in grid columns (of 6) and height in grid rows (unset = automatic). */
  span?: number;
  rows?: number;
  col?: number;
  row?: number;
  /** Grid version; 2 = fine rows. Older saves are converted on load. */
  gv?: number;
  /** Picture widget: local file chosen by the user (the built-in emblem is used when empty). */
  logoUri?: string;
  /** Clinometer widget settings. */
  tilt?: Partial<TiltSettings>;
}

export interface DeviceStatus {
  status: SessionStatus;
  message?: string;
}

export interface AppState {
  ready: boolean;
  /** Dashboard edit mode: when false (locked) the widgets show no settings or editing controls. */
  unlocked: boolean;
  devices: SavedDevice[];
  readings: Record<string, Reading | undefined>;
  statuses: Record<string, DeviceStatus | undefined>;
  /** Recent main value per device (current in A, or temperature for thermometers), newest last, for the sparklines. */
  history: Record<string, number[] | undefined>;
}

const STORAGE_KEY = 'jeepmonitor.devices.v1';
const HISTORY_LEN = 180;

let state: AppState = { ready: false, unlocked: false, devices: [], readings: {}, statuses: {}, history: {} };
const listeners = new Set<() => void>();

function set(next: Partial<AppState>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export const store = {
  get: (): AppState => state,
  subscribe: (l: () => void): (() => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(state));
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.devices));
  } catch {
    // storage is best effort
  }
}

export async function loadDevices(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const devices = (raw ? (JSON.parse(raw) as SavedDevice[]) : []).map((d) =>
      d.gv === 2
        ? d
        : {
            ...d,
            gv: 2,
            rows: d.rows !== undefined ? Math.max(1, Math.round(d.rows * 1.7)) : undefined,
            row: d.row !== undefined ? Math.round(d.row * 1.7) : undefined,
          },
    );
    set({ devices, ready: true });
  } catch {
    set({ ready: true });
  }
}

export function addDevice(device: SavedDevice): void {
  if (state.devices.some((d) => d.id === device.id)) return;
  set({ devices: [...state.devices, { ...device, gv: 2 }] });
  void persist();
}

export function updateDevice(id: string, patch: Partial<SavedDevice>): void {
  set({ devices: state.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  void persist();
}

export function removeDevice(id: string): void {
  const { [id]: _r, ...readings } = state.readings;
  const { [id]: _s, ...statuses } = state.statuses;
  const { [id]: _h, ...history } = state.history;
  set({ devices: state.devices.filter((d) => d.id !== id), readings, statuses, history });
  void persist();
}

export function setStatus(id: string, status: SessionStatus, message?: string): void {
  set({ statuses: { ...state.statuses, [id]: { status, message } } });
}

export function setReading(id: string, reading: Reading): void {
  const prev = state.history[id] ?? [];
  const amps =
    reading.kind === 'shunt300' ? reading.amps : reading.kind === 'thermometer' ? reading.tempC : reading.chargeAmps;
  const history = [...prev, amps].slice(-HISTORY_LEN);
  set({
    readings: { ...state.readings, [id]: reading },
    history: { ...state.history, [id]: history },
  });
}

export function setUnlocked(unlocked: boolean): void {
  set({ unlocked });
}

/** Moves a device one step earlier (-1) or later (+1) among the given visible devices. */
export function moveDevice(id: string, dir: -1 | 1, visibleIds: string[]): void {
  const at = visibleIds.indexOf(id);
  const otherId = visibleIds[at + dir];
  if (at < 0 || !otherId) return;
  const devices = [...state.devices];
  const a = devices.findIndex((d) => d.id === id);
  const b = devices.findIndex((d) => d.id === otherId);
  if (a < 0 || b < 0) return;
  [devices[a], devices[b]] = [devices[b], devices[a]];
  set({ devices });
  void persist();
}

/** Moves a widget to the position of another one (drag and drop on the dashboard). */
export function reorderDevice(id: string, targetId: string): void {
  const devices = [...state.devices];
  const from = devices.findIndex((d) => d.id === id);
  const to = devices.findIndex((d) => d.id === targetId);
  if (from < 0 || to < 0 || from === to) return;
  const [moved] = devices.splice(from, 1);
  devices.splice(to, 0, moved);
  set({ devices });
  void persist();
}
