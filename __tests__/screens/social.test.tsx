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

jest.mock('@/lib/activity', () => ({
  getFeed: jest.fn().mockResolvedValue([]),
  likeEvent: jest.fn().mockResolvedValue(undefined),
  unlikeEvent: jest.fn().mockResolvedValue(undefined),
  getComments: jest.fn().mockResolvedValue([]),
  addComment: jest.fn().mockResolvedValue({
    id: 'c-1', userId: 'user-2', username: 'alice', body: 'Nice!', createdAt: '2026-04-11T10:00:00Z',
  }),
}));

import { getFollowing, searchUsers } from '@/lib/follows';
import { getFeed, likeEvent, unlikeEvent } from '@/lib/activity';

beforeEach(() => {
  jest.clearAllMocks();
  (getFollowing as jest.Mock).mockResolvedValue([]);
  (searchUsers as jest.Mock).mockResolvedValue([]);
  (getFeed as jest.Mock).mockResolvedValue([]);
});

describe('SocialScreen', () => {
  it('renders search bar and activity section on load', async () => {
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeTruthy();
      expect(screen.getByText('Follow people to see their activity here.')).toBeTruthy();
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

  it('hides following list and activity section when search is active', async () => {
    (getFollowing as jest.Mock).mockResolvedValue([
      { id: 'user-2', username: 'alice', bio: null, is_private: false, followStatus: 'following' },
    ]);
    render(<SocialScreen />);
    await waitFor(() => screen.getByTestId('search-input'));
    fireEvent.changeText(screen.getByTestId('search-input'), 'bob');
    await waitFor(() => {
      expect(screen.queryByText('Follow people to see their activity here.')).toBeNull();
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

// ─── Activity Feed ────────────────────────────────────────────────────────────

const mockEvent = {
  id: 'evt-1',
  actorId: 'user-2',
  actorUsername: 'alice',
  eventType: 'started_book' as const,
  bookId: 'book-1',
  bookTitle: 'The Hobbit',
  bookCoverUrl: null,
  metadata: {},
  createdAt: '2026-04-11T10:00:00Z',
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
};

describe('Activity Feed', () => {
  it('renders empty state when feed is empty', async () => {
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByText('Follow people to see their activity here.')).toBeTruthy();
    });
  });

  it('renders feed card with correct verb for started_book', async () => {
    (getFeed as jest.Mock).mockResolvedValue([mockEvent]);
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByText(/is now reading/)).toBeTruthy();
      expect(screen.getByText(/The Hobbit/)).toBeTruthy();
    });
  });

  it('renders feed card with correct verb for finished_book', async () => {
    (getFeed as jest.Mock).mockResolvedValue([{
      ...mockEvent,
      id: 'evt-2',
      eventType: 'finished_book',
      metadata: { rating: 4, review_snippet: 'Loved it' },
    }]);
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByText(/finished/)).toBeTruthy();
      expect(screen.getByText(/Loved it/)).toBeTruthy();
    });
  });

  it('like button shows filled heart when likedByMe is true', async () => {
    (getFeed as jest.Mock).mockResolvedValue([{ ...mockEvent, likedByMe: true, likeCount: 1 }]);
    render(<SocialScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('like-btn-evt-1')).toBeTruthy();
      expect(screen.getByTestId('like-btn-evt-1').props.accessibilityLabel).toBe('liked');
    });
  });

  it('tapping like button calls likeEvent', async () => {
    (getFeed as jest.Mock).mockResolvedValue([mockEvent]);
    render(<SocialScreen />);
    await waitFor(() => screen.getByTestId('like-btn-evt-1'));
    fireEvent.press(screen.getByTestId('like-btn-evt-1'));
    await waitFor(() => {
      expect(likeEvent).toHaveBeenCalledWith('user-1', 'evt-1');
    });
  });

  it('tapping comment button opens comments modal', async () => {
    (getFeed as jest.Mock).mockResolvedValue([mockEvent]);
    render(<SocialScreen />);
    await waitFor(() => screen.getByTestId('comment-btn-evt-1'));
    fireEvent.press(screen.getByTestId('comment-btn-evt-1'));
    await waitFor(() => {
      expect(screen.getByText('Comments')).toBeTruthy();
    });
  });

  it('tapping send in comments modal calls addComment', async () => {
    const { addComment } = require('@/lib/activity');
    (getFeed as jest.Mock).mockResolvedValue([mockEvent]);
    render(<SocialScreen />);
    await waitFor(() => screen.getByTestId('comment-btn-evt-1'));
    fireEvent.press(screen.getByTestId('comment-btn-evt-1'));
    await waitFor(() => screen.getByTestId('comment-input'));
    fireEvent.changeText(screen.getByTestId('comment-input'), 'Great book!');
    fireEvent.press(screen.getByTestId('send-comment-btn'));
    await waitFor(() => {
      expect(addComment).toHaveBeenCalledWith('user-1', 'evt-1', 'Great book!');
    });
  });
});
