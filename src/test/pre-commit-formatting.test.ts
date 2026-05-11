import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packageJsonPath = resolve(repoRoot, 'package.json');
const preCommitHookPath = resolve(repoRoot, '.husky/pre-commit');

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

    expect(packageJson.scripts?.prepare).toBe('svelte-kit sync && husky');
    expect(packageJson['lint-staged']).toEqual({
      '*.{js,cjs,mjs,ts,cts,mts,tsx,jsx,json,css,html}': 'oxfmt --write',
      '*.svelte': 'prettier --write --plugin prettier-plugin-svelte --single-quote',
    });
  });

  it('commits through a husky pre-commit hook that runs lint-staged', () => {
    const hookExists = existsSync(preCommitHookPath);

    expect(hookExists).toBe(true);
    if (!hookExists) {
      return;
    }

    const hookLines = readFileSync(preCommitHookPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    expect(hookLines.at(-1)).toBe('pnpm exec lint-staged');
  });
});
