import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { driverFor } from '../ble/registry';
import { removeDevice, updateDevice, type SavedDevice } from '../state/store';
import { colors } from './theme';
import { Button } from './widgets';

const toNum = (text: string): number | undefined => {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** Settings for one saved device: custom name and label plus per-kind options. */
export function DeviceSettings({ device, onClose }: { device: SavedDevice; onClose: () => void }) {
  const [name, setName] = useState(device.alias);
  const [label, setLabel] = useState(device.label ?? '');
  const [unit, setUnit] = useState<'C' | 'F'>(device.tempUnit ?? 'C');
  const [tOff, setTOff] = useState(device.tempOffset ? String(device.tempOffset) : '');
  const [hOff, setHOff] = useState(device.humOffset ? String(device.humOffset) : '');
  const [cap, setCap] = useState(device.capacityAh ? String(device.capacityAh) : '');
  const [mid, setMid] = useState(String(device.modbusId ?? 255));

  const save = () => {
    const patch: Partial<SavedDevice> = {
      alias: name.trim() || device.name,
      label: label.trim() || undefined,
    };
    if (device.kind === 'thermometer') {
      patch.tempUnit = unit;
      patch.tempOffset = toNum(tOff) || undefined;
      patch.humOffset = toNum(hOff) || undefined;
    }
    if (device.kind === 'shunt300') {
      const n = toNum(cap);
      patch.capacityAh = n && n > 0 ? n : undefined;
    }
    if (device.kind === 'renogy-dcc') {
      const n = parseInt(mid, 10);
      patch.modbusId = n > 0 && n < 256 ? n : 255;
    }
    updateDevice(device.id, patch);
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Device settings</Text>
            <Text style={styles.meta}>
              {driverFor(device.kind).label}  |  {device.id}
            </Text>

            <Field label="Name" value={name} onChange={setName} placeholder={device.name} />
            <Field label="Label / location" value={label} onChange={setLabel} placeholder="e.g. Trunk, Fridge, Cabin" />

            {device.kind === 'thermometer' ? (
              <>
                <View style={styles.row}>
                  <Text style={styles.fieldLabel}>Temperature unit</Text>
                  <View style={styles.row}>
                    <Button title="C" tone={unit === 'C' ? 'primary' : 'ghost'} onPress={() => setUnit('C')} />
                    <Button title="F" tone={unit === 'F' ? 'primary' : 'ghost'} onPress={() => setUnit('F')} />
                  </View>
                </View>
                <Field label="Temperature offset (C)" value={tOff} onChange={setTOff} placeholder="0" narrow />
                <Field label="Humidity offset (%)" value={hOff} onChange={setHOff} placeholder="0" narrow />
                <Text style={styles.hint}>Offsets calibrate the sensor against a reference thermometer.</Text>
              </>
            ) : null}
            {device.kind === 'shunt300' ? (
              <Field label="Battery capacity (Ah)" value={cap} onChange={setCap} placeholder="e.g. 200" narrow />
            ) : null}
            {device.kind === 'renogy-dcc' ? (
              <Field label="Modbus device id" value={mid} onChange={setMid} placeholder="255" narrow />
            ) : null}

            <View style={[styles.row, { justifyContent: 'space-between', marginTop: 6 }]}>
              <Button
                title="Remove device"
                tone="danger"
                onPress={() => {
                  removeDevice(device.id);
                  onClose();
                }}
              />
              <View style={styles.row}>
                <Button title="Cancel" tone="ghost" onPress={onClose} />
                <Button title="Save" onPress={save} />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  narrow,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder: string;
  narrow?: boolean;
}) {
  return (
    <View style={narrow ? styles.row : { gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        style={[styles.input, narrow && { minWidth: 110, textAlign: 'right' }]}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 20 },
  sheet: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  meta: { color: colors.faint, fontSize: 12 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  fieldLabel: { color: colors.muted, fontSize: 14 },
  input: {
    color: colors.text,
    backgroundColor: '#0D141B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 16,
  },
});
