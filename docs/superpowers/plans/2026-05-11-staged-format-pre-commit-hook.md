# Staged Format Pre-Commit Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repo-managed pre-commit hook that formats only staged files, preserves partial staging, and covers both Svelte and non-Svelte code files used in this repository.

**Architecture:** Use `husky` to install a repository-owned pre-commit hook and `lint-staged` to run formatter commands against staged file paths while protecting partial staging semantics. Route `.svelte` files to Prettier with the Svelte plugin and route repo-supported JS/TS/CSS/HTML/JSON files to `oxfmt`.

**Tech Stack:** `pnpm`, Husky, lint-staged, Prettier, `prettier-plugin-svelte`, `oxfmt`, Vitest

---

## File Map

### New files

- `src/test/pre-commit-formatting.test.ts` — configuration contract tests for the staged-format hook
- `.husky/pre-commit` — repository-managed pre-commit hook entrypoint

### Modified files

- `package.json` — add hook/formatter dependencies, update `prepare`, and define `lint-staged` routing
- `pnpm-lock.yaml` — lockfile updates for the added dev dependencies

## Task 1: Lock down the hook contract with a failing test

**Files:**
- Create: `src/test/pre-commit-formatting.test.ts`

- [ ] **Step 1: Write the failing configuration test**

```ts
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageJsonPath = resolve(process.cwd(), 'package.json');
const preCommitHookPath = resolve(process.cwd(), '.husky/pre-commit');

describe('staged formatting pre-commit hook', () => {
  it('installs repo-managed hook tooling and routes staged files by formatter', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
      ['lint-staged']?: Record<string, string>;
    };

    expect(packageJson.devDependencies).toMatchObject({
      husky: expect.any(String),
      'lint-staged': expect.any(String),
      prettier: expect.any(String),
      'prettier-plugin-svelte': expect.any(String),
    });

    expect(packageJson.scripts?.prepare).toContain('husky');
    expect(packageJson['lint-staged']).toEqual({
      '*.{js,cjs,mjs,ts,cts,mts,tsx,jsx,json,css,html}': 'oxfmt --write',
      '*.svelte':
        'prettier --write --plugin prettier-plugin-svelte --single-quote',
    });
  });

  it('commits through a husky pre-commit hook that runs lint-staged', () => {
    expect(existsSync(preCommitHookPath)).toBe(true);

    const hook = readFileSync(preCommitHookPath, 'utf8');

    expect(hook).toContain('pnpm exec lint-staged');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails for the missing hook setup**

Run: `pnpm exec vitest run src/test/pre-commit-formatting.test.ts`

Expected: FAIL because `package.json` does not yet declare `husky`, `lint-staged`, `prettier`, `prettier-plugin-svelte`, and `.husky/pre-commit` does not exist.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/test/pre-commit-formatting.test.ts
git commit -m "test: define staged formatting hook contract"
```

## Task 2: Add the hook tooling and staged formatter routing

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `.husky/pre-commit`

- [ ] **Step 1: Install the hook and Svelte formatter dependencies**

Run: `pnpm add -D husky lint-staged prettier prettier-plugin-svelte`

Expected: PASS with new dependency entries added to `package.json` and `pnpm-lock.yaml`.

- [ ] **Step 2: Update `package.json` with the minimal hook configuration**

Update the relevant sections to:

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "prepare": "svelte-kit sync && husky",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
    "test:unit": "vitest",
    "test": "npm run test:unit -- --run",
    "lint": "oxlint src",
    "format": "oxfmt src",
    "format:check": "oxfmt --check src"
  },
  "lint-staged": {
    "*.{js,cjs,mjs,ts,cts,mts,tsx,jsx,json,css,html}": "oxfmt --write",
    "*.svelte": "prettier --write --plugin prettier-plugin-svelte --single-quote"
  }
}
```

Keep all existing scripts unchanged apart from replacing `prepare`, and keep the exact dependency version strings that `pnpm add -D husky lint-staged prettier prettier-plugin-svelte` wrote into `devDependencies`.

- [ ] **Step 3: Add the Husky pre-commit hook**

Create `.husky/pre-commit` with:

```sh
pnpm exec lint-staged
```

- [ ] **Step 4: Run the configuration contract test to verify the implementation passes**

Run: `pnpm exec vitest run src/test/pre-commit-formatting.test.ts`

Expected: PASS with both tests green.

- [ ] **Step 5: Commit the hook configuration**

```bash
git add package.json pnpm-lock.yaml .husky/pre-commit src/test/pre-commit-formatting.test.ts
git commit -m "chore: add staged formatting pre-commit hook"
```

## Task 3: Verify staged-file formatting behavior end to end

**Files:**
- Modify temporarily: `src/routes/+layout.ts`
- Modify temporarily: `src/routes/+page.svelte`

- [ ] **Step 1: Create a staged formatting change plus an unstaged extra hunk in `src/routes/+layout.ts`**

Edit `src/routes/+layout.ts` to:

```ts
export const prerender = true;
export const ssr=false;
```

Run: `git add src/routes/+layout.ts`

Then edit the same file again to:

```ts
export const prerender = true;
export const ssr=false;
export const csr = true;
```

This creates one staged formatting change and one separate unstaged hunk.

- [ ] **Step 2: Make a reversible formatting-only edit in a Svelte file**

Edit the import block at the top of `src/routes/+page.svelte` so it becomes:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
</script>
```

Run: `git add src/routes/+page.svelte`

This gives the hook a staged `.svelte` formatting target.

- [ ] **Step 3: Run the hook command directly**

Run: `pnpm exec lint-staged`

Expected: PASS with `oxfmt --write` run for `src/routes/+layout.ts` and `prettier --write --plugin prettier-plugin-svelte --single-quote` run for `src/routes/+page.svelte`.

- [ ] **Step 4: Confirm the staged diff contains formatter output without pulling in the unstaged hunk**

Run: `git diff --cached -- src/routes/+layout.ts src/routes/+page.svelte`

Expected: PASS with the staged diff showing:

```diff
-export const ssr=false
+export const ssr = false;
```

and the Svelte file reformatted with the repository’s two-space, single-quote style preserved.

Also confirm the staged diff for `src/routes/+layout.ts` does **not** include:

```ts
export const csr = true;
```

- [ ] **Step 5: Confirm the extra hunk stayed unstaged**

Run: `git diff -- src/routes/+layout.ts`

Expected: PASS with the working-tree diff still showing:

```diff
+export const csr = true;
```

- [ ] **Step 6: Reset the temporary verification edits**

Run:

```bash
git restore --staged src/routes/+layout.ts src/routes/+page.svelte
git restore src/routes/+layout.ts src/routes/+page.svelte
```

Expected: PASS with no lasting changes to those verification files.

- [ ] **Step 7: Verify the repository test suite still passes for the touched config test**

Run: `pnpm exec vitest run src/test/pre-commit-formatting.test.ts src/test/ci-workflow.test.ts`

Expected: PASS with both tests green.
