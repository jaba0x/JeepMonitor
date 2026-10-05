/**
 * Vehicle pitch / roll from the tablet's accelerometer (gravity vector, in g).
 * The device is mounted either flat (screen up) or upright (screen facing the driver);
 * the mount and its rotation are detected automatically when the user presses "Set level".
 */
export type Mount = 'flat' | 'upright';
export type Rotation = 0 | 90 | 180 | 270;
export type TiltUnit = 'deg' | 'pct';
export type TiltStyle = 'bubble' | 'vehicle' | 'numbers';

export interface Gravity {
  x: number;
  y: number;
  z: number;
}

export interface TiltSettings {
  mount: Mount;
  rotation: Rotation;
  invertPitch: boolean;
  invertRoll: boolean;
  /** Offsets captured when the vehicle is level (after inversion). */
  zeroPitch: number;
  zeroRoll: number;
  unit: TiltUnit;
  style: TiltStyle;
  /** Angle at which the widget turns red. */
  warnDeg: number;
  /** True once the mount has been detected at least once. */
  auto?: boolean;
}

export const DEFAULT_TILT: TiltSettings = {
  mount: 'upright',
  rotation: 0,
  invertPitch: false,
  invertRoll: false,
  zeroPitch: 0,
  zeroRoll: 0,
  unit: 'deg',
  style: 'bubble',
  warnDeg: 30,
};

const DEG = 180 / Math.PI;

function rotate(x: number, y: number, rotation: Rotation): [number, number] {
  let a = x;
  let b = y;
  for (let i = 0; i < rotation / 90; i++) {
    const t = a;
    a = b;
    b = -t;
  }
  return [a, b];
}

/** Pitch (nose up positive) and roll (right side down positive) before inversion and zeroing. */
export function rawTilt(g: Gravity, mount: Mount, rotation: Rotation): { pitch: number; roll: number } {
  const [x, y] = rotate(g.x, g.y, rotation);
  if (mount === 'upright') {
    return { roll: Math.atan2(-x, y) * DEG, pitch: Math.atan2(g.z, y) * DEG };
  }
  return { roll: Math.atan2(-x, g.z) * DEG, pitch: Math.atan2(-y, g.z) * DEG };
}

function wrap(a: number): number {
  let v = a;
  while (v > 180) v -= 360;
  while (v < -180) v += 360;
  return v;
}

export function tilt(g: Gravity, s: TiltSettings): { pitch: number; roll: number } {
  const raw = rawTilt(g, s.mount, s.rotation);
  return {
    pitch: wrap((s.invertPitch ? -raw.pitch : raw.pitch) - s.zeroPitch),
    roll: wrap((s.invertRoll ? -raw.roll : raw.roll) - s.zeroRoll),
  };
}

/** Works out how the device is mounted from one reading taken while the vehicle is roughly level. */
export function detectMount(g: Gravity): { mount: Mount; rotation: Rotation } {
  const total = Math.hypot(g.x, g.y, g.z) || 1;
  if (Math.abs(g.z) / total > 0.75) return { mount: 'flat', rotation: 0 };
  let best: Rotation = 0;
  let bestUp = -Infinity;
  for (const r of [0, 90, 180, 270] as Rotation[]) {
    const [, up] = rotate(g.x, g.y, r);
    if (up > bestUp) {
      bestUp = up;
      best = r;
    }
  }
  return { mount: 'upright', rotation: best };
}

/** "Set level": detect the mount from this reading and make it the zero point. */
export function calibrate(g: Gravity, s: TiltSettings): TiltSettings {
  const base: TiltSettings = { ...s, ...detectMount(g), zeroPitch: 0, zeroRoll: 0, auto: true };
  const t = tilt(g, base);
  return { ...base, zeroPitch: t.pitch, zeroRoll: t.roll };
}

export function formatAngle(deg: number, unit: TiltUnit): string {
  if (unit === 'pct') {
    const grade = Math.tan((deg * Math.PI) / 180) * 100;
    return `${Math.abs(grade) > 999 ? '999+' : grade.toFixed(0)}%`;
  }
  return `${deg.toFixed(1)}°`;
}
