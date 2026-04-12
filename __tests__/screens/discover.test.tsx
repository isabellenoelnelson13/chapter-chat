import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import DiscoverScreen from '@/app/(tabs)/discover';
import { ActionSheetIOS } from 'react-native';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/lib/discover', () => ({
  getTrending: jest.fn().mockResolvedValue([]),
  getBooksByGenre: jest.fn().mockResolvedValue([]),
  getRecommended: jest.fn().mockResolvedValue({ books: [], personalized: false }),
}));

jest.mock('@/lib/books', () => ({
  upsertBook: jest.fn().mockResolvedValue('book-uuid'),
}));

jest.mock('@/lib/userBooks', () => ({
  addToShelf: jest.fn().mockResolvedValue('ub-uuid'),
}));

jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
  (_opts, cb) => cb(1)
);

import { getTrending, getBooksByGenre, getRecommended } from '@/lib/discover';
import { upsertBook } from '@/lib/books';
import { addToShelf } from '@/lib/userBooks';

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
  (getTrending as jest.Mock).mockResolvedValue([]);
  (getBooksByGenre as jest.Mock).mockResolvedValue([]);
  (getRecommended as jest.Mock).mockResolvedValue({ books: [], personalized: false });
  (upsertBook as jest.Mock).mockResolvedValue('book-uuid');
  (addToShelf as jest.Mock).mockResolvedValue('ub-uuid');
  jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
    (_opts, cb) => cb(1)
  );
});

describe('DiscoverScreen — Trending tab', () => {
  it('renders Trending and For You tab buttons', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('tab-trending')).toBeTruthy();
      expect(screen.getByTestId('tab-for-you')).toBeTruthy();
    });
  });

  it('renders genre pills', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('genre-pill-Fantasy')).toBeTruthy();
      expect(screen.getByTestId('genre-pill-Thriller')).toBeTruthy();
    });
  });

  it('calls getTrending on mount', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => {
      expect(getTrending).toHaveBeenCalled();
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

  it('tapping a genre pill calls getBooksByGenre with that genre', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => screen.getByTestId('genre-pill-Fantasy'));
    fireEvent.press(screen.getByTestId('genre-pill-Fantasy'));
    await waitFor(() => {
      expect(getBooksByGenre).toHaveBeenCalledWith('Fantasy');
    });
  });

  it('tapping active genre pill a second time resets to trending', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => screen.getByTestId('genre-pill-Fantasy'));
    fireEvent.press(screen.getByTestId('genre-pill-Fantasy'));
    await waitFor(() => expect(getBooksByGenre).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByTestId('genre-pill-Fantasy'));
    await waitFor(() => {
      expect(getTrending).toHaveBeenCalledTimes(2);
    });
  });

  it('tapping a book card shows shelf action sheet and calls upsertBook + addToShelf', async () => {
    (getTrending as jest.Mock).mockResolvedValue([fakeBook]);
    render(<DiscoverScreen />);
    await waitFor(() => screen.getByTestId('book-card-1'));
    fireEvent.press(screen.getByTestId('book-card-1'));
    await waitFor(() => {
      expect(upsertBook).toHaveBeenCalledWith(fakeBook);
      expect(addToShelf).toHaveBeenCalledWith('user-1', 'book-uuid', 'reading');
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

  it('does not show genre pills in For You mode', async () => {
    render(<DiscoverScreen />);
    await waitFor(() => screen.getByTestId('tab-for-you'));
    fireEvent.press(screen.getByTestId('tab-for-you'));
    await waitFor(() => {
      expect(screen.queryByTestId('genre-pill-Fantasy')).toBeNull();
    });
  });
});
