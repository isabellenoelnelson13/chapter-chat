import { View, Text, StyleSheet } from 'react-native';

export default function SocialScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Social — Coming in Phase 3</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#888', fontSize: 16 },
});
