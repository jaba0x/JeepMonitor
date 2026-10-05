import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { connectDevice, disconnectDevice, refreshDevice } from '../ble/sessionManager';
import { estimateTime, formatDuration } from '../protocol/estimate';
import { dewPoint } from '../protocol/thermometer';
import type { DccReading, ShuntReading, ThermometerReading } from '../protocol/types';
import { driverFor } from '../ble/registry';
import { useAppState, type ChartType, type SavedDevice } from '../state/store';
import { ampsColor, colors, fmt, socColor } from './theme';
import { ageText, Card, MiniChart, SocBar, Stat, StatusPill, useNow, WidgetTitle } from './widgets';

/**
 * One card per device. To show a new kind of device, add a branch here
 * (and register its driver in src/ble/registry.ts).
 */
export function DeviceCard({ device, cellHeight }: { device: SavedDevice; cellHeight?: number; fullscreen?: boolean }) {
  const reading = useAppState((s) => s.readings[device.id]);
  const status = useAppState((s) => s.statuses[device.id]);
  const history = useAppState((s) => s.history[device.id]);
  const now = useNow();
  const staleAfter = device.kind === 'thermometer' ? 180000 : 15000;
  const stale = reading ? now - reading.ts > staleAfter : false;
  const chart: ChartType = device.chart ?? (device.kind === 'thermometer' ? 'line' : 'bars');
  // extra frame height (set by resizing the widget) goes to the graph
  const chartHeight = 56 + Math.max(0, (cellHeight ?? 0) - 270);

  return (
    <Card style={stale ? { opacity: 0.55 } : undefined}>
      <View style={styles.head}>
        <View style={{ flexShrink: 1 }}>
          <WidgetTitle>{device.alias}</WidgetTitle>
          <Text style={styles.sub}>{device.label ? device.label : driverFor(device.kind).label}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
          <StatusPill status={status?.status ?? 'idle'} message={status?.message} />
          {reading ? <Text style={styles.age}>{ageText(reading.ts, now)}</Text> : null}
        </View>
      </View>
      <Controls id={device.id} connected={(status?.status ?? 'idle') !== 'idle'} />
      {status?.status === 'error' && status.message ? <Text style={styles.error}>{status.message}</Text> : null}

      {!reading ? (
        <Text style={styles.waiting}>Waiting for data...</Text>
      ) : reading.kind === 'shunt300' ? (
        <ShuntBody r={reading} history={history ?? []} capacityAh={device.capacityAh} chart={chart} h={chartHeight} />
      ) : reading.kind === 'thermometer' ? (
        <ThermometerBody r={reading} history={history ?? []} device={device} chart={chart} h={chartHeight} />
      ) : (
        <DccBody r={reading} history={history ?? []} chart={chart} h={chartHeight} />
      )}
    </Card>
  );
}

/** Refresh and connect / disconnect buttons. */
function Controls({ id, connected }: { id: string; connected: boolean }) {
  const [busy, setBusy] = useState(false);
  const run = (fn: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(true);
    void Promise.resolve(fn()).finally(() => setTimeout(() => setBusy(false), 800));
  };
  return (
    <View style={styles.controls}>
      <Pressable disabled={busy} onPress={() => run(() => refreshDevice(id))} style={[styles.ctl, busy && { opacity: 0.5 }]} hitSlop={6}>
        <Text style={styles.ctlText}>Refresh</Text>
      </Pressable>
      <Pressable
        disabled={busy}
        onPress={() => run(() => (connected ? disconnectDevice(id) : connectDevice(id)))}
        style={[styles.ctl, busy && { opacity: 0.5 }]}
        hitSlop={6}
      >
        <Text style={styles.ctlText}>{connected ? 'Disconnect' : 'Connect'}</Text>
      </Pressable>
    </View>
  );
}

function ShuntBody({ r, history, capacityAh, chart, h }: { r: ShuntReading; history: number[]; capacityAh?: number; chart: ChartType; h: number }) {
  const est = estimateTime(r.socPercent, capacityAh, r.amps);
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.row}>
        <Stat label="Charge" value={fmt(r.socPercent, 0)} unit="%" color={socColor(r.socPercent)} big />
        <Stat label="Current" value={fmt(r.amps, 2)} unit="A" color={ampsColor(r.amps)} big />
      </View>
      <SocBar percent={r.socPercent} color={socColor(r.socPercent)} />
      <View style={styles.row}>
        <Stat label="Voltage" value={fmt(r.batteryVolts, 2)} unit="V" />
        <Stat label="Power" value={fmt(r.watts, 0)} unit="W" color={ampsColor(r.watts)} />
        <Stat label="Starter" value={fmt(r.starterVolts, 2)} unit="V" />
        <Stat label="Temp" value={fmt(r.tempC, 1)} unit="C" />
      </View>
      {est.hours !== null ? (
        <Text style={styles.estimate}>
          {est.mode === 'discharging' ? 'Remaining' : 'Full in'}: {formatDuration(est.hours)}
        </Text>
      ) : null}
      <MiniChart values={history} type={chart} signed color={colors.charge} height={h} />
    </View>
  );
}

function ThermometerBody({ r, history, device, chart, h }: { r: ThermometerReading; history: number[]; device: SavedDevice; chart: ChartType; h: number }) {
  const tempC = r.tempC + (device.tempOffset ?? 0);
  const humidity = Math.min(100, Math.max(0, r.humidity + (device.humOffset ?? 0)));
  const fahrenheit = device.tempUnit === 'F';
  const show = (c: number): string => fmt(fahrenheit ? (c * 9) / 5 + 32 : c, 1);
  const unit = fahrenheit ? 'F' : 'C';
  const dew = dewPoint(tempC, humidity);
  const batt =
    r.batteryPercent !== undefined
      ? `${fmt(r.batteryPercent, 0)}%`
      : r.batteryVolts !== undefined
        ? `${fmt(r.batteryVolts, 2)}V`
        : '--';
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.row}>
        <Stat label="Temperature" value={show(tempC)} unit={unit} big />
        <Stat label="Humidity" value={fmt(humidity, 0)} unit="%" big />
      </View>
      <View style={styles.row}>
        <Stat label="Dew point" value={Number.isFinite(dew) ? show(dew) : '--'} unit={unit} />
        <Stat label="Sensor battery" value={batt} />
      </View>
      <MiniChart values={history} type={chart} signed={false} color="#FB923C" height={h} />
    </View>
  );
}

function DccBody({ r, history, chart, h }: { r: DccReading; history: number[]; chart: ChartType; h: number }) {
  const opt = (v: number | undefined, d: number, unit: string) => (v === undefined ? '--' : `${fmt(v, d)}${unit}`);
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.row}>
        <Stat label="Charge" value={fmt(r.socPercent, 0)} unit="%" color={socColor(r.socPercent)} big />
        <Stat label="Current" value={fmt(r.chargeAmps, 2)} unit="A" color={ampsColor(r.chargeAmps)} big />
      </View>
      <View style={styles.row}>
        <Stat label="Battery" value={fmt(r.batteryVolts, 1)} unit="V" />
        <Stat label="Alternator" value={fmt(r.alternatorVolts, 1)} unit="V" />
        <Stat label="Alt. current" value={fmt(r.alternatorAmps, 2)} unit="A" />
        <Stat label="Alt. power" value={fmt(r.alternatorWatts, 0)} unit="W" />
      </View>
      <View style={styles.row}>
        <Stat label="Solar" value={fmt(r.solarWatts, 0)} unit="W" />
        <Stat label="Solar V" value={fmt(r.solarVolts, 1)} unit="V" />
        <Stat label="Controller" value={fmt(r.controllerTempC, 0)} unit="C" />
        <Stat label="Battery temp" value={fmt(r.batteryTempC, 0)} unit="C" />
      </View>
      <Text style={styles.estimate}>
        {r.chargingState ?? '--'}
        {r.batteryType ? `  |  ${r.batteryType}` : ''}
        {r.fault ? `  |  Fault: ${r.fault}` : ''}
      </Text>
      <Text style={styles.sectionLabel}>Today</Text>
      <View style={styles.row}>
        <Stat label="Charged" value={fmt(r.todayAmpHours, 0)} unit="Ah" />
        <Stat label="Energy" value={fmt(r.todayWattHours, 0)} unit="Wh" />
        <Stat label="Peak power" value={fmt(r.maxPowerTodayW, 0)} unit="W" />
        <Stat label="Peak current" value={opt(r.maxChargeAmpsToday, 1, ' A')} />
        <Stat label="Min battery" value={opt(r.minBatteryVoltsToday, 1, ' V')} />
        <Stat label="Max battery" value={opt(r.maxBatteryVoltsToday, 1, ' V')} />
      </View>
      <Text style={styles.sectionLabel}>Lifetime</Text>
      <View style={styles.row}>
        <Stat label="Total energy" value={fmt(r.totalWattHours / 1000, 1)} unit="kWh" />
        <Stat label="Total charge" value={fmt(r.totalAmpHours, 0)} unit="Ah" />
        <Stat label="Days running" value={opt(r.daysRunning, 0, '')} />
        <Stat label="Over-discharges" value={opt(r.overDischarges, 0, '')} />
        <Stat label="Over-charges" value={opt(r.overCharges, 0, '')} />
      </View>
      {r.model ? <Text style={styles.age}>Model {r.model}{r.deviceId !== undefined ? `  |  id ${r.deviceId}` : ''}</Text> : null}
      <MiniChart values={history} type={chart} signed color={colors.charge} height={h} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sectionLabel: { color: colors.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  age: { color: colors.faint, fontSize: 11, marginTop: 2 },
  error: { color: colors.bad, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  waiting: { color: colors.muted, paddingVertical: 24, textAlign: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  controls: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  ctl: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  ctlText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  estimate: { color: colors.muted, fontSize: 14 },
});
