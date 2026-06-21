import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const deleteAccount = async () => {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const token = currentSession?.access_token ?? anonKey;
    const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Delete failed: ${res.status}`);
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signUp, signOut, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
