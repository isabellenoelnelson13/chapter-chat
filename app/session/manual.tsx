import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
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
import { getShelf, updateProgressPercent, type UserBookWithBook } from '@/lib/userBooks';
import { createSession } from '@/lib/sessions';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';


export default function ManualSessionScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session!.user.id;
  const router = useRouter();
  const { bookId: paramBookId } = useLocalSearchParams<{ bookId?: string }>();

  const [readingBooks, setReadingBooks] = useState<UserBookWithBook[]>([]);
  const [readBooks, setReadBooks] = useState<UserBookWithBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<UserBookWithBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [secs, setSecs] = useState('');
  const [error, setError] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerTemp, setDatePickerTemp] = useState(new Date());
  const successOpacity = useSharedValue(0);
  const successScale = useSharedValue(0.8);
  const successStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ scale: successScale.value }],
  }));

  const isPercent = selectedBook?.format === 'ebook' || selectedBook?.format === 'audiobook';

  useEffect(() => {
    Promise.all([getShelf(userId, 'reading'), getShelf(userId, 'read')])
      .then(([reading, read]) => {
        setReadingBooks(reading);
        setReadBooks(read);
        const allBooks = [...reading, ...read];
        const preSelected = paramBookId
          ? allBooks.find(b => b.book_id === paramBookId) ?? null
          : reading[0] ?? null;
        if (preSelected) {
          setSelectedBook(preSelected);
          const isP = preSelected.format === 'ebook' || preSelected.format === 'audiobook';
          setStartPage(isP
            ? String(Math.round(preSelected.progress_percent ?? 0))
            : String(preSelected.current_page));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId, paramBookId]);

  const logSession = async () => {
    setError('');
    const sp = parseInt(startPage, 10);
    const ep = parseInt(endPage, 10);
    const pageCount = selectedBook?.book.page_count;
    if (isNaN(sp) || isNaN(ep) || sp < 0 || ep <= sp) {
      setError(isPercent ? 'End % must be greater than start %' : 'End page must be greater than start page');
      return;
    }
    if (isPercent && ep > 100) {
      setError('Percentage cannot exceed 100');
      return;
    }
    if (!isPercent && pageCount != null && ep > pageCount) {
      setError('End page exceeds book length');
      return;
    }
    const h = parseInt(hours || '0', 10);
    const m = parseInt(minutes || '0', 10);
    const s = parseInt(secs || '0', 10);
    if (isNaN(h) || isNaN(m) || isNaN(s) || m > 59 || s > 59 || h < 0 || m < 0 || s < 0) {
      setError('Enter valid hours, minutes, and seconds');
      return;
    }
    const durationSeconds = h * 3600 + m * 60 + s;
    if (durationSeconds <= 0) {
      setError('Time must be greater than 0');
      return;
    }
    if (!selectedBook) return;

    const effectivePageCount = selectedBook.book.page_count ?? 300;
    const sessionStartPage = isPercent ? Math.round(sp / 100 * effectivePageCount) : sp;
    const sessionEndPage = isPercent ? Math.round(ep / 100 * effectivePageCount) : ep;

    const isReadBook = readBooks.some(b => b.id === selectedBook.id);
    try {
      await createSession({
        userId,
        bookId: selectedBook.book_id,
        userBookId: selectedBook.id,
        startPage: sessionStartPage,
        endPage: sessionEndPage,
        durationSeconds,
        startedAt: sessionDate,
        skipProgressUpdate: isReadBook,
      });
      if (isPercent && !isReadBook) {
        await updateProgressPercent(selectedBook.id, ep);
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
    container: { flex: 1, backgroundColor: colors.background },
    center: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scroll: { padding: Spacing.lg, gap: Spacing.lg },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    backText: { color: colors.textSecondary, fontSize: 15, fontFamily: Fonts.regular },
    heading: { color: colors.primary, fontSize: 28, fontFamily: Fonts.bold },
    bookTitle: { color: colors.primary, fontSize: 16, fontFamily: Fonts.semiBold },
    noBooks: { color: colors.textSecondary, fontSize: 15, fontFamily: Fonts.regular },
    bookPicker: { flexGrow: 0 },
    bookChip: {
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginRight: Spacing.sm,
      maxWidth: 160,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bookChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    bookChipText: { color: colors.textSecondary, fontSize: 13, fontFamily: Fonts.regular },
    bookChipTextActive: { color: colors.surface, fontFamily: Fonts.regular },
    row: { flexDirection: 'row', gap: Spacing.sm },
    halfField: { flex: 1, gap: 6 },
    field: { gap: 6 },
    timeRow: { flexDirection: 'row', gap: Spacing.sm },
    timeField: { flex: 1, alignItems: 'center', gap: 4 },
    timeInput: { textAlign: 'center', width: '100%' },
    timeUnit: { color: colors.textSecondary, fontSize: 12, fontFamily: Fonts.medium },
    label: { color: colors.textSecondary, fontSize: 13, fontFamily: Fonts.medium },
    input: {
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 16,
      fontFamily: Fonts.regular,
      ...Shadow.card,
    },
    error: { color: colors.error, fontSize: 13, fontFamily: Fonts.regular },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      ...Shadow.card,
    },
    dateLabel: { flex: 1, fontSize: 15, fontFamily: Fonts.regular, color: colors.textPrimary },
    datePickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    datePickerSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: Radius.lg,
      borderTopRightRadius: Radius.lg,
      paddingBottom: 32,
    },
    datePickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    datePickerTitle: { fontSize: 16, fontFamily: Fonts.semiBold, color: colors.textPrimary },
    datePickerCancel: { fontSize: 16, fontFamily: Fonts.regular, color: colors.textSecondary },
    datePickerDone: { fontSize: 16, fontFamily: Fonts.semiBold, color: colors.primary },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: Radius.md,
      paddingVertical: 16,
      alignItems: 'center',
    },
    saveBtnText: { color: colors.surface, fontSize: 16, fontFamily: Fonts.bold },
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.heading}>Log a Session</Text>

        {selectedBook && (
          <Text style={styles.bookTitle}>{selectedBook.book.title}</Text>
        )}

        {readingBooks.length === 0 && readBooks.length === 0 && (
          <Text style={styles.noBooks}>No books in your library</Text>
        )}

        {(readingBooks.length + readBooks.length) > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bookPicker}>
            {[...readingBooks, ...readBooks].map((book) => (
              <TouchableOpacity
                key={book.id}
                style={[
                  styles.bookChip,
                  selectedBook?.id === book.id && styles.bookChipActive,
                ]}
                onPress={() => {
                  setSelectedBook(book);
                  const isP = book.format === 'ebook' || book.format === 'audiobook';
                  setStartPage(isP
                    ? String(Math.round(book.progress_percent ?? 0))
                    : String(book.current_page));
                }}
              >
                <Text
                  style={[
                    styles.bookChipText,
                    selectedBook?.id === book.id && styles.bookChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {book.book.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.dateRow} onPress={() => {
          setDatePickerTemp(sessionDate);
          setDatePickerVisible(true);
        }}>
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.dateLabel}>
            {sessionDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>{isPercent ? 'Start %' : 'Start page'}</Text>
            <TextInput
              style={styles.input}
              placeholder={isPercent ? '0' : 'Start page'}
              placeholderTextColor={colors.textTertiary}
              value={startPage}
              onChangeText={setStartPage}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>{isPercent ? 'End %' : 'End page'}</Text>
            <TextInput
              style={styles.input}
              placeholder={isPercent ? '100' : 'End page'}
              placeholderTextColor={colors.textTertiary}
              value={endPage}
              onChangeText={setEndPage}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Time spent</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={hours}
                onChangeText={setHours}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.timeUnit}>hr</Text>
            </View>
            <View style={styles.timeField}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.timeUnit}>min</Text>
            </View>
            <View style={styles.timeField}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={secs}
                onChangeText={setSecs}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.timeUnit}>sec</Text>
            </View>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.saveBtn} onPress={logSession}>
          <Text style={styles.saveBtnText}>Log Session</Text>
        </TouchableOpacity>
      </ScrollView>
      <Animated.View style={[styles.successOverlay, successStyle]} pointerEvents="none">
        <View style={styles.successBadge}>
          <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
          <Text style={styles.successText}>Session logged!</Text>
        </View>
      </Animated.View>

      {/* Date Picker */}
      {datePickerVisible && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerSheet}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={() => setDatePickerVisible(false)}>
                  <Text style={styles.datePickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>Session Date</Text>
                <TouchableOpacity onPress={() => {
                  setSessionDate(datePickerTemp);
                  setDatePickerVisible(false);
                }}>
                  <Text style={styles.datePickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={datePickerTemp}
                mode="date"
                display="spinner"
                onChange={(_: DateTimePickerEvent, d?: Date) => { if (d) setDatePickerTemp(d); }}
                maximumDate={new Date()}
                textColor={colors.textPrimary}
              />
            </View>
          </View>
        </Modal>
      )}
      {datePickerVisible && Platform.OS === 'android' && (
        <DateTimePicker
          value={datePickerTemp}
          mode="date"
          display="default"
          onChange={(_: DateTimePickerEvent, d?: Date) => {
            setDatePickerVisible(false);
            if (d) setSessionDate(d);
          }}
          maximumDate={new Date()}
        />
      )}
    </SafeAreaView>
  );
}
