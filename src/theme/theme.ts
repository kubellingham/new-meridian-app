/**
 * Meridian design tokens — Master Brief v2.0, Section 13.
 *
 * Design principle (locked): restrained, functional dark UI. The electric
 * cyan accent is used sparingly — at most 2-3 elements per screen. No
 * attempt at a distinctive visual identity in V1; a designer refines
 * post-launch.
 */

/** Brand colour palette — exact values from the brief. Do not improvise. */
export const colors = {
  /** Near-black app background. Everything lives on this. */
  base: '#080E1A',
  /** Dark panel — card backgrounds. */
  surface: '#111827',
  /** Elevated dark — modals, bubbles, raised panels. */
  panel: '#1C2740',
  /** Electric cyan — THE accent. Max 2-3 elements per screen. */
  primary: '#00D4FF',
  /** Deep blue — secondary accent, links, passive data. */
  secondary: '#0A84FF',
  /** Cool off-white — primary text. */
  text: '#F0F4FF',
  /** Gray-blue — secondary text, labels, timestamps. */
  muted: '#6B7FA3',
  /** Achievement green — PRs, streaks, goal completions. */
  success: '#00C896',
  /** Amber — missed targets, gentle alerts. */
  warning: '#FFB020',
  /** Red — errors and critical alerts only. */
  error: '#FF4545',
  /** Subtle border for cards on the base background. */
  border: 'rgba(107, 127, 163, 0.18)',
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
