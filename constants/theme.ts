export const Fonts = {
  regular: 'Lato_400Regular',
  medium: 'Lato_400Regular',
  semiBold: 'Lato_700Bold',
  bold: 'LibreBaskerville_700Bold',
  bookTitle: 'LibreBaskerville_700Bold',
  bookBody: 'Lato_400Regular',
};

export interface ColorPalette {
  background: string;
  surface: string;
  primary: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  error: string;
  orange: string;
  progressTrack: string;
  progressFill: string;
  tabBarBg: string;
  tabActive: string;
  tabInactive: string;
}

export type ThemeName = 'lavender' | 'forest' | 'midnight' | 'sunset' | 'ocean' | 'rose' | 'slate' | 'sepia' | 'berry';

export const Themes: Record<ThemeName, { label: string; palette: ColorPalette }> = {
  lavender: {
    label: 'Lavender',
    palette: {
      background: '#EEEEF8',
      surface: '#FFFFFF',
      primary: '#7C6FCD',
      textPrimary: '#1A1A2E',
      textSecondary: '#8888A8',
      textTertiary: '#BBBBCC',
      border: '#E4E4F0',
      error: '#FF4444',
      orange: '#FF6B35',
      progressTrack: '#E4E4F0',
      progressFill: '#1A1A2E',
      tabBarBg: '#FFFFFF',
      tabActive: '#7C6FCD',
      tabInactive: '#AAAACC',
    },
  },
  forest: {
    label: 'Forest',
    palette: {
      background: '#EEF3EE',
      surface: '#FFFFFF',
      primary: '#4A7C59',
      textPrimary: '#1A2E1A',
      textSecondary: '#6A8872',
      textTertiary: '#AABFAA',
      border: '#D8E8D8',
      error: '#D94F3F',
      orange: '#E07B39',
      progressTrack: '#D8E8D8',
      progressFill: '#1A2E1A',
      tabBarBg: '#FFFFFF',
      tabActive: '#4A7C59',
      tabInactive: '#9AB8A0',
    },
  },
  midnight: {
    label: 'Midnight',
    palette: {
      background: '#12121E',
      surface: '#1E1E30',
      primary: '#9B8FE8',
      textPrimary: '#E8E8F8',
      textSecondary: '#8888AA',
      textTertiary: '#555570',
      border: '#2E2E48',
      error: '#FF5555',
      orange: '#FF7744',
      progressTrack: '#2E2E48',
      progressFill: '#E8E8F8',
      tabBarBg: '#1E1E30',
      tabActive: '#9B8FE8',
      tabInactive: '#555570',
    },
  },
  sunset: {
    label: 'Sunset',
    palette: {
      background: '#FDF3EE',
      surface: '#FFFFFF',
      primary: '#C4603A',
      textPrimary: '#2E1A12',
      textSecondary: '#9A6E58',
      textTertiary: '#C8A898',
      border: '#F0DDD5',
      error: '#D63030',
      orange: '#E87A30',
      progressTrack: '#F0DDD5',
      progressFill: '#2E1A12',
      tabBarBg: '#FFFFFF',
      tabActive: '#C4603A',
      tabInactive: '#D4A898',
    },
  },
  ocean: {
    label: 'Ocean',
    palette: {
      background: '#EEF4F8',
      surface: '#FFFFFF',
      primary: '#2E7DAF',
      textPrimary: '#12253A',
      textSecondary: '#5A7A99',
      textTertiary: '#A0BDD0',
      border: '#D0E4F0',
      error: '#E05050',
      orange: '#E07840',
      progressTrack: '#D0E4F0',
      progressFill: '#12253A',
      tabBarBg: '#FFFFFF',
      tabActive: '#2E7DAF',
      tabInactive: '#90B5CC',
    },
  },
  rose: {
    label: 'Rose',
    palette: {
      background: '#FDF0F3',
      surface: '#FFFFFF',
      primary: '#C4547A',
      textPrimary: '#2E1220',
      textSecondary: '#9A6278',
      textTertiary: '#C8A0B0',
      border: '#F0D8E0',
      error: '#D63030',
      orange: '#E87060',
      progressTrack: '#F0D8E0',
      progressFill: '#2E1220',
      tabBarBg: '#FFFFFF',
      tabActive: '#C4547A',
      tabInactive: '#D4A0B0',
    },
  },
  slate: {
    label: 'Slate',
    palette: {
      background: '#EEF0F4',
      surface: '#FFFFFF',
      primary: '#4A6080',
      textPrimary: '#1A2030',
      textSecondary: '#6A7A90',
      textTertiary: '#AABBC8',
      border: '#D8DDE8',
      error: '#D94040',
      orange: '#E08040',
      progressTrack: '#D8DDE8',
      progressFill: '#1A2030',
      tabBarBg: '#FFFFFF',
      tabActive: '#4A6080',
      tabInactive: '#90A0B4',
    },
  },
  sepia: {
    label: 'Sepia',
    palette: {
      background: '#F5EDE0',
      surface: '#FFF8F0',
      primary: '#8B5A2B',
      textPrimary: '#2C1A0A',
      textSecondary: '#8B6040',
      textTertiary: '#C0A080',
      border: '#E8D8C0',
      error: '#CC3030',
      orange: '#D07030',
      progressTrack: '#E8D8C0',
      progressFill: '#2C1A0A',
      tabBarBg: '#FFF8F0',
      tabActive: '#8B5A2B',
      tabInactive: '#C0A080',
    },
  },
  berry: {
    label: 'Berry',
    palette: {
      background: '#F5EEF3',
      surface: '#FFFFFF',
      primary: '#8B2D6A',
      textPrimary: '#2A0E20',
      textSecondary: '#8A5070',
      textTertiary: '#C0A0B4',
      border: '#EAD8E4',
      error: '#D63030',
      orange: '#E07050',
      progressTrack: '#EAD8E4',
      progressFill: '#2A0E20',
      tabBarBg: '#FFFFFF',
      tabActive: '#8B2D6A',
      tabInactive: '#C0A0B4',
    },
  },
};

/** Static fallback — used only before the ThemeProvider mounts */
export const Colors: ColorPalette = Themes.lavender.palette;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

export const Shadow = {
  card: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
};
