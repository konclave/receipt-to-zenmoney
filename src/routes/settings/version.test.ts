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

    expect(settingsPage).toContain('App Version');
    expect(settingsPage).toContain('data.appVersion');
  });
});
