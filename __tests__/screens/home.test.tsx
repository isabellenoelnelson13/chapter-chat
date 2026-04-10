import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from '@/app/(tabs)/index';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({
    session: { user: { id: 'user-1' } },
    loading: false,
  })),
}));

const mockCurrentBook = {
  id: 'ub-1',
  user_id: 'user-1',
  book_id: 'book-1',
  shelf: 'reading',
  current_page: 50,
  rating: null,
  review: null,
  added_at: '2026-04-01T00:00:00Z',
  finished_at: null,
  book: {
    id: 'book-1',
    title: 'The Hobbit',
    author: 'J.R.R. Tolkien',
    cover_url: null,
    page_count: 310,
  },
};

jest.mock('@/lib/userBooks', () => ({
  getCurrentBook: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/stats', () => ({
  getTodayStats: jest.fn().mockResolvedValue({ pagesRead: 0, timeSeconds: 0, streak: 0 }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { getCurrentBook } from '@/lib/userBooks';
import { getTodayStats } from '@/lib/stats';

beforeEach(() => {
  jest.clearAllMocks();
  (getCurrentBook as jest.Mock).mockResolvedValue(null);
  (getTodayStats as jest.Mock).mockResolvedValue({ pagesRead: 0, timeSeconds: 0, streak: 0 });
});

describe('HomeScreen', () => {
  it('shows empty state when no book is being read', async () => {
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getByText('Start a book')).toBeTruthy();
    });
  });

  it('shows current book title and author when reading', async () => {
    (getCurrentBook as jest.Mock).mockResolvedValue(mockCurrentBook);
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getByText('The Hobbit')).toBeTruthy();
      expect(screen.getByText('J.R.R. Tolkien')).toBeTruthy();
    });
  });

  it('shows today stats', async () => {
    (getTodayStats as jest.Mock).mockResolvedValue({ pagesRead: 42, timeSeconds: 3600, streak: 5 });
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeTruthy();  // pages
      expect(screen.getByText('1h 0m')).toBeTruthy(); // time
      expect(screen.getByText('5')).toBeTruthy(); // streak
    });
  });

  it('navigates to session screen on book card tap', async () => {
    (getCurrentBook as jest.Mock).mockResolvedValue(mockCurrentBook);
    render(<HomeScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    fireEvent.press(screen.getByText('Start Reading'));
    expect(mockPush).toHaveBeenCalledWith('/session/book-1');
  });

  it('navigates to search when no book and tapping Start a book', async () => {
    render(<HomeScreen />);
    await waitFor(() => screen.getByText('Start a book'));
    fireEvent.press(screen.getByText('Start a book'));
    expect(mockPush).toHaveBeenCalledWith('/search');
  });
});
