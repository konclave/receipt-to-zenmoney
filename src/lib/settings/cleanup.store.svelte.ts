import { formatBytes, type StorageStats } from '$lib/services/storage-stats';

function toErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function isAbortError(cause: unknown): boolean {
  return (
    typeof cause === 'object' && cause !== null && 'name' in cause && cause.name === 'AbortError'
  );
}

function getBackupDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function shareOrDownloadBackup(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, {
    type: blob.type || 'application/gzip',
  });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: 'Zenmoney Backup',
      });
      return true;
    } catch (cause) {
      if (isAbortError(cause)) {
        return false;
      }
    }
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

  return true;
}

interface CleanupRepo {
  getStorageStats(): Promise<StorageStats>;
  exportBackupForPeriod(period: number | 'all'): Promise<{ blob: Blob }>;
  deleteTransactionsByPeriod(period: number | 'all'): Promise<string[]>;
  bulkDeleteReceiptImages(ids: string[]): Promise<void>;
}

interface CleanupConfirmTarget {
  period: number | 'all';
  label: string;
  txCount: number;
  bytes: number;
}

export function createCleanupStore(repo: CleanupRepo, initialStats: StorageStats | null = null) {
  let storageStats = $state<StorageStats | null>(initialStats);
  let cleanupModalOpen = $state(false);
  let cleanupConfirmTarget = $state<CleanupConfirmTarget | null>(null);
  let loadingStats = $state(false);
  let cleaning = $state(false);
  let status = $state<string | null>(null);
  let error = $state<string | null>(null);

  async function refreshStats(options: { throwOnError?: boolean } = {}) {
    loadingStats = true;
    error = null;

    try {
      storageStats = await repo.getStorageStats();
    } catch (cause) {
      error = toErrorMessage(cause);
      if (options.throwOnError) {
        throw cause;
      }
    } finally {
      loadingStats = false;
    }
  }

  function openCleanupModal() {
    cleanupModalOpen = true;
  }

  function closeModals() {
    cleanupModalOpen = false;
    cleanupConfirmTarget = null;
  }

  function selectCleanupTarget(period: number | 'all') {
    cleanupModalOpen = false;

    if (!storageStats) {
      cleanupConfirmTarget = null;
      return;
    }

    if (period === 'all') {
      cleanupConfirmTarget = {
        period: 'all',
        label: 'all years',
        txCount: storageStats.byYear.reduce((sum, year) => sum + year.txCount, 0),
        bytes: storageStats.totalBytes,
      };
      return;
    }

    const yearStats = storageStats.byYear.find((entry) => entry.year === period);
    cleanupConfirmTarget = yearStats
      ? {
          period,
          label: String(period),
          txCount: yearStats.txCount,
          bytes: yearStats.bytes,
        }
      : null;
  }

  async function confirmCleanup({ withBackup }: { withBackup: boolean }) {
    if (!cleanupConfirmTarget) return;

    cleaning = true;
    status = null;
    error = null;
    const target = cleanupConfirmTarget;

    try {
      if (withBackup) {
        const { blob } = await repo.exportBackupForPeriod(target.period);
        const filename =
          target.period === 'all'
            ? `rzm-backup-all-${getBackupDate()}.rzm.gz`
            : `rzm-backup-${target.period}.rzm.gz`;
        const completed = await shareOrDownloadBackup(blob, filename);
        if (!completed) return;
      }

      const deletedIds = await repo.deleteTransactionsByPeriod(target.period);
      await repo.bulkDeleteReceiptImages(deletedIds);
      await refreshStats({ throwOnError: true });
      cleanupConfirmTarget = null;
      status = `Deleted ${deletedIds.length} transactions · freed ~${formatBytes(target.bytes)}`;
    } catch (cause) {
      status = null;
      error = toErrorMessage(cause);
    } finally {
      cleaning = false;
    }
  }

  return {
    get storageStats() {
      return storageStats;
    },
    get cleanupModalOpen() {
      return cleanupModalOpen;
    },
    get cleanupConfirmTarget() {
      return cleanupConfirmTarget;
    },
    get loadingStats() {
      return loadingStats;
    },
    get cleaning() {
      return cleaning;
    },
    get status() {
      return status;
    },
    get error() {
      return error;
    },
    refreshStats,
    openCleanupModal,
    closeModals,
    selectCleanupTarget,
    confirmCleanup,
  };
}
