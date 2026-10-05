import { base64ToBytes } from './bytes';
import type { ThermometerReading } from './types';

/**
 * Xiaomi LYWSD03MMC running custom firmware (pvvx / ATC) broadcasts its readings in BLE advertisements,
 * so no connection is needed. Supported advertising formats (selectable in the firmware's settings):
 *  - pvvx "custom"  : service data 0x181A, 15 bytes, little-endian, 0.01 degC / 0.01 %
 *  - ATC1441        : service data 0x181A, 13 bytes, big-endian, 0.1 degC / 1 %
 *  - BTHome v2      : service data 0xFCD2, unencrypted
 */
export const THERMOMETER_NAME_PREFIXES = ['ATC_', 'PVVX', 'LYWSD03MMC', 'LYWSDCGQ', 'MJ_HT'];

export function isThermometerName(name: string): boolean {
  return THERMOMETER_NAME_PREFIXES.some((p) => name.startsWith(p));
}

const le16 = (b: number[], o: number): number => b[o] | (b[o + 1] << 8);
const be16 = (b: number[], o: number): number => (b[o] << 8) | b[o + 1];
const s16 = (v: number): number => (v & 0x8000 ? v - 0x10000 : v);

const r = (v: number, d: number): number => {
  const k = 10 ** d;
  return Math.round(v * k) / k;
};

function plausible(tempC: number, humidity: number): boolean {
  return tempC > -60 && tempC < 130 && humidity >= 0 && humidity <= 100;
}

/** Dew point in degC (Magnus formula). */
export function dewPoint(tempC: number, humidity: number): number {
  if (humidity <= 0) return NaN;
  const a = 17.62;
  const b = 243.12;
  const g = Math.log(humidity / 100) + (a * tempC) / (b + tempC);
  return (b * g) / (a - g);
}

export function parsePvvxCustom(bytes: number[], ts: number): ThermometerReading | null {
  if (bytes.length < 15) return null;
  const tempC = s16(le16(bytes, 6)) / 100;
  const humidity = le16(bytes, 8) / 100;
  if (!plausible(tempC, humidity)) return null;
  return {
    kind: 'thermometer',
    ts,
    tempC: r(tempC, 2),
    humidity: r(humidity, 2),
    batteryVolts: le16(bytes, 10) / 1000,
    batteryPercent: bytes[12],
    format: 'pvvx',
  };
}

export function parseAtc1441(bytes: number[], ts: number): ThermometerReading | null {
  if (bytes.length < 13) return null;
  const tempC = s16(be16(bytes, 6)) / 10;
  const humidity = bytes[8];
  if (!plausible(tempC, humidity)) return null;
  return {
    kind: 'thermometer',
    ts,
    tempC: r(tempC, 1),
    humidity,
    batteryPercent: bytes[9],
    batteryVolts: be16(bytes, 10) / 1000,
    format: 'atc1441',
  };
}

/** BTHome v2 object id -> data length in bytes (see bthome.io). Unknown ids end parsing. */
const BTHOME_LEN: Record<number, number> = {
  0x00: 1, 0x01: 1, 0x02: 2, 0x03: 2, 0x04: 3, 0x05: 3, 0x06: 2, 0x07: 2, 0x08: 2, 0x09: 1, 0x0a: 3, 0x0b: 3,
  0x0c: 2, 0x0d: 2, 0x0e: 2, 0x0f: 1, 0x10: 1, 0x11: 1, 0x12: 2, 0x13: 2, 0x14: 2, 0x15: 1, 0x16: 1, 0x17: 1,
  0x18: 1, 0x19: 1, 0x1a: 1, 0x1b: 1, 0x1c: 1, 0x1d: 1, 0x1e: 1, 0x1f: 1, 0x20: 1, 0x21: 1, 0x22: 1, 0x23: 1,
  0x24: 1, 0x25: 1, 0x26: 1, 0x27: 1, 0x28: 1, 0x29: 1, 0x2a: 1, 0x2b: 1, 0x2c: 1, 0x2d: 1, 0x2e: 1, 0x2f: 1,
  0x3a: 1, 0x3c: 2, 0x3d: 2, 0x3e: 4, 0x3f: 2, 0x40: 2, 0x41: 2, 0x42: 3, 0x43: 2, 0x44: 2, 0x45: 2, 0x46: 1,
  0x47: 2, 0x48: 2, 0x49: 2, 0x4a: 2, 0x4b: 3, 0x4c: 4, 0x4d: 4, 0x4e: 4, 0x4f: 4, 0x50: 4, 0x51: 2, 0x52: 2,
};

export interface BtHomeParts {
  encrypted: boolean;
  tempC?: number;
  humidity?: number;
  batteryPercent?: number;
  batteryVolts?: number;
}

/** Reads whatever temperature / humidity / battery objects a BTHome v2 packet carries (any subset). */
export function parseBtHomeParts(bytes: number[]): BtHomeParts {
  const out: BtHomeParts = { encrypted: bytes.length > 0 && (bytes[0] & 1) === 1 };
  if (bytes.length < 2 || out.encrypted) return out;
  let i = 1;
  while (i < bytes.length) {
    const id = bytes[i];
    let len = BTHOME_LEN[id];
    if (id === 0x53 || id === 0x54) len = 1 + (bytes[i + 1] ?? 0); // text / raw: length-prefixed
    if (len === undefined || i + 1 + len > bytes.length) break;
    const o = i + 1;
    if (id === 0x02) out.tempC = s16(le16(bytes, o)) / 100;
    else if (id === 0x45) out.tempC = s16(le16(bytes, o)) / 10;
    else if (id === 0x03) out.humidity = le16(bytes, o) / 100;
    else if (id === 0x2e) out.humidity = bytes[o];
    else if (id === 0x01) out.batteryPercent = bytes[o];
    else if (id === 0x0c) out.batteryVolts = le16(bytes, o) / 1000;
    i += 1 + len;
  }
  return out;
}

export function parseBtHome(bytes: number[], ts: number): ThermometerReading | null {
  const p = parseBtHomeParts(bytes);
  if (p.tempC === undefined || p.humidity === undefined || !plausible(p.tempC, p.humidity)) return null;
  return {
    kind: 'thermometer',
    ts,
    tempC: r(p.tempC, 2),
    humidity: r(p.humidity, 2),
    batteryPercent: p.batteryPercent,
    batteryVolts: p.batteryVolts,
    format: 'bthome',
  };
}

/**
 * Like parseThermometerAdvert, but also accepts packets that carry only part of the data
 * (some firmware alternates temperature, humidity and battery). The caller merges the parts.
 */
export function parseThermometerParts(
  serviceData: Record<string, string | undefined> | null | undefined,
): Partial<Omit<ThermometerReading, 'kind' | 'ts'>> | null {
  if (!serviceData) return null;
  for (const [uuid, value] of Object.entries(serviceData)) {
    if (!value) continue;
    const u = uuid.toLowerCase();
    if (!(u.includes('0000fcd2') || u === 'fcd2')) continue;
    try {
      const p = parseBtHomeParts(Array.from(base64ToBytes(value)));
      if (p.tempC !== undefined || p.humidity !== undefined || p.batteryPercent !== undefined) {
        const t = p.tempC !== undefined ? r(p.tempC, 2) : undefined;
        const h = p.humidity !== undefined ? r(p.humidity, 2) : undefined;
        if ((t !== undefined && !plausible(t, 50)) || (h !== undefined && !plausible(20, h))) continue;
        return { tempC: t, humidity: h, batteryPercent: p.batteryPercent, batteryVolts: p.batteryVolts, format: 'bthome' };
      }
    } catch {
      // fall through
    }
  }
  const full = parseThermometerAdvert(serviceData, 0);
  if (!full) return null;
  const { kind: _k, ts: _t, ...rest } = full;
  return rest;
}

/** Picks the right parser from an advertisement's service data (map of uuid -> base64). */
export function parseThermometerAdvert(
  serviceData: Record<string, string | undefined> | null | undefined,
  ts: number,
): ThermometerReading | null {
  if (!serviceData) return null;
  for (const [uuid, value] of Object.entries(serviceData)) {
    if (!value) continue;
    const u = uuid.toLowerCase();
    let bytes: number[];
    try {
      bytes = Array.from(base64ToBytes(value));
    } catch {
      continue;
    }
    if (u.includes('0000181a') || u === '181a') {
      const parsed = bytes.length >= 15 ? parsePvvxCustom(bytes, ts) : parseAtc1441(bytes, ts);
      if (parsed) return parsed;
    } else if (u.includes('0000fcd2') || u === 'fcd2') {
      const parsed = parseBtHome(bytes, ts);
      if (parsed) return parsed;
    }
  }
  return null;
}

const short = (uuid: string): string => {
  const m = /^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/i.exec(uuid);
  return (m ? m[1] : uuid).toUpperCase();
};

/**
 * Explains in plain words what a device is broadcasting when none of the supported formats matched,
 * so a wrong firmware or format setting is obvious instead of just "no data".
 */
export function describeAdvert(serviceData: Record<string, string | undefined> | null | undefined): string {
  const entries = Object.entries(serviceData ?? {}).filter(([, v]) => !!v);
  if (entries.length === 0) {
    return 'The sensor sends no service data. Stock Xiaomi firmware or a very weak battery.';
  }
  const parts: string[] = [];
  for (const [uuid, value] of entries) {
    const id = short(uuid);
    let len = 0;
    try {
      len = base64ToBytes(value as string).length;
    } catch {
      // ignore
    }
    if (id === 'FE95') parts.push('FE95 = Xiaomi original/encrypted format. Flash the custom firmware, or set the advertising format to ATC1441/custom/BTHome and turn encryption off.');
    else if (id === 'FCD2') {
      let bytes: number[] = [];
      try {
        bytes = Array.from(base64ToBytes(value as string));
      } catch {
        // ignore
      }
      parts.push(
        bytes.length > 0 && (bytes[0] & 1) === 1
          ? 'FCD2 = BTHome ENCRYPTED. In the sensor settings (flasher page) turn encryption off.'
          : `FCD2 = BTHome without temperature/humidity. Raw: ${bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')}`,
      );
    }
    else if (id === '181A') parts.push(`181A with ${len} bytes. Expected 13 (ATC1441) or 15 (custom).`);
    else parts.push(`${id} (${len} bytes)`);
  }
  return parts.join(' | ');
}
