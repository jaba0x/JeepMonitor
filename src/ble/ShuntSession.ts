import type { Device } from 'react-native-ble-plx';
import { BleSession, findCharacteristic } from './session';
import { base64ToBytes } from '../protocol/bytes';
import { parseShuntNotification, SHUNT_NOTIFY_CHARACTERISTIC } from '../protocol/shunt300';

/** Renogy Smart Shunt 300: purely notification driven, nothing to write. */
export class ShuntSession extends BleSession {
  private lastEmit = 0;

  protected async serve(device: Device): Promise<void> {
    const characteristic = await findCharacteristic(device, SHUNT_NOTIFY_CHARACTERISTIC);
    await new Promise<void>((_resolve, reject) => {
      const sub = characteristic.monitor((error, c) => {
        if (error) {
          reject(error);
          return;
        }
        if (!c?.value) return;
        const now = Date.now();
        if (now - this.lastEmit < 1000) return;
        const reading = parseShuntNotification(base64ToBytes(c.value), now);
        if (!reading) return;
        this.lastEmit = now;
        this.emit.reading(reading);
      });
      this.onEnd(() => sub.remove());
    });
  }
}
