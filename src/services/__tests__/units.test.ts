/** Unit conversions — round-trip sanity for the onboarding inputs. */

import { cmFromFtIn, ftInFromCm, kgFromLb, lbFromKg } from '../units';

describe('height', () => {
  it('converts ft+in to cm', () => {
    expect(cmFromFtIn(5, 9)).toBe(175);
    expect(cmFromFtIn(6, 0)).toBe(183);
  });

  it('converts cm to ft+in, carrying 12 inches', () => {
    expect(ftInFromCm(175)).toEqual({ ft: 5, inches: 9 });
    // 182.9 cm is 6'0" — the rounded 12 inches must carry, never show 5'12".
    expect(ftInFromCm(182.9)).toEqual({ ft: 6, inches: 0 });
  });

  it('round-trips within an inch', () => {
    for (const cm of [150, 163, 175, 188, 201]) {
      const { ft, inches } = ftInFromCm(cm);
      expect(Math.abs(cmFromFtIn(ft, inches) - cm)).toBeLessThanOrEqual(2);
    }
  });
});

describe('weight', () => {
  it('converts both ways at 0.1 precision', () => {
    expect(kgFromLb(203)).toBe(92.1);
    expect(lbFromKg(92)).toBe(202.8);
  });

  it('round-trips within 0.2 kg', () => {
    for (const kg of [50, 68.5, 92, 120.3]) {
      expect(Math.abs(kgFromLb(lbFromKg(kg)) - kg)).toBeLessThanOrEqual(0.2);
    }
  });
});
