import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import StatsScreen from '@/app/(tabs)/stats';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const EMPTY_MONTHLY = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  .map(month => ({ month, count: 0 }));

jest.mock('@/lib/stats', () => ({
  getStreak: jest.fn().mockResolvedValue(3),
  getWeeklyPace: jest.fn().mockResolvedValue(15),
  getYearlyGoalProgress: jest.fn().mockResolvedValue({ booksRead: 4, goal: 12 }),
  getReadingHistory: jest.fn().mockResolvedValue([]),
  getMonthlyBooks: jest.fn().mockResolvedValue(
    ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      .map(month => ({ month, count: 0 }))
  ),
  getGenreBreakdown: jest.fn().mockResolvedValue([]),
}));

import { getYearlyGoalProgress, getMonthlyBooks, getGenreBreakdown, getReadingHistory } from '@/lib/stats';

beforeEach(() => {
  jest.clearAllMocks();
  (getYearlyGoalProgress as jest.Mock).mockResolvedValue({ booksRead: 4, goal: 12 });
  (getMonthlyBooks as jest.Mock).mockResolvedValue(EMPTY_MONTHLY);
  (getGenreBreakdown as jest.Mock).mockResolvedValue([]);
  (getReadingHistory as jest.Mock).mockResolvedValue([]);
});

describe('StatsScreen', () => {
  it('renders section titles after loading', async () => {
    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Last 30 Days')).toBeTruthy();
      expect(screen.getByText('Books Finished')).toBeTruthy();
      expect(screen.getByText('Genres')).toBeTruthy();
    });
  });

  it('shows yearly goal progress when goal > 0', async () => {
    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/4 of 12 books/)).toBeTruthy();
    });
  });

  it('shows set goal prompt when goal is 0', async () => {
    (getYearlyGoalProgress as jest.Mock).mockResolvedValue({ booksRead: 0, goal: 0 });
    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Set a goal in your Profile')).toBeTruthy();
    });
  });

  it('shows no books finished empty state', async () => {
    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText('No books finished yet this year')).toBeTruthy();
    });
  });

  it('shows genre empty state when no genres', async () => {
    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Finish books to see your genre breakdown')).toBeTruthy();
    });
  });

  it('renders chart placeholders when data is present', async () => {
    (getGenreBreakdown as jest.Mock).mockResolvedValue([
      { genre: 'Fantasy', count: 3 },
    ]);
    (getMonthlyBooks as jest.Mock).mockResolvedValue(
      EMPTY_MONTHLY.map((m, i) => i === 0 ? { ...m, count: 2 } : m)
    );
    const today = new Date().toISOString().slice(0, 10);
    (getReadingHistory as jest.Mock).mockResolvedValue([{ date: today, pages: 10 }]);
    render(<StatsScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeTruthy();
      expect(screen.getByTestId('bar-chart')).toBeTruthy();
      expect(screen.getByTestId('pie-chart')).toBeTruthy();
    });
  });
});
