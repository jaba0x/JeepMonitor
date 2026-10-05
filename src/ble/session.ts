import type { Characteristic, Device } from 'react-native-ble-plx';
import { errorMessage, getBleManager } from './manager';
import type { Reading, SessionStatus } from '../protocol/types';

export interface SessionEmitter {
  status(status: SessionStatus, message?: string): void;
  reading(reading: Reading): void;
}

/** What the session manager needs from any driver: connected (BleSession) or advertisement-only. */
export interface Session {
  start(): void;
  stop(): Promise<void>;
}

export async function findCharacteristic(device: Device, uuid: string): Promise<Characteristic> {
  const wanted = uuid.toLowerCase();
  for (const service of await device.services()) {
    for (const c of await service.characteristics()) {
      if (c.uuid.toLowerCase() === wanted) return c;
    }
  }
  throw new Error(`Characteristic ${uuid} not found on this device`);
}

/**
 * One long-lived connection to one device. Connects, serves data until the link drops,
 * then reconnects with a growing back-off. Subclasses implement `serve`.
 */
export abstract class BleSession implements Session {
  private stopped = true;
  private cleanups: Array<() => void> = [];
  private wake: (() => void) | null = null;

  constructor(
    readonly deviceId: string,
    protected readonly emit: SessionEmitter,
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    void this.run();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.wake?.();
    try {
      await getBleManager().cancelDeviceConnection(this.deviceId);
    } catch {
      // not connected
    }
    this.emit.status('idle');
  }

  protected get isStopped(): boolean {
    return this.stopped;
  }

  protected onEnd(fn: () => void): void {
    this.cleanups.push(fn);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(done, ms);
      const self = this;
      function done() {
        clearTimeout(t);
        self.wake = null;
        resolve();
      }
      this.wake = done;
    });
  }

  /** Runs until the connection should be dropped. Throw to report an error. */
  protected abstract serve(device: Device): Promise<void>;

  private async run(): Promise<void> {
    let backoff = 2000;
    while (!this.stopped) {
      this.emit.status('connecting');
      try {
        await this.connectAndServe();
        backoff = 2000;
      } catch (e) {
        if (this.stopped) break;
        this.emit.status('error', errorMessage(e));
      }
      if (this.stopped) break;
      this.emit.status('waiting');
      await this.sleep(backoff);
      backoff = Math.min(Math.round(backoff * 1.7), 30000);
    }
  }

  private async connectAndServe(): Promise<void> {
    const device = await getBleManager().connectToDevice(this.deviceId, { requestMTU: 247, timeout: 20000 });
    let resolveDisconnected: () => void = () => {};
    const disconnected = new Promise<void>((resolve) => {
      resolveDisconnected = resolve;
    });
    const sub = device.onDisconnected(() => resolveDisconnected());
    try {
      await device.discoverAllServicesAndCharacteristics();
      this.emit.status('connected');
      const served = this.serve(device);
      served.catch(() => {}); // a late failure after a disconnect is expected
      await Promise.race([served, disconnected]);
    } finally {
      sub.remove();
      for (const fn of this.cleanups.splice(0)) {
        try {
          fn();
        } catch {
          // ignore
        }
      }
      try {
        await device.cancelConnection();
      } catch {
        // already gone
      }
    }
  }
}
