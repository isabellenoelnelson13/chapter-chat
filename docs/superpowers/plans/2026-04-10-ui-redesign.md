# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all screens from a dark gold theme to a light lavender/purple theme matching the provided Figma designs, add a Stats placeholder tab, and move to a 5-tab layout (Home, Library, Stats, Social, Discover).

**Architecture:** A single `constants/theme.ts` file exports all design tokens (Colors, Spacing, Radius, Shadow). Every screen imports from it instead of hardcoding hex values. No new logic — pure visual changes. The existing 80 tests must all pass after each task since the test suite does not assert on colors or layout.

**Tech Stack:** Expo SDK 54, Expo Router 6, React Native, TypeScript, `@expo/vector-icons` (Ionicons — already installed)

---

## Design token reference (use these everywhere)

```
background:    #EEEEF8  (light lavender)
surface:       #FFFFFF  (card / input background)
primary:       #7C6FCD  (purple accent, active tab, buttons, titles)
textPrimary:   #1A1A2E  (near-black navy)
textSecondary: #8888A8  (gray-purple labels)
border:        #E4E4F0  (subtle dividers / input borders)
error:         #FF4444
orange:        #FF6B35  (streak icon)
progressTrack: #E4E4F0
progressFill:  #1A1A2E  (dark bar fill, matches Figma)
```

Tab bar: white background, `#7C6FCD` active, `#AAAACC` inactive, no top border visible (use transparent or white border).

Card shadow: `shadowColor: '#1A1A2E'`, `shadowOffset: { width: 0, height: 2 }`, `shadowOpacity: 0.06`, `shadowRadius: 8`, `elevation: 3`.

---

## File Map

```
constants/
  theme.ts                        CREATE — all design tokens

app/(tabs)/
  _layout.tsx                     MODIFY — 5 tabs with Ionicons, new colors, hide Profile
  stats.tsx                       CREATE — Stats placeholder
  social.tsx                      MODIFY — restyle placeholder
  discover.tsx                    MODIFY — restyle placeholder
  profile.tsx                     MODIFY — restyle (stays accessible via Home header button)
  index.tsx                       MODIFY — full restyle; fix hooks-before-return
  library.tsx                     MODIFY — full restyle

app/(auth)/
  login.tsx                       MODIFY — restyle
  signup.tsx                      MODIFY — restyle

app/
  search.tsx                      MODIFY — restyle
  session/[bookId].tsx            MODIFY — restyle
  session/manual.tsx              MODIFY — restyle
```

---

## Task 1: Design tokens

**Files:**
- Create: `constants/theme.ts`

- [ ] **Step 1: Create the theme file**

```typescript
// constants/theme.ts

export const Colors = {
  background: '#EEEEF8',
  surface: '#FFFFFF',
  primary: '#7C6FCD',
  textPrimary: '#1A1A2E',
  textSecondary: '#8888A8',
  textTertiary: '#BBBBCC',
  border: '#E4E4F0',
  error: '#FF4444',
  orange: '#FF6B35',
  progressTrack: '#E4E4F0',
  progressFill: '#1A1A2E',
  tabBarBg: '#FFFFFF',
  tabActive: '#7C6FCD',
  tabInactive: '#AAAACC',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

export const Shadow = {
  card: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
};
```

- [ ] **Step 2: Run tests to verify nothing broke**

```bash
npx jest --no-coverage 2>&1 | tail -8
```

Expected: 80 tests passing, 14 suites.

- [ ] **Step 3: Commit**

```bash
git add constants/theme.ts && git commit -m "feat: add design token constants for UI redesign"
```

---

## Task 2: Tab bar layout + Stats placeholder

**Files:**
- Modify: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/stats.tsx`

- [ ] **Step 1: Create Stats placeholder**

```typescript
// app/(tabs)/stats.tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';

export default function StatsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Stats</Text>
      <Text style={styles.coming}>Coming in Phase 3</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 24 },
  title: { fontSize: 32, fontWeight: '700', color: Colors.primary, marginBottom: 8 },
  coming: { fontSize: 15, color: Colors.textSecondary },
});
```

- [ ] **Step 2: Replace `app/(tabs)/_layout.tsx`**

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(focusedName: IoniconName, unfocusedName: IoniconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : unfocusedName} size={24} color={color} />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBarBg,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: tabIcon('home', 'home-outline'),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: tabIcon('library', 'library-outline'),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: tabIcon('stats-chart', 'stats-chart-outline'),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: tabIcon('people', 'people-outline'),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: tabIcon('compass', 'compass-outline'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 3: Run tests**

```bash
npx jest --no-coverage 2>&1 | tail -8
```

Expected: 80 tests passing.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/_layout.tsx app/(tabs)/stats.tsx && git commit -m "feat: redesign tab bar with Ionicons and add Stats placeholder tab"
```

---

## Task 3: Placeholder screens (Social, Discover, Profile)

**Files:**
- Modify: `app/(tabs)/social.tsx`
- Modify: `app/(tabs)/discover.tsx`
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Replace `app/(tabs)/social.tsx`**

```typescript
// app/(tabs)/social.tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';

export default function SocialScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Social</Text>
      <Text style={styles.coming}>Coming in Phase 3</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 24 },
  title: { fontSize: 32, fontWeight: '700', color: Colors.primary, marginBottom: 8 },
  coming: { fontSize: 15, color: Colors.textSecondary },
});
```

- [ ] **Step 2: Replace `app/(tabs)/discover.tsx`**

```typescript
// app/(tabs)/discover.tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';

export default function DiscoverScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Discover</Text>
      <Text style={styles.coming}>Coming in Phase 4</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 24 },
  title: { fontSize: 32, fontWeight: '700', color: Colors.primary, marginBottom: 8 },
  coming: { fontSize: 15, color: Colors.textSecondary },
});
```

- [ ] **Step 3: Replace `app/(tabs)/profile.tsx`**

```typescript
// app/(tabs)/profile.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { Colors, Shadow, Radius } from '@/constants/theme';

export default function ProfileScreen() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.coming}>Coming in Phase 3</Text>
      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 24, gap: 16 },
  title: { fontSize: 32, fontWeight: '700', color: Colors.primary },
  coming: { fontSize: 15, color: Colors.textSecondary },
  signOutBtn: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    ...Shadow.card,
  },
  signOutText: { color: Colors.error, fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 4: Run tests**

```bash
npx jest --no-coverage 2>&1 | tail -8
```

Expected: 80 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/social.tsx app/(tabs)/discover.tsx app/(tabs)/profile.tsx && git commit -m "feat: restyle Social, Discover, Profile placeholder screens"
```

---

## Task 4: Auth screens

**Files:**
- Modify: `app/(auth)/login.tsx`
- Modify: `app/(auth)/signup.tsx`

- [ ] **Step 1: Replace `app/(auth)/login.tsx`**

```typescript
// app/(auth)/login.tsx
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
import { Colors, Radius, Shadow, Spacing } from '../../constants/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
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
        <Text style={styles.title}>BookApp</Text>
        <Text style={styles.subtitle}>Track every page, share every story</Text>

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
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.surface} />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <Link href="/(auth)/signup" style={styles.link}>
          Don't have an account? Sign up
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
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 14,
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
    marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  error: {
    color: Colors.error,
    fontSize: 13,
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
  buttonText: { color: Colors.surface, fontWeight: '700', fontSize: 16 },
  link: {
    color: Colors.primary,
    textAlign: 'center',
    marginTop: Spacing.lg,
    fontSize: 14,
  },
});
```

- [ ] **Step 2: Replace `app/(auth)/signup.tsx`**

```typescript
// app/(auth)/signup.tsx
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
import { Colors, Radius, Shadow, Spacing } from '../../constants/theme';

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
        <Text style={styles.title}>Create Account</Text>
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
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 14,
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
    marginBottom: Spacing.sm,
    ...Shadow.card,
  },
  error: {
    color: Colors.error,
    fontSize: 13,
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
  buttonText: { color: Colors.surface, fontWeight: '700', fontSize: 16 },
  link: {
    color: Colors.primary,
    textAlign: 'center',
    marginTop: Spacing.lg,
    fontSize: 14,
  },
});
```

- [ ] **Step 3: Run tests**

```bash
npx jest --no-coverage 2>&1 | tail -8
```

Expected: 80 tests passing.

- [ ] **Step 4: Commit**

```bash
git add app/(auth)/login.tsx app/(auth)/signup.tsx && git commit -m "feat: restyle auth screens with lavender/purple theme"
```

---

## Task 5: Home screen

**Files:**
- Modify: `app/(tabs)/index.tsx`

Key changes from current:
- Background `#EEEEF8`, surface `#FFFFFF`
- Greeting text: large bold purple
- **Fix hooks-before-return:** move all `useState`/`useEffect` before `if (!session) return null`
- Current book card: purple background (`#7C6FCD`), white text, dark progress fill, white "Start Reading" pill button
- Stats section: "Today's Progress" heading, 3 separate white cards (Pages / Time / Streak) with Ionicons
- Add profile icon button (→ `/(tabs)/profile`) in the header top-right
- Loading spinner: primary purple

- [ ] **Step 1: Replace `app/(tabs)/index.tsx`**

```typescript
// app/(tabs)/index.tsx
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getCurrentBook, type UserBookWithBook } from '@/lib/userBooks';
import { getTodayStats, estimateDaysRemaining, type TodayStats } from '@/lib/stats';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [currentBook, setCurrentBook] = useState<UserBookWithBook | null>(null);
  const [stats, setStats] = useState<TodayStats>({ pagesRead: 0, timeSeconds: 0, streak: 0 });
  const [loading, setLoading] = useState(true);

  const userId = session?.user.id ?? '';

  useEffect(() => {
    if (!userId) return;
    Promise.all([getCurrentBook(userId), getTodayStats(userId)])
      .then(([book, todayStats]) => {
        setCurrentBook(book);
        setStats(todayStats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  if (!session) return null;

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const pacePerDay =
    currentBook?.book.page_count && currentBook.current_page > 0 ? stats.pagesRead : 0;
  const daysLeft =
    currentBook?.book.page_count
      ? estimateDaysRemaining(pacePerDay, currentBook.current_page, currentBook.book.page_count)
      : null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const progress = currentBook?.book.page_count
    ? Math.min(1, currentBook.current_page / currentBook.book.page_count)
    : 0;
  const pct = Math.round(progress * 100);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.date}>{dateStr}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Ionicons name="person-circle-outline" size={32} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Current book card */}
        {currentBook ? (
          <View style={styles.bookCard}>
            {currentBook.book.cover_url ? (
              <Image source={{ uri: currentBook.book.cover_url }} style={styles.cover} />
            ) : (
              <View style={styles.coverPlaceholder} />
            )}
            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle} numberOfLines={2}>{currentBook.book.title}</Text>
              <Text style={styles.bookAuthor}>{currentBook.book.author}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {currentBook.current_page} / {currentBook.book.page_count ?? '?'} pages · {pct}%
                {daysLeft !== null ? `  ·  ~${daysLeft} days left` : ''}
              </Text>
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => router.push(`/session/${currentBook.book_id}`)}
              >
                <Ionicons name="play" size={14} color={Colors.primary} />
                <Text style={styles.startBtnText}>Start Reading Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.emptyCard} onPress={() => router.push('/search')}>
            <Ionicons name="book-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>Start a book</Text>
            <Text style={styles.emptySubtext}>Search for something to read</Text>
          </TouchableOpacity>
        )}

        {/* Today's Progress */}
        <Text style={styles.sectionTitle}>Today's Progress</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="book-outline" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{stats.pagesRead}</Text>
            <Text style={styles.statLabel}>Pages</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{formatTime(stats.timeSeconds)}</Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={20} color={Colors.orange} />
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: { fontSize: 28, fontWeight: '700', color: Colors.primary },
  date: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  profileBtn: { padding: 4 },

  // Current book card (purple background)
  bookCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
    ...Shadow.card,
  },
  cover: { width: 80, height: 120, borderRadius: Radius.sm },
  coverPlaceholder: {
    width: 80,
    height: 120,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  bookInfo: { flex: 1, gap: 6 },
  bookTitle: { color: Colors.surface, fontSize: 17, fontWeight: '700' },
  bookAuthor: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: Colors.surface, borderRadius: 2 },
  progressText: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingVertical: 10,
    gap: 6,
    marginTop: 4,
  },
  startBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },

  // Empty state
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 32,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.card,
  },
  emptyText: { color: Colors.textPrimary, fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: Colors.textSecondary, fontSize: 14 },

  // Stats
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
    ...Shadow.card,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 12, color: Colors.textSecondary },
});
```

- [ ] **Step 2: Run tests**

```bash
npx jest --no-coverage 2>&1 | tail -8
```

Expected: 80 tests passing.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/index.tsx && git commit -m "feat: restyle Home screen with lavender/purple theme"
```

---

## Task 6: Library screen

**Files:**
- Modify: `app/(tabs)/library.tsx`

Key changes:
- Background `#EEEEF8`
- Page title "Library" in bold purple
- Shelf tabs: pill-style selector on a `#E4E4F0` track, white active pill
- Book cards: white with shadow, dark text, purple progress bar
- FAB: purple circle
- Library header row with title + FAB (move FAB out of absolute positioning to a header row)

- [ ] **Step 1: Replace `app/(tabs)/library.tsx`**

```typescript
// app/(tabs)/library.tsx
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getShelf, type UserBookWithBook } from '@/lib/userBooks';
import { Shelf } from '@/types/database';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

const SHELVES: { key: Shelf; label: string }[] = [
  { key: 'reading', label: 'Reading' },
  { key: 'want', label: 'Want to Read' },
  { key: 'read', label: 'Read' },
  { key: 'dnf', label: 'DNF' },
];

export default function LibraryScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [activeShelf, setActiveShelf] = useState<Shelf>('reading');
  const [books, setBooks] = useState<UserBookWithBook[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = session?.user.id ?? '';

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getShelf(userId, activeShelf)
      .then(setBooks)
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, [userId, activeShelf]);

  if (!session) return null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/search')}>
          <Ionicons name="add" size={24} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      {/* Shelf tabs (pill selector) */}
      <View style={styles.tabTrack}>
        {SHELVES.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeShelf === key && styles.activeTab]}
            onPress={() => setActiveShelf(key)}
          >
            <Text style={[styles.tabText, activeShelf === key && styles.activeTabText]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          contentContainerStyle={books.length === 0 ? styles.emptyContainer : styles.list}
          renderItem={({ item }) => <BookCard book={item} shelf={activeShelf} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No books here yet</Text>}
        />
      )}
    </SafeAreaView>
  );
}

function BookCard({ book, shelf }: { book: UserBookWithBook; shelf: Shelf }) {
  const progress = book.book.page_count
    ? Math.min(1, book.current_page / book.book.page_count)
    : 0;

  return (
    <View style={styles.card}>
      {book.book.cover_url ? (
        <Image source={{ uri: book.book.cover_url }} style={styles.cover} />
      ) : (
        <View style={styles.coverPlaceholder} />
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>{book.book.title}</Text>
        <Text style={styles.cardAuthor}>{book.book.author}</Text>
        {shelf === 'reading' && book.book.page_count && (
          <>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={styles.progressPct}>{Math.round(progress * 100)}% complete</Text>
          </>
        )}
        {shelf === 'read' && book.rating !== null && (
          <Text style={styles.rating}>
            {'★'.repeat(Math.min(5, Math.max(0, book.rating ?? 0)))}
            {'☆'.repeat(5 - Math.min(5, Math.max(0, book.rating ?? 0)))}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: 32, fontWeight: '700', color: Colors.primary },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.card,
  },

  // Pill selector
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: Colors.border,
    borderRadius: Radius.xl,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.xl,
  },
  activeTab: { backgroundColor: Colors.surface, ...Shadow.card },
  tabText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  activeTabText: { color: Colors.textPrimary, fontWeight: '700' },

  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.sm },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, fontSize: 15 },

  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.card,
  },
  cover: { width: 56, height: 84, borderRadius: Radius.sm },
  coverPlaceholder: {
    width: 56,
    height: 84,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
  },
  cardInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  cardAuthor: { color: Colors.textSecondary, fontSize: 13 },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: 3, backgroundColor: Colors.progressFill, borderRadius: 2 },
  progressPct: { color: Colors.textSecondary, fontSize: 12 },
  rating: { color: Colors.primary, fontSize: 14 },
});
```

- [ ] **Step 2: Run tests**

```bash
npx jest --no-coverage 2>&1 | tail -8
```

Expected: 80 tests passing. Note: the library test asserts on "Want" tab label — the current label is "Want" but this task changes it to "Want to Read". If the test checks for `getByText('Want')`, update the test to `getByText('Want to Read')`. The test file is `__tests__/screens/library.test.tsx`.

If tests fail due to label change, find and update the assertion in `__tests__/screens/library.test.tsx`:
```
// Find: getByText('Want') or similar
// Change to: getByText('Want to Read')
```

Also update the mock `SHELVES` data check if needed.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/library.tsx __tests__/screens/library.test.tsx && git commit -m "feat: restyle Library screen with lavender/purple theme and pill tabs"
```

---

## Task 7: Search screen

**Files:**
- Modify: `app/search.tsx`

Key changes:
- Background `#EEEEF8`
- Input: white surface, border, shadow
- Results: white cards with shadow
- Cancel button: primary purple text
- ActionSheetIOS comment stays

- [ ] **Step 1: Replace `app/search.tsx`**

```typescript
// app/search.tsx
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { searchBooks, upsertBook, type BookSearchResult } from '@/lib/books';
import { addToShelf } from '@/lib/userBooks';
import { Shelf } from '@/types/database';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

const SHELF_OPTIONS = ['Cancel', 'Reading', 'Want to Read', 'Read', 'Did Not Finish'] as const;
const SHELF_KEYS: (Shelf | null)[] = [null, 'reading', 'want', 'read', 'dnf'];

export default function SearchScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!session) return null;
  const userId = session.user.id;

  const onChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const items = await searchBooks(text.trim());
        setResults(items);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const addBook = async (book: BookSearchResult, shelf: Shelf) => {
    try {
      const bookId = await upsertBook(book);
      await addToShelf(userId, bookId, shelf);
      router.back();
    } catch {
      Alert.alert('Error', 'Could not add book. Please try again.');
    }
  };

  const showShelfPicker = (book: BookSearchResult) => {
    // ActionSheetIOS is iOS-only — this app targets iOS exclusively
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...SHELF_OPTIONS],
        cancelButtonIndex: 0,
        title: `Add "${book.title}" to...`,
      },
      (buttonIndex) => {
        const shelf = SHELF_KEYS[buttonIndex];
        if (shelf) addBook(book, shelf);
      }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.input}
          placeholder="Search by title or author..."
          placeholderTextColor={Colors.textTertiary}
          value={query}
          onChangeText={onChangeText}
          autoFocus
          returnKeyType="search"
        />
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {searching && <ActivityIndicator color={Colors.primary} style={styles.spinner} />}

      <FlatList
        data={results}
        keyExtractor={(item) => item.google_books_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.result} onPress={() => showShelfPicker(item)}>
            {item.cover_url ? (
              <Image source={{ uri: item.cover_url }} style={styles.cover} />
            ) : (
              <View style={styles.coverPlaceholder} />
            )}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.author}>{item.author}</Text>
              {item.page_count && (
                <Text style={styles.pages}>{item.page_count} pages</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    ...Shadow.card,
  },
  cancel: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  spinner: { marginVertical: Spacing.md },
  list: { padding: Spacing.md, gap: Spacing.sm },
  result: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.card,
  },
  cover: { width: 50, height: 75, borderRadius: Radius.sm },
  coverPlaceholder: {
    width: 50,
    height: 75,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
  },
  info: { flex: 1, gap: 4, justifyContent: 'center' },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  author: { color: Colors.textSecondary, fontSize: 13 },
  pages: { color: Colors.textTertiary, fontSize: 12 },
});
```

- [ ] **Step 2: Run tests**

```bash
npx jest --no-coverage 2>&1 | tail -8
```

Expected: 80 tests passing.

- [ ] **Step 3: Commit**

```bash
git add app/search.tsx && git commit -m "feat: restyle Search screen with lavender/purple theme"
```

---

## Task 8: Session screens

**Files:**
- Modify: `app/session/[bookId].tsx`
- Modify: `app/session/manual.tsx`

- [ ] **Step 1: Replace `app/session/[bookId].tsx`**

```typescript
// app/session/[bookId].tsx
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getUserBook, type UserBookWithBook } from '@/lib/userBooks';
import { createSession } from '@/lib/sessions';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

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
      router.back();
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
          />
          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
          <TouchableOpacity style={styles.primaryBtn} onPress={saveSession}>
            <Text style={styles.primaryBtnText}>Save Session</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
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
  backText: { color: Colors.textSecondary, fontSize: 15 },
  bookTitle: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.xl,
  },
  timerArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  timer: {
    color: Colors.primary,
    fontSize: 72,
    fontWeight: '200',
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
    ...Shadow.card,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.surface, fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  secondaryBtnText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  logManuallyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  errorText: { color: Colors.error, fontSize: 13 },
});
```

- [ ] **Step 2: Replace `app/session/manual.tsx`**

```typescript
// app/session/manual.tsx
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getShelf, type UserBookWithBook } from '@/lib/userBooks';
import { createSession } from '@/lib/sessions';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

function parseTime(hhmm: string): number | null {
  const parts = hhmm.split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m) || h < 0 || m < 0 || m > 59) return null;
  return h * 3600 + m * 60;
}

export default function ManualSessionScreen() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const router = useRouter();

  const [readingBooks, setReadingBooks] = useState<UserBookWithBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<UserBookWithBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getShelf(userId, 'reading')
      .then((books) => {
        setReadingBooks(books);
        if (books.length > 0) {
          setSelectedBook(books[0]);
          setStartPage(String(books[0].current_page));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  const logSession = async () => {
    setError('');
    const sp = parseInt(startPage, 10);
    const ep = parseInt(endPage, 10);
    const pageCount = selectedBook?.book.page_count;
    if (
      isNaN(sp) || isNaN(ep) ||
      sp < 0 || ep <= sp ||
      (pageCount !== null && pageCount !== undefined && ep > pageCount)
    ) {
      setError('End page must be greater than start page');
      return;
    }
    const durationSeconds = parseTime(timeStr);
    if (durationSeconds === null) {
      setError('Enter time as H:MM or HH:MM');
      return;
    }
    if (durationSeconds <= 0) {
      setError('Time must be greater than 0');
      return;
    }
    if (!selectedBook) return;

    try {
      await createSession({
        userId,
        bookId: selectedBook.book_id,
        userBookId: selectedBook.id,
        startPage: sp,
        endPage: ep,
        durationSeconds,
        startedAt: new Date(),
      });
      router.back();
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.heading}>Log a Session</Text>

        {selectedBook && (
          <Text style={styles.bookTitle}>{selectedBook.book.title}</Text>
        )}

        {readingBooks.length === 0 && (
          <Text style={styles.noBooks}>No books currently being read</Text>
        )}

        {readingBooks.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bookPicker}>
            {readingBooks.map((book) => (
              <TouchableOpacity
                key={book.id}
                style={[
                  styles.bookChip,
                  selectedBook?.id === book.id && styles.bookChipActive,
                ]}
                onPress={() => {
                  setSelectedBook(book);
                  setStartPage(String(book.current_page));
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

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Start page</Text>
            <TextInput
              style={styles.input}
              placeholder="Start page"
              placeholderTextColor={Colors.textTertiary}
              value={startPage}
              onChangeText={setStartPage}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>End page</Text>
            <TextInput
              style={styles.input}
              placeholder="End page"
              placeholderTextColor={Colors.textTertiary}
              value={endPage}
              onChangeText={setEndPage}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Time spent</Text>
          <TextInput
            style={styles.input}
            placeholder="HH:MM"
            placeholderTextColor={Colors.textTertiary}
            value={timeStr}
            onChangeText={setTimeStr}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.saveBtn} onPress={logSession}>
          <Text style={styles.saveBtnText}>Log Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: Colors.textSecondary, fontSize: 15 },
  heading: { color: Colors.primary, fontSize: 28, fontWeight: '700' },
  bookTitle: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  noBooks: { color: Colors.textSecondary, fontSize: 15 },
  bookPicker: { flexGrow: 0 },
  bookChip: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: Spacing.sm,
    maxWidth: 160,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bookChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  bookChipText: { color: Colors.textSecondary, fontSize: 13 },
  bookChipTextActive: { color: Colors.surface },
  row: { flexDirection: 'row', gap: Spacing.sm },
  halfField: { flex: 1, gap: 6 },
  field: { gap: 6 },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  input: {
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    ...Shadow.card,
  },
  error: { color: Colors.error, fontSize: 13 },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: Colors.surface, fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 3: Run tests**

```bash
npx jest --no-coverage 2>&1 | tail -8
```

Expected: 80 tests passing.

- [ ] **Step 4: Commit**

```bash
git add "app/session/[bookId].tsx" app/session/manual.tsx && git commit -m "feat: restyle session screens with lavender/purple theme"
```

---

## Final verification

After all 8 tasks:

```bash
npx jest --no-coverage 2>&1 | tail -8
```

Expected: 80 tests, 14 suites, all passing.

```bash
git log --oneline -10
```

Should show 8 new commits on top of the Phase 2 merge.
