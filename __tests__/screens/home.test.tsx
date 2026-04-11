import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from '@/app/(tabs)/index';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({
    session: { user: { id: 'user-1' } },
    loading: false,
  })),
}));

const mockBook1 = {
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
    description: null,
  },
};

const mockBook2 = {
  id: 'ub-2',
  user_id: 'user-1',
  book_id: 'book-2',
  shelf: 'reading',
  current_page: 20,
  rating: null,
  review: null,
  added_at: '2026-04-02T00:00:00Z',
  finished_at: null,
  book: {
    id: 'book-2',
    title: 'Dune',
    author: 'Frank Herbert',
    cover_url: null,
    page_count: 412,
    description: null,
  },
};

jest.mock('@/lib/userBooks', () => ({
  getShelf: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/stats', () => ({
  getTodayStats: jest.fn().mockResolvedValue({ pagesRead: 0, timeSeconds: 0, streak: 0 }),
  estimateDaysRemaining: jest.fn().mockReturnValue(null),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { getShelf } from '@/lib/userBooks';
import { getTodayStats } from '@/lib/stats';

beforeEach(() => {
  jest.clearAllMocks();
  (getShelf as jest.Mock).mockResolvedValue([]);
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
    (getShelf as jest.Mock).mockResolvedValue([mockBook1]);
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
      expect(screen.getByText('42')).toBeTruthy();
      expect(screen.getByText('1h 0m')).toBeTruthy();
      expect(screen.getByText('5')).toBeTruthy();
    });
  });

  it('navigates to session screen on book card tap', async () => {
    (getShelf as jest.Mock).mockResolvedValue([mockBook1]);
    render(<HomeScreen />);
    await waitFor(() => screen.getByText('Start Reading Session'));
    fireEvent.press(screen.getByText('Start Reading Session'));
    expect(mockPush).toHaveBeenCalledWith('/session/book-1');
  });

  it('navigates to search when no book and tapping Start a book', async () => {
    render(<HomeScreen />);
    await waitFor(() => screen.getByText('Start a book'));
    fireEvent.press(screen.getByText('Start a book'));
    expect(mockPush).toHaveBeenCalledWith('/search');
  });

  it('renders both book titles when there are multiple reading books', async () => {
    (getShelf as jest.Mock).mockResolvedValue([mockBook1, mockBook2]);
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getByText('The Hobbit')).toBeTruthy();
      expect(screen.getByText('Dune')).toBeTruthy();
    });
  });

  it('renders dot indicators when there are multiple reading books', async () => {
    (getShelf as jest.Mock).mockResolvedValue([mockBook1, mockBook2]);
    render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('carousel-dots')).toBeTruthy();
    });
  });

  it('does not render dot indicators for a single book', async () => {
    (getShelf as jest.Mock).mockResolvedValue([mockBook1]);
    render(<HomeScreen />);
    await waitFor(() => screen.getByText('The Hobbit'));
    expect(screen.queryByTestId('carousel-dots')).toBeNull();
  });
});
