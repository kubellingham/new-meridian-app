/**
 * Meridian design tokens — "The Practice" (Claude Design system,
 * project d0756814: warm ink + brass, serif-forward). Supersedes the
 * V1 placeholder cyan-on-navy from Master Brief §13. A good consulting
 * room at 8pm: warm, calm, credible. The brass accent keeps the old
 * rule — at most 2-3 accented elements per screen.
 */

/** Brand colour palette — exact values from the design tokens. Do not improvise. */
export const colors = {
  /** Warm ink — app background. Everything lives on this. */
  base: '#141210',
  /** Card background. */
  surface: '#1D1A17',
  /** Elevated panel — modals, bubbles, track fills. */
  panel: '#282320',
  /** Brass — THE accent, candlelight against ink. Max 2-3 uses per screen. */
  primary: '#D9A441',
  /** Text on brass fills (primary buttons, hold bar past the fill line). */
  onPrimary: '#1C1608',
  /** Worn bronze — secondary emphasis, quiet fills. */
  secondary: '#8C7B65',
  /** Warm paper — primary text. */
  text: '#F4EFE6',
  /** Warm gray — secondary text, labels, timestamps (AA at caption size). */
  muted: '#9A8F80',
  /** Muted sage — streaks, goal completions. Never neon. */
  success: '#8BA888',
  /** Clay — missed targets, gentle alerts. */
  warning: '#C97F5D',
  /** Quiet red — errors and critical alerts only. */
  error: '#C4635B',
  /** Hairline border for cards. */
  border: 'rgba(154, 143, 128, 0.22)',
  /** Stronger outline — secondary buttons, chips, the hold track. */
  borderStrong: 'rgba(154, 143, 128, 0.38)',
} as const;

/** Spacing scale (px). Use these instead of magic numbers. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Corner radii. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/**
 * Font families as registered with expo-font in the root layout.
 * Playfair Display is reserved for hero numbers and key data moments only;
 * DM Sans carries everything else (brief §13, Typography).
 */
export const fonts = {
  hero: 'PlayfairDisplay_700Bold',
  heroMedium: 'PlayfairDisplay_500Medium',
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
} as const;

/** Font size scale (px). */
export const fontSizes = {
  hero: 40,
  title: 24,
  subtitle: 18,
  body: 16,
  label: 14,
  caption: 12,
} as const;

/** Convenience bundle when a component wants the whole theme. */
export const theme = { colors, spacing, radius, fonts, fontSizes } as const;

export type Theme = typeof theme;
