import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflowPath = resolve(process.cwd(), '.github/workflows/pr-validation.yml');

describe('PR validation workflow', () => {
  it('defines a pull request workflow with required checks', () => {
    const workflow = readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('name: PR Validation');
    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('pnpm install --frozen-lockfile');
    expect(workflow).toContain('pnpm test -- --run');
    expect(workflow).toContain('pnpm lint');
    expect(workflow).toContain('pnpm format:check');
    expect(workflow).toContain('pnpm check');
  });
});
