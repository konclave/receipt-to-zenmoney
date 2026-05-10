import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackupStore } from './backup.store.svelte';

describe('createBackupStore', () => {
  const repo = {
    exportBackup: vi.fn(),
    importBackup: vi.fn(),
  };
  const effects = {
    refreshStats: vi.fn(),
  };

  beforeEach(() => {
    repo.exportBackup.mockReset();
    repo.importBackup.mockReset();
    effects.refreshStats.mockReset();
    vi.restoreAllMocks();

    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it('updates status and refreshes stats after a successful import', async () => {
    repo.importBackup.mockResolvedValue({ imported: 3, skipped: 1 });

    const store = createBackupStore(repo, effects);
    const file = new File(['backup'], 'backup.rzm.gz', { type: 'application/gzip' });

    await store.importFile(file);

    expect(repo.importBackup).toHaveBeenCalledWith(file);
    expect(effects.refreshStats).toHaveBeenCalledTimes(1);
    expect(store.status).toBe('Imported 3 new, skipped 1 duplicate(s)');
    expect(store.error).toBeNull();
    expect(store.importing).toBe(false);
  });

  it('shares the exported backup when navigator share is available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const blob = new Blob(['backup'], { type: 'application/gzip' });
    repo.exportBackup.mockResolvedValue({ blob, count: 2 });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(true),
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      writable: true,
      value: share,
    });

    const store = createBackupStore(repo, effects);

    await store.exportAll();

    expect(repo.exportBackup).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledTimes(1);
    const [{ files, title }] = share.mock.calls[0];
    expect(title).toBe('Backup export');
    expect(files).toHaveLength(1);
    expect(files[0]).toBeInstanceOf(File);
    expect(files[0].name.endsWith('.rzm.gz')).toBe(true);
    expect(store.status).toBe('Exported 2 transaction(s)');
    expect(store.error).toBeNull();
    expect(store.exporting).toBe(false);
  });
});
