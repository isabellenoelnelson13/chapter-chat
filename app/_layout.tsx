import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';
import {
  Lora_400Regular,
  Lora_600SemiBold,
} from '@expo-google-fonts/lora';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../lib/auth';
import { ThemeProvider } from '../lib/theme';
import { registerPushToken, getNotificationPreferences, scheduleReadingReminder, scheduleWeeklySummary } from '../lib/notifications';

// Show notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export { ErrorBoundary } from 'expo-router';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/');
    }
  }, [session, loading, segments]);

  // Register push token and set up local notification schedules when signed in
  useEffect(() => {
    if (!session?.user.id) return;
    const userId = session.user.id;

    registerPushToken(userId);

    getNotificationPreferences(userId).then((prefs) => {
      if (prefs.readingReminderEnabled) {
        scheduleReadingReminder(prefs.readingReminderHour, prefs.readingReminderMinute);
      }
      if (prefs.weeklySummaryEnabled) {
        scheduleWeeklySummary();
      }
    });
  }, [session?.user.id]);

  // Navigate when user taps a push notification
  useEffect(() => {
    // App was launched from a tapped notification (killed state)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response);
    });

    // App was in foreground or background when notification was tapped
    const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    return () => sub.remove();
  }, []);

  function handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data as Record<string, unknown>;
    if (!data) return;
    if (data.eventId) router.push(`/activity/${data.eventId}`);
    else if (data.clubId) router.push(`/club/${data.clubId}`);
  }

  // Render nothing while auth state is loading to prevent flash of protected content
  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      <Stack.Screen name="search" options={{ presentation: 'modal' }} />
      <Stack.Screen name="session/[bookId]" />
      <Stack.Screen name="session/manual" />
      <Stack.Screen name="author/[authorId]" />
      <Stack.Screen name="activity/[eventId]" />
      <Stack.Screen name="notification-settings" />
      <Stack.Screen name="notifications-inbox" />
      <Stack.Screen name="quick-log" options={{ presentation: 'modal' }} />
      <Stack.Screen name="series/[seriesId]" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
    Lora_400Regular,
    Lora_600SemiBold,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}
