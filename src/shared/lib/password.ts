/**
 * Generate a secure random password that satisfies the backend password policy.
 *
 * Policy (server/src/controllers/userController.ts validatePasswordPolicy):
 *   - minimum length (default 8, configurable via settings)
 *   - at least 1 uppercase letter
 *   - at least 1 lowercase letter
 *   - at least 1 digit
 *
 * We generate 12 characters and also include special characters for extra
 * strength. Ambiguous characters (O/0, I/l/1) are excluded for readability.
 */
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SPECIAL = '!@#$%^&*-_=+';
const ALL = UPPER + LOWER + DIGITS + SPECIAL;

/** Cryptographically-secure random integer in [0, max). */
function secureRandomInt(max: number): number {
  const array = new Uint32Array(1);
  // Reject values that would introduce modulo bias
  const range = 2 ** 32;
  const limit = range - (range % max);
  let value: number;
  do {
    crypto.getRandomValues(array);
    value = array[0];
  } while (value >= limit);
  return value % max;
}

export function generateRandomPassword(length = 12): string {
  const chars: string[] = [];

  // Guarantee at least one character from each required category
  chars.push(UPPER[secureRandomInt(UPPER.length)]);
  chars.push(LOWER[secureRandomInt(LOWER.length)]);
  chars.push(DIGITS[secureRandomInt(DIGITS.length)]);
  chars.push(SPECIAL[secureRandomInt(SPECIAL.length)]);

  // Fill the rest with random picks from the full pool
  for (let i = chars.length; i < length; i++) {
    chars.push(ALL[secureRandomInt(ALL.length)]);
  }

  // Fisher-Yates shuffle so the guaranteed chars aren't always at the start
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}