import { ScanMode, type Device } from 'react-native-ble-plx';
import { ensureBlePermissions, errorMessage, getBleManager } from './manager';
import { RENOGY_NAME_PREFIXES } from '../protocol/renogyDcc';
import { SHUNT_NAME_PREFIX } from '../protocol/shunt300';
import { isThermometerName } from '../protocol/thermometer';
import type { DeviceKind } from '../protocol/types';

export interface ScanResult {
  id: string;
  name: string;
  rssi: number | null;
  seenAt: number;
}

/** Best guess at which driver a device needs, from its advertised name. */
export function guessKind(name: string): DeviceKind {
  if (name.startsWith(SHUNT_NAME_PREFIX)) return 'shunt300';
  if (RENOGY_NAME_PREFIXES.some((p) => name.startsWith(p))) return 'renogy-dcc';
  if (isThermometerName(name)) return 'thermometer';
  return 'explorer';
}

/** True for devices this app knows how to read (used by the "known devices only" filter). */
export function isKnownName(name: string): boolean {
  return guessKind(name) !== 'explorer' || /renogy/i.test(name);
}

export function deviceName(device: Device): string {
  return device.name ?? device.localName ?? '(unnamed)';
}

// One shared BLE scan serves every listener (the Add-device list and the passive thermometer sessions),
// because the platform allows only one scan per app and restarting scans too often gets throttled.
interface Listener {
  onDevice: (device: Device) => void;
  onError: (message: string) => void;
}
const listeners = new Set<Listener>();
let running = false;

function startIfNeeded(): void {
  if (running || listeners.size === 0) return;
  running = true;
  getBleManager().startDeviceScan(null, { allowDuplicates: true, scanMode: ScanMode.LowLatency }, (error, device) => {
    if (error) {
      running = false;
      try {
        getBleManager().stopDeviceScan();
      } catch {
        // already stopped
      }
      const message = errorMessage(error);
      for (const l of [...listeners]) l.onError(message);
      return;
    }
    if (device) for (const l of listeners) l.onDevice(device);
  });
}

function stopIfIdle(): void {
  if (listeners.size === 0 && running) {
    running = false;
    getBleManager().stopDeviceScan();
  }
}

/** Receives every advertisement while subscribed. Returns an unsubscribe function. */
export async function subscribeScan(
  onDevice: (device: Device) => void,
  onError: (message: string) => void,
): Promise<() => void> {
  if (!(await ensureBlePermissions())) {
    onError('Bluetooth permission was denied.');
    return () => {};
  }
  const listener: Listener = { onDevice, onError };
  listeners.add(listener);
  startIfNeeded();
  return () => {
    listeners.delete(listener);
    stopIfIdle();
  };
}

/** Scan for the device picker: each device is reported once. Returns a stop function. */
export async function startScan(
  onResult: (r: ScanResult) => void,
  onError: (message: string) => void,
): Promise<() => void> {
  const seen = new Set<string>();
  return subscribeScan((device) => {
    if (seen.has(device.id)) return;
    seen.add(device.id);
    onResult({ id: device.id, name: deviceName(device), rssi: device.rssi, seenAt: Date.now() });
  }, onError);
}
