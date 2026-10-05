/** Modbus RTU framing as used by Renogy BT-1 / BT-2 style modules. */

export function crc16Modbus(data: ArrayLike<number>): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
    }
  }
  return crc & 0xffff;
}

/** Read-holding-registers request: [id, fn, regHi, regLo, wordsHi, wordsLo, crcLo, crcHi]. */
export function buildReadRequest(
  deviceId: number,
  register: number,
  words: number,
  fn = 0x03,
): Uint8Array {
  const body = [deviceId & 0xff, fn, (register >> 8) & 0xff, register & 0xff, (words >> 8) & 0xff, words & 0xff];
  const crc = crc16Modbus(body);
  return Uint8Array.from([...body, crc & 0xff, (crc >> 8) & 0xff]);
}

/** Length of a successful read response for `words` registers: id + fn + count + data + 2 CRC bytes. */
export function expectedResponseLength(words: number): number {
  return words * 2 + 5;
}

export function hasValidCrc(frame: ArrayLike<number>): boolean {
  if (frame.length < 4) return false;
  const body = Array.prototype.slice.call(frame, 0, frame.length - 2) as number[];
  const crc = crc16Modbus(body);
  return frame[frame.length - 2] === (crc & 0xff) && frame[frame.length - 1] === ((crc >> 8) & 0xff);
}

export type FrameCheck =
  | { ok: true }
  | { ok: false; reason: 'length' | 'crc' | 'exception' | 'function' };

/** Validates a complete read response. Function 0x83 means the device returned a Modbus exception. */
export function checkReadResponse(frame: Uint8Array, words: number): FrameCheck {
  if (frame.length >= 2 && frame[1] === 0x83) return { ok: false, reason: 'exception' };
  if (frame.length !== expectedResponseLength(words)) return { ok: false, reason: 'length' };
  if (frame[1] !== 0x03) return { ok: false, reason: 'function' };
  if (!hasValidCrc(frame)) return { ok: false, reason: 'crc' };
  return { ok: true };
}

/**
 * BLE notifications are limited by the MTU (often 20 bytes) so a single Modbus
 * response may arrive in several pieces. Feed every notification in; a complete
 * frame is returned once enough bytes have been collected.
 */
export class FrameAssembler {
  private buf: number[] = [];
  private expected = 0;

  /** Call before sending a request so stale bytes from a timed-out read are dropped. */
  expect(words: number): void {
    this.buf = [];
    this.expected = expectedResponseLength(words);
  }

  push(chunk: ArrayLike<number>): Uint8Array | null {
    if (this.expected === 0) return null;
    for (let i = 0; i < chunk.length; i++) this.buf.push(chunk[i]);
    // A Modbus exception reply is only 5 bytes long; stop waiting for the full length.
    if (this.buf.length >= 2 && this.buf[1] === 0x83 && this.buf.length >= 5) {
      const frame = Uint8Array.from(this.buf.slice(0, 5));
      this.reset();
      return frame;
    }
    if (this.buf.length >= this.expected) {
      const frame = Uint8Array.from(this.buf.slice(0, this.expected));
      this.reset();
      return frame;
    }
    return null;
  }

  reset(): void {
    this.buf = [];
    this.expected = 0;
  }
}
