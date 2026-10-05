import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { guessKind, type ScanResult } from '../ble/scan';
import { driverFor } from '../ble/registry';
import { addDevice, removeDevice, updateDevice, useAppState, type SavedDevice } from '../state/store';
import { ScanList } from './ScanList';
import { colors } from './theme';
import { Button, Card, StatusPill } from './widgets';

export function DevicesScreen() {
  const devices = useAppState((s) => s.devices).filter((d) => d.kind !== 'logo' && d.kind !== 'clinometer');

  const add = (r: ScanResult) => {
    const kind = guessKind(r.name);
    addDevice({ id: r.id, name: r.name, alias: kind === 'thermometer' ? 'Trunk Temperature' : r.name, kind });
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.h1}>Devices</Text>
      {devices.length === 0 ? <Text style={styles.hint}>Nothing saved yet. Scan below and add a device.</Text> : null}
      {devices.map((d) => (
        <SavedRow key={d.id} device={d} />
      ))}

      <Text style={styles.h2}>Add a device</Text>
      <Card>
        <Text style={styles.hint}>
          Only one app can usually hold a Bluetooth connection to a device. If a device does not show up or will not
          connect, close the Renogy DC Home app first.
        </Text>
        <View style={{ height: 12 }} />
        <ScanList actionLabel="Add" onPick={add} excludeIds={devices.map((d) => d.id)} />
      </Card>
    </ScrollView>
  );
}

function SavedRow({ device }: { device: SavedDevice }) {
  const status = useAppState((s) => s.statuses[device.id]);
  const [alias, setAlias] = useState(device.alias);
  const driver = driverFor(device.kind);

  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.rowHead}>
        <TextInput
          value={alias}
          onChangeText={setAlias}
          onEndEditing={() => updateDevice(device.id, { alias: alias.trim() || device.name })}
          style={styles.alias}
          placeholderTextColor={colors.faint}
        />
        {driver.create ? <StatusPill status={status?.status ?? 'idle'} message={status?.message} /> : null}
      </View>
      <Text style={styles.meta}>
        {driver.label}  |  {device.id}
      </Text>
      {!driver.create ? (
        <Text style={styles.hint}>This device has no live driver yet. Use the Explorer tab to inspect it.</Text>
      ) : null}

      {device.kind === 'shunt300' ? (
        <NumberField
          label="Battery capacity (Ah)"
          value={device.capacityAh}
          placeholder="e.g. 200"
          onCommit={(n) => updateDevice(device.id, { capacityAh: n })}
        />
      ) : null}
      {device.kind === 'renogy-dcc' ? (
        <NumberField
          label="Modbus device id"
          value={device.modbusId ?? 255}
          placeholder="255"
          onCommit={(n) => updateDevice(device.id, { modbusId: n && n > 0 && n < 256 ? n : 255 })}
        />
      ) : null}

      <View style={{ alignItems: 'flex-start' }}>
        <Button title="Remove" tone="danger" onPress={() => removeDevice(device.id)} />
      </View>
    </Card>
  );
}

function NumberField({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: number | undefined;
  placeholder: string;
  onCommit: (n: number | undefined) => void;
}) {
  const [text, setText] = useState(value ? String(value) : '');
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        onEndEditing={() => {
          const n = parseInt(text, 10);
          onCommit(Number.isFinite(n) && n > 0 ? n : undefined);
        }}
        keyboardType="number-pad"
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14 },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800' },
  h2: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 10 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  alias: { color: colors.text, fontSize: 18, fontWeight: '700', flex: 1, padding: 0 },
  meta: { color: colors.faint, fontSize: 12 },
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  fieldLabel: { color: colors.muted, fontSize: 14 },
  input: {
    color: colors.text,
    backgroundColor: '#0D141B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 90,
    textAlign: 'right',
    fontSize: 16,
  },
});
