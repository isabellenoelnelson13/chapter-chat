import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BarChart, PieChart } from 'react-native-gifted-charts';
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
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 2 * Spacing.lg - 2 * Spacing.md;
const PIE_COLORS = ['#7C6FCD', '#A599E9', '#5B4FB0', '#C4BCF0', '#3D3580', '#E8E4FA'];
const BAR_COLOR = '#A599E9';
const BAR_COLOR_SELECTED = '#7C6FCD';
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTooltipDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

type Period = 'week' | 'month';

export default function StatsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('week');
  const [chartKey, setChartKey] = useState(0);
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

  const [streak, setStreak] = useState(0);
  const [pace, setPace] = useState(0);
  const [yearlyGoal, setYearlyGoal] = useState<YearlyGoalProgress>({ booksRead: 0, goal: 0 });
  const [weekHistory, setWeekHistory] = useState<DailyReading[]>([]);
  const [monthHistory, setMonthHistory] = useState<DailyReading[]>([]);
  const [monthly, setMonthly] = useState<MonthlyBooks[]>([]);
  const [genres, setGenres] = useState<GenreCount[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      Promise.allSettled([
        getStreak(userId),
        getWeeklyPace(userId),
        getYearlyGoalProgress(userId),
        getReadingHistory(userId, 7),
        getReadingHistory(userId, 30),
        getMonthlyBooks(userId, new Date().getFullYear()),
        getGenreBreakdown(userId),
      ]).then(([s, p, yg, wh, mh, m, g]) => {
        if (s.status === 'fulfilled') setStreak(s.value);
        if (p.status === 'fulfilled') setPace(p.value);
        if (yg.status === 'fulfilled') setYearlyGoal(yg.value);
        if (wh.status === 'fulfilled') setWeekHistory(wh.value);
        if (mh.status === 'fulfilled') setMonthHistory(mh.value);
        if (m.status === 'fulfilled') setMonthly(m.value);
        if (g.status === 'fulfilled') setGenres(g.value);
        setLoading(false);
        setChartKey(k => k + 1);
      });
    }, [userId])
  );

  // Re-animate and clear selection when period changes
  useEffect(() => {
    setChartKey(k => k + 1);
    setSelectedBarIndex(null);
  }, [period]);

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  // Pages chart data
  const weekBarData = weekHistory.map((d, i) => ({
    value: d.pages,
    label: DAY_LABELS[new Date(d.date + 'T00:00:00Z').getUTCDay()],
    frontColor: i === selectedBarIndex ? BAR_COLOR_SELECTED : BAR_COLOR,
  }));

  const monthBarData = monthHistory.map((d, i) => ({
    value: d.pages,
    label: '',
    frontColor: i === selectedBarIndex ? BAR_COLOR_SELECTED : BAR_COLOR,
  }));

  const monthDateRange = monthHistory.length > 0
    ? `${monthHistory[0].date.slice(5).replace('-', '/')} – ${monthHistory[monthHistory.length - 1].date.slice(5).replace('-', '/')}`
    : '';

  const activeBarData = period === 'week' ? weekBarData : monthBarData;
  const activeHistory = period === 'week' ? weekHistory : monthHistory;
  const hasPageData = activeHistory.some(d => d.pages > 0);
  const maxPages = Math.max(...activeBarData.map(d => d.value), 1);
  const weekBarWidth = Math.floor((CHART_WIDTH - 40) / 7 * 0.55);
  const weekSpacing = Math.floor((CHART_WIDTH - 40) / 7 * 0.45);
  const monthBarWidth = Math.max(4, Math.floor((CHART_WIDTH - 40) / 30 * 0.55));
  const monthSpacing = Math.max(2, Math.floor((CHART_WIDTH - 40) / 30 * 0.45));
  const barWidth = period === 'week' ? weekBarWidth : monthBarWidth;
  const barSpacing = period === 'week' ? weekSpacing : monthSpacing;

  // Monthly books bar chart
  const booksBarData = monthly.map(m => ({
    value: m.count,
    label: m.month,
    frontColor: Colors.primary,
  }));
  const hasBarData = monthly.some(m => m.count > 0);

  // Genre pie chart
  const topGenres = genres.slice(0, 6);
  const pieData = topGenres.map((g, i) => ({
    value: g.count,
    color: PIE_COLORS[i],
  }));
  const hasPieData = topGenres.length > 0;

  const goalPct = yearlyGoal.goal > 0
    ? Math.min(1, yearlyGoal.booksRead / yearlyGoal.goal)
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Stats</Text>

        {/* Streak + pace */}
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

        {/* Pages chart with week/month toggle */}
        <View style={styles.card}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>
              Pages {period === 'week' ? 'This Week' : 'This Month'}
            </Text>
            <View style={styles.toggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, period === 'week' && styles.toggleBtnActive]}
                onPress={() => setPeriod('week')}
              >
                <Text style={[styles.toggleText, period === 'week' && styles.toggleTextActive]}>
                  Week
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, period === 'month' && styles.toggleBtnActive]}
                onPress={() => setPeriod('month')}
              >
                <Text style={[styles.toggleText, period === 'month' && styles.toggleTextActive]}>
                  Month
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {!hasPageData ? (
            <Text style={styles.emptyText}>Start a reading session to see your pages</Text>
          ) : (
            <>
              {(() => {
                const entry = selectedBarIndex !== null
                  ? (period === 'week' ? weekHistory : monthHistory)[selectedBarIndex]
                  : null;
                return (
                  <View style={styles.tooltipRow}>
                    {entry ? (
                      <View style={styles.tooltip}>
                        <Text style={styles.tooltipDate}>{formatTooltipDate(entry.date)}</Text>
                        <View style={styles.tooltipDivider} />
                        <Text style={styles.tooltipPages}>{entry.pages} pages</Text>
                      </View>
                    ) : (
                      <Text style={styles.tooltipHint}>Tap a bar for details</Text>
                    )}
                  </View>
                );
              })()}
              <BarChart
                key={`pages-${chartKey}`}
                data={activeBarData}
                width={CHART_WIDTH}
                height={200}
                barWidth={barWidth}
                spacing={barSpacing}
                roundedTop
                isAnimated
                animationDuration={700}
                noOfSections={4}
                maxValue={Math.ceil(maxPages / 4) * 4 + 4}
                rulesType="dashed"
                rulesColor={Colors.border}
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={styles.axisLabel}
                xAxisLabelTextStyle={styles.axisLabel}
                hideRules={false}
                disableScroll
                onPress={(_item: any, index: number) =>
                  setSelectedBarIndex(prev => (prev === index ? null : index))
                }
              />
              {period === 'month' && (
                <Text style={styles.dateRange}>{monthDateRange}</Text>
              )}
            </>
          )}
        </View>

        {/* Books finished per month */}
        <View style={styles.card}>
          <Text style={styles.chartTitle}>Books Finished This Year</Text>
          {!hasBarData ? (
            <Text style={styles.emptyText}>No books finished yet this year</Text>
          ) : (
            <BarChart
              key={`books-${chartKey}`}
              data={booksBarData}
              width={CHART_WIDTH}
              height={160}
              barWidth={18}
              spacing={Math.floor((CHART_WIDTH - 40) / 12 - 18)}
              roundedTop
              isAnimated
              animationDuration={700}
              noOfSections={3}
              rulesType="dashed"
              rulesColor={Colors.border}
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={styles.axisLabel}
              xAxisLabelTextStyle={styles.axisLabel}
              disableScroll
            />
          )}
        </View>

        {/* Genre breakdown */}
        <View style={styles.card}>
          <Text style={styles.chartTitle}>Genres</Text>
          {!hasPieData ? (
            <Text style={styles.emptyText}>Finish books to see your genre breakdown</Text>
          ) : (
            <View style={styles.pieRow}>
              <PieChart
                key={`pie-${chartKey}`}
                data={pieData}
                donut
                radius={80}
                innerRadius={52}
                isAnimated
                animationDuration={700}
              />
              <View style={styles.legend}>
                {topGenres.map((g, i) => (
                  <View key={g.genre} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: PIE_COLORS[i] }]} />
                    <Text style={styles.legendText} numberOfLines={1}>
                      {g.genre}
                      <Text style={styles.legendCount}> {g.count}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xl },
  title: { fontSize: 32, fontFamily: Fonts.bold, color: Colors.primary },

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
  statValue: { fontSize: 22, fontFamily: Fonts.bold, color: Colors.textPrimary },
  statLabel: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.card,
  },
  cardTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 8 },
  goalText: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: 8 },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.progressTrack,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: Colors.primary, borderRadius: 4 },

  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  chartTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radius.xl,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.xl,
  },
  toggleBtnActive: {
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  toggleText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  toggleTextActive: { color: Colors.primary, fontFamily: Fonts.semiBold },

  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  axisLabel: { color: Colors.textTertiary, fontSize: 10, fontFamily: Fonts.regular },
  dateRange: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textTertiary, textAlign: 'center', marginTop: 4 },
  tooltipRow: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
    minHeight: 28,
  },
  tooltip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FA',
    borderRadius: Radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
  },
  tooltipDate: { color: Colors.primary, fontSize: 13, fontFamily: Fonts.semiBold },
  tooltipDivider: { width: 1, height: 12, backgroundColor: '#C4BCF0' },
  tooltipPages: { color: Colors.textPrimary, fontSize: 13, fontFamily: Fonts.bold },
  tooltipHint: { color: Colors.textTertiary, fontSize: 12, fontFamily: Fonts.regular },
  barTopLabel: { fontSize: 9, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: 2 },

  pieRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  legendText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, flex: 1 },
  legendCount: { fontFamily: Fonts.bold, color: Colors.textPrimary },
});
