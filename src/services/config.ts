/**
 * EXPO_PUBLIC_API_BASE_URL is bundled into the app: it is never a secret.
 * Production must use HTTPS. Development may use local HTTP on emulator/LAN.
 */
export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';

export function getApiBaseUrl(): string {
  if (!apiBaseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL doit être configurée.');
  let url: URL;
  try { url = new URL(apiBaseUrl); } catch { throw new Error('EXPO_PUBLIC_API_BASE_URL invalide.'); }
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (url.protocol !== 'https:' && !(isDev && url.protocol === 'http:')) {
    throw new Error('Une URL HTTPS est requise hors développement.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL ne doit contenir ni secrets ni paramètres.');
  }
  if (!isDev && /^(localhost|127\.0\.0\.1|10\.0\.2\.2)$/i.test(url.hostname)) {
    throw new Error('Une adresse locale ne peut pas être utilisée en production.');
  }
  return apiBaseUrl;
}
