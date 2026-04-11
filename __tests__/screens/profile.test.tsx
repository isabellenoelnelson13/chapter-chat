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

jest.mock('@/lib/follows', () => ({
  getFollowRequests: jest.fn().mockResolvedValue([]),
  approveFollowRequest: jest.fn().mockResolvedValue(undefined),
  declineFollowRequest: jest.fn().mockResolvedValue(undefined),
}));

import { updatePrivacy } from '@/lib/profile';
import { getFollowRequests, approveFollowRequest, declineFollowRequest } from '@/lib/follows';

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue(undefined);
  (getFollowRequests as jest.Mock).mockResolvedValue([]);
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

  it('hides follow requests card when no pending requests', async () => {
    render(<ProfileScreen />);
    await waitFor(() => screen.getByText('isabelle'));
    expect(screen.queryByText('Follow Requests')).toBeNull();
  });

  it('shows follow requests card when requests are pending', async () => {
    (getFollowRequests as jest.Mock).mockResolvedValue([
      { requesterId: 'user-3', username: 'bob', bio: null },
    ]);
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('Follow Requests')).toBeTruthy();
      expect(screen.getByText('bob')).toBeTruthy();
    });
  });

  it('Accept button calls approveFollowRequest', async () => {
    (getFollowRequests as jest.Mock).mockResolvedValue([
      { requesterId: 'user-3', username: 'bob', bio: null },
    ]);
    render(<ProfileScreen />);
    await waitFor(() => screen.getByText('bob'));
    fireEvent.press(screen.getByTestId('accept-request-user-3'));
    await waitFor(() => {
      expect(approveFollowRequest).toHaveBeenCalledWith('user-3', 'user-1');
    });
  });

  it('Decline button calls declineFollowRequest', async () => {
    (getFollowRequests as jest.Mock).mockResolvedValue([
      { requesterId: 'user-3', username: 'bob', bio: null },
    ]);
    render(<ProfileScreen />);
    await waitFor(() => screen.getByText('bob'));
    fireEvent.press(screen.getByTestId('decline-request-user-3'));
    await waitFor(() => {
      expect(declineFollowRequest).toHaveBeenCalledWith('user-3', 'user-1');
    });
  });
});
