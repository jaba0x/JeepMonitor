import { decode, encode } from 'base-64';

export function base64ToBytes(b64: string): Uint8Array {
  const bin = decode(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: ArrayLike<number>): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return encode(s);
}

export function toHex(bytes: ArrayLike<number>): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i++) parts.push(bytes[i].toString(16).padStart(2, '0'));
  return parts.join(' ');
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

/** Big-endian unsigned integer. Returns 0 when the buffer is too short (same behaviour as the reference lib). */
export function uintBE(b: ArrayLike<number>, offset: number, length: number): number {
  if (b.length < offset + length) return 0;
  let v = 0;
  for (let i = 0; i < length; i++) v = v * 256 + b[offset + i];
  return v;
}

/** Big-endian two's-complement signed integer. */
export function intBE(b: ArrayLike<number>, offset: number, length: number): number {
  const v = uintBE(b, offset, length);
  const range = 2 ** (8 * length);
  return v >= range / 2 ? v - range : v;
}

export function round(v: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
