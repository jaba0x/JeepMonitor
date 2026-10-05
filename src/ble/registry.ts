import type { Session, SessionEmitter } from './session';
import { AdvertSession } from './AdvertSession';
import { DccSession } from './DccSession';
import { ShuntSession } from './ShuntSession';
import type { SavedDevice } from '../state/store';
import type { DeviceKind } from '../protocol/types';

/**
 * Driver registry. To support a new device later (ONE Core, JeepLogger, ...):
 *  1. add a parser under src/protocol and a BleSession subclass under src/ble,
 *  2. add its kind to DeviceKind,
 *  3. register it here and add a card for it in src/ui/DeviceCard.tsx.
 */
export interface DriverInfo {
  kind: DeviceKind;
  label: string;
  description: string;
  /** Absent for tools that are not live data sources. */
  create?: (device: SavedDevice, emit: SessionEmitter) => Session;
}

export const DRIVERS: DriverInfo[] = [
  {
    kind: 'shunt300',
    label: 'Renogy Smart Shunt 300',
    description: 'Battery SOC, voltage, current, temperature (BLE notifications)',
    create: (d, emit) => new ShuntSession(d.id, emit),
  },
  {
    kind: 'renogy-dcc',
    label: 'Renogy controller / DC-DC (BT-1, BT-2)',
    description: 'Modbus over BLE. Needs a BT-1/BT-2 module on the device.',
    create: (d, emit) => new DccSession(d.id, emit, d.modbusId ?? 0xff),
  },
  {
    kind: 'thermometer',
    label: 'Xiaomi LYWSD03MMC thermometer (custom firmware)',
    description: 'Temperature and humidity from BLE advertisements (pvvx / ATC firmware). No connection needed.',
    create: (d, emit) => new AdvertSession(d.id, emit),
  },
  {
    kind: 'clinometer',
    label: 'Clinometer (pitch and roll)',
    description: "Uses this tablet's tilt sensor. Mount-aware, with fullscreen.",
  },
  {
    kind: 'logo',
    label: 'Logo / picture',
    description: 'Show your own picture or emblem on the dashboard',
  },
  {
    kind: 'explorer',
    label: 'Unknown device (GATT explorer)',
    description: 'Inspect services and log raw packets, e.g. the ONE Core',
  },
];

export function driverFor(kind: DeviceKind): DriverInfo {
  return DRIVERS.find((d) => d.kind === kind) ?? DRIVERS[DRIVERS.length - 1];
}
