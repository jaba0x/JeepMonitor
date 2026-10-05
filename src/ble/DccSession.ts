import type { Characteristic, Device } from 'react-native-ble-plx';
import { BleSession, findCharacteristic, type SessionEmitter } from './session';
import { base64ToBytes, bytesToBase64 } from '../protocol/bytes';
import { buildReadRequest, checkReadResponse, FrameAssembler } from '../protocol/modbus';
import {
  applyDccSection,
  DCC_NOTIFY_CHARACTERISTIC,
  DCC_PROBE_IDS,
  DCC_SECTIONS,
  DCC_WRITE_CHARACTERISTIC,
  emptyDccReading,
  type DccSection,
} from '../protocol/renogyDcc';
import type { DccReading } from '../protocol/types';

const POLL_MS = 2000;
const REPLY_TIMEOUT_MS = 4000;
const PROBE_TIMEOUT_MS = 1800;
const STATIC_SECTIONS: DccSection['name'][] = ['info', 'address', 'batteryType'];

/**
 * Renogy controller / DC-DC charger behind a BT-1 or BT-2 module (Modbus over BLE).
 * Experimental: your RBC20D1U is wired to the ONE Core over RS485 and has no Bluetooth of its own,
 * so this driver only applies once a BT-2 module is fitted.
 */
export class DccSession extends BleSession {
  private reading: DccReading = emptyDccReading();
  private readonly assembler = new FrameAssembler();
  private pending: { resolve: (f: Uint8Array) => void; reject: (e: unknown) => void } | null = null;

  constructor(
    deviceId: string,
    emit: SessionEmitter,
    private modbusId = 0xff,
  ) {
    super(deviceId, emit);
  }

  protected async serve(device: Device): Promise<void> {
    const notify = await findCharacteristic(device, DCC_NOTIFY_CHARACTERISTIC);
    const writeChar = await findCharacteristic(device, DCC_WRITE_CHARACTERISTIC);
    this.reading = emptyDccReading();
    const doneStatic = new Set<string>();

    const sub = notify.monitor((error, c) => {
      if (error) {
        this.pending?.reject(error);
        this.pending = null;
        return;
      }
      if (!c?.value) return;
      const frame = this.assembler.push(base64ToBytes(c.value));
      if (frame && this.pending) {
        const p = this.pending;
        this.pending = null;
        p.resolve(frame);
      }
    });
    this.onEnd(() => sub.remove());

    await this.findModbusId(writeChar);

    while (!this.isStopped) {
      for (const section of DCC_SECTIONS) {
        if (STATIC_SECTIONS.includes(section.name) && doneStatic.has(section.name)) continue;
        try {
          const frame = await this.request(writeChar, section);
          const check = checkReadResponse(frame, section.words);
          if (!check.ok) continue; // some registers are not implemented on every model
          this.reading = applyDccSection(this.reading, section.name, frame);
          doneStatic.add(section.name);
        } catch (e) {
          if (this.isStopped) return;
          throw e;
        }
      }
      this.emit.reading(this.reading);
      await this.sleep(POLL_MS);
    }
  }

  /** Tries the configured Modbus id first, then common ones, and keeps the first that answers. */
  private async findModbusId(writeChar: Characteristic): Promise<void> {
    const probe = DCC_SECTIONS.find((s) => s.name === 'charging')!;
    const ids = [this.modbusId, ...DCC_PROBE_IDS.filter((i) => i !== this.modbusId)];
    for (const id of ids) {
      if (this.isStopped) return;
      this.modbusId = id;
      try {
        const frame = await this.request(writeChar, probe, PROBE_TIMEOUT_MS);
        if (checkReadResponse(frame, probe.words).ok) return;
      } catch {
        // no answer on this id, try the next one
      }
    }
    throw new Error(
      'Connected, but nothing answered on the usual Modbus ids. A DC-DC charger wired to a ONE Core is read through the ' +
        "ONE Core's own protocol, which is not public: use the Explorer tab on it. Set the Modbus id in the device settings if you know it.",
    );
  }

  private async request(writeChar: Characteristic, section: DccSection, timeoutMs = REPLY_TIMEOUT_MS): Promise<Uint8Array> {
    this.assembler.expect(section.words);
    const payload = bytesToBase64(buildReadRequest(this.modbusId, section.register, section.words));
    const reply = new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        reject(new Error(`No reply for register ${section.register}. Check the Modbus device id.`));
      }, timeoutMs);
      this.pending = {
        resolve: (f) => {
          clearTimeout(timer);
          resolve(f);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      };
    });
    try {
      await writeChar.writeWithResponse(payload);
    } catch {
      await writeChar.writeWithoutResponse(payload);
    }
    return reply;
  }
}
