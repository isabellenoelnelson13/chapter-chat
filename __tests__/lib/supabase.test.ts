import { supabase } from '../../lib/supabase';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('supabase client', () => {
  it('is initialized with the correct URL', () => {
    // @ts-ignore — accessing internal config for test
    const url = supabase.supabaseUrl;
    expect(url).toBe(process.env.EXPO_PUBLIC_SUPABASE_URL);
  });

  it('exposes auth, from, and channel APIs', () => {
    expect(supabase.auth).toBeDefined();
    expect(supabase.from).toBeDefined();
    expect(supabase.channel).toBeDefined();
  });
});
