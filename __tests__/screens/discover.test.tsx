import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import DiscoverScreen from '@/app/(tabs)/discover';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

jest.mock('@/lib/discover', () => ({
  getTrending: jest.fn().mockResolvedValue([]),
  getRecommended: jest.fn().mockResolvedValue({ books: [], personalized: false }),
}));

jest.mock('@/lib/books', () => ({
  upsertBook: jest.fn().mockResolvedValue('book-uuid'),
}));

import { getTrending, getRecommended } from '@/lib/discover';
import { upsertBook } from '@/lib/books';

const fakeBook = {
  hardcover_id: '1',
  title: 'Dune',
  author: 'Frank Herbert',
  cover_url: null,
  page_count: 412,
  genres: ['Sci-Fi'],
  description: null,
  rating: 4.7,
  users_read_count: 200000,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPush.mockClear();
  (getTrending as jest.Mock).mockResolvedValue([]);
  (getRecommended as jest.Mock).mockResolvedValue({ books: [], personalized: false });
  (upsertBook as jest.Mock).mockResolvedValue('book-uuid');
});

describe('DiscoverScreen — Trending tab', () => {
  it('renders Trending and For You tab buttons', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('tab-trending')).toBeTruthy();
      expect(screen.getByTestId('tab-for-you')).toBeTruthy();
    });
  });

  it('renders period pills', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('period-pill-all_time')).toBeTruthy();
      expect(screen.getByTestId('period-pill-last_month')).toBeTruthy();
      expect(screen.getByTestId('period-pill-3_months')).toBeTruthy();
      expect(screen.getByTestId('period-pill-1_year')).toBeTruthy();
    });
  });

  it('calls getTrending with all_time on mount', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => {
      expect(getTrending).toHaveBeenCalledWith('all_time');
    });
  });

  it('renders book cards from trending results', async () => {
    (getTrending as jest.Mock).mockResolvedValue([fakeBook]);
    render(<DiscoverScreen />);
    await waitFor(() => {
      expect(screen.getByText('Dune')).toBeTruthy();
      expect(screen.getByText('Frank Herbert')).toBeTruthy();
    });
  });

  it('tapping a period pill calls getTrending with that period', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => screen.getByTestId('period-pill-last_month'));
    fireEvent.press(screen.getByTestId('period-pill-last_month'));
    await waitFor(() => {
      expect(getTrending).toHaveBeenCalledWith('last_month');
    });
  });

  it('tapping a book card upserts the book and navigates to its detail page', async () => {
    (getTrending as jest.Mock).mockResolvedValue([fakeBook]);
    render(<DiscoverScreen />);
    await waitFor(() => screen.getByTestId('book-card-1'));
    fireEvent.press(screen.getByTestId('book-card-1'));
    await waitFor(() => {
      expect(upsertBook).toHaveBeenCalledWith(fakeBook);
      expect(mockPush).toHaveBeenCalledWith('/book/book-uuid');
    });
  });
});

describe('DiscoverScreen — For You tab', () => {
  it('shows empty state when not personalized', async () => {
    (getRecommended as jest.Mock).mockResolvedValue({ books: [], personalized: false });
    render(<DiscoverScreen />);
    await waitFor(() => screen.getByTestId('tab-for-you'));
    fireEvent.press(screen.getByTestId('tab-for-you'));
    await waitFor(() => {
      expect(
        screen.getByText("Add some books to your library and we'll find recommendations for you.")
      ).toBeTruthy();
    });
  });

  it('shows recommendation cards when personalized', async () => {
    (getRecommended as jest.Mock).mockResolvedValue({ books: [fakeBook], personalized: true });
    render(<DiscoverScreen />);
    await waitFor(() => screen.getByTestId('tab-for-you'));
    fireEvent.press(screen.getByTestId('tab-for-you'));
    await waitFor(() => {
      expect(screen.getByText('Dune')).toBeTruthy();
    });
  });

  it('does not show period pills in For You mode', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => screen.getByTestId('tab-for-you'));
    fireEvent.press(screen.getByTestId('tab-for-you'));
    await waitFor(() => {
      expect(screen.queryByTestId('period-pill-all_time')).toBeNull();
    });
  });
});
