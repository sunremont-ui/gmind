import { Stronghold, Client } from '@tauri-apps/plugin-stronghold';
import { appLocalDataDir } from '@tauri-apps/api/path';

const VAULT_PASSWORD = 'gmind-vault';
const CLIENT_NAME = 'gmind';

let _stronghold: Stronghold | null = null;
let _client: Client | null = null;

const SECRET_KEYS = {
  yandexApiKey: 'yandex_api_key',
  yandexFolderId: 'yandex_folder_id',
  yandexModel: 'yandex_model',
  openAIApiKey: 'openai_api_key',
  openAIModel: 'openai_model',
  openAIEndpoint: 'openai_endpoint',
  ollamaEndpoint: 'ollama_endpoint',
} as const

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function getClient(): Promise<Client | null> {
  if (!isTauri()) return null;
  if (_client) return _client;
  try {
    const appDir = await appLocalDataDir();
    const vaultPath = `${appDir}/secrets.hold`;
    _stronghold = await Stronghold.load(vaultPath, VAULT_PASSWORD);
    try {
      _client = await _stronghold.loadClient(CLIENT_NAME);
    } catch {
      _client = await _stronghold.createClient(CLIENT_NAME);
    }
    return _client;
  } catch (e) {
    console.warn('[secrets] stronghold init failed:', e);
    return null;
  }
}

async function persist(): Promise<void> {
  if (_stronghold) await _stronghold.save();
}

export const secrets = {
  async store(key: string, value: string): Promise<void> {
    const client = await getClient();
    if (!client) return;
    try {
      const store = client.getStore();
      await store.insert(key, Array.from(new TextEncoder().encode(value)));
      await persist();
    } catch (e) {
      console.warn('[secrets] store failed:', e);
    }
  },

  async get(key: string): Promise<string | null> {
    const client = await getClient();
    if (!client) return null;
    try {
      const store = client.getStore();
      const data = await store.get(key);
      if (!data) return null;
      return new TextDecoder().decode(data);
    } catch (e) {
      console.warn('[secrets] get failed:', e);
      return null;
    }
  },

  async remove(key: string): Promise<void> {
    const client = await getClient();
    if (!client) return;
    try {
      const store = client.getStore();
      await store.remove(key);
      await persist();
    } catch (e) {
      console.warn('[secrets] remove failed:', e);
    }
  },

  // Yandex GPT
  async saveYandexConfig(apiKey: string, folderId: string, model: string) {
    await this.store(SECRET_KEYS.yandexApiKey, apiKey);
    await this.store(SECRET_KEYS.yandexFolderId, folderId);
    await this.store(SECRET_KEYS.yandexModel, model);
  },

  async loadYandexConfig(): Promise<{ apiKey: string; folderId: string; model: string } | null> {
    const apiKey = await this.get(SECRET_KEYS.yandexApiKey);
    const folderId = await this.get(SECRET_KEYS.yandexFolderId);
    const model = await this.get(SECRET_KEYS.yandexModel);
    if (!apiKey && !folderId && !model) return null;
    return { apiKey: apiKey || '', folderId: folderId || '', model: model || '' };
  },

  // OpenAI
  async saveOpenAIConfig(apiKey: string, endpoint: string, model: string) {
    await this.store(SECRET_KEYS.openAIApiKey, apiKey);
    await this.store(SECRET_KEYS.openAIEndpoint, endpoint);
    await this.store(SECRET_KEYS.openAIModel, model);
  },

  async loadOpenAIConfig(): Promise<{ apiKey: string; endpoint: string; model: string } | null> {
    const apiKey = await this.get(SECRET_KEYS.openAIApiKey);
    const endpoint = await this.get(SECRET_KEYS.openAIEndpoint);
    const model = await this.get(SECRET_KEYS.openAIModel);
    if (!apiKey && !endpoint && !model) return null;
    return { apiKey: apiKey || '', endpoint: endpoint || '', model: model || '' };
  },
}
