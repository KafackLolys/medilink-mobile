import { getApiBaseUrl } from './config';
import { createHttpClient, type HttpRequestOptions } from './http-client';

/**
 * SessionManager supplies access tokens via its SecureStore-backed lifecycle.
 * This module deliberately never stores or logs credentials.
 */
let accessTokenProvider: (() => string | null | Promise<string | null>) | null = null;
let unauthorizedHandler: ((presentedToken: string | null) => boolean | Promise<boolean>) | null = null;
let sessionKeyProvider: (() => string) | null = null;
let retryUnauthorizedHandler: ((token: string | null) => void | Promise<void>) | null = null;

export function configureHttpAuth(options: {
  getAccessToken: () => string | null | Promise<string | null>;
  onUnauthorized?: (presentedToken: string | null) => boolean | Promise<boolean>;
  getSessionKey?: () => string;
  onRetryUnauthorized?: (token: string | null) => void | Promise<void>;
}): void {
  accessTokenProvider = options.getAccessToken;
  unauthorizedHandler = options.onUnauthorized ?? null;
  sessionKeyProvider = options.getSessionKey ?? null;
  retryUnauthorizedHandler = options.onRetryUnauthorized ?? null;
}

export function resetHttpAuth(): void {
  accessTokenProvider = null;
  unauthorizedHandler = null;
  sessionKeyProvider = null;
  retryUnauthorizedHandler = null;
}

let client: ReturnType<typeof createHttpClient> | null = null;
function getClient() {
  return client ?? (client = createHttpClient({
    baseUrl: getApiBaseUrl(),
    getAccessToken: () => accessTokenProvider?.() ?? null,
    onUnauthorized: token => unauthorizedHandler?.(token) ?? false,
    getSessionKey: () => sessionKeyProvider?.() ?? 'guest',
    onRetryUnauthorized: token => retryUnauthorizedHandler?.(token),
  }));
}

export function apiRequest<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
  return getClient().request<T>(path, options);
}

export { HttpError, classifyStatus, makeMultipart } from './http-client';
export type { HttpRequestOptions, HttpMethod, NativeUploadFile } from './http-client';
