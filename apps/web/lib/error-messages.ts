import {
  AUTH_ERROR_CODES,
  MARKETPLACE_ERROR_CODES,
  type AuthErrorCode,
  type MarketplaceErrorCode,
} from '@sobrebox/shared';

export type ErrorMessageKey =
  | `Errors.${AuthErrorCode | MarketplaceErrorCode}`
  | 'Errors.UNKNOWN';

const KNOWN = new Set<string>([
  ...Object.values(AUTH_ERROR_CODES),
  ...Object.values(MARKETPLACE_ERROR_CODES),
]);

// Map an API error code (or any thrown message) to a translation key.
// Known auth codes -> `Errors.<code>`; anything else -> `Errors.UNKNOWN`.
export function errorMessageKey(code: string): ErrorMessageKey {
  return (
    KNOWN.has(code) ? `Errors.${code}` : 'Errors.UNKNOWN'
  ) as ErrorMessageKey;
}
