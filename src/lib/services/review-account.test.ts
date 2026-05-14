import { describe, it, expect } from "vitest";
import { resolveReviewAccountId } from "./review-account";
import type { ZenmoneyAccount } from "$lib/types";

const ACCOUNTS: ZenmoneyAccount[] = [
  { id: "acc-1", title: "Cash" },
  { id: "acc-2", title: "Card" },
];

describe("resolveReviewAccountId", () => {
  it("returns the saved default account when it exists", () => {
    expect(resolveReviewAccountId(ACCOUNTS, "acc-2")).toBe("acc-2");
  });

  it("falls back to the first account when the saved default is missing", () => {
    expect(resolveReviewAccountId(ACCOUNTS, "missing")).toBe("acc-1");
  });

  it("returns the only account when there is one", () => {
    expect(resolveReviewAccountId([{ id: "acc-9", title: "Wallet" }], "")).toBe(
      "acc-9",
    );
  });

  it("returns empty string when there are no accounts", () => {
    expect(resolveReviewAccountId([], "acc-1")).toBe("");
  });
});
