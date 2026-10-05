import { round, uintBE } from './bytes';
import type { DccReading } from './types';

/**
 * Renogy DC-DC charger (DCC30S / DCC50S / RBC..D1S family) over a BT-1 / BT-2 module.
 * Transport: write requests to FFD1 (service FFD0), receive notifications on FFF1.
 * Register map taken from the community `renogy-bt` project and the BT-2 reverse-engineering notes.
 */
export const DCC_WRITE_SERVICE = '0000ffd0-0000-1000-8000-00805f9b34fb';
export const DCC_WRITE_CHARACTERISTIC = '0000ffd1-0000-1000-8000-00805f9b34fb';
export const DCC_NOTIFY_CHARACTERISTIC = '0000fff1-0000-1000-8000-00805f9b34fb';
/** Modbus ids tried, after the configured one, when a device does not answer. */
export const DCC_PROBE_IDS = [0xff, 0x01, 0x10, 0x11, 0x20, 0x30];
export const RENOGY_NAME_PREFIXES = ['BT-TH', 'RNGRBP', 'BTRIC', 'RNGRIU'];

export const CHARGING_STATE: Record<number, string> = {
  0: 'Off',
  1: 'Activated',
  2: 'MPPT',
  3: 'Equalizing',
  4: 'Boost',
  5: 'Float',
  6: 'Current limiting',
  8: 'Alternator direct',
};

export const BATTERY_TYPE: Record<number, string> = {
  1: 'Open',
  2: 'Sealed',
  3: 'Gel',
  4: 'Lithium',
  5: 'Custom',
};

export interface DccSection {
  name: 'info' | 'address' | 'charging' | 'state' | 'batteryType';
  register: number;
  words: number;
}

export const DCC_SECTIONS: DccSection[] = [
  { name: 'info', register: 12, words: 8 },
  { name: 'address', register: 26, words: 1 },
  { name: 'charging', register: 256, words: 30 },
  { name: 'state', register: 288, words: 3 },
  { name: 'batteryType', register: 57348, words: 1 },
];

/** Renogy temperature bytes use bit 7 as a sign flag. */
export function parseTemperature(raw: number): number {
  return raw & 0x80 ? -(raw - 128) : raw;
}

export function emptyDccReading(ts = Date.now()): DccReading {
  return {
    kind: 'renogy-dcc',
    ts,
    socPercent: 0,
    batteryVolts: 0,
    chargeAmps: 0,
    controllerTempC: 0,
    batteryTempC: 0,
    alternatorVolts: 0,
    alternatorAmps: 0,
    alternatorWatts: 0,
    solarVolts: 0,
    solarAmps: 0,
    solarWatts: 0,
    todayAmpHours: 0,
    todayWattHours: 0,
    maxPowerTodayW: 0,
    totalWattHours: 0,
    totalAmpHours: 0,
  };
}

/** `frame` is a full, CRC-checked Modbus response (header at bytes 0..2, data from byte 3). */
export function applyDccSection(reading: DccReading, section: DccSection['name'], frame: Uint8Array): DccReading {
  const next: DccReading = { ...reading, ts: Date.now() };
  switch (section) {
    case 'info': {
      let model = '';
      for (let i = 3; i < 19 && i < frame.length; i++) if (frame[i] > 0x20 && frame[i] < 0x7f) model += String.fromCharCode(frame[i]);
      next.model = model.trim();
      break;
    }
    case 'address':
      next.deviceId = frame[4];
      break;
    case 'charging':
      next.socPercent = uintBE(frame, 3, 2);
      next.batteryVolts = round(uintBE(frame, 5, 2) * 0.1, 1);
      next.chargeAmps = round(uintBE(frame, 7, 2) * 0.01, 2);
      next.controllerTempC = parseTemperature(frame[9]);
      next.batteryTempC = parseTemperature(frame[10]);
      next.alternatorVolts = round(uintBE(frame, 11, 2) * 0.1, 1);
      next.alternatorAmps = round(uintBE(frame, 13, 2) * 0.01, 2);
      next.alternatorWatts = uintBE(frame, 15, 2);
      next.solarVolts = round(uintBE(frame, 17, 2) * 0.1, 1);
      next.solarAmps = round(uintBE(frame, 19, 2) * 0.01, 2);
      next.solarWatts = uintBE(frame, 21, 2);
      next.minBatteryVoltsToday = round(uintBE(frame, 25, 2) * 0.1, 1);
      next.maxBatteryVoltsToday = round(uintBE(frame, 27, 2) * 0.1, 1);
      next.maxChargeAmpsToday = round(uintBE(frame, 29, 2) * 0.01, 2);
      next.maxPowerTodayW = uintBE(frame, 33, 2);
      next.todayAmpHours = uintBE(frame, 37, 2);
      next.todayWattHours = uintBE(frame, 41, 2);
      next.daysRunning = uintBE(frame, 45, 2);
      next.overDischarges = uintBE(frame, 47, 2);
      next.overCharges = uintBE(frame, 49, 2);
      next.totalAmpHours = uintBE(frame, 51, 4);
      next.totalWattHours = uintBE(frame, 59, 4);
      break;
    case 'state': {
      // Status word 0x0120 (low byte = charging state), then two fault words.
      next.chargingState = CHARGING_STATE[frame[4]] ?? `State ${frame[4]}`;
      const w1 = uintBE(frame, 5, 2);
      const w2 = uintBE(frame, 7, 2);
      next.fault = firstFault(w1, w2);
      break;
    }
    case 'batteryType':
      next.batteryType = BATTERY_TYPE[uintBE(frame, 3, 2)];
      break;
  }
  return next;
}

const FAULTS_W1: [number, string][] = [
  [11, 'Low temperature shutdown'],
  [10, 'BMS overcharge protection'],
  [9, 'Starter reverse polarity'],
  [8, 'Alternator over-voltage'],
  [4, 'Alternator over-current'],
  [3, 'Controller over-temperature (2)'],
];
const FAULTS_W2: [number, string][] = [
  [12, 'Solar reverse polarity'],
  [9, 'Solar over-voltage'],
  [7, 'Solar over-current'],
  [6, 'Battery over-temperature'],
  [5, 'Controller over-temperature'],
  [2, 'Battery low voltage'],
  [1, 'Battery over-voltage'],
  [0, 'Battery over-discharge'],
];

function firstFault(w1: number, w2: number): string | undefined {
  for (const [bit, label] of FAULTS_W1) if ((w1 >> bit) & 1) return label;
  for (const [bit, label] of FAULTS_W2) if ((w2 >> bit) & 1) return label;
  return undefined;
}
