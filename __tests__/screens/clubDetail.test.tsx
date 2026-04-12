import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ClubDetailScreen from '@/app/club/[clubId]/index';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const mockClubDetail = {
  id: 'club-1',
  name: 'Tolkien Fans',
  description: 'We love Tolkien',
  ownerId: 'user-1',
  currentBook: {
    id: 'cb-1',
    bookId: 'book-1',
    bookTitle: 'The Hobbit',
    bookCoverUrl: null,
    startedAt: '2026-04-01T00:00:00Z',
    endedAt: null,
  },
  members: [
    { userId: 'user-1', username: 'alice', role: 'owner', currentPage: 50, pageCount: 310 },
    { userId: 'user-2', username: 'bob', role: 'member', currentPage: 100, pageCount: 310 },
  ],
  history: [],
};

const mockPost = {
  id: 'post-1',
  clubId: 'club-1',
  userId: 'user-2',
  username: 'bob',
  body: 'Great chapter!',
  parentId: null,
  replyCount: 1,
  createdAt: '2026-04-11T10:00:00Z',
};

jest.mock('@/lib/clubs', () => ({
  getClub: jest.fn().mockResolvedValue(null),
  addMember: jest.fn().mockResolvedValue(undefined),
  removeMember: jest.fn().mockResolvedValue(undefined),
  setCurrentBook: jest.fn().mockResolvedValue(undefined),
  getPosts: jest.fn().mockResolvedValue([]),
  addPost: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/follows', () => ({
  searchUsers: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/books', () => ({
  searchBooks: jest.fn().mockResolvedValue([]),
  upsertBook: jest.fn().mockResolvedValue('book-uuid'),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ clubId: 'club-1' }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

import { getClub, getPosts, addPost } from '@/lib/clubs';

beforeEach(() => {
  jest.clearAllMocks();
  (getClub as jest.Mock).mockResolvedValue(mockClubDetail);
  (getPosts as jest.Mock).mockResolvedValue([mockPost]);
  (addPost as jest.Mock).mockResolvedValue({
    ...mockPost,
    id: 'post-new',
    body: 'My post',
    userId: 'user-1',
    username: 'alice',
  });
});

describe('ClubDetailScreen', () => {
  it('renders club name', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => expect(screen.getByText('Tolkien Fans')).toBeTruthy());
  });

  it('shows current book title', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => expect(screen.getByText('The Hobbit')).toBeTruthy());
  });

  it('shows all members with username', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeTruthy();
      expect(screen.getAllByText('bob').length).toBeGreaterThan(0);
    });
  });

  it('shows member progress percentage', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => {
      // alice: 50/310 = 16%
      expect(screen.getByText('16%')).toBeTruthy();
      // bob: 100/310 = 32%
      expect(screen.getByText('32%')).toBeTruthy();
    });
  });

  it('shows posts', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => expect(screen.getByText('Great chapter!')).toBeTruthy());
  });

  it('owner sees Add member button', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() =>
      expect(screen.getByTestId('add-member-btn')).toBeTruthy()
    );
  });

  it('non-owner does not see Add member button', async () => {
    (getClub as jest.Mock).mockResolvedValue({
      ...mockClubDetail,
      ownerId: 'user-99',
    });
    render(<ClubDetailScreen />);
    await waitFor(() => screen.getByText('Tolkien Fans'));
    expect(screen.queryByTestId('add-member-btn')).toBeNull();
  });

  it('tapping a post navigates to thread', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => screen.getByText('Great chapter!'));
    fireEvent.press(screen.getByTestId('post-card-post-1'));
    expect(mockPush).toHaveBeenCalledWith('/club/club-1/post/post-1');
  });

  it('tapping New Post opens modal', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => screen.getByTestId('new-post-btn'));
    fireEvent.press(screen.getByTestId('new-post-btn'));
    expect(screen.getByPlaceholderText('Write a post...')).toBeTruthy();
  });

  it('submitting new post calls addPost and appends to list', async () => {
    render(<ClubDetailScreen />);
    await waitFor(() => screen.getByTestId('new-post-btn'));
    fireEvent.press(screen.getByTestId('new-post-btn'));
    fireEvent.changeText(screen.getByPlaceholderText('Write a post...'), 'My post');
    fireEvent.press(screen.getByTestId('submit-post-btn'));
    await waitFor(() =>
      expect(addPost).toHaveBeenCalledWith('club-1', 'user-1', 'My post', undefined)
    );
    await waitFor(() => expect(screen.getByText('My post')).toBeTruthy());
  });
});
