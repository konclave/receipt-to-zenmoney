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

    // Version is rendered via AppFeedback component
    expect(settingsPage).toContain('AppFeedback');
    expect(settingsPage).toContain('data.appVersion');
  });

  it('links ZenMoney connect flow to the broker start endpoint', () => {
    const settingsPage = readFileSync(
      resolve(process.cwd(), 'src/routes/settings/+page.svelte'),
      'utf8',
    );

    expect(settingsPage).toContain('/api/zenmoney/oauth/start');
    expect(settingsPage).toContain('/api/zenmoney/logout');
  });

  it('keeps the manual ZenMoney token input available alongside OAuth', () => {
    const settingsPage = readFileSync(
      resolve(process.cwd(), 'src/routes/settings/+page.svelte'),
      'utf8',
    );

    expect(settingsPage).toContain('placeholder="Paste your ZenMoney token"');
    expect(settingsPage).toContain('/api/zenmoney/oauth/start');
    expect(settingsPage).toContain('PUBLIC_ZENMONEY_OAUTH_ENABLED');
  });
});
