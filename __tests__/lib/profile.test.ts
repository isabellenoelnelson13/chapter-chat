import { getProfile, updateYearlyGoal, updatePrivacy } from '@/lib/profile';

const testState = {
  builderResolve: { data: null as any, error: null as any },
  mockBuilder: null as any,
};

jest.mock('@/lib/supabase', () => {
  const mockBuilder = {
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(() => Promise.resolve(testState.builderResolve)),
    then: jest.fn((resolve: any, reject: any) =>
      Promise.resolve(testState.builderResolve).then(resolve, reject)
    ),
  };
  testState.mockBuilder = mockBuilder;
  return { supabase: { from: jest.fn(() => mockBuilder) } };
});

beforeEach(() => {
  testState.builderResolve = { data: null, error: null };
  jest.clearAllMocks();
  if (testState.mockBuilder) {
    testState.mockBuilder.select.mockReturnThis();
    testState.mockBuilder.update.mockReturnThis();
    testState.mockBuilder.eq.mockReturnThis();
    testState.mockBuilder.maybeSingle.mockImplementation(() =>
      Promise.resolve(testState.builderResolve)
    );
    testState.mockBuilder.then.mockImplementation((resolve: any, reject: any) =>
      Promise.resolve(testState.builderResolve).then(resolve, reject)
    );
  }
});

describe('getProfile', () => {
  it('returns profile when found', async () => {
    testState.builderResolve = {
      data: {
        id: 'user-1',
        username: 'isabelle',
        bio: 'I love books',
        is_private: false,
        yearly_goal: 24,
      },
      error: null,
    };
    const profile = await getProfile('user-1');
    expect(profile?.username).toBe('isabelle');
    expect(profile?.yearly_goal).toBe(24);
    expect(profile?.is_private).toBe(false);
  });

  it('returns null when not found', async () => {
    testState.builderResolve = { data: null, error: null };
    const profile = await getProfile('user-1');
    expect(profile).toBeNull();
  });
});

describe('updateYearlyGoal', () => {
  it('calls supabase update with correct payload', async () => {
    testState.builderResolve = { data: null, error: null };
    await updateYearlyGoal('user-1', 20);
    expect(testState.mockBuilder.update).toHaveBeenCalledWith({ yearly_goal: 20 });
    expect(testState.mockBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
  });
});

describe('updatePrivacy', () => {
  it('calls supabase update with is_private=true', async () => {
    testState.builderResolve = { data: null, error: null };
    await updatePrivacy('user-1', true);
    expect(testState.mockBuilder.update).toHaveBeenCalledWith({ is_private: true });
  });

  it('calls supabase update with is_private=false', async () => {
    testState.builderResolve = { data: null, error: null };
    await updatePrivacy('user-1', false);
    expect(testState.mockBuilder.update).toHaveBeenCalledWith({ is_private: false });
  });
});
