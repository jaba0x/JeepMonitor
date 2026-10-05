export type DeviceKind = 'shunt300' | 'renogy-dcc' | 'thermometer' | 'logo' | 'clinometer' | 'explorer';

export interface ShuntReading {
  kind: 'shunt300';
  ts: number;
  socPercent: number;
  batteryVolts: number;
  starterVolts: number;
  /** Positive = charging, negative = discharging. */
  amps: number;
  watts: number;
  tempC: number;
}

export interface DccReading {
  kind: 'renogy-dcc';
  ts: number;
  model?: string;
  deviceId?: number;
  socPercent: number;
  batteryVolts: number;
  chargeAmps: number;
  controllerTempC: number;
  batteryTempC: number;
  alternatorVolts: number;
  alternatorAmps: number;
  alternatorWatts: number;
  solarVolts: number;
  solarAmps: number;
  solarWatts: number;
  chargingState?: string;
  fault?: string;
  batteryType?: string;
  todayAmpHours: number;
  todayWattHours: number;
  maxPowerTodayW: number;
  totalWattHours: number;
  totalAmpHours: number;
  minBatteryVoltsToday?: number;
  maxBatteryVoltsToday?: number;
  maxChargeAmpsToday?: number;
  daysRunning?: number;
  overDischarges?: number;
  overCharges?: number;
}

export interface ThermometerReading {
  kind: 'thermometer';
  ts: number;
  tempC: number;
  humidity: number;
  batteryPercent?: number;
  batteryVolts?: number;
  format: 'pvvx' | 'atc1441' | 'bthome';
}

export type Reading = ShuntReading | DccReading | ThermometerReading;

export type SessionStatus = 'idle' | 'connecting' | 'connected' | 'waiting' | 'error';
