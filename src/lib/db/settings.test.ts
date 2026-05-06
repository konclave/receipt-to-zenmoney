// src/lib/db/settings.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getSettings, saveSettings } from './settings';
import { _resetDb } from './index';

beforeEach(async () => {
  localStorage.clear();
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
    expect(s.zenmoneyToken).toBe('');
    expect(s.zenmoneyServerTimestamp).toBe(0);
    expect(s.zenmoneyAccountId).toBe('');
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
});
