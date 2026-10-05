import { describe, expect, it } from 'vitest';
import { bytesToBase64, fromHex } from '../bytes';
import { dewPoint, parseThermometerAdvert } from '../thermometer';

const b64 = (hex: string) => bytesToBase64(fromHex(hex));
const U181A = '0000181a-0000-1000-8000-00805f9b34fb';
const UFCD2 = '0000fcd2-0000-1000-8000-00805f9b34fb';

describe('thermometer adverts', () => {
  it('parses pvvx custom format', () => {
    // mac, temp 21.50 C, humidity 45.23 %, 3012 mV, 85 %, counter, flags
    const r = parseThermometerAdvert({ [U181A]: b64('a1b2c3d4e5f6' + '6608' + 'ab11' + 'c40b' + '55' + '07' + '00') }, 1);
    expect(r).toMatchObject({ tempC: 21.5, humidity: 45.23, batteryPercent: 85, batteryVolts: 3.012, format: 'pvvx' });
  });

  it('parses negative temperatures (pvvx)', () => {
    // -5.25 C = -525 = 0xFDF3
    const r = parseThermometerAdvert({ [U181A]: b64('a1b2c3d4e5f6' + 'f3fd' + '1027' + 'c40b' + '55' + '01' + '00') }, 1);
    expect(r?.tempC).toBe(-5.25);
    expect(r?.humidity).toBe(100);
  });

  it('parses ATC1441 format', () => {
    // mac, 21.5 C (215 = 0x00d7), 45 %, 85 %, 3012 mV (0x0bc4), counter
    const r = parseThermometerAdvert({ [U181A]: b64('a1b2c3d4e5f6' + '00d7' + '2d' + '55' + '0bc4' + '07') }, 1);
    expect(r).toMatchObject({ tempC: 21.5, humidity: 45, batteryPercent: 85, batteryVolts: 3.012, format: 'atc1441' });
  });

  it('parses unencrypted BTHome v2', () => {
    const r = parseThermometerAdvert({ [UFCD2]: b64('40' + '0007' + '0155' + '026608' + '03ab11') }, 1);
    expect(r).toMatchObject({ tempC: 21.5, humidity: 45.23, batteryPercent: 85, format: 'bthome' });
  });

  it('ignores encrypted BTHome, junk and missing data', () => {
    expect(parseThermometerAdvert({ [UFCD2]: b64('41' + '026608') }, 1)).toBeNull();
    expect(parseThermometerAdvert({ [U181A]: b64('0102') }, 1)).toBeNull();
    expect(parseThermometerAdvert(undefined, 1)).toBeNull();
    expect(parseThermometerAdvert({}, 1)).toBeNull();
  });

  it('computes dew point', () => {
    expect(dewPoint(20, 50)).toBeCloseTo(9.3, 1);
  });
});

import { describeAdvert } from '../thermometer';

describe('describeAdvert', () => {
  it('names stock Xiaomi firmware', () => {
    expect(describeAdvert({ '0000fe95-0000-1000-8000-00805f9b34fb': b64('0102030405') })).toContain('FE95');
  });
  it('reports unexpected 181A length', () => {
    expect(describeAdvert({ [U181A]: b64('0102030405') })).toContain('5 bytes');
  });
  it('handles no service data', () => {
    expect(describeAdvert({})).toContain('no service data');
  });
});
