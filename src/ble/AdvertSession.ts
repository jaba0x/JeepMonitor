import { subscribeScan } from './scan';
import type { Session, SessionEmitter } from './session';
import { describeAdvert, parseThermometerParts } from '../protocol/thermometer';
import type { ThermometerReading } from '../protocol/types';

const CHECK_MS = 5000;
// The sensor advertises every few seconds and a phone scan can miss several packets in a row, so be patient.
const NO_DATA_MS = 90000;
const RETRY_MS = 10000;

/**
 * Passive session for devices that broadcast their data (e.g. LYWSD03MMC with custom firmware).
 * It never connects, so it costs the sensor no battery: it just listens to advertisements
 * from the saved device id. Parts of a reading that arrive in separate packets are merged.
 */
export class AdvertSession implements Session {
  private active = false;
  private unsubscribe: (() => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private lastReading = 0;
  private lastSeen = 0;
  private startedAt = 0;
  private hint = '';
  private merged: Partial<ThermometerReading> = {};

  constructor(
    readonly deviceId: string,
    private readonly emit: SessionEmitter,
  ) {}

  start(): void {
    if (this.active) return;
    this.active = true;
    this.startedAt = Date.now();
    this.emit.status('waiting');
    this.timer = setInterval(() => this.check(), CHECK_MS);
    void this.listen();
  }

  async stop(): Promise<void> {
    this.active = false;
    if (this.timer) clearInterval(this.timer);
    if (this.retry) clearTimeout(this.retry);
    this.timer = this.retry = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.emit.status('idle');
  }

  private async listen(): Promise<void> {
    const unsubscribe = await subscribeScan(
      (device) => {
        if (device.id !== this.deviceId) return;
        const now = Date.now();
        this.lastSeen = now;
        const parts = parseThermometerParts(device.serviceData);
        if (!parts) {
          this.hint = describeAdvert(device.serviceData);
          return;
        }
        for (const [k, v] of Object.entries(parts)) {
          if (v !== undefined) (this.merged as Record<string, unknown>)[k] = v;
        }
        const m = this.merged;
        if (m.tempC === undefined || m.humidity === undefined) return;
        this.lastReading = now;
        this.emit.status('connected');
        this.emit.reading({
          kind: 'thermometer',
          ts: now,
          tempC: m.tempC,
          humidity: m.humidity,
          batteryPercent: m.batteryPercent,
          batteryVolts: m.batteryVolts,
          format: m.format ?? 'pvvx',
        });
      },
      (message) => {
        if (!this.active) return;
        this.emit.status('error', message);
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.retry = setTimeout(() => void this.listen(), RETRY_MS);
      },
    );
    if (!this.active) {
      unsubscribe();
      return;
    }
    this.unsubscribe = unsubscribe;
  }

  private check(): void {
    const now = Date.now();
    if (this.lastReading && now - this.lastReading < NO_DATA_MS) return;
    if (this.lastSeen && now - this.lastSeen < NO_DATA_MS && !this.lastReading) {
      this.emit.status('error', `Seen, no readable data. ${this.hint}`);
    } else if (this.lastReading || now - this.startedAt > NO_DATA_MS) {
      this.emit.status('waiting', 'No packets for a while');
    }
  }
}
