import { useEffect, useMemo, useRef, useState } from 'react';
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
  AppState,
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
import { getUserBook, updateProgressPercent, type UserBookWithBook } from '@/lib/userBooks';
import { createSession } from '@/lib/sessions';
import { createEvent } from '@/lib/activity';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

type Phase = 'setup' | 'running' | 'paused' | 'finish';

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SessionScreen() {
  const { colors } = useTheme();
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
  // Timestamp-based tracking so backgrounding doesn't lose time
  const runStartRef = useRef<number | null>(null);   // Date.now() when last started/resumed
  const accumulatedRef = useRef(0);                  // seconds before current running period

  const userId = session!.user.id;

  const tick = () => {
    if (runStartRef.current === null) return;
    setSeconds(accumulatedRef.current + Math.floor((Date.now() - runStartRef.current) / 1000));
  };

  const isPercent = userBook?.format === 'ebook' || userBook?.format === 'audiobook';

  useEffect(() => {
    getUserBook(userId, bookId)
      .then((book) => {
        setUserBook(book);
        if (book) {
          const isP = book.format === 'ebook' || book.format === 'audiobook';
          setStartPage(isP
            ? String(Math.round(book.progress_percent ?? 0))
            : String(book.current_page));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [userId, bookId]);

  // Recalculate elapsed time when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && runStartRef.current !== null) tick();
    });
    return () => sub.remove();
  }, []);

  const startTimer = () => {
    accumulatedRef.current = 0;
    runStartRef.current = Date.now();
    startedAtRef.current = new Date();
    setPhase('running');
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, 1000);
  };

  const pauseTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (runStartRef.current !== null) {
      accumulatedRef.current += Math.floor((Date.now() - runStartRef.current) / 1000);
      runStartRef.current = null;
    }
    setSeconds(accumulatedRef.current);
    setPhase('paused');
  };

  const resumeTimer = () => {
    runStartRef.current = Date.now();
    setPhase('running');
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, 1000);
  };

  const finishTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (runStartRef.current !== null) {
      accumulatedRef.current += Math.floor((Date.now() - runStartRef.current) / 1000);
      runStartRef.current = null;
    }
    setSeconds(accumulatedRef.current);
    setPhase('finish');
  };

  const saveSession = async () => {
    const sp = parseInt(startPage, 10);
    const ep = parseInt(endPage, 10);
    const pageCount = userBook?.book.page_count;
    setSaveError('');

    if (isNaN(sp) || isNaN(ep) || sp < 0 || !userBook) {
      setSaveError('Check your page numbers');
      return;
    }
    if (isPercent) {
      if (ep <= sp || ep > 100 || sp < 0) {
        setSaveError('End % must be greater than start % and at most 100');
        return;
      }
    } else {
      if (ep <= sp || (pageCount != null && ep > pageCount)) {
        setSaveError('Check your page numbers');
        return;
      }
    }
    if (seconds === 0) {
      setSaveError('Read at least a moment before saving');
      return;
    }

    // For ebooks/audiobooks convert % to approximate pages for session storage
    const effectivePageCount = pageCount ?? 300;
    const sessionStartPage = isPercent ? Math.round(sp / 100 * effectivePageCount) : sp;
    const sessionEndPage = isPercent ? Math.round(ep / 100 * effectivePageCount) : ep;

    try {
      await createSession({
        userId,
        bookId,
        userBookId: userBook.id,
        startPage: sessionStartPage,
        endPage: sessionEndPage,
        durationSeconds: seconds,
        startedAt: startedAtRef.current!,
      });
      if (isPercent) {
        await updateProgressPercent(userBook.id, ep);
      }
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

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: Spacing.lg },
    center: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.sm },
    backText: { color: colors.textSecondary, fontSize: 15, fontFamily: Fonts.regular },
    bookTitle: {
      color: colors.primary,
      fontSize: 18,
      fontFamily: Fonts.semiBold,
      marginBottom: Spacing.xl,
    },
    timerArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    timer: {
      color: colors.primary,
      fontSize: 72,
      fontFamily: Fonts.regular,
      fontVariant: ['tabular-nums'],
    },
    controls: { gap: Spacing.sm },
    input: {
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      fontSize: 16,
      fontFamily: Fonts.regular,
      ...Shadow.card,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 16,
      alignItems: 'center',
    },
    primaryBtnText: { color: colors.surface, fontSize: 16, fontFamily: Fonts.bold },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingVertical: 16,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    secondaryBtnText: { color: colors.textPrimary, fontSize: 16, fontFamily: Fonts.semiBold },
    logManuallyText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: Fonts.regular,
      textAlign: 'center',
      marginTop: 4,
    },
    errorText: { color: colors.error, fontSize: 13, fontFamily: Fonts.regular },
    successOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    successBadge: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.xl * 1.5,
      alignItems: 'center',
      gap: Spacing.sm,
      ...Shadow.card,
    },
    successText: { color: colors.textPrimary, fontSize: 16, fontFamily: Fonts.bold },
    shareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    shareLabel: { fontSize: 15, fontFamily: Fonts.regular, color: colors.textPrimary },
  }), [colors]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
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
        <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
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
            placeholder={isPercent ? 'Start % (0–100)' : 'Starting page'}
            placeholderTextColor={colors.textTertiary}
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
            placeholder={isPercent ? 'End % (0–100)' : 'Ending page'}
            placeholderTextColor={colors.textTertiary}
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
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={saveSession}>
            <Text style={styles.primaryBtnText}>Save Session</Text>
          </TouchableOpacity>
        </View>
      )}
      <Animated.View style={[styles.successOverlay, successStyle]} pointerEvents="none">
        <View style={styles.successBadge}>
          <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
          <Text style={styles.successText}>Session saved!</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
    </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
