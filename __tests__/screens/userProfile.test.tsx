import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import UserProfileScreen from '@/app/user/[userId]';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ userId: 'user-2' }),
}));

jest.mock('@/lib/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({
    id: 'user-2',
    username: 'alice',
    bio: 'book lover',
    is_private: false,
    yearly_goal: 10,
  }),
}));

jest.mock('@/lib/userBooks', () => ({
  getShelf: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/follows', () => ({
  getFollowStatus: jest.fn().mockResolvedValue('none'),
  followUser: jest.fn().mockResolvedValue(undefined),
  unfollowUser: jest.fn().mockResolvedValue(undefined),
  cancelFollowRequest: jest.fn().mockResolvedValue(undefined),
}));

import { getProfile } from '@/lib/profile';
import { getFollowStatus, followUser } from '@/lib/follows';

beforeEach(() => {
  jest.clearAllMocks();
  (getProfile as jest.Mock).mockResolvedValue({
    id: 'user-2',
    username: 'alice',
    bio: 'book lover',
    is_private: false,
    yearly_goal: 10,
  });
  (getFollowStatus as jest.Mock).mockResolvedValue('none');
});

describe('UserProfileScreen', () => {
  it('renders username and initials', async () => {
    render(<UserProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeTruthy();
      expect(screen.getByText('A')).toBeTruthy();
    });
  });

  it('renders bio when present', async () => {
    render(<UserProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('book lover')).toBeTruthy();
    });
  });

  it('shows Follow button for public profile with status none', async () => {
    render(<UserProfileScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('follow-btn')).toBeTruthy();
      expect(screen.getByText('Follow')).toBeTruthy();
    });
  });

  it('shows shelf counts for public profile', async () => {
    render(<UserProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Read · /)).toBeTruthy();
      expect(screen.getByText(/Reading · /)).toBeTruthy();
    });
  });

  it('shows Private profile label for private profile with status none', async () => {
    (getProfile as jest.Mock).mockResolvedValue({
      id: 'user-2',
      username: 'alice',
      bio: null,
      is_private: true,
      yearly_goal: 0,
    });
    (getFollowStatus as jest.Mock).mockResolvedValue('none');
    render(<UserProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('🔒 Private profile')).toBeTruthy();
    });
  });

  it('shows shelf counts for private profile with status following', async () => {
    (getProfile as jest.Mock).mockResolvedValue({
      id: 'user-2',
      username: 'alice',
      bio: null,
      is_private: true,
      yearly_goal: 0,
    });
    (getFollowStatus as jest.Mock).mockResolvedValue('following');
    render(<UserProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Read · /)).toBeTruthy();
    });
  });

  it('tapping Follow calls followUser', async () => {
    render(<UserProfileScreen />);
    await waitFor(() => screen.getByTestId('follow-btn'));
    fireEvent.press(screen.getByTestId('follow-btn'));
    await waitFor(() => {
      expect(followUser).toHaveBeenCalledWith('user-1', 'user-2', false);
    });
  });
});
