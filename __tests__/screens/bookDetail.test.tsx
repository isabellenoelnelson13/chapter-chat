import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';
import BookDetailScreen from '@/app/book/[bookId]';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({
    session: { user: { id: 'user-1' } },
  })),
}));

jest.mock('@/lib/userBooks', () => ({
  getUserBook: jest.fn().mockResolvedValue(null),
  moveShelf: jest.fn().mockResolvedValue(undefined),
  rateBook: jest.fn().mockResolvedValue(undefined),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ bookId: 'book-1' }),
}));

import { getUserBook, moveShelf, rateBook } from '@/lib/userBooks';

const mockReadingBook = {
  id: 'ub-1',
  user_id: 'user-1',
  book_id: 'book-1',
  shelf: 'reading' as const,
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
    description: 'In a hole in the ground there lived a hobbit.',
  },
};

const mockReadBook = {
  ...mockReadingBook,
  id: 'ub-2',
  shelf: 'read' as const,
  rating: 4,
};

beforeEach(() => {
  jest.clearAllMocks();
  (getUserBook as jest.Mock).mockResolvedValue(null);
});

describe('BookDetailScreen', () => {
  it('shows loading spinner then book info', async () => {
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByText('The Hobbit')).toBeTruthy();
      expect(screen.getByText('J.R.R. Tolkien')).toBeTruthy();
    });
  });

  it('shows book not found when getUserBook returns null', async () => {
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByText('Book not found')).toBeTruthy();
    });
  });

  it('shows Start Reading Session button on reading shelf', async () => {
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('start-session-btn')).toBeTruthy();
    });
  });

  it('does not show Start Reading Session on read shelf', async () => {
    (getUserBook as jest.Mock).mockResolvedValue(mockReadBook);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByText('The Hobbit')).toBeTruthy();
    });
    expect(screen.queryByTestId('start-session-btn')).toBeNull();
  });

  it('shows star rating row on read shelf', async () => {
    (getUserBook as jest.Mock).mockResolvedValue(mockReadBook);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('rating-row')).toBeTruthy();
    });
  });

  it('tapping a star calls rateBook', async () => {
    (getUserBook as jest.Mock).mockResolvedValue({ ...mockReadBook, rating: null });
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('star-3'));
    fireEvent.press(screen.getByTestId('star-3'));
    await waitFor(() => {
      expect(rateBook).toHaveBeenCalledWith('ub-2', 3);
    });
  });

  it('tapping Move to shelf calls moveShelf and navigates back', async () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
      (_opts: any, callback: (index: number) => void) => { callback(1); } // 1 = "Reading"
    );
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('move-shelf-btn'));
    fireEvent.press(screen.getByTestId('move-shelf-btn'));
    await waitFor(() => {
      expect(moveShelf).toHaveBeenCalledWith('ub-1', 'reading');
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it('Start Reading Session navigates to session screen', async () => {
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('start-session-btn'));
    fireEvent.press(screen.getByTestId('start-session-btn'));
    expect(mockPush).toHaveBeenCalledWith('/session/book-1');
  });
});
