import { getApiBaseUrl } from './config';
import { createHttpClient, type HttpRequestOptions } from './http-client';

/**
 * Inject the verified token provider during the auth implementation (prompt 07).
 * This module deliberately does not persist or synthesize credentials.
 */
let accessTokenProvider: (() => string | null | Promise<string | null>) | null = null;
let unauthorizedHandler: ((presentedToken: string | null) => boolean | Promise<boolean>) | null = null;
let sessionKeyProvider: (() => string) | null = null;

export function configureHttpAuth(options: {
  getAccessToken: () => string | null | Promise<string | null>;
  onUnauthorized?: (presentedToken: string | null) => boolean | Promise<boolean>;
  getSessionKey?: () => string;
}): void {
  accessTokenProvider = options.getAccessToken;
  unauthorizedHandler = options.onUnauthorized ?? null;
  sessionKeyProvider = options.getSessionKey ?? null;
}

export function resetHttpAuth(): void {
  accessTokenProvider = null;
  unauthorizedHandler = null;
  sessionKeyProvider = null;
}

let client: ReturnType<typeof createHttpClient> | null = null;
function getClient() {
  return client ?? (client = createHttpClient({
    baseUrl: getApiBaseUrl(),
    getAccessToken: () => accessTokenProvider?.() ?? null,
    onUnauthorized: token => unauthorizedHandler?.(token) ?? false,
    getSessionKey: () => sessionKeyProvider?.() ?? 'guest',
  }));
}

export function apiRequest<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
  return getClient().request<T>(path, options);
}

export { HttpError, classifyStatus, makeMultipart } from './http-client';
export type { HttpRequestOptions, HttpMethod, NativeUploadFile } from './http-client';
