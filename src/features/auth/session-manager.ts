import type { AccountRole, AuthenticatedUser, LoginResponse } from '../../types/domain';

export type SessionTokens = {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
};
export type SessionSnapshot =
  | { status: 'loading'; role: null }
  | { status: 'unauthenticated'; role: null }
  | { status: 'authenticated'; role: AccountRole };

export type SessionStorage = {
  read: () => Promise<SessionTokens | null>;
  write: (tokens: SessionTokens) => Promise<void>;
  clear: () => Promise<void>;
};
export type SessionEndpoints = {
  refresh: (refreshToken: string) => Promise<LoginResponse>;
  profile: (idToken: string) => Promise<{ user: AuthenticatedUser }>;
  logout: (idToken: string) => Promise<unknown>;
};
export type SessionHooks = {
  publish: (state: SessionSnapshot) => void;
  purge: () => void | Promise<void>;
};
export type SessionManagerOptions = {
  storage: SessionStorage;
  endpoints: SessionEndpoints;
  hooks: SessionHooks;
  now?: () => number;
};

function isActiveUser(user: AuthenticatedUser): user is AuthenticatedUser & { role: AccountRole } {
  return ['patient', 'doctor', 'admin'].includes(user.role)
    && user.status !== 'suspended' && user.status !== 'deleted';
}

function parseTokens(response: LoginResponse, now: number): SessionTokens {
  if (!response?.idToken || !response.refreshToken || !response.user?.id ||
      !Number.isFinite(response.expiresIn) || response.expiresIn <= 0 ||
      response.tokenType !== 'Bearer') {
    throw new Error('Réponse de session invalide.');
  }
  return {
    idToken: response.idToken,
    refreshToken: response.refreshToken,
    userId: response.user.id,
    expiresAt: now + response.expiresIn * 1000,
  };
}

/**
 * Domain-only orchestration; SecureStore is injected through SessionStorage.
 * No tokens are ever written to Zustand, navigation params, logs or AsyncStorage.
 */
export class SessionManager {
  private readonly options: SessionManagerOptions;
  private readonly now: () => number;
  private tokens: SessionTokens | null = null;
  private generation = 0;
  private state: SessionSnapshot = { status: 'loading', role: null };
  private refreshFlight: Promise<boolean> | null = null;
  private refreshGeneration = -1;
  private writeChain: Promise<void> = Promise.resolve();
  private bootFlight: Promise<void> | null = null;

  constructor(options: SessionManagerOptions) {
    this.options = options;
    this.now = options.now ?? Date.now;
    this.options.hooks.publish(this.state);
  }

  get snapshot(): SessionSnapshot { return this.state; }
  get sessionKey(): string { return String(this.generation); }
  get idToken(): string | null { return this.tokens?.idToken ?? null; }

  async validAccessToken(): Promise<string | null> {
    if (!this.tokens || this.state.status !== 'authenticated') return null;
    // Refresh before expiry; clock drift and latency are accounted for by 60s.
    if (this.tokens.expiresAt <= this.now() + 60_000) {
      if (!(await this.refresh())) return null;
    }
    return this.tokens?.idToken ?? null;
  }

  private publish(state: SessionSnapshot) {
    this.state = state;
    this.options.hooks.publish(state);
  }

  private enqueueWrite(operation: () => Promise<void>) {
    const result = this.writeChain.catch(() => undefined).then(operation);
    this.writeChain = result;
    return result;
  }

  /** Every session replacement invalidates all outstanding refresh responses. */
  private async clearForGeneration(expected: number) {
    if (this.generation !== expected) return;
    this.tokens = null;
    this.publish({ status: 'unauthenticated', role: null });
    await this.options.hooks.purge();
    // The epoch may have changed while waiting for a cache purge.
    if (this.generation !== expected) return;
    await this.enqueueWrite(() => this.generation === expected ? this.options.storage.clear() : Promise.resolve());
  }

  async clear(): Promise<void> {
    const epoch = ++this.generation;
    await this.clearForGeneration(epoch);
  }

  private async verifiedProfile(tokens: SessionTokens): Promise<AuthenticatedUser> {
    const profile = await this.options.endpoints.profile(tokens.idToken);
    if (!profile?.user || profile.user.id !== tokens.userId || !isActiveUser(profile.user)) {
      throw new Error('Compte inactif ou profil incohérent.');
    }
    return profile.user;
  }

  async login(response: LoginResponse, signal?: AbortSignal): Promise<void> {
    const epoch = ++this.generation;
    const candidate = parseTokens(response, this.now());
    this.tokens = null;
    this.publish({ status: 'loading', role: null });
    try {
      const user = await this.verifiedProfile(candidate);
      if (epoch !== this.generation) return;
      if (signal?.aborted) { await this.clear(); return; }
      // Persist BEFORE opening protected routes. A write failure means no session.
      await this.enqueueWrite(() => this.options.storage.write(candidate));
      if (epoch !== this.generation || signal?.aborted) {
        if (signal?.aborted && epoch === this.generation) await this.clear();
        return;
      }
      await this.options.hooks.purge();
      if (epoch !== this.generation) return;
      this.tokens = candidate;
      this.publish({ status: 'authenticated', role: user.role });
    } catch (error) {
      if (epoch === this.generation) await this.clear();
      throw error;
    }
  }

  bootstrap(): Promise<void> {
    if (this.bootFlight) return this.bootFlight;
    const epoch = this.generation;
    const flight = (async () => {
      this.publish({ status: 'loading', role: null });
      try {
        // Wait for any writes/clears before reading persistent data.
        await this.writeChain.catch(() => undefined);
        const stored = await this.options.storage.read();
        if (epoch !== this.generation) return;
        if (!stored) { this.publish({ status: 'unauthenticated', role: null }); return; }
        if (!stored.idToken || !stored.refreshToken || !stored.userId) throw new Error('Invalid stored session');
        this.tokens = stored;
        // Refresh on every cold start to check revocation and current account status.
        const refreshed = await this.refresh();
        if (epoch !== this.generation || !refreshed) return;
        const valid = this.tokens;
        if (!valid) return;
        const user = await this.verifiedProfile(valid);
        if (epoch !== this.generation) return;
        this.publish({ status: 'authenticated', role: user.role });
      } catch {
        if (epoch === this.generation) await this.clear();
      }
    })();
    const wrapped = flight.finally(() => { if (this.bootFlight === wrapped) this.bootFlight = null; });
    this.bootFlight = wrapped;
    return wrapped;
  }

  async refresh(): Promise<boolean> {
    const current = this.tokens;
    if (!current) return false;
    const epoch = this.generation;
    if (this.refreshFlight && this.refreshGeneration === epoch) return this.refreshFlight;
    const flight = (async () => {
      try {
        const result = await this.options.endpoints.refresh(current.refreshToken);
        if (epoch !== this.generation) return false;
        // A newer successful refresh may have rotated credentials.
        if (this.tokens?.refreshToken !== current.refreshToken) return this.tokens !== null;
        const next = parseTokens(result, this.now());
        if (next.userId !== current.userId || !isActiveUser(result.user)) throw new Error('Unexpected account in refresh.');
        await this.enqueueWrite(() => this.options.storage.write(next));
        if (epoch !== this.generation || this.tokens?.refreshToken !== current.refreshToken) return false;
        this.tokens = next;
        return true;
      } catch {
        if (epoch === this.generation && this.tokens?.refreshToken === current.refreshToken) {
          await this.clear();
        }
        return false;
      }
    })();
    this.refreshGeneration = epoch;
    this.refreshFlight = flight.finally(() => {
      if (this.refreshFlight === wrapped) this.refreshFlight = null;
    });
    const wrapped = this.refreshFlight;
    return wrapped;
  }

  async onUnauthorized(presentedToken: string | null): Promise<boolean> {
    if (!presentedToken || !this.tokens) return false;
    if (this.tokens.idToken !== presentedToken) {
      return this.state.status === 'authenticated';
    }
    return this.refresh();
  }

  async logout(): Promise<void> {
    const previousToken = this.tokens?.idToken ?? null;
    await this.clear(); // revoke local access immediately, even when offline
    if (previousToken) {
      try { await this.options.endpoints.logout(previousToken); }
      catch { /* Local logout is authoritative even if server is unreachable. */ }
    }
  }
}
