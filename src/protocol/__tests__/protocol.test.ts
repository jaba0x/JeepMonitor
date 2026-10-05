import { describe, expect, it } from 'vitest';
import { fromHex, intBE, toHex, uintBE, base64ToBytes, bytesToBase64 } from '../bytes';
import { buildReadRequest, checkReadResponse, crc16Modbus, FrameAssembler, hasValidCrc } from '../modbus';
import { parseShuntNotification } from '../shunt300';
import { applyDccSection, DCC_SECTIONS, emptyDccReading, parseTemperature } from '../renogyDcc';

describe('bytes', () => {
  it('round-trips base64', () => {
    const b = Uint8Array.from([0, 1, 2, 250, 255]);
    expect(Array.from(base64ToBytes(bytesToBase64(b)))).toEqual(Array.from(b));
  });
  it('reads big-endian unsigned and signed values', () => {
    const b = Uint8Array.from([0xff, 0xff, 0xfe, 0x00, 0x03, 0xe8]);
    expect(intBE(b, 0, 3)).toBe(-2);
    expect(uintBE(b, 3, 3)).toBe(1000);
    expect(uintBE(b, 5, 3)).toBe(0); // too short -> 0
  });
  it('hex helpers', () => {
    expect(toHex(fromHex('ff 03 01'))).toBe('ff 03 01');
  });
});

describe('modbus', () => {
  // Frames captured/documented by the renogy-bt and Renogy-BT2-Reader projects.
  it('builds the documented read requests (CRC low byte first)', () => {
    expect(toHex(buildReadRequest(0xff, 0x0100, 0x22))).toBe('ff 03 01 00 00 22 d1 f1');
    expect(toHex(buildReadRequest(0xff, 0x0100, 7))).toBe('ff 03 01 00 00 07 10 2a');
  });
  it('validates the documented BT-2 response', () => {
    const frame = fromHex('ff 03 0e 00 64 00 85 00 00 10 10 00 7a 00 00 00 00 31 68');
    expect(hasValidCrc(frame)).toBe(true);
    expect(checkReadResponse(frame, 7)).toEqual({ ok: true });
    expect(crc16Modbus(frame.slice(0, -2))).toBe(0x6831);
  });
  it('rejects corrupted, short and exception frames', () => {
    const good = fromHex('ff 03 0e 00 64 00 85 00 00 10 10 00 7a 00 00 00 00 31 68');
    const bad = Uint8Array.from(good);
    bad[4] ^= 1;
    expect(checkReadResponse(bad, 7)).toEqual({ ok: false, reason: 'crc' });
    expect(checkReadResponse(good.slice(0, 10), 7)).toEqual({ ok: false, reason: 'length' });
    expect(checkReadResponse(fromHex('ff 83 02 c0 f1'), 7)).toEqual({ ok: false, reason: 'exception' });
  });
  it('reassembles a response split across 20-byte notifications', () => {
    const frame = fromHex('ff 03 0e 00 64 00 85 00 00 10 10 00 7a 00 00 00 00 31 68');
    const a = new FrameAssembler();
    a.expect(7);
    expect(a.push(frame.slice(0, 7))).toBeNull();
    expect(a.push(frame.slice(7, 14))).toBeNull();
    const out = a.push(frame.slice(14));
    expect(out && toHex(out)).toBe(toHex(frame));
    expect(a.push(frame)).toBeNull(); // nothing expected until expect() is called again
  });
  it('returns a short exception reply without waiting for the full length', () => {
    const a = new FrameAssembler();
    a.expect(30);
    const out = a.push(fromHex('ff 83 02 c0 f1'));
    expect(out?.length).toBe(5);
  });
});

function shuntPacket(): Uint8Array {
  const p = new Uint8Array(80);
  p[1] = 87;
  p.set([0xff, 0xff, 0x2a], 21); // -214 mA
  p.set([0x00, 0x32, 0xc8], 25); // 13_000 mV -> 13.0 V (0x0032C8 = 13000)
  p.set([0x2f, 0x58], 30); // 12_120 mV
  p.set([0x03, 0x66], 34); // 870 -> 87.0 %
  p.set([0x00, 0xfa], 66); // 250 -> 25.0 C
  return p;
}

describe('shunt300', () => {
  it('parses a status notification', () => {
    const r = parseShuntNotification(shuntPacket(), 1)!;
    expect(r.kind).toBe('shunt300');
    expect(r.socPercent).toBe(87);
    expect(r.batteryVolts).toBe(13);
    expect(r.amps).toBe(-0.21);
    expect(r.watts).toBe(-2.8);
    expect(r.starterVolts).toBe(12.12);
    expect(r.tempC).toBe(25);
  });
  it('ignores other operations and short packets', () => {
    const p = shuntPacket();
    p[1] = 1;
    expect(parseShuntNotification(p)).toBeNull();
    expect(parseShuntNotification(new Uint8Array(10))).toBeNull();
  });
});

describe('renogy dcc', () => {
  it('has the expected section list', () => {
    expect(DCC_SECTIONS.map((s) => s.register)).toEqual([12, 26, 256, 288, 57348]);
  });
  it('decodes temperatures with a sign bit', () => {
    expect(parseTemperature(25)).toBe(25);
    expect(parseTemperature(0x80 | 5)).toBe(-5 + 0); // 133 -> -(133-128) = -5
  });
  it('parses the charging block (BT-2 documented values + synthetic fields)', () => {
    const f = new Uint8Array(65);
    f[0] = 0xff;
    f[1] = 3;
    f[2] = 60;
    f.set([0x00, 0x64], 3); // SOC 100
    f.set([0x00, 0x85], 5); // 13.3 V
    f.set([0x03, 0xe8], 7); // 10.00 A
    f[9] = 18;
    f[10] = 0x85; // -5 C
    f.set([0x00, 0x81], 11); // 12.9 V alt
    f.set([0x01, 0xf4], 13); // 5.00 A
    f.set([0x00, 0x41], 15); // 65 W
    const r = applyDccSection(emptyDccReading(), 'charging', f);
    expect(r.socPercent).toBe(100);
    expect(r.batteryVolts).toBe(13.3);
    expect(r.chargeAmps).toBe(10);
    expect(r.controllerTempC).toBe(18);
    expect(r.batteryTempC).toBe(-5);
    expect(r.alternatorVolts).toBe(12.9);
    expect(r.alternatorAmps).toBe(5);
    expect(r.alternatorWatts).toBe(65);
  });
  it('parses the extra daily and lifetime fields', () => {
    const f = new Uint8Array(65);
    f.set([0x00, 0x7d], 25); // 12.5 V min
    f.set([0x00, 0x91], 27); // 14.5 V max
    f.set([0x07, 0xd0], 29); // 20.00 A
    f.set([0x00, 0x0c], 45); // 12 days
    f.set([0x00, 0x02], 47);
    f.set([0x00, 0x01], 49);
    const r = applyDccSection(emptyDccReading(), 'charging', f);
    expect(r.minBatteryVoltsToday).toBe(12.5);
    expect(r.maxBatteryVoltsToday).toBe(14.5);
    expect(r.maxChargeAmpsToday).toBe(20);
    expect(r.daysRunning).toBe(12);
    expect(r.overDischarges).toBe(2);
    expect(r.overCharges).toBe(1);
  });
  it('maps charging state and faults', () => {
    const f = fromHex('ff 03 06 00 06 00 00 00 01 00 00');
    const r = applyDccSection(emptyDccReading(), 'state', f);
    expect(r.chargingState).toBe('Current limiting');
    expect(r.fault).toBe('Battery over-discharge');
  });
});
