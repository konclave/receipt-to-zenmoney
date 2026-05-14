import type { ZenmoneyAccount } from "$lib/types";

export function resolveReviewAccountId(
  accounts: ZenmoneyAccount[],
  defaultAccountId: string,
): string {
  if (accounts.some((account) => account.id === defaultAccountId))
    return defaultAccountId;
  return accounts[0]?.id ?? "";
}
