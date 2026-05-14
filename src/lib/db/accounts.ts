import { getDb } from "./index";
import type { ZenmoneyAccount } from "$lib/types";

export async function getAccounts(): Promise<ZenmoneyAccount[]> {
  const db = await getDb();
  return db.getAll("accounts");
}

export async function saveAccounts(accounts: ZenmoneyAccount[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("accounts", "readwrite");
  await tx.store.clear();
  await Promise.all(accounts.map((account) => tx.store.put(account)));
  await tx.done;
}
