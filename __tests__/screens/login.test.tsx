import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../app/(auth)/login';

const mockSignIn = jest.fn();
const mockReplace = jest.fn();

jest.mock('../../lib/auth', () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockReplace.mockReset();
  });

  it('renders email and password fields', () => {
    const { getByPlaceholderText } = render(<LoginScreen />);
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
  });

  it('renders a Sign In button', () => {
    const { getByText } = render(<LoginScreen />);
    expect(getByText('Sign In')).toBeTruthy();
  });

  it('calls signIn with trimmed email and password on submit', async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('Email'), '  user@example.com  ');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('user@example.com', 'password123');
    });
  });

  it('redirects to tabs on successful sign in', async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('Email'), 'user@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/');
    });
  });

  it('shows an error message when signIn fails', async () => {
    mockSignIn.mockResolvedValue({ error: new Error('Invalid credentials') });
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    fireEvent.changeText(getByPlaceholderText('Email'), 'user@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'wrong');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(getByText('Invalid credentials')).toBeTruthy();
    });
  });
});
