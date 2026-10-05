import { intBE, round, uintBE } from './bytes';
import type { ShuntReading } from './types';

/**
 * Renogy Smart Shunt 300 streams status notifications on this characteristic.
 * The owning service UUID is not documented, so look the characteristic up across all services.
 *
 * Layout (from the community `renogy-bt` project; verify against your own unit):
 *   byte 1        operation, 87 (0x57) = status report
 *   bytes 21..23  current, signed, mA
 *   bytes 25..27  main battery voltage, mV
 *   bytes 30..31  starter battery voltage, mV
 *   bytes 34..35  state of charge, 0.1 %
 *   bytes 66..67  battery temperature, 0.1 degC
 */
export const SHUNT_NOTIFY_CHARACTERISTIC = '0000c411-0000-1000-8000-00805f9b34fb';
export const SHUNT_STATUS_OPERATION = 87;
export const SHUNT_MIN_LENGTH = 68;
export const SHUNT_NAME_PREFIX = 'RTMShunt';

export function parseShuntNotification(bytes: Uint8Array, ts = Date.now()): ShuntReading | null {
  if (bytes.length < SHUNT_MIN_LENGTH) return null;
  if (bytes[1] !== SHUNT_STATUS_OPERATION) return null;

  const batteryVolts = uintBE(bytes, 25, 3) * 0.001;
  const amps = intBE(bytes, 21, 3) * 0.001;
  return {
    kind: 'shunt300',
    ts,
    socPercent: round(uintBE(bytes, 34, 2) * 0.1, 1),
    batteryVolts: round(batteryVolts, 2),
    starterVolts: round(uintBE(bytes, 30, 2) * 0.001, 2),
    amps: round(amps, 2),
    watts: round(batteryVolts * amps, 1),
    tempC: round(uintBE(bytes, 66, 2) * 0.1, 1),
  };
}
