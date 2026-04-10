import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../lib/auth';

// Mock Supabase
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    );
  });

  it('returns null session on initial load and loading false after resolution', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    expect(result.current.session).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('exposes signIn, signUp, and signOut functions', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(typeof result.current.signIn).toBe('function');
    expect(typeof result.current.signUp).toBe('function');
    expect(typeof result.current.signOut).toBe('function');
  });
});
