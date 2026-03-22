import {
  AppStorage,
  CustomProvidersStore,
  getAppStorage,
  ProviderKeysStore,
  SessionsStore,
  setAppStorage,
  SettingsStore,
} from "@mariozechner/pi-web-ui";
import type { StorageBackend, StorageTransaction } from "@mariozechner/pi-web-ui";

const PACKY_PROVIDER = "packyapi";

class MapTransaction implements StorageTransaction {
  constructor(private stores: Map<string, Map<string, unknown>>) {}

  async get<T = unknown>(storeName: string, key: string): Promise<T | null> {
    return (this.stores.get(storeName)?.get(key) as T | undefined) ?? null;
  }

  async set<T = unknown>(storeName: string, key: string, value: T): Promise<void> {
    if (!this.stores.has(storeName)) {
      this.stores.set(storeName, new Map());
    }
    this.stores.get(storeName)!.set(key, value);
  }

  async delete(storeName: string, key: string): Promise<void> {
    this.stores.get(storeName)?.delete(key);
  }
}

class MapStorageBackend implements StorageBackend {
  private stores = new Map<string, Map<string, unknown>>();

  private ensureStore(storeName: string): Map<string, unknown> {
    if (!this.stores.has(storeName)) {
      this.stores.set(storeName, new Map());
    }
    return this.stores.get(storeName)!;
  }

  async get<T = unknown>(storeName: string, key: string): Promise<T | null> {
    return (this.ensureStore(storeName).get(key) as T | undefined) ?? null;
  }

  async set<T = unknown>(storeName: string, key: string, value: T): Promise<void> {
    this.ensureStore(storeName).set(key, value);
  }

  async delete(storeName: string, key: string): Promise<void> {
    this.ensureStore(storeName).delete(key);
  }

  async keys(storeName: string, prefix?: string): Promise<string[]> {
    return [...this.ensureStore(storeName).keys()].filter((key) => (prefix ? key.startsWith(prefix) : true));
  }

  async getAllFromIndex<T = unknown>(storeName: string, indexName: string, direction: "asc" | "desc" = "asc"): Promise<T[]> {
    const values = [...this.ensureStore(storeName).values()] as T[];
    return values.sort((left, right) => {
      const a = (left as Record<string, unknown>)?.[indexName];
      const b = (right as Record<string, unknown>)?.[indexName];
      const order = String(a ?? "").localeCompare(String(b ?? ""));
      return direction === "asc" ? order : -order;
    });
  }

  async clear(storeName: string): Promise<void> {
    this.ensureStore(storeName).clear();
  }

  async has(storeName: string, key: string): Promise<boolean> {
    return this.ensureStore(storeName).has(key);
  }

  async transaction<T>(
    _storeNames: string[],
    _mode: "readonly" | "readwrite",
    operation: (tx: StorageTransaction) => Promise<T>,
  ): Promise<T> {
    return operation(new MapTransaction(this.stores));
  }

  async getQuotaInfo(): Promise<{ usage: number; quota: number; percent: number }> {
    return { usage: 0, quota: 0, percent: 0 };
  }

  async requestPersistence(): Promise<boolean> {
    return true;
  }
}

let initialized = false;

export async function ensurePiWebUiStorage(): Promise<void> {
  if (initialized) {
    return;
  }

  const backend = new MapStorageBackend();
  const settings = new SettingsStore();
  const providerKeys = new ProviderKeysStore();
  const sessions = new SessionsStore();
  const customProviders = new CustomProvidersStore();

  settings.setBackend(backend);
  providerKeys.setBackend(backend);
  sessions.setBackend(backend);
  customProviders.setBackend(backend);

  setAppStorage(new AppStorage(settings, providerKeys, sessions, customProviders, backend));

  initialized = true;
}

export async function syncPiProviderKey(apiKey: string): Promise<void> {
  if (!initialized) {
    await ensurePiWebUiStorage();
  }
  await getAppStorage().providerKeys.set(PACKY_PROVIDER, apiKey);
}
