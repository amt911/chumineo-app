export const MARKETPLACE_ERROR_CODES = {
  // Requested quantity exceeds the stock available to list (owned minus units
  // already reserved by the user's own active listings).
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  // Inventory change would drop below (or delete) units still reserved by the
  // user's own active listings.
  UNITS_RESERVED: 'UNITS_RESERVED',
} as const;

export type MarketplaceErrorCode =
  (typeof MARKETPLACE_ERROR_CODES)[keyof typeof MARKETPLACE_ERROR_CODES];
