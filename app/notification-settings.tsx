import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  scheduleReadingReminder,
  cancelReadingReminder,
  scheduleWeeklySummary,
  cancelWeeklySummary,
  type NotificationPreferences,
} from '@/lib/notifications';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

function formatTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const userId = session!.user.id;

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());

  useEffect(() => {
    getNotificationPreferences(userId)
      .then((p) => { setPrefs(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId]);

  const save = async (updated: NotificationPreferences) => {
    setPrefs(updated);
    setSaving(true);
    try {
      await saveNotificationPreferences(userId, updated);
      if (updated.readingReminderEnabled) {
        await scheduleReadingReminder(updated.readingReminderHour, updated.readingReminderMinute);
      } else {
        await cancelReadingReminder();
      }
      if (updated.weeklySummaryEnabled) {
        await scheduleWeeklySummary();
      } else {
        await cancelWeeklySummary();
      }
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    save({ ...prefs, [key]: !prefs[key] });
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: Spacing.lg, gap: Spacing.lg },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    backText: { color: colors.textSecondary, fontSize: 15, fontFamily: Fonts.regular },
    heading: { color: colors.primary, fontSize: 28, fontFamily: Fonts.bold },
    section: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      gap: Spacing.sm,
      ...Shadow.card,
    },
    sectionTitle: { fontSize: 13, fontFamily: Fonts.semiBold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    rowTextGroup: { flex: 1 },
    rowLabel: { fontSize: 15, fontFamily: Fonts.regular, color: colors.textPrimary, flex: 1 },
    rowSub: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textTertiary, marginTop: 2 },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.background,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
    },
    timeLabel: { flex: 1, fontSize: 15, fontFamily: Fonts.regular, color: colors.textPrimary },
    pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    pickerSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: Radius.lg,
      borderTopRightRadius: Radius.lg,
      paddingBottom: 32,
    },
    pickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pickerTitle: { fontSize: 16, fontFamily: Fonts.semiBold, color: colors.textPrimary },
    pickerCancel: { fontSize: 16, fontFamily: Fonts.regular, color: colors.textSecondary },
    pickerDone: { fontSize: 16, fontFamily: Fonts.semiBold, color: colors.primary },
  }), [colors]);

  if (loading || !prefs) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const reminderDate = new Date();
  reminderDate.setHours(prefs.readingReminderHour, prefs.readingReminderMinute, 0, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.heading}>Notifications</Text>
        {saving && <ActivityIndicator color={colors.primary} style={{ marginBottom: 8 }} />}

        {/* Reading Reminder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reading Reminder</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Daily reading reminder</Text>
            <Switch
              value={prefs.readingReminderEnabled}
              onValueChange={() => toggle('readingReminderEnabled')}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
          {prefs.readingReminderEnabled && (
            <TouchableOpacity
              style={styles.timeRow}
              onPress={() => {
                setTempTime(reminderDate);
                setTimePickerVisible(true);
              }}
            >
              <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.timeLabel}>
                {formatTime(prefs.readingReminderHour, prefs.readingReminderMinute)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Streak Protection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Streak Protection</Text>
          <View style={styles.row}>
            <View style={styles.rowTextGroup}>
              <Text style={styles.rowLabel}>Remind me if I haven't read</Text>
              <Text style={styles.rowSub}>Sends at 8 PM if you have no sessions today</Text>
            </View>
            <Switch
              value={prefs.streakProtectionEnabled}
              onValueChange={() => toggle('streakProtectionEnabled')}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        {/* Club Posts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Book Clubs</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>New posts in my clubs</Text>
            <Switch
              value={prefs.clubPostsEnabled}
              onValueChange={() => toggle('clubPostsEnabled')}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        {/* Weekly Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Summary</Text>
          <View style={styles.row}>
            <View style={styles.rowTextGroup}>
              <Text style={styles.rowLabel}>Weekly reading recap</Text>
              <Text style={styles.rowSub}>Every Sunday at 9 AM</Text>
            </View>
            <Switch
              value={prefs.weeklySummaryEnabled}
              onValueChange={() => toggle('weeklySummaryEnabled')}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        {/* Comments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Comments on my updates</Text>
            <Switch
              value={prefs.commentNotificationsEnabled}
              onValueChange={() => toggle('commentNotificationsEnabled')}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
        </View>
      </ScrollView>

      {/* Time picker — iOS modal */}
      {timePickerVisible && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setTimePickerVisible(false)}>
                  <Text style={styles.pickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Reminder Time</Text>
                <TouchableOpacity
                  onPress={() => {
                    setTimePickerVisible(false);
                    save({ ...prefs, readingReminderHour: tempTime.getHours(), readingReminderMinute: tempTime.getMinutes() });
                  }}
                >
                  <Text style={styles.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempTime}
                mode="time"
                display="spinner"
                onChange={(_: DateTimePickerEvent, d?: Date) => { if (d) setTempTime(d); }}
                textColor={colors.textPrimary}
              />
            </View>
          </View>
        </Modal>
      )}
      {timePickerVisible && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempTime}
          mode="time"
          display="default"
          onChange={(_: DateTimePickerEvent, d?: Date) => {
            setTimePickerVisible(false);
            if (d) save({ ...prefs, readingReminderHour: d.getHours(), readingReminderMinute: d.getMinutes() });
          }}
        />
      )}
    </SafeAreaView>
  );
}
