// src/lib/db/settings.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getSettings, saveSettings } from './settings';
import { _resetDb } from './index';

beforeEach(async () => {
  window.localStorage.clear();
  _resetDb();
  await new Promise<void>((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase('rzm');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
});

describe('getSettings', () => {
  it('returns empty defaults when nothing is saved', async () => {
    const s = await getSettings();
    expect(s.claudeApiKey).toBe('');
    expect(s.zenmoneyAuthMode).toBe('manual');
    expect(s.zenmoneyToken).toBe('');
    expect(s.zenmoneyAccessToken).toBe('');
    expect(s.zenmoneyAccessTokenExpiresAt).toBe(0);
    expect(s.zenmoneyServerTimestamp).toBe(0);
    expect(s.zenmoneyAccountId).toBe('');
  });
});

describe('getSettings defaults', () => {
  it('returns aiProvider anthropic by default', async () => {
    const s = await getSettings();
    expect(s.aiProvider).toBe('anthropic');
  });

  it('returns empty openrouterApiKey by default', async () => {
    const s = await getSettings();
    expect(s.openrouterApiKey).toBe('');
  });

  it('returns default openrouterModel by default', async () => {
    const s = await getSettings();
    expect(s.openrouterModel).toBe('anthropic/claude-sonnet-4.6');
  });
});

describe('saveSettings', () => {
  it('saves and decrypts claudeApiKey', async () => {
    await saveSettings({ claudeApiKey: 'sk-test-123' });
    expect((await getSettings()).claudeApiKey).toBe('sk-test-123');
  });

  it('saves and decrypts zenmoneyToken', async () => {
    await saveSettings({ zenmoneyToken: 'zm-token-abc' });
    expect((await getSettings()).zenmoneyToken).toBe('zm-token-abc');
  });

  it('saves zenmoneyServerTimestamp as number', async () => {
    await saveSettings({ zenmoneyServerTimestamp: 1746441600 });
    expect((await getSettings()).zenmoneyServerTimestamp).toBe(1746441600);
  });

  it('partial save does not overwrite unrelated fields', async () => {
    await saveSettings({ claudeApiKey: 'key-a', zenmoneyToken: 'token-b' });
    await saveSettings({ claudeApiKey: 'key-updated' });
    const s = await getSettings();
    expect(s.claudeApiKey).toBe('key-updated');
    expect(s.zenmoneyToken).toBe('token-b');
  });

  it('saves zenmoneyAuthMode', async () => {
    await saveSettings({ zenmoneyAuthMode: 'oauth' });
    expect((await getSettings()).zenmoneyAuthMode).toBe('oauth');
  });

  it('saves and decrypts zenmoneyAccessToken', async () => {
    await saveSettings({ zenmoneyAccessToken: 'oauth-access-token' });
    expect((await getSettings()).zenmoneyAccessToken).toBe('oauth-access-token');
  });

  it('saves zenmoneyAccessTokenExpiresAt', async () => {
    await saveSettings({ zenmoneyAccessTokenExpiresAt: 1746441600000 });
    expect((await getSettings()).zenmoneyAccessTokenExpiresAt).toBe(1746441600000);
  });
});

describe('saveSettings new fields', () => {
  it('saves and decrypts openrouterApiKey', async () => {
    await saveSettings({ openrouterApiKey: 'sk-or-abc' });
    expect((await getSettings()).openrouterApiKey).toBe('sk-or-abc');
  });

  it('saves aiProvider', async () => {
    await saveSettings({ aiProvider: 'openrouter' });
    expect((await getSettings()).aiProvider).toBe('openrouter');
  });

  it('saves openrouterModel', async () => {
    await saveSettings({ openrouterModel: 'openai/gpt-4o' });
    expect((await getSettings()).openrouterModel).toBe('openai/gpt-4o');
  });

  it('partial save does not overwrite openrouterApiKey', async () => {
    await saveSettings({ openrouterApiKey: 'sk-or-abc', aiProvider: 'openrouter' });
    await saveSettings({ claudeApiKey: 'sk-ant-updated' });
    const s = await getSettings();
    expect(s.openrouterApiKey).toBe('sk-or-abc');
    expect(s.aiProvider).toBe('openrouter');
  });
});
