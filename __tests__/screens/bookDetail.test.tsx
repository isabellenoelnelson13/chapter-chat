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

jest.mock('@/lib/books', () => ({
  getBookById: jest.fn().mockResolvedValue(null),
  getBookReviews: jest.fn().mockResolvedValue({ friendReviews: [], topReviews: [] }),
  updatePageCount: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/userBooks', () => ({
  getUserBook: jest.fn().mockResolvedValue(null),
  addToShelf: jest.fn().mockResolvedValue('ub-new'),
  moveShelf: jest.fn().mockResolvedValue(undefined),
  removeFromShelf: jest.fn().mockResolvedValue(undefined),
  rateBook: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/activity', () => ({
  createEvent: jest.fn().mockResolvedValue(undefined),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ bookId: 'book-1' }),
}));

import { getBookById, getBookReviews } from '@/lib/books';
import { getUserBook, addToShelf, moveShelf, removeFromShelf, rateBook } from '@/lib/userBooks';
import { createEvent } from '@/lib/activity';

const mockBook = {
  id: 'book-1',
  hardcover_id: 'hc-1',
  title: 'The Hobbit',
  author: 'J.R.R. Tolkien',
  cover_url: null,
  page_count: 310,
  description: 'In a hole in the ground there lived a hobbit.',
  rating: 4.2,
  users_read_count: 150000,
  genres: ['Fantasy'],
  created_at: '2026-01-01T00:00:00Z',
};

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
    rating: 4.2,
    users_read_count: 150000,
  },
};

const mockReadBook = {
  ...mockReadingBook,
  id: 'ub-2',
  shelf: 'read' as const,
  rating: 4,
};

const mockReadBookWithReview = {
  ...mockReadBook,
  review: 'A wonderful adventure.',
};

beforeEach(() => {
  jest.clearAllMocks();
  (getBookById as jest.Mock).mockResolvedValue(null);
  (getBookReviews as jest.Mock).mockResolvedValue({ friendReviews: [], topReviews: [] });
  (getUserBook as jest.Mock).mockResolvedValue(null);
  (createEvent as jest.Mock).mockResolvedValue(undefined);
});

describe('BookDetailScreen', () => {
  it('shows loading spinner then book info', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByText('The Hobbit')).toBeTruthy();
      expect(screen.getByText('J.R.R. Tolkien')).toBeTruthy();
    });
  });

  it('shows book not found when getBookById returns null', async () => {
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByText('Book not found')).toBeTruthy();
    });
  });

  it('shows Hardcover community rating', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(null);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('hardcover-rating')).toBeTruthy();
    });
  });

  it('shows Add to Shelf button when book is not on any shelf', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(null);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('add-to-shelf-btn')).toBeTruthy();
    });
  });

  it('shows Start Reading Session button on reading shelf', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('start-session-btn')).toBeTruthy();
    });
  });

  it('does not show Start Reading Session on read shelf', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(mockReadBook);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByText('The Hobbit')).toBeTruthy();
    });
    expect(screen.queryByTestId('start-session-btn')).toBeNull();
  });

  it('shows star rating row on read shelf', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(mockReadBook);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('rating-row')).toBeTruthy();
    });
  });

  it('shows review placeholder when book is read and has no review', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue({ ...mockReadBook, review: null });
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('review-placeholder')).toBeTruthy();
    });
  });

  it('shows existing review text when book has a review', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(mockReadBookWithReview);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('review-text')).toBeTruthy();
      expect(screen.getByText('A wonderful adventure.')).toBeTruthy();
    });
  });

  it('tapping review placeholder opens text input', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue({ ...mockReadBook, review: null });
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('review-placeholder'));
    fireEvent.press(screen.getByTestId('review-placeholder'));
    await waitFor(() => {
      expect(screen.getByTestId('review-input')).toBeTruthy();
    });
  });

  it('tapping Save calls rateBook with review text and collapses input', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue({ ...mockReadBook, review: null });
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('review-placeholder'));
    fireEvent.press(screen.getByTestId('review-placeholder'));
    await waitFor(() => screen.getByTestId('review-input'));
    fireEvent.changeText(screen.getByTestId('review-input'), 'Loved it!');
    fireEvent.press(screen.getByTestId('review-save'));
    await waitFor(() => {
      expect(rateBook).toHaveBeenCalledWith('ub-2', 4, 'Loved it!');
      expect(screen.queryByTestId('review-input')).toBeNull();
      expect(screen.getByText('Loved it!')).toBeTruthy();
    });
  });

  it('tapping a star calls rateBook', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue({ ...mockReadBook, rating: null });
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('star-3'));
    fireEvent.press(screen.getByTestId('star-3'));
    await waitFor(() => {
      expect(rateBook).toHaveBeenCalledWith('ub-2', 3, undefined);
    });
  });

  it('tapping Move to shelf calls moveShelf', async () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
      (_opts: any, callback: (index: number) => void) => { callback(1); }
    );
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('move-shelf-btn'));
    fireEvent.press(screen.getByTestId('move-shelf-btn'));
    await waitFor(() => {
      expect(moveShelf).toHaveBeenCalledWith('ub-1', 'reading');
    });
  });

  it('Start Reading Session navigates to session screen', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('start-session-btn'));
    fireEvent.press(screen.getByTestId('start-session-btn'));
    expect(mockPush).toHaveBeenCalledWith('/session/book-1');
  });
});

describe('Activity events', () => {
  it('share progress button is visible when shelf is reading', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('share-progress-btn')).toBeTruthy();
    });
  });

  it('share progress button is hidden when shelf is not reading', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(mockReadBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByText('The Hobbit'));
    expect(screen.queryByTestId('share-progress-btn')).toBeNull();
  });

  it('tapping share progress button calls createEvent with shared_session', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('share-progress-btn'));
    fireEvent.press(screen.getByTestId('share-progress-btn'));
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith('user-1', 'shared_session', 'book-1', {
        pages_read: 50,
        duration_seconds: 0,
      });
    });
  });

  it('button label changes to Shared ✓ after tap', async () => {
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('share-progress-btn'));
    fireEvent.press(screen.getByTestId('share-progress-btn'));
    await waitFor(() => {
      expect(screen.getByText('Shared ✓')).toBeTruthy();
    });
  });

  it('tapping Move to shelf to reading calls createEvent with started_book', async () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
      (_opts: any, callback: (index: number) => void) => { callback(1); }
    );
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('move-shelf-btn'));
    fireEvent.press(screen.getByTestId('move-shelf-btn'));
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith('user-1', 'started_book', 'book-1', {});
    });
  });

  it('tapping Move to shelf to read calls createEvent with finished_book', async () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
      (_opts: any, callback: (index: number) => void) => { callback(3); }
    );
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock)
      .mockResolvedValueOnce(mockReadingBook)
      .mockResolvedValue({ ...mockReadingBook, shelf: 'read', rating: 4, review: 'Great' });
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('move-shelf-btn'));
    fireEvent.press(screen.getByTestId('move-shelf-btn'));
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith('user-1', 'finished_book', 'book-1', {
        rating: 4,
        review_snippet: 'Great',
      });
    });
  });

  it('tapping Remove from library calls removeFromShelf and navigates back', async () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
      (_opts: any, callback: (index: number) => void) => { callback(5); } // 5 = "Remove from library"
    );
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('move-shelf-btn'));
    fireEvent.press(screen.getByTestId('move-shelf-btn'));
    await waitFor(() => {
      expect(removeFromShelf).toHaveBeenCalledWith('ub-1');
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it('tapping Move to shelf to want calls createEvent with added_to_shelf', async () => {
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
      (_opts: any, callback: (index: number) => void) => { callback(2); }
    );
    (getBookById as jest.Mock).mockResolvedValue(mockBook);
    (getUserBook as jest.Mock).mockResolvedValue(mockReadingBook);
    render(<BookDetailScreen />);
    await waitFor(() => screen.getByTestId('move-shelf-btn'));
    fireEvent.press(screen.getByTestId('move-shelf-btn'));
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith('user-1', 'added_to_shelf', 'book-1', { shelf: 'want' });
    });
  });
});
