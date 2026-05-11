import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import packageJson from '../../../package.json';
import { load } from './+page';

describe('settings version info', () => {
  it('loads the app version from package.json', async () => {
    await expect(load()).resolves.toEqual({ appVersion: packageJson.version });
  });

  it('renders an app version section on the settings screen', () => {
    const settingsPage = readFileSync(
      resolve(process.cwd(), 'src/routes/settings/+page.svelte'),
      'utf8',
    );

    expect(settingsPage).toContain('AppFeedback');
    expect(settingsPage).toContain('data.appVersion');
  });

  it('creates the refactored settings page store with OAuth configuration', () => {
    const settingsPage = readFileSync(
      resolve(process.cwd(), 'src/routes/settings/+page.svelte'),
      'utf8',
    );

    expect(settingsPage).toContain('createSettingsPageStore');
    expect(settingsPage).toContain('PUBLIC_ZENMONEY_OAUTH_ENABLED');
    expect(settingsPage).toContain('oauthEnabled');
    expect(settingsPage).toContain('page.load()');
  });

  it('renders the extracted settings sections in the route shell', () => {
    const settingsPage = readFileSync(
      resolve(process.cwd(), 'src/routes/settings/+page.svelte'),
      'utf8',
    );

    expect(settingsPage).toContain('AiSettingsSection');
    expect(settingsPage).toContain('ZenMoneyConnectionSection');
    expect(settingsPage).toContain('ZenMoneyDataSection');
    expect(settingsPage).toContain('BackupRestoreSection');
    expect(settingsPage).toContain('StorageCleanupSection');
    expect(settingsPage).not.toContain('handleReloadCategories');
    expect(settingsPage).not.toContain('handleCleanupConfirm');
  });
});
