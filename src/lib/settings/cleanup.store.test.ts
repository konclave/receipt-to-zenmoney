import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCleanupStore } from "./cleanup.store.svelte";

describe("createCleanupStore", () => {
  const repo = {
    getStorageStats: vi.fn(),
    exportBackupForPeriod: vi.fn(),
    deleteTransactionsByPeriod: vi.fn(),
    bulkDeleteReceiptImages: vi.fn(),
  };

  beforeEach(() => {
    repo.getStorageStats.mockReset();
    repo.exportBackupForPeriod.mockReset();
    repo.deleteTransactionsByPeriod.mockReset();
    repo.bulkDeleteReceiptImages.mockReset();
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00.000Z"));
  });

  function mockDownloadLink() {
    const click = vi.fn();
    const remove = vi.fn();
    const link = document.createElement("a");
    link.click = click;
    link.remove = remove;

    const createElement = vi
      .spyOn(document, "createElement")
      .mockReturnValue(link);
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});

    return {
      click,
      remove,
      createElement,
      createObjectURL,
      revokeObjectURL,
      link,
    };
  }

  it("builds the all-years cleanup target from the summed yearly counts and total bytes", () => {
    const store = createCleanupStore(repo, {
      totalBytes: 8_192,
      byYear: [
        { year: 2025, txCount: 3, bytes: 2_048 },
        { year: 2024, txCount: 4, bytes: 6_144 },
      ],
    });

    store.openCleanupModal();
    store.selectCleanupTarget("all");

    expect(store.cleanupModalOpen).toBe(false);
    expect(store.cleanupConfirmTarget).toEqual({
      period: "all",
      label: "all years",
      txCount: 7,
      bytes: 8_192,
    });
  });

  it("deletes transactions and receipt images, then refreshes stats", async () => {
    repo.deleteTransactionsByPeriod.mockResolvedValue(["tx-1", "tx-2"]);
    repo.bulkDeleteReceiptImages.mockResolvedValue(undefined);
    repo.getStorageStats.mockResolvedValue({
      totalBytes: 1_024,
      byYear: [{ year: 2025, txCount: 1, bytes: 1_024 }],
    });

    const store = createCleanupStore(repo, {
      totalBytes: 4_096,
      byYear: [{ year: 2025, txCount: 2, bytes: 4_096 }],
    });

    store.selectCleanupTarget(2025);
    await store.confirmCleanup({ withBackup: false });

    expect(repo.deleteTransactionsByPeriod).toHaveBeenCalledWith(2025);
    expect(repo.bulkDeleteReceiptImages).toHaveBeenCalledWith(["tx-1", "tx-2"]);
    expect(repo.getStorageStats).toHaveBeenCalledTimes(1);
    expect(store.storageStats).toEqual({
      totalBytes: 1_024,
      byYear: [{ year: 2025, txCount: 1, bytes: 1_024 }],
    });
    expect(store.cleanupConfirmTarget).toBeNull();
    expect(store.status).toBe("Deleted 2 transactions · freed ~4 KB");
    expect(store.error).toBeNull();
    expect(store.cleaning).toBe(false);
  });

  it("treats a refresh failure during confirmCleanup as an operation error", async () => {
    repo.deleteTransactionsByPeriod.mockResolvedValue(["tx-1", "tx-2"]);
    repo.bulkDeleteReceiptImages.mockResolvedValue(undefined);
    repo.getStorageStats.mockRejectedValue(new Error("stats failed"));

    const store = createCleanupStore(repo, {
      totalBytes: 4_096,
      byYear: [{ year: 2025, txCount: 2, bytes: 4_096 }],
    });

    store.selectCleanupTarget(2025);
    await store.confirmCleanup({ withBackup: false });

    expect(repo.deleteTransactionsByPeriod).toHaveBeenCalledWith(2025);
    expect(repo.bulkDeleteReceiptImages).toHaveBeenCalledWith(["tx-1", "tx-2"]);
    expect(repo.getStorageStats).toHaveBeenCalledTimes(1);
    expect(store.cleanupConfirmTarget).toEqual({
      period: 2025,
      label: "2025",
      txCount: 2,
      bytes: 4_096,
    });
    expect(store.status).toBeNull();
    expect(store.error).toBe("stats failed");
    expect(store.cleaning).toBe(false);
  });

  it("does not delete anything when backup share is canceled for all-years cleanup", async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException("cancelled", "AbortError"));
    const blob = new Blob(["backup"], { type: "application/gzip" });
    repo.exportBackupForPeriod.mockResolvedValue({ blob });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(true),
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      writable: true,
      value: share,
    });

    const store = createCleanupStore(repo, {
      totalBytes: 4_096,
      byYear: [{ year: 2025, txCount: 2, bytes: 4_096 }],
    });

    store.selectCleanupTarget("all");
    await store.confirmCleanup({ withBackup: true });

    expect(repo.exportBackupForPeriod).toHaveBeenCalledWith("all");
    const [{ files, title }] = share.mock.calls[0];
    expect(title).toBe("Zenmoney Backup");
    expect(files[0].name).toBe("rzm-backup-all-2026-05-10.rzm.gz");
    expect(repo.deleteTransactionsByPeriod).not.toHaveBeenCalled();
    expect(repo.bulkDeleteReceiptImages).not.toHaveBeenCalled();
    expect(store.cleanupConfirmTarget).toEqual({
      period: "all",
      label: "all years",
      txCount: 2,
      bytes: 4_096,
    });
    expect(store.status).toBeNull();
    expect(store.error).toBeNull();
    expect(store.cleaning).toBe(false);
  });

  it("falls back to download for yearly cleanup backup before deleting", async () => {
    const share = vi.fn().mockRejectedValue(new Error("share failed"));
    const blob = new Blob(["backup"], { type: "application/gzip" });
    repo.exportBackupForPeriod.mockResolvedValue({ blob });
    repo.deleteTransactionsByPeriod.mockResolvedValue(["tx-1"]);
    repo.bulkDeleteReceiptImages.mockResolvedValue(undefined);
    repo.getStorageStats.mockResolvedValue({
      totalBytes: 1_024,
      byYear: [{ year: 2025, txCount: 1, bytes: 1_024 }],
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(true),
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      writable: true,
      value: share,
    });
    const { click, createObjectURL, revokeObjectURL, link } =
      mockDownloadLink();

    const store = createCleanupStore(repo, {
      totalBytes: 4_096,
      byYear: [{ year: 2025, txCount: 2, bytes: 4_096 }],
    });

    store.selectCleanupTarget(2025);
    await store.confirmCleanup({ withBackup: true });

    expect(repo.exportBackupForPeriod).toHaveBeenCalledWith(2025);
    const [{ files, title }] = share.mock.calls[0];
    expect(title).toBe("Zenmoney Backup");
    expect(files[0].name).toBe("rzm-backup-2025.rzm.gz");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(link.download).toBe("rzm-backup-2025.rzm.gz");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    expect(repo.deleteTransactionsByPeriod).toHaveBeenCalledWith(2025);
    expect(store.status).toBe("Deleted 1 transactions · freed ~4 KB");
    expect(store.error).toBeNull();
  });
});
