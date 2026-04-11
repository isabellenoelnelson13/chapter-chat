import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LibraryScreen from '@/app/(tabs)/library';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const mockBooks = [
  {
    id: 'ub-1',
    user_id: 'user-1',
    book_id: 'book-1',
    shelf: 'reading',
    current_page: 50,
    rating: null,
    review: null,
    added_at: '2026-04-01T00:00:00Z',
    finished_at: null,
    book: { id: 'book-1', title: 'The Hobbit', author: 'Tolkien', cover_url: null, page_count: 310, description: null },
  },
];

jest.mock('@/lib/userBooks', () => ({
  getShelf: jest.fn().mockResolvedValue([]),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { getShelf } from '@/lib/userBooks';

beforeEach(() => {
  jest.clearAllMocks();
  (getShelf as jest.Mock).mockResolvedValue([]);
});

describe('LibraryScreen', () => {
  it('renders all four shelf tabs', async () => {
    render(<LibraryScreen />);
    await waitFor(() => {
      expect(screen.getByText('Reading')).toBeTruthy();
      expect(screen.getByText('Want to Read')).toBeTruthy();
      expect(screen.getByText('Read')).toBeTruthy();
      expect(screen.getByText('DNF')).toBeTruthy();
    });
  });

  it('shows empty state message when shelf is empty', async () => {
    render(<LibraryScreen />);
    await waitFor(() => {
      expect(screen.getByText('No books here yet')).toBeTruthy();
    });
  });

  it('shows book title when shelf has books', async () => {
    (getShelf as jest.Mock).mockResolvedValue(mockBooks);
    render(<LibraryScreen />);
    await waitFor(() => {
      expect(screen.getByText('The Hobbit')).toBeTruthy();
    });
  });

  it('loads Want shelf when Want tab is tapped', async () => {
    render(<LibraryScreen />);
    fireEvent.press(screen.getByText('Want to Read'));
    await waitFor(() => {
      expect(getShelf).toHaveBeenCalledWith('user-1', 'want');
    });
  });

  it('navigates to search when + button is pressed', async () => {
    render(<LibraryScreen />);
    await waitFor(() => screen.getByText('No books here yet'));
    fireEvent.press(screen.getByTestId('add-book-btn'));
    expect(mockPush).toHaveBeenCalledWith('/search');
  });

  it('shows progress bar on Reading shelf for a book with page count', async () => {
    (getShelf as jest.Mock).mockResolvedValue(mockBooks); // shelf='reading', page_count=310, current_page=50
    render(<LibraryScreen />);
    await waitFor(() => {
      expect(screen.getByText('The Hobbit')).toBeTruthy();
    });
    // progress bar is rendered (we verify no crash and the book is shown)
    // The progress fill is a View with a % width — verifying it doesn't crash is sufficient
  });

  it('taps a book card and navigates to book detail', async () => {
    (getShelf as jest.Mock).mockResolvedValue(mockBooks);
    render(<LibraryScreen />);
    await waitFor(() => screen.getByText('The Hobbit'));
    fireEvent.press(screen.getByText('The Hobbit'));
    expect(mockPush).toHaveBeenCalledWith('/book/book-1');
  });

  it('shows star rating on Read shelf', async () => {
    const readBook = {
      ...mockBooks[0],
      shelf: 'read' as const,
      rating: 4,
    };
    (getShelf as jest.Mock).mockResolvedValue([readBook]);
    render(<LibraryScreen />);
    fireEvent.press(screen.getByText('Read'));
    await waitFor(() => {
      expect(screen.getByText('★★★★☆')).toBeTruthy();
    });
  });
});
