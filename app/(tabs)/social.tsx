import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';

export default function SocialScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Social</Text>
      <Text style={styles.coming}>Coming in Phase 3</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 24 },
  title: { fontSize: 32, fontWeight: '700', color: Colors.primary, marginBottom: 8 },
  coming: { fontSize: 15, color: Colors.textSecondary },
});
