import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { Colors, Fonts, Radius, Shadow, Spacing } from '../../constants/theme';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setError(null);
    setLoading(true);
    const { error } = await signUp(email.trim(), password, username.trim());
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.replace('/(tabs)/');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Sign Up</Text>
        <Text style={styles.subtitle}>Join the reading community</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={Colors.textTertiary}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.textTertiary}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.textTertiary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={styles.button}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.surface} />
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <Link href="/(auth)/login" style={styles.link}>
          Already have an account? Sign in
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg },
  title: {
    fontSize: 34,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: Fonts.regular,
    marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  error: {
    color: Colors.error,
    fontSize: 13,
    fontFamily: Fonts.regular,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: 16,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonText: { color: Colors.surface, fontFamily: Fonts.bold, fontSize: 16 },
  link: {
    color: Colors.primary,
    textAlign: 'center',
    marginTop: Spacing.lg,
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
});
