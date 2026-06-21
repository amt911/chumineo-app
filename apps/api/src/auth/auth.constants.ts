export const AUTH = {
  accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? '7'),
  rememberDays: Number(process.env.JWT_REFRESH_REMEMBER_DAYS ?? '30'),
  lockoutMax: Number(process.env.LOCKOUT_MAX_ATTEMPTS ?? '5'),
  lockoutWindowMin: Number(process.env.LOCKOUT_WINDOW_MIN ?? '15'),
} as const;
