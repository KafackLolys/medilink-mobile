import { abortableDelay, retryDecision, type RetryPolicy } from '../features/network/network-policy.ts';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type HttpErrorKind =
  | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'validation'
  | 'server' | 'http' | 'network' | 'timeout' | 'cancelled' | 'invalid_response';

export class HttpError extends Error {
  readonly kind: HttpErrorKind;
  readonly status: number | null;
  readonly details: unknown;

  constructor(message: string, kind: HttpErrorKind, status: number | null = null, details: unknown = undefined) {
    super(message);
    this.name = 'HttpError';
    this.kind = kind;
    this.status = status;
    this.details = details;
  }
}

export type TokenProvider = () => string | null | undefined | Promise<string | null | undefined>;
export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  getAccessToken?: TokenProvider;
  onUnauthorized?: (presentedToken: string | null) => boolean | Promise<boolean>;
  getSessionKey?: () => string;
  onRetryUnauthorized?: (token: string | null) => void | Promise<void>;
}

export type HttpRequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  formData?: FormData;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  authenticated?: boolean;
  headers?: Record<string, string>;
  /** Never implicit. Opt in only for GET endpoints without side effects. */
  retryPolicy?: RetryPolicy;
};

const statusKinds: Record<number, HttpErrorKind> = {
  401: 'unauthorized', 403: 'forbidden', 404: 'not_found',
  409: 'conflict', 422: 'validation', 500: 'server',
};

export function classifyStatus(status: number): HttpErrorKind {
  return statusKinds[status] ?? (status >= 500 ? 'server' : 'http');
}

function messageForStatus(status: number): string {
  switch (status) {
    case 401: return 'Session expirée ou authentification requise.';
    case 403: return 'Accès non autorisé.';
    case 404: return 'Ressource introuvable.';
    case 409: return 'Conflit avec les données actuelles.';
    case 422: return 'Certaines données ne sont pas valides.';
    default: return status >= 500 ? 'Le serveur est momentanément indisponible.' : 'La requête a échoué.';
  }
}

function extractMessage(payload: unknown, status: number): string {
  if (typeof payload !== 'object' || payload === null) return messageForStatus(status);
  const data = payload as { message?: unknown; error?: unknown };
  if (Array.isArray(data.message)) {
    const values = data.message.filter((value): value is string => typeof value === 'string');
    if (values.length) return values.join(', ');
  }
  if (typeof data.message === 'string' && data.message.trim()) return data.message;
  if (typeof data.error === 'string' && data.error.trim()) return data.error;
  return messageForStatus(status);
}

function validateBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) throw new Error('API base URL doit commencer par https:// ou http://.');
  const url = new URL(trimmed);
  if (url.username || url.password || url.search || url.hash) throw new Error('URL API invalide : identifiants et paramètres interdits.');
  return trimmed;
}

export function createHttpClient(options: HttpClientOptions) {
  const baseUrl = validateBaseUrl(options.baseUrl);
  const fetcher = options.fetchImpl ?? fetch;
  const defaultTimeoutMs = options.timeoutMs ?? 15000;

  async function request<T>(path: string, config: HttpRequestOptions = {}): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('#')) {
      throw new Error('Le chemin API doit être relatif et commencer par un seul /.');
    }
    const url = new URL(baseUrl + path);
    for (const [key, value] of Object.entries(config.query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    const controller = new AbortController();
    const signal = config.signal;
    if (signal?.aborted) throw new HttpError('Requête annulée.', 'cancelled');
    let timedOut = false;
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    const timeout = config.timeoutMs ?? defaultTimeoutMs;
    if (!Number.isFinite(timeout) || timeout <= 0) {
      signal?.removeEventListener('abort', cancel);
      throw new Error('timeoutMs doit être positif et fini.');
    }
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeout);

    try {
      if (config.formData && config.body !== undefined) {
        throw new Error('body et formData ne peuvent pas être utilisés ensemble.');
      }
      const headers: Record<string, string> = { Accept: 'application/json', ...config.headers };
      if (config.formData) {
        delete headers['Content-Type'];
        delete headers['content-type'];
      } else if (config.body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }
      const sessionKey = options.getSessionKey?.();
      let presentedToken: string | null = null;
      if (config.authenticated !== false) {
        presentedToken = (await options.getAccessToken?.()) ?? null;
        if (presentedToken) headers.Authorization = 'Bearer ' + presentedToken;
        if (sessionKey !== options.getSessionKey?.()) {
          throw new HttpError('La session a changé pendant la requête.', 'cancelled');
        }
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        if (controller.signal.aborted) throw new HttpError(timedOut ? 'Délai de connexion dépassé.' : 'Requête annulée.', timedOut ? 'timeout' : 'cancelled');
        const response = await fetcher(url.toString(), {
          method: config.method ?? 'GET',
          headers,
          body: config.formData ?? (config.body === undefined ? undefined : JSON.stringify(config.body)),
          signal: controller.signal,
        });
        const raw = response.status === 204 ? '' : await response.text();
        let payload: unknown;
        if (raw) {
          try { payload = JSON.parse(raw); }
          catch {
            if (response.ok) throw new HttpError('Réponse JSON du serveur invalide.', 'invalid_response', response.status);
            payload = undefined;
          }
        }
        if (config.authenticated !== false && sessionKey !== options.getSessionKey?.()) {
          throw new HttpError('La session a changé pendant la réponse.', 'cancelled');
        }
        if (response.ok) return payload as T;
        const failure = new HttpError(extractMessage(payload, response.status), classifyStatus(response.status), response.status, payload);
        if (response.status === 401 && attempt > 0 && config.authenticated !== false) {
          try { await options.onRetryUnauthorized?.(presentedToken); } catch { /* Preserve 401. */ }
        }
        if (response.status !== 401 || config.authenticated === false || attempt > 0 || !presentedToken) throw failure;
        let restored = false;
        try { restored = (await options.onUnauthorized?.(presentedToken)) ?? false; }
        catch { restored = false; }
        if (!restored || controller.signal.aborted || sessionKey !== options.getSessionKey?.()) throw failure;
        const fresh = (await options.getAccessToken?.()) ?? null;
        if (!fresh || fresh === presentedToken || sessionKey !== options.getSessionKey?.()) throw failure;
        presentedToken = fresh;
        headers.Authorization = 'Bearer ' + fresh;
      }
      throw new HttpError('Requête non autorisée.', 'unauthorized', 401);

    } catch (cause) {
      if (cause instanceof HttpError) throw cause;
      if (timedOut) throw new HttpError('Délai de connexion dépassé.', 'timeout');
      if (signal?.aborted || controller.signal.aborted) throw new HttpError('Requête annulée.', 'cancelled');
      throw new HttpError('Impossible de joindre le serveur. Vérifiez votre connexion.', 'network');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }

  async function resilientRequest<T>(path: string, config: HttpRequestOptions = {}): Promise<T> {
    const method=config.method??'GET';
    if(config.retryPolicy==='safe-get'&&method!=='GET')
      throw new Error('Un retry automatique est autorisé uniquement sur une lecture GET explicite.');
    const identity=options.getSessionKey?.();
    let attempt=0;
    for(;;){
      if(config.signal?.aborted)throw new HttpError('Requête annulée.','cancelled');
      if(identity!==options.getSessionKey?.())
        throw new HttpError('La session a changé.','cancelled');
      try{
        return await request<T>(path,config);
      }catch(error){
        if(!(error instanceof HttpError))throw error;
        if(config.signal?.aborted||identity!==options.getSessionKey?.())
          throw new HttpError('Requête annulée.','cancelled');
        const decision=retryDecision({method,policy:config.retryPolicy??'none',
          attempt,kind:error.kind,status:error.status,cancelled:error.kind==='cancelled'});
        if(!decision.retry)throw error;
        attempt++;
        try{await abortableDelay(decision.delayMs,config.signal??new AbortController().signal);}
        catch{throw new HttpError('Requête annulée.','cancelled');}
      }
    }
  }

  return { request: resilientRequest };
}

/**
 * React Native FormData accepts a file descriptor with uri, name and type.
 * The cast is localised here; native FormData uploads the file from its URI.
 */
export type NativeUploadFile = { uri: string; name: string; type: string };
export function makeMultipart(fields: Record<string, string>, files: Array<{ field: string; file: NativeUploadFile }> = []): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  for (const { field, file } of files) {
    form.append(field, file as unknown as Blob);
  }
  return form;
}
