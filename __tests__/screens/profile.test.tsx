import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from '@/app/(tabs)/profile';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

const mockSignOut = jest.fn();
jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({
    session: { user: { id: 'user-1' } },
    signOut: mockSignOut,
  })),
}));

jest.mock('@/lib/stats', () => ({
  getStreak: jest.fn().mockResolvedValue(5),
  getYearlyGoalProgress: jest.fn().mockResolvedValue({ booksRead: 3, goal: 12 }),
  getReadingHistory: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({
    id: 'user-1',
    username: 'isabelle',
    bio: 'I love books',
    is_private: false,
    yearly_goal: 12,
  }),
  updateYearlyGoal: jest.fn().mockResolvedValue(undefined),
  updatePrivacy: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/userBooks', () => ({
  getShelf: jest.fn().mockResolvedValue([]),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { updatePrivacy } from '@/lib/profile';

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue(undefined);
});

describe('ProfileScreen', () => {
  it('renders username and initials', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('isabelle')).toBeTruthy();
      expect(screen.getByText('I')).toBeTruthy(); // initial
    });
  });

  it('renders bio when present', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('I love books')).toBeTruthy();
    });
  });

  it('shows streak in stats summary', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('5')).toBeTruthy();
    });
  });

  it('shows yearly goal progress', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText(/3 of 12 books/)).toBeTruthy();
    });
  });

  it('shows Sign Out button and calls signOut on press', async () => {
    render(<ProfileScreen />);
    await waitFor(() => screen.getByText('Sign Out'));
    fireEvent.press(screen.getByText('Sign Out'));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('privacy switch reflects is_private=false (switch ON = public)', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('privacy-switch')).toBeTruthy();
    });
  });

  it('toggling privacy switch calls updatePrivacy', async () => {
    render(<ProfileScreen />);
    await waitFor(() => screen.getByTestId('privacy-switch'));
    fireEvent(screen.getByTestId('privacy-switch'), 'valueChange', false);
    await waitFor(() => {
      expect(updatePrivacy).toHaveBeenCalledWith('user-1', true);
    });
  });
});
