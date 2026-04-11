import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SocialScreen from '@/app/(tabs)/social';

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
}));

jest.mock('@/lib/follows', () => ({
  getFollowing: jest.fn().mockResolvedValue([]),
  searchUsers: jest.fn().mockResolvedValue([]),
  followUser: jest.fn().mockResolvedValue(undefined),
  unfollowUser: jest.fn().mockResolvedValue(undefined),
  cancelFollowRequest: jest.fn().mockResolvedValue(undefined),
}));

import { getFollowing, searchUsers } from '@/lib/follows';

beforeEach(() => {
  jest.clearAllMocks();
  (getFollowing as jest.Mock).mockResolvedValue([]);
  (searchUsers as jest.Mock).mockResolvedValue([]);
});

describe('SocialScreen', () => {
  it('renders search bar and activity stub on load', async () => {
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeTruthy();
      expect(screen.getByText("Your friends' activity will appear here.")).toBeTruthy();
    });
  });

  it('shows empty following state when following no one', async () => {
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByText('Search for people to follow.')).toBeTruthy();
    });
  });

  it('shows following list when user follows someone', async () => {
    (getFollowing as jest.Mock).mockResolvedValue([
      { id: 'user-2', username: 'alice', bio: null, is_private: false, followStatus: 'following' },
    ]);
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeTruthy();
    });
  });

  it('hides following list and activity stub when search is active', async () => {
    (getFollowing as jest.Mock).mockResolvedValue([
      { id: 'user-2', username: 'alice', bio: null, is_private: false, followStatus: 'following' },
    ]);
    render(<SocialScreen />);
    await waitFor(() => screen.getByTestId('search-input'));
    fireEvent.changeText(screen.getByTestId('search-input'), 'bob');
    await waitFor(() => {
      expect(screen.queryByText("Your friends' activity will appear here.")).toBeNull();
    });
  });

  it('shows search results when query is non-empty', async () => {
    (searchUsers as jest.Mock).mockResolvedValue([
      { id: 'user-3', username: 'bob', bio: null, is_private: false, followStatus: 'none' },
    ]);
    render(<SocialScreen />);
    await waitFor(() => screen.getByTestId('search-input'));
    fireEvent.changeText(screen.getByTestId('search-input'), 'bob');
    await waitFor(() => {
      expect(screen.getByText('bob')).toBeTruthy();
    });
  });

  it('shows Follow button for user with followStatus none', async () => {
    (getFollowing as jest.Mock).mockResolvedValue([
      { id: 'user-2', username: 'alice', bio: null, is_private: false, followStatus: 'none' },
    ]);
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('follow-btn-user-2')).toBeTruthy();
      expect(screen.getByText('Follow')).toBeTruthy();
    });
  });

  it('shows Following button for user with followStatus following', async () => {
    (getFollowing as jest.Mock).mockResolvedValue([
      { id: 'user-2', username: 'alice', bio: null, is_private: false, followStatus: 'following' },
    ]);
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByText('Following')).toBeTruthy();
    });
  });

  it('shows Requested button for user with followStatus requested', async () => {
    (getFollowing as jest.Mock).mockResolvedValue([
      { id: 'user-2', username: 'alice', bio: null, is_private: true, followStatus: 'requested' },
    ]);
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByText('Requested')).toBeTruthy();
    });
  });
});
