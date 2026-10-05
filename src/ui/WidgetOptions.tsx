import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { calibrate, DEFAULT_TILT, type TiltSettings } from '../protocol/tilt';
import { removeDevice, updateDevice, type ChartType, type SavedDevice } from '../state/store';
import { DeviceSettings } from './DeviceSettings';
import { gravityBus } from './gravityBus';
import { pickLogo } from './LogoWidget';
import { colors } from './theme';
import { Button, Chip } from './widgets';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

/** Options for one widget, shown as a sheet when you tap it while the dashboard is unlocked. */
export function WidgetOptions({ device, onClose }: { device: SavedDevice; onClose: () => void }) {
  const [settings, setSettings] = useState(false);
  const isWidget = device.kind === 'logo' || device.kind === 'clinometer';
  const chart: ChartType = device.chart ?? (device.kind === 'thermometer' ? 'line' : 'bars');
  const cfg: TiltSettings = { ...DEFAULT_TILT, ...device.tilt };
  const setTilt = (patch: Partial<TiltSettings>) => updateDevice(device.id, { tilt: { ...cfg, ...patch } });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={{ gap: 14 }}>
            <Text style={styles.title}>{device.alias}</Text>
            <Text style={styles.hint}>Drag the blue grip to move this widget and the corner handle to resize it.</Text>

            <Row label="Widget">
              <Chip label="Name and settings" onPress={() => setSettings(true)} />
              <Chip label="Reset size" onPress={() => updateDevice(device.id, { span: undefined, rows: undefined, size: undefined, col: undefined, row: undefined })} />
              {isWidget ? (
                <Chip
                  label="Remove"
                  tone="danger"
                  onPress={() => {
                    removeDevice(device.id);
                    onClose();
                  }}
                />
              ) : null}
            </Row>

            {!isWidget ? (
              <Row label="Graph">
                {(['bars', 'line', 'area', 'off'] as ChartType[]).map((k) => (
                  <Chip key={k} label={k === 'off' ? 'No graph' : k} active={chart === k} onPress={() => updateDevice(device.id, { chart: k })} />
                ))}
              </Row>
            ) : null}

            {device.kind === 'logo' ? (
              <Row label="Picture">
                <Chip label="Choose image" onPress={() => void pickLogo(device)} />
                {device.logoUri ? <Chip label="Use default emblem" onPress={() => updateDevice(device.id, { logoUri: undefined })} /> : null}
              </Row>
            ) : null}

            {device.kind === 'clinometer' ? (
              <>
                <Row label="Style">
                  {(['bubble', 'vehicle', 'numbers'] as const).map((k) => (
                    <Chip key={k} label={k} active={cfg.style === k} onPress={() => setTilt({ style: k })} />
                  ))}
                </Row>
                <Row label="Unit">
                  <Chip label="Degrees" active={cfg.unit === 'deg'} onPress={() => setTilt({ unit: 'deg' })} />
                  <Chip label="Grade %" active={cfg.unit === 'pct'} onPress={() => setTilt({ unit: 'pct' })} />
                </Row>
                <Row label="Warn at">
                  {[15, 20, 25, 30, 35, 45].map((k) => (
                    <Chip key={k} label={`${k}°`} active={cfg.warnDeg === k} onPress={() => setTilt({ warnDeg: k })} />
                  ))}
                </Row>
                <Row label="Mount">
                  <Chip label={`Detected: ${cfg.mount}`} onPress={() => {}} />
                  <Chip label="Rotate 90" onPress={() => setTilt({ rotation: (((cfg.rotation + 90) % 360) as TiltSettings['rotation']) })} />
                  <Chip label="Flip pitch" active={cfg.invertPitch} onPress={() => setTilt({ invertPitch: !cfg.invertPitch })} />
                  <Chip label="Flip roll" active={cfg.invertRoll} onPress={() => setTilt({ invertRoll: !cfg.invertRoll })} />
                </Row>
                <Row label="Level">
                  <Button
                    title="Set level here"
                    onPress={() => {
                      if (gravityBus.latest) updateDevice(device.id, { tilt: calibrate(gravityBus.latest, cfg) });
                    }}
                  />
                </Row>
                <Text style={styles.hint}>
                  Park on level ground and press "Set level here". The widget works out how the tablet is mounted and zeroes
                  itself. If a direction is backwards, use Rotate 90 or Flip.
                </Text>
              </>
            ) : null}

            <View style={{ alignItems: 'flex-end' }}>
              <Button title="Done" onPress={onClose} />
            </View>
          </ScrollView>
        </View>
      </View>
      {settings ? <DeviceSettings device={device} onClose={() => setSettings(false)} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
    maxHeight: '75%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  label: { color: colors.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, minWidth: 64 },
});
