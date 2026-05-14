import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('settings section components', () => {
  it('hides default-account controls when there is only one account', () => {
    const section = readFileSync(
      resolve(process.cwd(), 'src/lib/components/settings/ZenMoneyDataSection.svelte'),
      'utf8',
    );
    const guardedDefaultAccountControls =
      /\{#if store\.hasMultipleAccounts\}[\s\S]*Default Account[\s\S]*id="account"[\s\S]*\{\/if\}/;

    expect(section).toContain('Categories');
    expect(section).toMatch(guardedDefaultAccountControls);
  });
});

describe('settings route composition', () => {
  it('uses the page store and extracted section components instead of inline workflows', () => {
    const settingsPage = readFileSync(
      resolve(process.cwd(), 'src/routes/settings/+page.svelte'),
      'utf8',
    );

    expect(settingsPage).toContain('createSettingsPageStore');
    expect(settingsPage).toContain('AiSettingsSection');
    expect(settingsPage).toContain('ZenmoneyConnectionSection');
    expect(settingsPage).toContain('ZenmoneyDataSection');
    expect(settingsPage).toContain('BackupRestoreSection');
    expect(settingsPage).toContain('StorageCleanupSection');
    expect(settingsPage).not.toContain('handleReloadCategories');
    expect(settingsPage).not.toContain('handleCleanupConfirm');
    expect(settingsPage).not.toContain('https://openrouter.ai/api/v1/models');
  });
});
