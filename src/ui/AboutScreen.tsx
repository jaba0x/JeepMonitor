import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AUTHOR, BLOG_LABEL, BLOG_URL, COPYRIGHT_LINE } from '../about';
import { DRIVERS } from '../ble/registry';
import { BUILD, VERSION } from '../version';
import { colors } from './theme';
import { UpdateCard } from './UpdateCard';
import { Card } from './widgets';


export function AboutScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
        <Text style={styles.name}>JeepMonitor</Text>
        <Text style={styles.tag}>One app for your vehicle's power and sensors</Text>
        <Text style={styles.version}>Version {VERSION} (build {BUILD})</Text>
      </View>

      <UpdateCard />

      <Card style={{ gap: 6 }}>
        <Text style={styles.h2}>Supported devices</Text>
        {DRIVERS.filter((d) => d.create).map((d) => (
          <View key={d.kind} style={{ marginTop: 6 }}>
            <Text style={styles.item}>{d.label}</Text>
            <Text style={styles.sub}>{d.description}</Text>
          </View>
        ))}
      </Card>

      <Card style={{ gap: 8 }}>
        <Text style={styles.h2}>Author</Text>
        <Text style={styles.item}>{AUTHOR}</Text>
        <Text style={[styles.link]} onPress={() => void Linking.openURL(BLOG_URL)}>
          Blog: {BLOG_LABEL}
        </Text>
      </Card>

      <Text style={styles.copy}>{COPYRIGHT_LINE}. All rights reserved.</Text>
      <Text style={styles.legal}>
        Renogy is a trademark of its respective owner. JeepMonitor is an independent project and is not affiliated with
        or endorsed by Renogy or Xiaomi.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14 },
  hero: { alignItems: 'center', gap: 6, paddingVertical: 10 },
  logo: { width: 140, height: 140, borderRadius: 32 },
  name: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 8 },
  tag: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  version: { color: colors.faint, fontSize: 12 },
  h2: { color: colors.text, fontSize: 18, fontWeight: '700' },
  item: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  link: { color: colors.info, fontSize: 15, fontWeight: '600' },
  copy: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 4 },
  legal: { color: colors.faint, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
