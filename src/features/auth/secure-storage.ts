import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { SessionStorage, SessionTokens } from './session-manager';

const KEY = 'medilink.session.v1';
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: 'medilink-auth',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function ensureAvailable() {
  // Intentionally no web or AsyncStorage fallback for medical credentials.
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    throw new Error('Stockage sécurisé indisponible sur cette plateforme.');
  }
  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error('Le stockage sécurisé natif est indisponible.');
  }
}

export const secureSessionStorage: SessionStorage = {
  async read() {
    await ensureAvailable();
    const text = await SecureStore.getItemAsync(KEY, OPTIONS);
    if (!text) return null;
    try {
      const value: unknown = JSON.parse(text);
      if (!value || typeof value !== 'object') throw new Error('Invalid stored session');
      const data = value as Record<string, unknown>;
      if (typeof data.idToken !== 'string' || !data.idToken ||
          typeof data.refreshToken !== 'string' || !data.refreshToken ||
          typeof data.userId !== 'string' || !data.userId ||
          typeof data.expiresAt !== 'number' || !Number.isFinite(data.expiresAt)) {
        throw new Error('Invalid stored session');
      }
      return data as unknown as SessionTokens;
    } catch {
      await SecureStore.deleteItemAsync(KEY, OPTIONS);
      return null;
    }
  },
  async write(tokens) {
    await ensureAvailable();
    await SecureStore.setItemAsync(KEY, JSON.stringify(tokens), OPTIONS);
  },
  async clear() {
    await ensureAvailable();
    await SecureStore.deleteItemAsync(KEY, OPTIONS);
  },
};
