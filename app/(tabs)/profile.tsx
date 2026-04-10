import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { Colors, Shadow, Radius } from '@/constants/theme';

export default function ProfileScreen() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.coming}>Coming in Phase 3</Text>
      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 24, gap: 16 },
  title: { fontSize: 32, fontWeight: '700', color: Colors.primary },
  coming: { fontSize: 15, color: Colors.textSecondary },
  signOutBtn: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    ...Shadow.card,
  },
  signOutText: { color: Colors.error, fontSize: 15, fontWeight: '600' },
});
