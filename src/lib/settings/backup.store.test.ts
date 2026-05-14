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

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00.000Z'));
  });

  function mockDownloadLink() {
    const click = vi.fn();
    const remove = vi.fn();
    const link = document.createElement('a');
    link.click = click;
    link.remove = remove;

    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(link);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    return {
      click,
      remove,
      createElement,
      createObjectURL,
      revokeObjectURL,
      link,
    };
  }

  it('updates status and refreshes stats after a successful import', async () => {
    repo.importBackup.mockResolvedValue({ imported: 3, skipped: 1 });

    const store = createBackupStore(repo, effects);
    const file = new File(['backup'], 'backup.rzm.gz', {
      type: 'application/gzip',
    });

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
    expect(title).toBe('Zenmoney Backup');
    expect(files).toHaveLength(1);
    expect(files[0]).toBeInstanceOf(File);
    expect(files[0].name).toBe('rzm-backup-2026-05-10.rzm.gz');
    expect(store.status).toBe('Exported 2 transaction(s)');
    expect(store.error).toBeNull();
    expect(store.exporting).toBe(false);
  });

  it('treats a share abort as a silent cancel without falling back to download', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
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
    const { createObjectURL } = mockDownloadLink();

    const store = createBackupStore(repo, effects);

    await store.exportAll();

    expect(share).toHaveBeenCalledTimes(1);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(store.status).toBeNull();
    expect(store.error).toBeNull();
    expect(store.exporting).toBe(false);
  });

  it('falls back to download when share fails for a non-abort reason', async () => {
    const share = vi.fn().mockRejectedValue(new Error('share failed'));
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
    const { click, createObjectURL, revokeObjectURL, link } = mockDownloadLink();

    const store = createBackupStore(repo, effects);

    await store.exportAll();

    expect(share).toHaveBeenCalledTimes(1);
    const [{ files, title }] = share.mock.calls[0];
    expect(title).toBe('Zenmoney Backup');
    expect(files[0].name).toBe('rzm-backup-2026-05-10.rzm.gz');
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(link.download).toBe('rzm-backup-2026-05-10.rzm.gz');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    expect(store.status).toBe('Exported 2 transaction(s)');
    expect(store.error).toBeNull();
  });
});
