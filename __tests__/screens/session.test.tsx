import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import SessionScreen from '@/app/session/[bookId]';

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
  getUserBook: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/sessions', () => ({
  createSession: jest.fn().mockResolvedValue(undefined),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ bookId: 'book-1' }),
}));

import { getUserBook } from '@/lib/userBooks';
import { createSession } from '@/lib/sessions';

beforeEach(() => {
  jest.clearAllMocks();
  (getUserBook as jest.Mock).mockResolvedValue(mockUserBook);
  (createSession as jest.Mock).mockResolvedValue(undefined);
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SessionScreen', () => {
  it('shows start page input in setup phase', async () => {
    render(<SessionScreen />);
    await waitFor(() => expect(screen.getByText('The Hobbit')).toBeTruthy());
    expect(screen.getByPlaceholderText('Starting page')).toBeTruthy();
    expect(screen.getByText('Start Reading')).toBeTruthy();
  });

  it('starts the timer when Start Reading is pressed', async () => {
    render(<SessionScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    fireEvent.changeText(screen.getByPlaceholderText('Starting page'), '50');
    fireEvent.press(screen.getByText('Start Reading'));
    expect(screen.getByText('0:00')).toBeTruthy();
    expect(screen.getByText('Pause')).toBeTruthy();
  });

  it('increments the timer each second', async () => {
    render(<SessionScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    fireEvent.changeText(screen.getByPlaceholderText('Starting page'), '50');
    fireEvent.press(screen.getByText('Start Reading'));
    act(() => { jest.advanceTimersByTime(3000); });
    expect(screen.getByText('0:03')).toBeTruthy();
  });

  it('pauses and resumes the timer', async () => {
    render(<SessionScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    fireEvent.changeText(screen.getByPlaceholderText('Starting page'), '50');
    fireEvent.press(screen.getByText('Start Reading'));
    act(() => { jest.advanceTimersByTime(5000); });
    fireEvent.press(screen.getByText('Pause'));
    expect(screen.getByText('Resume')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(5000); });
    expect(screen.getByText('0:05')).toBeTruthy(); // time frozen while paused
    fireEvent.press(screen.getByText('Resume'));
    act(() => { jest.advanceTimersByTime(2000); });
    expect(screen.getByText('0:07')).toBeTruthy();
  });

  it('shows end page input after tapping Finish', async () => {
    render(<SessionScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    fireEvent.changeText(screen.getByPlaceholderText('Starting page'), '50');
    fireEvent.press(screen.getByText('Start Reading'));
    fireEvent.press(screen.getByText('Finish'));
    expect(screen.getByPlaceholderText('Ending page')).toBeTruthy();
    expect(screen.getByText('Save Session')).toBeTruthy();
  });

  it('saves session and navigates back', async () => {
    render(<SessionScreen />);
    await waitFor(() => screen.getByText('Start Reading'));
    fireEvent.changeText(screen.getByPlaceholderText('Starting page'), '50');
    fireEvent.press(screen.getByText('Start Reading'));
    act(() => { jest.advanceTimersByTime(1800000); }); // 30 minutes
    fireEvent.press(screen.getByText('Finish'));
    fireEvent.changeText(screen.getByPlaceholderText('Ending page'), '80');
    fireEvent.press(screen.getByText('Save Session'));
    await waitFor(() => expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        bookId: 'book-1',
        userBookId: 'ub-1',
        startPage: 50,
        endPage: 80,
        durationSeconds: 1800,
      })
    ));
    expect(mockBack).toHaveBeenCalled();
  });
});
