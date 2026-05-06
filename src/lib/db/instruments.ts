import { getDb } from './index';
import type { ZenMoneyInstrument } from '$lib/types';

export async function saveInstruments(instruments: ZenMoneyInstrument[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('instruments', 'readwrite');
  await tx.store.clear();
  await Promise.all(instruments.map((i) => tx.store.put(i)));
  await tx.done;
}

export async function getInstrumentByCurrency(
  currency: string,
): Promise<ZenMoneyInstrument | undefined> {
  const db = await getDb();
  const all = await db.getAll('instruments');
  return all.find((i) => i.shortTitle === currency);
}
