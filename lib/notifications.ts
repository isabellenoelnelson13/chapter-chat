import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationPreferences {
  readingReminderEnabled: boolean;
  readingReminderHour: number;    // 0–23
  readingReminderMinute: number;  // 0–59
  streakProtectionEnabled: boolean;
  clubPostsEnabled: boolean;
  weeklySummaryEnabled: boolean;
  commentNotificationsEnabled: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  readingReminderEnabled: true,
  readingReminderHour: 20,
  readingReminderMinute: 0,
  streakProtectionEnabled: true,
  clubPostsEnabled: true,
  weeklySummaryEnabled: true,
  commentNotificationsEnabled: true,
};

// ─── Push token registration ──────────────────────────────────────────────────

export async function registerPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) return; // simulators don't support push

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) return;

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenData.data;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token }, { onConflict: 'user_id,token' });
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return DEFAULT_PREFS;

  return {
    readingReminderEnabled: data.reading_reminder_enabled,
    readingReminderHour: data.reading_reminder_hour,
    readingReminderMinute: data.reading_reminder_minute,
    streakProtectionEnabled: data.streak_protection_enabled,
    clubPostsEnabled: data.club_posts_enabled,
    weeklySummaryEnabled: data.weekly_summary_enabled,
    commentNotificationsEnabled: data.comment_notifications_enabled,
  };
}

export async function saveNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences,
): Promise<void> {
  await supabase.from('notification_preferences').upsert({
    user_id: userId,
    reading_reminder_enabled: prefs.readingReminderEnabled,
    reading_reminder_hour: prefs.readingReminderHour,
    reading_reminder_minute: prefs.readingReminderMinute,
    streak_protection_enabled: prefs.streakProtectionEnabled,
    club_posts_enabled: prefs.clubPostsEnabled,
    weekly_summary_enabled: prefs.weeklySummaryEnabled,
    comment_notifications_enabled: prefs.commentNotificationsEnabled,
    updated_at: new Date().toISOString(),
  });
}

// ─── Local notification scheduling ───────────────────────────────────────────

const REMINDER_ID = 'daily-reading-reminder';
const STREAK_ID = 'streak-protection';
const WEEKLY_ID = 'weekly-summary';

export async function scheduleReadingReminder(
  hour: number,
  minute: number,
  hasReadToday: boolean,
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
  if (hasReadToday) return;

  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= new Date()) return; // already past the reminder time today

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'Time to read 📖',
      body: "Don't forget your daily reading session!",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: target,
    },
  });
}

export async function cancelReadingReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
}

/** Schedule a one-time streak-protection notification for 8 PM today if the
 *  user hasn't read yet.  Cancels immediately if they have. */
export async function scheduleStreakProtection(hasReadToday: boolean): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(STREAK_ID).catch(() => {});
  if (hasReadToday) return;

  const now = new Date();
  const target = new Date();
  target.setHours(20, 0, 0, 0);
  if (target <= now) return; // already past 8 PM

  await Notifications.scheduleNotificationAsync({
    identifier: STREAK_ID,
    content: {
      title: 'Keep your streak alive 🔥',
      body: "You haven't read today yet — just a few pages counts!",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: target,
    },
  });
}

export async function scheduleWeeklySummary(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_ID,
    content: {
      title: 'Your week in reading 📚',
      body: 'Open Chapter Chat to see your reading summary for the week.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Sunday
      hour: 9,
      minute: 0,
    },
  });
}

export async function cancelWeeklySummary(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_ID).catch(() => {});
}

// ─── Inbox ───────────────────────────────────────────────────────────────────

export interface InboxNotification {
  id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

export async function getInboxNotifications(userId: string): Promise<InboxNotification[]> {
  const { data } = await supabase
    .from('inbox_notifications')
    .select('id, title, body, data, read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    data: r.data,
    read: r.read,
    createdAt: r.created_at,
  }));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('inbox_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('inbox_notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase
    .from('inbox_notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}

// ─── Push notifications (server-side via Edge Function) ──────────────────────

export async function sendPushNotification(
  recipientUserId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.functions.invoke('send-notification', {
      body: { recipientUserId, title, body, data },
    });
  } catch {
    // best-effort — don't surface push failures to the user
  }
}
