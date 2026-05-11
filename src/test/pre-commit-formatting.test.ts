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
