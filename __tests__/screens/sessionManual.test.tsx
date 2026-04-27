import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ManualSessionScreen from '@/app/session/manual';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const mockUserBook = {
  id: 'ub-1',
  user_id: 'user-1',
  book_id: 'book-1',
  shelf: 'reading',
  current_page: 50,
  rating: null,
  review: null,
  added_at: '2026-04-01T00:00:00Z',
  finished_at: null,
  book: { id: 'book-1', title: 'The Hobbit', author: 'Tolkien', cover_url: null, page_count: 310 },
};

jest.mock('@/lib/userBooks', () => ({
  getShelf: jest.fn().mockResolvedValue([mockUserBook]),
}));

jest.mock('@/lib/sessions', () => ({
  createSession: jest.fn().mockResolvedValue(undefined),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

import { createSession } from '@/lib/sessions';
import { getShelf } from '@/lib/userBooks';

beforeEach(() => {
  jest.clearAllMocks();
  (getShelf as jest.Mock).mockResolvedValue([mockUserBook]);
  (createSession as jest.Mock).mockResolvedValue(undefined);
});

describe('ManualSessionScreen', () => {
  it('renders start page, end page and time inputs', async () => {
    render(<ManualSessionScreen />);
    await waitFor(() => screen.getByText('The Hobbit'));
    expect(screen.getByPlaceholderText('Start page')).toBeTruthy();
    expect(screen.getByPlaceholderText('End page')).toBeTruthy();
    expect(screen.getByText('hr')).toBeTruthy();
    expect(screen.getByText('min')).toBeTruthy();
    expect(screen.getByText('sec')).toBeTruthy();
  });

  it('shows error when end page is not greater than start page', async () => {
    render(<ManualSessionScreen />);
    await waitFor(() => screen.getByText('Log Session'));
    fireEvent.changeText(screen.getByPlaceholderText('Start page'), '80');
    fireEvent.changeText(screen.getByPlaceholderText('End page'), '50');
    const timeInputs = screen.getAllByPlaceholderText('0');
    fireEvent.changeText(timeInputs[1], '30'); // minutes input
    fireEvent.press(screen.getByText('Log Session'));
    expect(screen.getByText('End page must be greater than start page')).toBeTruthy();
    expect(createSession).not.toHaveBeenCalled();
  });

  it('shows error when time is zero', async () => {
    render(<ManualSessionScreen />);
    await waitFor(() => screen.getByText('Log Session'));
    fireEvent.changeText(screen.getByPlaceholderText('Start page'), '50');
    fireEvent.changeText(screen.getByPlaceholderText('End page'), '80');
    // Leave all time inputs at default (0)
    fireEvent.press(screen.getByText('Log Session'));
    expect(screen.getByText('Time must be greater than 0')).toBeTruthy();
    expect(createSession).not.toHaveBeenCalled();
  });

  it('saves session on valid input', async () => {
    render(<ManualSessionScreen />);
    await waitFor(() => screen.getByText('Log Session'));
    fireEvent.changeText(screen.getByPlaceholderText('Start page'), '50');
    fireEvent.changeText(screen.getByPlaceholderText('End page'), '80');
    const timeInputs = screen.getAllByPlaceholderText('0');
    fireEvent.changeText(timeInputs[1], '30'); // minutes input = 30 min
    fireEvent.press(screen.getByText('Log Session'));
    await waitFor(() => expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        userBookId: 'ub-1',
        startPage: 50,
        endPage: 80,
        durationSeconds: 1800,
      })
    ));
  });
});
