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
  Image,
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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getUserBook, updateProgressPercent, moveShelf, type UserBookWithBook } from '@/lib/userBooks';
import { createSession } from '@/lib/sessions';
import { createEvent } from '@/lib/activity';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { startReadingActivity, updateReadingActivity, endReadingActivity } from '@/lib/liveActivity';

type Phase = 'setup' | 'running' | 'paused' | 'finish';

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SessionScreen() {
  const { colors } = useTheme();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();

  const [userBook, setUserBook] = useState<UserBookWithBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('setup');
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [shareToFeed, setShareToFeed] = useState(false);
  const [trackAsPercent, setTrackAsPercent] = useState(false);
  const successOpacity = useSharedValue(0);
  const successScale = useSharedValue(0.8);
  const successStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ scale: successScale.value }],
  }));
  const startedAtRef = useRef<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedRef = useRef(false);
  const runStartRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);

  const userId = session!.user.id;
  const isPercent = trackAsPercent;

  const tick = () => {
    if (runStartRef.current === null) return;
    setSeconds(accumulatedRef.current + Math.floor((Date.now() - runStartRef.current) / 1000));
  };

  useEffect(() => {
    getUserBook(userId, bookId)
      .then((book) => {
        setUserBook(book);
        if (book) {
          const isP = book.format === 'ebook' || book.format === 'audiobook';
          setTrackAsPercent(isP);
          setStartPage(isP
            ? String(Math.round(book.progress_percent ?? 0))
            : String(book.current_page));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [userId, bookId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && runStartRef.current !== null) tick();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    return () => { endReadingActivity(); };
  }, []);

  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') return;
    return navigation.addListener('beforeRemove', (e: any) => {
      if (savedRef.current) return;
      e.preventDefault();
      Alert.alert(
        'Discard session?',
        'You have a session in progress. Are you sure you want to leave?',
        [
          { text: 'Keep Reading', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]
      );
    });
  }, [navigation, phase]);

  const startTimer = () => {
    accumulatedRef.current = 0;
    runStartRef.current = Date.now();
    startedAtRef.current = new Date();
    setPhase('running');
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, 1000);
    if (userBook) {
      startReadingActivity(
        userBook.book.title,
        userBook.book.author ?? '',
        parseInt(startPage, 10) || userBook.current_page
      );
    }
  };

  const pauseTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (runStartRef.current !== null) {
      accumulatedRef.current += Math.floor((Date.now() - runStartRef.current) / 1000);
      runStartRef.current = null;
    }
    setSeconds(accumulatedRef.current);
    setPhase('paused');
    updateReadingActivity(
      accumulatedRef.current,
      parseInt(endPage, 10) || (userBook?.current_page ?? 0),
      true
    );
  };

  const resumeTimer = () => {
    runStartRef.current = Date.now();
    setPhase('running');
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, 1000);
    updateReadingActivity(
      accumulatedRef.current,
      parseInt(endPage, 10) || (userBook?.current_page ?? 0),
      false
    );
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

      const isComplete = isPercent ? ep >= 100 : (pageCount != null && ep >= pageCount);
      if (isComplete && userBook.shelf !== 'read') {
        await moveShelf(userBook.id, 'read');
        await createEvent(userId, 'finished_book', bookId, { rating: null, review_snippet: null });
      }

      endReadingActivity();
      savedRef.current = true;

      const onDone = () => {
        if (isComplete) {
          router.replace(`/book/${bookId}?rate=1` as any);
        } else {
          router.back();
        }
      };

      successOpacity.value = withSequence(
        withTiming(1, { duration: 250 }),
        withTiming(1, { duration: 800 }),
        withTiming(0, { duration: 300 }, (finished) => {
          if (finished) runOnJS(onDone)();
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
    outer: { flex: 1 },
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },

    // ── Header ──────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    backText: { color: colors.textSecondary, fontSize: 15, fontFamily: Fonts.regular },

    // ── Book card ────────────────────────────────────────────
    bookCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      ...Shadow.card,
    },
    cover: { width: 56, height: 84, borderRadius: Radius.sm },
    coverPlaceholder: {
      width: 56,
      height: 84,
      borderRadius: Radius.sm,
      backgroundColor: colors.primary + '22',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bookInfo: { flex: 1, gap: 3 },
    bookTitle: {
      fontSize: 15,
      fontFamily: Fonts.semiBold,
      color: colors.textPrimary,
      lineHeight: 20,
    },
    bookAuthor: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSecondary },
    bookMeta: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textTertiary, marginTop: 2 },
    bookMetaAccent: { fontSize: 12, fontFamily: Fonts.semiBold, color: colors.primary },

    // ── Timer area ────────────────────────────────────────────
    timerArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    timer: {
      color: colors.primary,
      fontSize: 72,
      fontFamily: Fonts.regular,
      fontVariant: ['tabular-nums'],
      letterSpacing: -1,
    },
    timerPaused: { color: colors.textTertiary },
    timerLabel: {
      fontSize: 13,
      fontFamily: Fonts.semiBold,
      color: colors.textTertiary,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    timerLabelActive: { color: colors.primary },

    // ── Controls ────────────────────────────────────────────
    controls: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.sm },

    controlRow: { flexDirection: 'row', gap: Spacing.sm },
    primaryBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 16,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    primaryBtnText: { color: colors.surface, fontSize: 16, fontFamily: Fonts.bold },
    secondaryBtn: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingVertical: 16,
      alignItems: 'center',
      backgroundColor: colors.surface,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    secondaryBtnText: { color: colors.textPrimary, fontSize: 16, fontFamily: Fonts.semiBold },

    // ── Setup-specific ───────────────────────────────────────
    setupBody: { flex: 1, paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    toggleRow: { flexDirection: 'row', gap: Spacing.sm },
    toggleBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: Radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    toggleBtnActive: { borderColor: colors.primary },
    toggleBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: colors.textSecondary },
    toggleBtnTextActive: { color: colors.primary },
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
    logManuallyText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: Fonts.regular,
      textAlign: 'center',
      marginTop: 4,
    },

    // ── Finish-specific ──────────────────────────────────────
    pageEquivHint: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textTertiary, textAlign: 'right' },
    errorText: { color: colors.error, fontSize: 13, fontFamily: Fonts.regular },
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

    // ── Success overlay ──────────────────────────────────────
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
  }), [colors]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ── Book card ─────────────────────────────────────────────────────────────

  const sp = parseInt(startPage, 10);
  const ep = parseInt(endPage, 10);
  const pageCount = userBook?.book.page_count ?? null;

  const bookMeta = () => {
    if (phase === 'finish') {
      return (
        <Text style={styles.bookMetaAccent}>{formatTimer(seconds)} read</Text>
      );
    }
    if ((phase === 'running' || phase === 'paused') && !isNaN(sp) && sp > 0) {
      return (
        <Text style={styles.bookMeta}>
          {isPercent ? `${sp}%` : `p. ${sp}`}
          {pageCount ? ` of ${isPercent ? '100%' : pageCount}` : ''}
        </Text>
      );
    }
    if (phase === 'setup' && userBook) {
      const cur = isPercent
        ? `${Math.round(userBook.progress_percent ?? 0)}%`
        : `p. ${userBook.current_page}`;
      return <Text style={styles.bookMeta}>{cur}</Text>;
    }
    return null;
  };

  const BookCard = () => (
    <View style={styles.bookCard}>
      {userBook?.book.cover_url ? (
        <Image source={{ uri: userBook.book.cover_url }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={styles.coverPlaceholder}>
          <Ionicons name="book" size={24} color={colors.primary} />
        </View>
      )}
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>{userBook?.book.title}</Text>
        <Text style={styles.bookAuthor} numberOfLines={1}>{userBook?.book.author}</Text>
        {bookMeta()}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* Book card — shown on all phases */}
      <BookCard />

      {/* ── Setup ── */}
      {phase === 'setup' && (
        <>
          <View style={styles.setupBody}>
            <View style={styles.toggleRow}>
              {(['Pages', '%'] as const).map((label) => {
                const active = label === '%' ? trackAsPercent : !trackAsPercent;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                    onPress={() => { setTrackAsPercent(label === '%'); setStartPage(''); }}
                  >
                    <Text style={[styles.toggleBtnText, active && styles.toggleBtnTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={styles.input}
              placeholder={isPercent ? 'Starting % (0–100)' : 'Starting page'}
              placeholderTextColor={colors.textTertiary}
              value={startPage}
              onChangeText={setStartPage}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.controls}>
            <TouchableOpacity style={styles.primaryBtn} onPress={startTimer}>
              <Ionicons name="play" size={18} color={colors.surface} />
              <Text style={styles.primaryBtnText}>Start Reading</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/session/manual')}>
              <Text style={styles.logManuallyText}>Log manually instead</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── Running ── */}
      {phase === 'running' && (
        <>
          <View style={styles.timerArea}>
            <Text style={styles.timer}>{formatTimer(seconds)}</Text>
            <Text style={[styles.timerLabel, styles.timerLabelActive]}>Reading</Text>
          </View>
          <View style={styles.controls}>
            <View style={styles.controlRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={pauseTimer}>
                <Ionicons name="pause" size={18} color={colors.textPrimary} />
                <Text style={styles.secondaryBtnText}>Pause</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={finishTimer}>
                <Ionicons name="checkmark" size={18} color={colors.surface} />
                <Text style={styles.primaryBtnText}>Finish</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* ── Paused ── */}
      {phase === 'paused' && (
        <>
          <View style={styles.timerArea}>
            <Text style={[styles.timer, styles.timerPaused]}>{formatTimer(seconds)}</Text>
            <Text style={styles.timerLabel}>Paused</Text>
          </View>
          <View style={styles.controls}>
            <View style={styles.controlRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={resumeTimer}>
                <Ionicons name="play" size={18} color={colors.textPrimary} />
                <Text style={styles.secondaryBtnText}>Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={finishTimer}>
                <Ionicons name="checkmark" size={18} color={colors.surface} />
                <Text style={styles.primaryBtnText}>Finish</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* ── Finish ── */}
      {phase === 'finish' && (
        <View style={styles.controls}>
          <TextInput
            style={styles.input}
            placeholder={isPercent ? 'Ending % (0–100)' : 'Ending page'}
            placeholderTextColor={colors.textTertiary}
            value={endPage}
            onChangeText={setEndPage}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            autoFocus
          />
          {isPercent && !isNaN(sp) && !isNaN(ep) && ep > sp && (() => {
            const pc = pageCount ?? 300;
            const startEquiv = Math.round(sp / 100 * pc);
            const endEquiv = Math.round(ep / 100 * pc);
            return (
              <Text style={styles.pageEquivHint}>
                ≈ {endEquiv - startEquiv} pages (pp. {startEquiv}–{endEquiv})
              </Text>
            );
          })()}
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

      {/* Success overlay */}
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
