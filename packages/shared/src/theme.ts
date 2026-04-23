// Shared theme tokens. Mirrors SyncPad palette verbatim for visual continuity.
// Brand red #D8393D is the anchor across SyncPad, GroceryScanner, and LinkDrive.

export const DARK = {
  bg: '#000000',
  bgBody: '#0D0D0D',
  bgCard: '#1A1A1A',
  bgElevated: '#2A2A2A',
  border: '#2A2A2A',
  borderSubtle: '#2E2E2E',
  text: '#F5F5F5',
  textMuted: 'rgba(245,245,245,0.5)',
  textDim: 'rgba(245,245,245,0.35)',
  accent: '#EF4444',
  accentBrand: '#D8393D',
  accentMuted: '#FF5555',
  accentDark: '#7A2A2A',
  destructive: '#DC2626',
  overlay: 'rgba(0,0,0,0.85)',
  success: '#10B981',
  warning: '#F59E0B',
} as const;

export const LIGHT = {
  bg: '#F8F7F4',
  bgBody: '#F8F7F4',
  bgCard: '#FFFFFF',
  bgElevated: '#F2F0EC',
  border: '#E7E5E0',
  borderSubtle: '#D4D0C8',
  text: '#1C1917',
  textMuted: 'rgba(28,25,23,0.5)',
  textDim: 'rgba(28,25,23,0.35)',
  accent: '#EF4444',
  accentBrand: '#D8393D',
  accentMuted: '#FF5555',
  accentDark: '#FCA5A5',
  destructive: '#DC2626',
  overlay: 'rgba(0,0,0,0.5)',
  success: '#10B981',
  warning: '#F59E0B',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 24,
} as const;

export const FONT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export type ThemeName = 'dark' | 'light';
export type ColorPalette = typeof DARK;
