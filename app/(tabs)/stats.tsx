import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
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
  getYearlyReadingStats,
  getReadingByDayOfWeek,
  getRatingStats,
  getReadingCalendar,
  type DailyReading,
  type MonthlyBooks,
  type GenreCount,
  type YearlyGoalProgress,
  type YearlyReadingStats,
  type RatingStats,
  type CalendarDay,
} from '@/lib/stats';
import { useTheme } from '@/lib/theme';
import { Fonts, Spacing, Radius, Shadow } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 2 * Spacing.lg - 2 * Spacing.md;
const CELL_SIZE = Math.floor(CHART_WIDTH / 7);
const PIE_COLORS = ['#7C6FCD', '#A599E9', '#5B4FB0', '#C4BCF0', '#3D3580', '#E8E4FA'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTooltipDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

type Period = 'week' | 'month';

export default function StatsScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('week');
  const [chartKey, setChartKey] = useState(0);
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
  const [selectedDowIndex, setSelectedDowIndex] = useState<number | null>(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);
  const [selectedRatingIndex, setSelectedRatingIndex] = useState<number | null>(null);
  const [selectedGenreIndex, setSelectedGenreIndex] = useState<number | null>(null);

  const now = new Date();
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth() + 1);
  const [calendarYear] = useState(now.getFullYear());
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const monthScrollRef = useRef<ScrollView>(null);

  const [streak, setStreak] = useState(0);
  const [pace, setPace] = useState(0);
  const [yearlyGoal, setYearlyGoal] = useState<YearlyGoalProgress>({ booksRead: 0, goal: 0 });
  const [weekHistory, setWeekHistory] = useState<DailyReading[]>([]);
  const [monthHistory, setMonthHistory] = useState<DailyReading[]>([]);
  const [monthly, setMonthly] = useState<MonthlyBooks[]>([]);
  const [genres, setGenres] = useState<GenreCount[]>([]);
  const [yearlyStats, setYearlyStats] = useState<YearlyReadingStats>({ totalPages: 0, totalHours: 0, totalSessions: 0, avgPagesPerSession: 0 });
  const [dayOfWeek, setDayOfWeek] = useState<{ day: string; pages: number }[]>([]);
  const [ratingStats, setRatingStats] = useState<RatingStats>({ average: 0, distribution: [1,2,3,4,5].map(stars => ({ stars, count: 0 })), totalRated: 0 });

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
        getYearlyReadingStats(userId),
        getReadingByDayOfWeek(userId),
        getRatingStats(userId),
      ]).then(([s, p, yg, wh, mh, m, g, ys, dow, rs]) => {
        if (s.status === 'fulfilled') setStreak(s.value);
        if (p.status === 'fulfilled') setPace(p.value);
        if (yg.status === 'fulfilled') setYearlyGoal(yg.value);
        if (wh.status === 'fulfilled') setWeekHistory(wh.value);
        if (mh.status === 'fulfilled') setMonthHistory(mh.value);
        if (m.status === 'fulfilled') setMonthly(m.value);
        if (g.status === 'fulfilled') setGenres(g.value);
        if (ys.status === 'fulfilled') setYearlyStats(ys.value);
        if (dow.status === 'fulfilled') setDayOfWeek(dow.value);
        if (rs.status === 'fulfilled') setRatingStats(rs.value);
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

  // Reload calendar when month changes
  useEffect(() => {
    if (!userId) return;
    getReadingCalendar(userId, calendarYear, calendarMonth)
      .then(setCalendarData)
      .catch(() => setCalendarData([]));
  }, [userId, calendarYear, calendarMonth]);

  const calendarCells = useMemo(() => {
    const firstDow = new Date(calendarYear, calendarMonth - 1, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
    const daysInPrev  = new Date(calendarYear, calendarMonth - 1, 0).getDate();
    const totalCells  = Math.ceil((firstDow + daysInMonth) / 7) * 7;
    const readMap = new Map(calendarData.map(d => [d.date, d]));
    const todayStr = new Date().toISOString().slice(0, 10);

    return Array.from({ length: totalCells }, (_, i) => {
      if (i < firstDow) {
        return { day: daysInPrev - firstDow + 1 + i, current: false, date: '', reading: null, isToday: false };
      } else if (i < firstDow + daysInMonth) {
        const day = i - firstDow + 1;
        const date = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { day, current: true, date, reading: readMap.get(date) ?? null, isToday: date === todayStr };
      } else {
        return { day: i - firstDow - daysInMonth + 1, current: false, date: '', reading: null, isToday: false };
      }
    });
  }, [calendarYear, calendarMonth, calendarData]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xl },
    title: { fontSize: 32, fontFamily: Fonts.bold, color: colors.primary },

    row: { flexDirection: 'row', gap: Spacing.sm },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      alignItems: 'center',
      gap: 6,
      ...Shadow.card,
    },
    statValue: { fontSize: 22, fontFamily: Fonts.bold, color: colors.textPrimary },
    statLabel: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textSecondary },

    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      ...Shadow.card,
    },
    cardTitle: { fontSize: 15, fontFamily: Fonts.bold, color: colors.textPrimary, marginBottom: 8 },
    goalText: { fontSize: 14, fontFamily: Fonts.regular, color: colors.textSecondary, marginBottom: 8 },
    progressTrack: {
      height: 8,
      backgroundColor: colors.progressTrack,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },

    chartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    chartTitle: {
      fontSize: 16,
      fontFamily: Fonts.bold,
      color: colors.textPrimary,
    },
    chartSubtitle: {
      fontSize: 12,
      fontFamily: Fonts.regular,
      color: colors.textTertiary,
      marginBottom: Spacing.sm,
    },
    toggle: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: Radius.xl,
      padding: 2,
    },
    toggleBtn: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: Radius.xl,
    },
    toggleBtnActive: {
      backgroundColor: colors.surface,
      ...Shadow.card,
    },
    toggleText: { fontSize: 12, fontFamily: Fonts.semiBold, color: colors.textSecondary },
    toggleTextActive: { color: colors.primary, fontFamily: Fonts.semiBold },

    emptyText: {
      fontSize: 14,
      fontFamily: Fonts.regular,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 16,
    },
    axisLabel: { color: colors.textTertiary, fontSize: 10, fontFamily: Fonts.regular },
    dateRange: { fontSize: 11, fontFamily: Fonts.regular, color: colors.textTertiary, textAlign: 'center', marginTop: 4 },
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
    tooltipDate: { color: colors.primary, fontSize: 13, fontFamily: Fonts.semiBold },
    tooltipDivider: { width: 1, height: 12, backgroundColor: '#C4BCF0' },
    tooltipPages: { color: colors.textPrimary, fontSize: 13, fontFamily: Fonts.bold },
    tooltipHint: { color: colors.textTertiary, fontSize: 12, fontFamily: Fonts.regular },
    barTopLabel: { fontSize: 9, fontFamily: Fonts.regular, color: colors.textSecondary, marginBottom: 2 },

    ratingAvgRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: Spacing.sm },
    ratingAvgStar: { fontSize: 22, color: colors.orange, fontFamily: Fonts.bold },
    ratingAvgValue: { fontSize: 28, fontFamily: Fonts.bold, color: colors.textPrimary },
    ratingAvgSub: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSecondary },

    // Calendar
    calMonthStrip: { marginBottom: Spacing.md },
    calMonthStripContent: { gap: 8, paddingHorizontal: 2 },
    calMonthBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: Radius.xl,
      backgroundColor: colors.background,
    },
    calMonthBtnActive: { backgroundColor: colors.primary },
    calMonthText: { fontSize: 14, fontFamily: Fonts.semiBold, color: colors.textSecondary },
    calMonthTextActive: { color: colors.surface },
    calDayHeaders: { flexDirection: 'row', marginBottom: 4 },
    calDayHeader: { width: CELL_SIZE, textAlign: 'center', fontSize: 11, fontFamily: Fonts.semiBold, color: colors.textTertiary },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCell: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      borderRadius: Radius.sm,
      backgroundColor: colors.border,
      overflow: 'hidden',
      marginBottom: 2,
    },
    calCellOther: { backgroundColor: 'transparent' },
    calCellActive: { backgroundColor: colors.primary },
    calCellToday: { borderWidth: 2, borderColor: colors.primary },
    calCover: { ...StyleSheet.absoluteFillObject as any },
    calDayNum: {
      position: 'absolute',
      top: 3,
      left: 5,
      fontSize: 10,
      fontFamily: Fonts.semiBold,
      color: colors.textPrimary,
      zIndex: 1,
    },
    calDayNumActive: { color: '#FFFFFF' },
    calDayNumOther: { color: colors.textTertiary },
    calLegend: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.md },
    calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    calLegendDot: { width: 14, height: 14, borderRadius: 4 },
    calLegendText: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textSecondary },

    pieRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    legend: { flex: 1, gap: 8 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
    legendText: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSecondary, flex: 1 },
    legendCount: { fontFamily: Fonts.bold, color: colors.textPrimary },
  }), [colors]);

  if (!session) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Pages chart data
  const weekBarData = weekHistory.map((d, i) => ({
    value: d.pages,
    label: DAY_LABELS[new Date(d.date + 'T00:00:00Z').getUTCDay()],
    frontColor: selectedBarIndex !== null && i !== selectedBarIndex ? colors.primary + '55' : colors.primary,
  }));

  const monthBarData = monthHistory.map((d, i) => ({
    value: d.pages,
    label: '',
    frontColor: selectedBarIndex !== null && i !== selectedBarIndex ? colors.primary + '55' : colors.primary,
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
  const booksBarData = monthly.map((m, i) => ({
    value: m.count,
    label: m.month,
    frontColor: selectedMonthIndex !== null && i !== selectedMonthIndex ? colors.primary + '55' : colors.primary,
  }));
  const hasBarData = monthly.some(m => m.count > 0);

  // Day of week chart
  const dowBarData = dayOfWeek.map((d, i) => ({
    value: d.pages,
    label: d.day,
    frontColor: selectedDowIndex !== null && i !== selectedDowIndex ? colors.primary + '55' : colors.primary,
  }));
  const hasDowData = dayOfWeek.some(d => d.pages > 0);

  // Rating bar chart
  const ratingBarData = ratingStats.distribution.map(({ stars, count }, i) => ({
    value: count,
    label: `${stars}★`,
    frontColor: selectedRatingIndex !== null && i !== selectedRatingIndex ? colors.primary + '55' : colors.primary,
  }));
  const hasRatingData = ratingStats.totalRated > 0;
  const ratingBarWidth = Math.floor((CHART_WIDTH - 40) / 5 * 0.5);
  const ratingBarSpacing = Math.floor((CHART_WIDTH - 40) / 5 * 0.5);

  // Genre pie chart
  const topGenres = genres.slice(0, 6);
  const pieData = topGenres.map((g, i) => ({
    value: g.count,
    color: PIE_COLORS[i],
    focused: i === selectedGenreIndex,
    onPress: () => setSelectedGenreIndex(prev => prev === i ? null : i),
  }));
  const hasPieData = topGenres.length > 0;

  const goalPct = yearlyGoal.goal > 0
    ? Math.min(1, yearlyGoal.booksRead / yearlyGoal.goal)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Stats</Text>

        {/* Streak + pace */}
        <View style={styles.row}>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={20} color={colors.orange} />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="book-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{pace}</Text>
            <Text style={styles.statLabel}>Pages/day avg</Text>
          </View>
        </View>

        {/* This year summary */}
        <View style={styles.row}>
          <View style={styles.statCard}>
            <Ionicons name="documents-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{yearlyStats.totalPages.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Pages this year</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{yearlyStats.totalHours}h</Text>
            <Text style={styles.statLabel}>Hours read</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.statCard}>
            <Ionicons name="layers-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{yearlyStats.totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trending-up-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{yearlyStats.avgPagesPerSession}</Text>
            <Text style={styles.statLabel}>Avg pages/session</Text>
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

        {/* Reading calendar */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reading Calendar</Text>

          {/* Month selector */}
          <ScrollView
            ref={monthScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.calMonthStrip}
            contentContainerStyle={styles.calMonthStripContent}
          >
            {MONTH_NAMES.map((name, i) => {
              const m = i + 1;
              const active = m === calendarMonth;
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.calMonthBtn, active && styles.calMonthBtnActive]}
                  onPress={() => setCalendarMonth(m)}
                >
                  <Text style={[styles.calMonthText, active && styles.calMonthTextActive]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Day-of-week headers */}
          <View style={styles.calDayHeaders}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <Text key={i} style={styles.calDayHeader}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.calGrid}>
            {calendarCells.map((cell, i) => (
              <View
                key={i}
                style={[
                  styles.calCell,
                  !cell.current && styles.calCellOther,
                  cell.current && cell.reading && styles.calCellActive,
                  cell.isToday && !cell.reading && styles.calCellToday,
                ]}
              >
                {cell.reading?.coverUrl ? (
                  <Image
                    source={{ uri: cell.reading.coverUrl }}
                    style={styles.calCover}
                    resizeMode="cover"
                  />
                ) : null}
                {cell.current ? (
                  <Text style={[
                    styles.calDayNum,
                    cell.reading && styles.calDayNumActive,
                  ]}>
                    {cell.day}
                  </Text>
                ) : (
                  <Text style={[styles.calDayNum, styles.calDayNumOther]}>{cell.day}</Text>
                )}
              </View>
            ))}
          </View>

          {/* Legend */}
          <View style={styles.calLegend}>
            <View style={styles.calLegendItem}>
              <View style={[styles.calLegendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.calLegendText}>Days read</Text>
            </View>
            <View style={styles.calLegendItem}>
              <View style={[styles.calLegendDot, { backgroundColor: colors.border }]} />
              <Text style={styles.calLegendText}>No reading</Text>
            </View>
          </View>
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
              <View style={{ overflow: 'hidden', width: CHART_WIDTH }}>
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
                  rulesType="solid"
                  rulesColor={colors.border}
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
              </View>
              {period === 'month' && (
                <Text style={styles.dateRange}>{monthDateRange}</Text>
              )}
            </>
          )}
        </View>

        {/* Reading by day of week */}
        <View style={styles.card}>
          <Text style={styles.chartTitle}>Reading by Day of Week</Text>
          <Text style={styles.chartSubtitle}>Avg pages per session</Text>
          {!hasDowData ? (
            <Text style={styles.emptyText}>Log sessions to see your reading patterns</Text>
          ) : (
            <>
              <View style={styles.tooltipRow}>
                {selectedDowIndex !== null ? (
                  <View style={styles.tooltip}>
                    <Text style={styles.tooltipDate}>{dayOfWeek[selectedDowIndex].day}</Text>
                    <View style={styles.tooltipDivider} />
                    <Text style={styles.tooltipPages}>{dayOfWeek[selectedDowIndex].pages} avg pages</Text>
                  </View>
                ) : (
                  <Text style={styles.tooltipHint}>Tap a bar for details</Text>
                )}
              </View>
              <View style={{ overflow: 'hidden', width: CHART_WIDTH }}>
                <BarChart
                  key={`dow-${chartKey}`}
                  data={dowBarData}
                  width={CHART_WIDTH}
                  height={160}
                  barWidth={weekBarWidth}
                  spacing={weekSpacing}
                  roundedTop
                  isAnimated
                  animationDuration={700}
                  noOfSections={3}
                  rulesType="solid"
                  rulesColor={colors.border}
                  xAxisThickness={0}
                  yAxisThickness={0}
                  yAxisTextStyle={styles.axisLabel}
                  xAxisLabelTextStyle={styles.axisLabel}
                  disableScroll
                  onPress={(_item: any, index: number) =>
                    setSelectedDowIndex(prev => prev === index ? null : index)
                  }
                />
              </View>
            </>
          )}
        </View>

        {/* Books finished per month */}
        <View style={styles.card}>
          <Text style={styles.chartTitle}>Books Finished This Year</Text>
          {!hasBarData ? (
            <Text style={styles.emptyText}>No books finished yet this year</Text>
          ) : (
            <>
              <View style={styles.tooltipRow}>
                {selectedMonthIndex !== null ? (
                  <View style={styles.tooltip}>
                    <Text style={styles.tooltipDate}>{monthly[selectedMonthIndex].month}</Text>
                    <View style={styles.tooltipDivider} />
                    <Text style={styles.tooltipPages}>
                      {monthly[selectedMonthIndex].count} {monthly[selectedMonthIndex].count === 1 ? 'book' : 'books'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.tooltipHint}>Tap a bar for details</Text>
                )}
              </View>
              <View style={{ overflow: 'hidden', width: CHART_WIDTH }}>
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
                  rulesType="solid"
                  rulesColor={colors.border}
                  xAxisThickness={0}
                  yAxisThickness={0}
                  yAxisTextStyle={styles.axisLabel}
                  xAxisLabelTextStyle={styles.axisLabel}
                  disableScroll
                  onPress={(_item: any, index: number) =>
                    setSelectedMonthIndex(prev => prev === index ? null : index)
                  }
                />
              </View>
            </>
          )}
        </View>

        {/* Rating distribution */}
        <View style={styles.card}>
          <Text style={styles.chartTitle}>My Ratings</Text>
          {!hasRatingData ? (
            <Text style={styles.emptyText}>Rate books to see your distribution</Text>
          ) : (
            <>
              <View style={styles.ratingAvgRow}>
                <Text style={styles.ratingAvgStar}>★</Text>
                <Text style={styles.ratingAvgValue}>{ratingStats.average}</Text>
                <Text style={styles.ratingAvgSub}>avg · {ratingStats.totalRated} {ratingStats.totalRated === 1 ? 'book' : 'books'} rated</Text>
              </View>
              <View style={styles.tooltipRow}>
                {selectedRatingIndex !== null ? (
                  <View style={styles.tooltip}>
                    <Text style={styles.tooltipDate}>
                      {'★'.repeat(ratingStats.distribution[selectedRatingIndex].stars)} {ratingStats.distribution[selectedRatingIndex].stars} star
                    </Text>
                    <View style={styles.tooltipDivider} />
                    <Text style={styles.tooltipPages}>
                      {ratingStats.distribution[selectedRatingIndex].count} {ratingStats.distribution[selectedRatingIndex].count === 1 ? 'book' : 'books'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.tooltipHint}>Tap a bar for details</Text>
                )}
              </View>
              <View style={{ overflow: 'hidden', width: CHART_WIDTH }}>
                <BarChart
                  key={`rating-${chartKey}`}
                  data={ratingBarData}
                  width={CHART_WIDTH}
                  height={160}
                  barWidth={ratingBarWidth}
                  spacing={ratingBarSpacing}
                  roundedTop
                  isAnimated
                  animationDuration={700}
                  noOfSections={3}
                  rulesType="solid"
                  rulesColor={colors.border}
                  xAxisThickness={0}
                  yAxisThickness={0}
                  yAxisTextStyle={styles.axisLabel}
                  xAxisLabelTextStyle={styles.axisLabel}
                  disableScroll
                  onPress={(_item: any, index: number) =>
                    setSelectedRatingIndex(prev => prev === index ? null : index)
                  }
                />
              </View>
            </>
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
                focusOnPress
                centerLabelComponent={() => {
                  if (selectedGenreIndex === null) return (
                    <Text style={{ fontSize: 10, color: colors.textTertiary, textAlign: 'center', fontFamily: Fonts.regular }}>
                      {'tap to\nexplore'}
                    </Text>
                  );
                  const g = topGenres[selectedGenreIndex];
                  return (
                    <View style={{ alignItems: 'center', paddingHorizontal: 6 }}>
                      <Text style={{ fontSize: 20, fontFamily: Fonts.bold, color: PIE_COLORS[selectedGenreIndex] }}>
                        {g.count}
                      </Text>
                      <Text style={{ fontSize: 9, fontFamily: Fonts.regular, color: colors.textSecondary, textAlign: 'center' }} numberOfLines={2}>
                        {g.genre}
                      </Text>
                    </View>
                  );
                }}
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
