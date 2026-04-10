import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SignupScreen from '../../app/(auth)/signup';

const mockSignUp = jest.fn();
const mockReplace = jest.fn();

jest.mock('../../lib/auth', () => ({
  useAuth: () => ({ signUp: mockSignUp }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

describe('SignupScreen', () => {
  beforeEach(() => {
    mockSignUp.mockReset();
    mockReplace.mockReset();
  });

  it('renders username, email, and password fields', () => {
    const { getByPlaceholderText } = render(<SignupScreen />);
    expect(getByPlaceholderText('Username')).toBeTruthy();
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
  });

  it('calls signUp with all three fields on submit', async () => {
    mockSignUp.mockResolvedValue({ error: null });
    const { getByPlaceholderText, getByText } = render(<SignupScreen />);

    fireEvent.changeText(getByPlaceholderText('Username'), 'isabelle');
    fireEvent.changeText(getByPlaceholderText('Email'), 'isabelle@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        'isabelle@example.com',
        'password123',
        'isabelle'
      );
    });
  });

  it('redirects to tabs on successful sign up', async () => {
    mockSignUp.mockResolvedValue({ error: null });
    const { getByPlaceholderText, getByText } = render(<SignupScreen />);

    fireEvent.changeText(getByPlaceholderText('Username'), 'isabelle');
    fireEvent.changeText(getByPlaceholderText('Email'), 'isabelle@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/');
    });
  });

  it('shows an error when signUp fails', async () => {
    mockSignUp.mockResolvedValue({ error: new Error('Username already taken') });
    const { getByPlaceholderText, getByText } = render(<SignupScreen />);

    fireEvent.changeText(getByPlaceholderText('Username'), 'taken');
    fireEvent.changeText(getByPlaceholderText('Email'), 'x@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'pass');
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(getByText('Username already taken')).toBeTruthy();
    });
  });
});
