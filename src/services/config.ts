/** Public, non-secret build configuration for the API client (prompt 05). */
export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, '') ?? '';

export function getApiBaseUrl(): string {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL doit être configurée.');
  }
  if (!/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(apiBaseUrl)) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL doit être une URL HTTPS valide.');
  }
  return apiBaseUrl;
}
