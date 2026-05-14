import { getDb } from './index';
import type { ZenmoneyInstrument } from '$lib/types';

export async function saveInstruments(instruments: ZenmoneyInstrument[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('instruments', 'readwrite');
  await tx.store.clear();
  await Promise.all(instruments.map((i) => tx.store.put(i)));
  await tx.done;
}

export async function getInstrumentByCurrency(
  currency: string,
): Promise<ZenmoneyInstrument | undefined> {
  const db = await getDb();
  const all = await db.getAll('instruments');
  return all.find((i) => i.shortTitle === currency);
}
