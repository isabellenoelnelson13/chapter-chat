import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../../lib/auth';

export default function ProfileScreen() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Profile — Coming in Phase 3</Text>
      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center', gap: 20 },
  text: { color: '#888', fontSize: 16 },
  button: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  buttonText: { color: '#ff4444', fontSize: 14, fontWeight: '600' },
});
