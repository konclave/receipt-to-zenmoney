function toErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

async function shareOrDownloadBackup(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type || 'application/gzip' });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({
      files: [file],
      title: 'Backup export',
    });
    return;
  }

  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface BackupRepo {
  exportBackup(): Promise<{ blob: Blob; count: number }>;
  importBackup(file: File): Promise<{ imported: number; skipped: number }>;
}

interface BackupEffects {
  refreshStats(): Promise<void>;
}

export function createBackupStore(repo: BackupRepo, effects: BackupEffects) {
  let exporting = $state(false);
  let importing = $state(false);
  let status = $state<string | null>(null);
  let error = $state<string | null>(null);

  async function exportAll() {
    exporting = true;
    status = null;
    error = null;

    try {
      const { blob, count } = await repo.exportBackup();
      await shareOrDownloadBackup(blob, `receipt-to-zenmoney-${Date.now()}.rzm.gz`);
      status = `Exported ${count} transaction(s)`;
    } catch (cause) {
      status = null;
      error = toErrorMessage(cause);
    } finally {
      exporting = false;
    }
  }

  async function importFile(file: File) {
    importing = true;
    status = null;
    error = null;

    try {
      const { imported, skipped } = await repo.importBackup(file);
      await effects.refreshStats();
      status = `Imported ${imported} new, skipped ${skipped} duplicate(s)`;
    } catch (cause) {
      status = null;
      error = toErrorMessage(cause);
    } finally {
      importing = false;
    }
  }

  return {
    get exporting() {
      return exporting;
    },
    get importing() {
      return importing;
    },
    get status() {
      return status;
    },
    get error() {
      return error;
    },
    exportAll,
    importFile,
  };
}
