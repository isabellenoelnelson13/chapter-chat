import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getUserBook, type UserBookWithBook } from '@/lib/userBooks';
import { createSession } from '@/lib/sessions';
import { createEvent } from '@/lib/activity';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

type Phase = 'setup' | 'running' | 'paused' | 'finish';

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SessionScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [userBook, setUserBook] = useState<UserBookWithBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('setup');
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [shareToFeed, setShareToFeed] = useState(false);
  const successOpacity = useSharedValue(0);
  const successScale = useSharedValue(0.8);
  const successStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ scale: successScale.value }],
  }));
  const startedAtRef = useRef<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userId = session!.user.id;

  useEffect(() => {
    getUserBook(userId, bookId)
      .then((book) => {
        setUserBook(book);
        if (book) setStartPage(String(book.current_page));
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [userId, bookId]);

  const startTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    startedAtRef.current = new Date();
    setPhase('running');
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const pauseTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase('paused');
  };

  const resumeTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase('running');
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const finishTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase('finish');
  };

  const saveSession = async () => {
    const sp = parseInt(startPage, 10);
    const ep = parseInt(endPage, 10);
    const pageCount = userBook?.book.page_count;
    setSaveError('');

    if (
      isNaN(sp) || isNaN(ep) ||
      sp < 0 || ep <= sp ||
      (pageCount !== null && pageCount !== undefined && ep > pageCount) ||
      !userBook
    ) {
      setSaveError('Check your page numbers');
      return;
    }
    if (seconds === 0) {
      setSaveError('Read at least a moment before saving');
      return;
    }

    try {
      await createSession({
        userId,
        bookId,
        userBookId: userBook.id,
        startPage: sp,
        endPage: ep,
        durationSeconds: seconds,
        startedAt: startedAtRef.current!,
      });
      if (shareToFeed) {
        await createEvent(userId, 'shared_session', bookId, {
          pages_read: ep - sp,
          duration_seconds: seconds,
        });
      }
      successOpacity.value = withSequence(
        withTiming(1, { duration: 250 }),
        withTiming(1, { duration: 800 }),
        withTiming(0, { duration: 300 }, (finished) => {
          if (finished) runOnJS(router.back)();
        })
      );
      successScale.value = withSequence(
        withTiming(1, { duration: 250 }),
        withTiming(1, { duration: 800 }),
        withTiming(0.8, { duration: 300 })
      );
    } catch {
      Alert.alert('Error', 'Could not save session. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {userBook && (
        <Text style={styles.bookTitle} numberOfLines={1}>{userBook.book.title}</Text>
      )}

      <View style={styles.timerArea}>
        <Text style={styles.timer}>{formatTimer(seconds)}</Text>
      </View>

      {phase === 'setup' && (
        <View style={styles.controls}>
          <TextInput
            style={styles.input}
            placeholder="Starting page"
            placeholderTextColor={Colors.textTertiary}
            value={startPage}
            onChangeText={setStartPage}
            keyboardType="number-pad"
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={startTimer}>
            <Text style={styles.primaryBtnText}>Start Reading</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/session/manual')}>
            <Text style={styles.logManuallyText}>Log manually instead</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'running' && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={pauseTimer}>
            <Text style={styles.secondaryBtnText}>Pause</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={finishTimer}>
            <Text style={styles.primaryBtnText}>Finish</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'paused' && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={resumeTimer}>
            <Text style={styles.secondaryBtnText}>Resume</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={finishTimer}>
            <Text style={styles.primaryBtnText}>Finish</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'finish' && (
        <View style={styles.controls}>
          <TextInput
            style={styles.input}
            placeholder="Ending page"
            placeholderTextColor={Colors.textTertiary}
            value={endPage}
            onChangeText={setEndPage}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
          <View style={styles.shareRow}>
            <Text style={styles.shareLabel}>Share to feed</Text>
            <Switch
              testID="share-toggle"
              value={shareToFeed}
              onValueChange={setShareToFeed}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor={Colors.surface}
            />
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={saveSession}>
            <Text style={styles.primaryBtnText}>Save Session</Text>
          </TouchableOpacity>
        </View>
      )}
      <Animated.View style={[styles.successOverlay, successStyle]} pointerEvents="none">
        <View style={styles.successBadge}>
          <Ionicons name="checkmark-circle" size={48} color={Colors.primary} />
          <Text style={styles.successText}>Session saved!</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
    </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.sm },
  backText: { color: Colors.textSecondary, fontSize: 15, fontFamily: Fonts.regular },
  bookTitle: {
    color: Colors.primary,
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.xl,
  },
  timerArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  timer: {
    color: Colors.primary,
    fontSize: 72,
    fontFamily: Fonts.regular,
    fontVariant: ['tabular-nums'],
  },
  controls: { gap: Spacing.sm },
  input: {
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: Fonts.regular,
    ...Shadow.card,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.surface, fontSize: 16, fontFamily: Fonts.bold },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  secondaryBtnText: { color: Colors.textPrimary, fontSize: 16, fontFamily: Fonts.semiBold },
  logManuallyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    marginTop: 4,
  },
  errorText: { color: Colors.error, fontSize: 13, fontFamily: Fonts.regular },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successBadge: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl * 1.5,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.card,
  },
  successText: { color: Colors.textPrimary, fontSize: 16, fontFamily: Fonts.bold },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareLabel: { fontSize: 15, fontFamily: Fonts.regular, color: Colors.textPrimary },
});
