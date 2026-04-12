import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import SearchScreen from '@/app/search';
import { ActionSheetIOS } from 'react-native';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

jest.mock('@/lib/books', () => ({
  searchBooks: jest.fn().mockResolvedValue([]),
  upsertBook: jest.fn().mockResolvedValue('book-uuid'),
}));

jest.mock('@/lib/userBooks', () => ({
  addToShelf: jest.fn().mockResolvedValue('ub-uuid'),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
  (_options, callback) => callback(1) // simulate selecting "Reading" (index 1)
);

import { searchBooks, upsertBook } from '@/lib/books';
import { addToShelf } from '@/lib/userBooks';

const mockResult = {
  hardcover_id: 'hc1',
  title: 'The Hobbit',
  author: 'Tolkien',
  cover_url: null,
  page_count: 310,
  genres: ['Fantasy'],
  description: null,
  rating: 4.2,
  users_read_count: 50000,
};

beforeEach(() => {
  jest.clearAllMocks();
  (searchBooks as jest.Mock).mockResolvedValue([]);
  (upsertBook as jest.Mock).mockResolvedValue('book-uuid');
  (addToShelf as jest.Mock).mockResolvedValue('ub-uuid');
  jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(
    (_options, callback) => callback(1)
  );
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SearchScreen', () => {
  it('renders search input', () => {
    render(<SearchScreen />);
    expect(screen.getByPlaceholderText('Search by title or author...')).toBeTruthy();
  });

  it('shows results after typing', async () => {
    (searchBooks as jest.Mock).mockResolvedValue([mockResult]);
    jest.useFakeTimers();
    render(<SearchScreen />);
    fireEvent.changeText(
      screen.getByPlaceholderText('Search by title or author...'),
      'hobbit'
    );
    await act(async () => { jest.advanceTimersByTime(500); });
    await waitFor(() => expect(screen.getByText('The Hobbit')).toBeTruthy());
  });

  it('clears results when input is cleared', async () => {
    (searchBooks as jest.Mock).mockResolvedValue([mockResult]);
    jest.useFakeTimers();
    render(<SearchScreen />);
    const input = screen.getByPlaceholderText('Search by title or author...');
    fireEvent.changeText(input, 'hobbit');
    await act(async () => { jest.advanceTimersByTime(500); });
    await waitFor(() => screen.getByText('The Hobbit'));
    fireEvent.changeText(input, '');
    expect(screen.queryByText('The Hobbit')).toBeNull();
  });

  it('shows action sheet when result is tapped', async () => {
    (searchBooks as jest.Mock).mockResolvedValue([mockResult]);
    jest.useFakeTimers();
    render(<SearchScreen />);
    fireEvent.changeText(
      screen.getByPlaceholderText('Search by title or author...'),
      'hobbit'
    );
    await act(async () => { jest.advanceTimersByTime(500); });
    await waitFor(() => screen.getByText('The Hobbit'));
    fireEvent.press(screen.getByText('The Hobbit'));
    expect(ActionSheetIOS.showActionSheetWithOptions).toHaveBeenCalled();
  });

  it('upserts book and adds to shelf then navigates back', async () => {
    (searchBooks as jest.Mock).mockResolvedValue([mockResult]);
    jest.useFakeTimers();
    render(<SearchScreen />);
    fireEvent.changeText(
      screen.getByPlaceholderText('Search by title or author...'),
      'hobbit'
    );
    await act(async () => { jest.advanceTimersByTime(500); });
    await waitFor(() => screen.getByText('The Hobbit'));
    fireEvent.press(screen.getByText('The Hobbit'));
    await waitFor(() => expect(upsertBook).toHaveBeenCalledWith(mockResult));
    expect(addToShelf).toHaveBeenCalledWith('user-1', 'book-uuid', 'reading');
    expect(mockBack).toHaveBeenCalled();
  });
});
