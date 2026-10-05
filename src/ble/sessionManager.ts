import type { Session } from './session';
import { driverFor } from './registry';
import { setReading, setStatus, store, type SavedDevice } from '../state/store';

/** Devices the user switched off by hand; they stay off until connected again. */
const paused = new Set<string>();
const sessions = new Map<string, { session: Session; kind: string; modbusId?: number }>();

/** Makes the running sessions match the saved device list. Safe to call whenever the list changes. */
export function syncSessions(devices: SavedDevice[]): void {
  const wanted = new Set(devices.map((d) => d.id));

  for (const [id, entry] of sessions) {
    const device = devices.find((d) => d.id === id);
    const changed = device && (device.kind !== entry.kind || device.modbusId !== entry.modbusId);
    if (!wanted.has(id) || changed) {
      void entry.session.stop();
      sessions.delete(id);
    }
  }

  for (const device of devices) {
    if (sessions.has(device.id) || paused.has(device.id)) continue;
    const create = driverFor(device.kind).create;
    if (!create) continue;
    const session = create(device, {
      status: (status, message) => setStatus(device.id, status, message),
      reading: (reading) => setReading(device.id, reading),
    });
    sessions.set(device.id, { session, kind: device.kind, modbusId: device.modbusId });
    session.start();
  }
}

export function stopAllSessions(): void {
  for (const { session } of sessions.values()) void session.stop();
  sessions.clear();
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function stopOne(id: string): Promise<void> {
  const entry = sessions.get(id);
  if (!entry) return;
  sessions.delete(id);
  await entry.session.stop();
  await sleep(700); // let the old link close before a new one opens
}

/** Drops the link and keeps it off until `connectDevice`. */
export async function disconnectDevice(id: string): Promise<void> {
  paused.add(id);
  await stopOne(id);
  setStatus(id, 'idle', 'Disconnected');
}

export function connectDevice(id: string): void {
  paused.delete(id);
  syncSessions(store.get().devices);
}

/** Drops the link and opens a fresh one right away. */
export async function refreshDevice(id: string): Promise<void> {
  paused.delete(id);
  await stopOne(id);
  syncSessions(store.get().devices);
}
