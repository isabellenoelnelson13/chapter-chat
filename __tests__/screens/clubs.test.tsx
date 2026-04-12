import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ClubsScreen from '@/app/clubs';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({ session: { user: { id: 'user-1' } } })),
}));

const mockClub = {
  id: 'club-1',
  name: 'Tolkien Fans',
  description: 'We love Tolkien',
  ownerId: 'user-1',
  memberCount: 3,
  currentBookTitle: 'The Hobbit',
  currentBookCoverUrl: null,
};

jest.mock('@/lib/clubs', () => ({
  getMyClubs: jest.fn().mockResolvedValue([]),
  createClub: jest.fn().mockResolvedValue('club-new'),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  },
}));

import { getMyClubs, createClub } from '@/lib/clubs';

beforeEach(() => {
  jest.clearAllMocks();
  (getMyClubs as jest.Mock).mockResolvedValue([mockClub]);
  (createClub as jest.Mock).mockResolvedValue('club-new');
});

describe('ClubsScreen', () => {
  it('renders heading', async () => {
    render(<ClubsScreen />);
    await waitFor(() => expect(screen.getByText('My Clubs')).toBeTruthy());
  });

  it('shows empty state when user has no clubs', async () => {
    (getMyClubs as jest.Mock).mockResolvedValue([]);
    render(<ClubsScreen />);
    await waitFor(() =>
      expect(screen.getByText("You're not in any clubs yet.")).toBeTruthy()
    );
  });

  it('renders club card with name and current book', async () => {
    render(<ClubsScreen />);
    await waitFor(() => expect(screen.getByText('Tolkien Fans')).toBeTruthy());
    expect(screen.getByText('The Hobbit')).toBeTruthy();
    expect(screen.getByText('3 members')).toBeTruthy();
  });

  it('tapping a club card navigates to club detail', async () => {
    render(<ClubsScreen />);
    await waitFor(() => screen.getByText('Tolkien Fans'));
    fireEvent.press(screen.getByTestId('club-card-club-1'));
    expect(mockPush).toHaveBeenCalledWith('/club/club-1');
  });

  it('tapping New Club shows create form', async () => {
    render(<ClubsScreen />);
    await waitFor(() => screen.getByText('My Clubs'));
    fireEvent.press(screen.getByTestId('new-club-btn'));
    expect(screen.getByPlaceholderText('Club name')).toBeTruthy();
  });

  it('creating a club calls createClub and reloads list', async () => {
    render(<ClubsScreen />);
    await waitFor(() => screen.getByText('My Clubs'));
    fireEvent.press(screen.getByTestId('new-club-btn'));
    fireEvent.changeText(screen.getByPlaceholderText('Club name'), 'New Club');
    fireEvent.press(screen.getByTestId('create-club-btn'));
    await waitFor(() => expect(createClub).toHaveBeenCalledWith('user-1', 'New Club', ''));
    await waitFor(() => expect(getMyClubs).toHaveBeenCalledTimes(2));
  });
});
