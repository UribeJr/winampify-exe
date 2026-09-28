// Same-origin by default: Vite proxies /api, /login, /callback and /refresh_token in dev,
// and Express serves both the API and the build in production.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export const STORAGE_KEYS = {
  refreshToken: 'spotify_refresh_token',
  accessToken: 'winampify_access_token',
  tokenExpiry: 'winampify_token_expiry'
};
