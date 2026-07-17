import type { CharacterId } from '@/src/content/characters';
import { colors } from './theme';

/**
 * Per-character accent hues — The Practice design system. Used ONLY on
 * a speaker label or a card's top hairline, never as a full-card tint:
 * five coaches with different philosophies earn subtly different
 * temperatures, and restraint is what keeps it a signature instead of
 * noise. Everyone without an entry (nutrition specialists, dormant and
 * retired trainers) reads in the muted warm gray.
 */
const CHARACTER_HUE: Partial<Record<CharacterId, string>> = {
  kael: '#7C9BB3', // steel blue — operations
  sera: '#B39DC9', // lilac — presence
  cassidy: '#DFAE55', // amber — slow & sustainable
  renata: '#8D99A6', // slate — strength minimalist
  marcus: '#D07A45', // ember — conditioning
  priya: '#97B291', // sage — adherence-first
  noa: '#B96560', // oxblood — twelve-week blocks
};

/** The character's accent hue, or the muted default for everyone else. */
export function hueFor(id: CharacterId | null | undefined): string {
  return (id && CHARACTER_HUE[id]) || colors.muted;
}
