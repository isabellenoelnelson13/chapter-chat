import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-gifted-charts';
import { useAuth } from '@/lib/auth';
import {
  getStreak,
  getWeeklyPace,
  getYearlyGoalProgress,
  getReadingHistory,
  getMonthlyBooks,
  getGenreBreakdown,
  type DailyReading,
  type MonthlyBooks,
  type GenreCount,
  type YearlyGoalProgress,
} from '@/lib/stats';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 2 * Spacing.lg - 32;
const PIE_COLORS = ['#7C6FCD', '#A599E9', '#5B4FB0', '#C4BCF0', '#3D3580', '#E8E4FA'];

export default function StatsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';

  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [pace, setPace] = useState(0);
  const [yearlyGoal, setYearlyGoal] = useState<YearlyGoalProgress>({ booksRead: 0, goal: 0 });
  const [history, setHistory] = useState<DailyReading[]>([]);
  const [monthly, setMonthly] = useState<MonthlyBooks[]>([]);
  const [genres, setGenres] = useState<GenreCount[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      Promise.all([
        getStreak(userId),
        getWeeklyPace(userId),
        getYearlyGoalProgress(userId),
        getReadingHistory(userId, 30),
        getMonthlyBooks(userId, new Date().getFullYear()),
        getGenreBreakdown(userId),
      ])
        .then(([s, p, yg, h, m, g]) => {
          setStreak(s);
          setPace(p);
          setYearlyGoal(yg);
          setHistory(h);
          setMonthly(m);
          setGenres(g);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, [userId])
  );

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const lineData = history.map(d => ({
    value: d.pages,
    label: d.date.slice(5).replace('-', '/'),
  }));

  const barData = monthly.map(m => ({
    value: m.count,
    label: m.month,
    frontColor: Colors.primary,
  }));

  const topGenres = genres.slice(0, 6);
  const pieData = topGenres.map((g, i) => ({
    value: g.count,
    color: PIE_COLORS[i],
    text: g.genre,
  }));

  const hasBarData = monthly.some(m => m.count > 0);
  const hasPieData = topGenres.length > 0;
  const goalPct = yearlyGoal.goal > 0
    ? Math.min(1, yearlyGoal.booksRead / yearlyGoal.goal)
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Stats</Text>

        {/* Streak + pace row */}
        <View style={styles.row}>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={20} color={Colors.orange} />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="book-outline" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{pace}</Text>
            <Text style={styles.statLabel}>Pages/day avg</Text>
          </View>
        </View>

        {/* Yearly goal */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{new Date().getFullYear()} Reading Goal</Text>
          {yearlyGoal.goal === 0 ? (
            <Text style={styles.emptyText}>Set a goal in your Profile</Text>
          ) : (
            <>
              <Text style={styles.goalText}>
                {yearlyGoal.booksRead} of {yearlyGoal.goal} books
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(goalPct * 100)}%` }]} />
              </View>
            </>
          )}
        </View>

        {/* Reading history line chart */}
        <Text style={styles.sectionTitle}>Last 30 Days</Text>
        <View style={styles.card}>
          {history.every(d => d.pages === 0) ? (
            <Text style={styles.emptyText}>Start a reading session to see your history</Text>
          ) : (
            <LineChart
              data={lineData}
              width={CHART_WIDTH}
              height={180}
              color={Colors.primary}
              dataPointsColor={Colors.primary}
              spacing={Math.floor(CHART_WIDTH / 32)}
              initialSpacing={0}
              noOfSections={4}
              xAxisThickness={0}
              yAxisThickness={0}
              hideDataPoints={false}
              yAxisTextStyle={styles.axisLabel}
              xAxisLabelTextStyle={styles.axisLabel}
            />
          )}
        </View>

        {/* Books finished bar chart */}
        <Text style={styles.sectionTitle}>Books Finished</Text>
        <View style={styles.card}>
          {!hasBarData ? (
            <Text style={styles.emptyText}>No books finished yet this year</Text>
          ) : (
            <BarChart
              data={barData}
              width={CHART_WIDTH}
              height={160}
              barWidth={20}
              spacing={8}
              roundedTop
              noOfSections={3}
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={styles.axisLabel}
              xAxisLabelTextStyle={styles.axisLabel}
            />
          )}
        </View>

        {/* Genre breakdown pie chart */}
        <Text style={styles.sectionTitle}>Genres</Text>
        <View style={styles.card}>
          {!hasPieData ? (
            <Text style={styles.emptyText}>Finish books to see your genre breakdown</Text>
          ) : (
            <>
              <PieChart
                data={pieData}
                donut
                radius={80}
                innerRadius={50}
              />
              <View style={styles.legend}>
                {topGenres.map((g, i) => (
                  <View key={g.genre} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: PIE_COLORS[i] }]} />
                    <Text style={styles.legendText}>{g.genre} ({g.count})</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },
  title: { fontSize: 32, fontWeight: '700', color: Colors.primary },

  row: { flexDirection: 'row', gap: Spacing.sm },
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

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.card,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  goalText: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.progressTrack,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: Colors.primary, borderRadius: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 12 },
  axisLabel: { color: Colors.textTertiary, fontSize: 9 },

  legend: { marginTop: Spacing.md, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: Colors.textSecondary },
});
