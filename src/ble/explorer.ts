import type { Characteristic, Device, Subscription } from 'react-native-ble-plx';
import { errorMessage, getBleManager } from './manager';
import { base64ToBytes, toHex } from '../protocol/bytes';

export interface GattEntry {
  service: string;
  characteristic: string;
  props: string[];
}

function props(c: Characteristic): string[] {
  const p: string[] = [];
  if (c.isReadable) p.push('read');
  if (c.isWritableWithResponse) p.push('write');
  if (c.isWritableWithoutResponse) p.push('write-nr');
  if (c.isNotifiable) p.push('notify');
  if (c.isIndicatable) p.push('indicate');
  return p;
}

/**
 * Connects to any BLE device, lists its GATT table and logs every notification as hex.
 * This is how an undocumented device (like the Renogy ONE Core) is reverse engineered:
 * run it while the official app shows data, then compare the packets with the screen.
 */
export class GattExplorer {
  private device: Device | null = null;
  private subs: Subscription[] = [];
  private chars: Characteristic[] = [];

  constructor(
    private readonly deviceId: string,
    private readonly log: (line: string) => void,
  ) {}

  private stamp(): string {
    return new Date().toISOString().slice(11, 23);
  }

  async connect(): Promise<GattEntry[]> {
    this.log(`${this.stamp()} connecting to ${this.deviceId}`);
    const device = await getBleManager().connectToDevice(this.deviceId, { requestMTU: 247, timeout: 20000 });
    this.device = device;
    device.onDisconnected((error) => this.log(`${this.stamp()} disconnected ${error ? errorMessage(error) : ''}`));
    await device.discoverAllServicesAndCharacteristics();
    const entries: GattEntry[] = [];
    for (const service of await device.services()) {
      for (const c of await service.characteristics()) {
        this.chars.push(c);
        entries.push({ service: service.uuid, characteristic: c.uuid, props: props(c) });
        this.log(`GATT ${service.uuid} / ${c.uuid} [${props(c).join(',')}]`);
      }
    }
    return entries;
  }

  /** Subscribes to every notifying / indicating characteristic and logs each packet. */
  subscribeAll(): void {
    for (const c of this.chars) {
      if (!c.isNotifiable && !c.isIndicatable) continue;
      const sub = c.monitor((error, updated) => {
        if (error) {
          this.log(`${this.stamp()} ERR ${c.uuid.slice(4, 8)} ${errorMessage(error)}`);
          return;
        }
        if (updated?.value) {
          const bytes = base64ToBytes(updated.value);
          this.log(`${this.stamp()} N ${c.uuid.slice(4, 8)} (${bytes.length}) ${toHex(bytes)}`);
        }
      });
      this.subs.push(sub);
    }
  }

  async readAll(): Promise<void> {
    for (const c of this.chars) {
      if (!c.isReadable) continue;
      try {
        const r = await c.read();
        if (r.value) {
          const bytes = base64ToBytes(r.value);
          this.log(`${this.stamp()} R ${c.uuid.slice(4, 8)} (${bytes.length}) ${toHex(bytes)}`);
        }
      } catch (e) {
        this.log(`${this.stamp()} R ${c.uuid.slice(4, 8)} failed: ${errorMessage(e)}`);
      }
    }
  }

  async disconnect(): Promise<void> {
    for (const s of this.subs.splice(0)) s.remove();
    try {
      await getBleManager().cancelDeviceConnection(this.deviceId);
    } catch {
      // already disconnected
    }
    this.device = null;
    this.chars = [];
  }
}
