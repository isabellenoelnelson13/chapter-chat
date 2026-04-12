import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ClubPostScreen from '@/app/club/[clubId]/post/[postId]';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const mockParent = {
  id: 'post-1',
  clubId: 'club-1',
  userId: 'user-2',
  username: 'bob',
  body: 'Top post body',
  parentId: null,
  replyCount: 1,
  createdAt: '2026-04-11T10:00:00Z',
};

const mockReply = {
  id: 'post-2',
  clubId: 'club-1',
  userId: 'user-1',
  username: 'alice',
  body: 'A reply here',
  parentId: 'post-1',
  replyCount: 0,
  createdAt: '2026-04-11T10:05:00Z',
};

jest.mock('@/lib/clubs', () => ({
  getThread: jest.fn().mockResolvedValue({ parent: null, replies: [] }),
  addPost: jest.fn().mockResolvedValue(null),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ clubId: 'club-1', postId: 'post-1' }),
}));

import { getThread, addPost } from '@/lib/clubs';

beforeEach(() => {
  jest.clearAllMocks();
  (getThread as jest.Mock).mockResolvedValue({
    parent: mockParent,
    replies: [mockReply],
  });
  (addPost as jest.Mock).mockResolvedValue({
    id: 'post-3',
    clubId: 'club-1',
    userId: 'user-1',
    username: 'alice',
    body: 'New reply',
    parentId: 'post-1',
    replyCount: 0,
    createdAt: '2026-04-11T11:00:00Z',
  });
});

describe('ClubPostScreen', () => {
  it('shows parent post body', async () => {
    render(<ClubPostScreen />);
    await waitFor(() => expect(screen.getByText('Top post body')).toBeTruthy());
  });

  it('shows replies below parent', async () => {
    render(<ClubPostScreen />);
    await waitFor(() => expect(screen.getByText('A reply here')).toBeTruthy());
  });

  it('reply input is visible', async () => {
    render(<ClubPostScreen />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Write a reply...')).toBeTruthy()
    );
  });

  it('submitting a reply calls addPost with parentId and appends to list', async () => {
    render(<ClubPostScreen />);
    await waitFor(() => screen.getByPlaceholderText('Write a reply...'));
    fireEvent.changeText(screen.getByPlaceholderText('Write a reply...'), 'New reply');
    fireEvent.press(screen.getByTestId('send-reply-btn'));
    await waitFor(() =>
      expect(addPost).toHaveBeenCalledWith('club-1', 'user-1', 'New reply', 'post-1')
    );
    await waitFor(() => expect(screen.getByText('New reply')).toBeTruthy());
  });
});
