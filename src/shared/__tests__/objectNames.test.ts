/**
 * Unit tests for the shared storage object-name generator
 * (src/shared/objectNames.ts). The security-relevant properties (portfolio
 * finding L2): the random segment is CSPRNG-derived, long, and unguessable, and
 * every call yields a distinct name so no upload overwrites another in place.
 *
 * The generated shape must also stay `{prefix}-{digits}-{lowercase-hex}.jpg` so
 * it continues to satisfy migration 0018's `chk_portfolio_image_url_folder`
 * (the barber-id folder prefix is added at the call site) and the format regexes
 * pinned in portfolioData.test.ts / verificationData.test.ts.
 */
import { uniqueObjectName } from '../objectNames';

const SHAPE = /^img-\d+-[0-9a-f]+\.jpg$/;

describe('uniqueObjectName', () => {
  it('produces {prefix}-{timestamp}-{lowercase-hex}.jpg', () => {
    const name = uniqueObjectName('img');
    expect(name).toMatch(SHAPE);
  });

  it('uses a long random token (>= 96 bits ⇒ >= 24 hex chars)', () => {
    const token = uniqueObjectName('img').split('-')[2].replace('.jpg', '');
    expect(token).toMatch(/^[0-9a-f]+$/);
    expect(token.length).toBeGreaterThanOrEqual(24);
  });

  it('preserves the caller prefix', () => {
    expect(uniqueObjectName('license')).toMatch(/^license-\d+-[0-9a-f]+\.jpg$/);
  });

  it('yields a distinct name on every call (no fixed path / no in-place overwrite)', () => {
    const names = new Set(Array.from({ length: 500 }, () => uniqueObjectName('img')));
    // 500 calls, 96 bits of entropy each — a collision would be astronomically
    // unlikely and would signal the token is not actually random.
    expect(names.size).toBe(500);
  });
});
