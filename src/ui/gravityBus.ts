import type { Gravity } from '../protocol/tilt';

/** Latest smoothed accelerometer reading, shared so the options sheet can run "Set level". */
export const gravityBus: { latest: Gravity | null } = { latest: null };
