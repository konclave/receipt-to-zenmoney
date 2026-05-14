import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const viteConfigPath = resolve(process.cwd(), 'vite.config.ts');

describe('PWA manifest icons config', () => {
  it('includes the generic svg icon and apple touch icon asset', () => {
    const viteConfig = readFileSync(viteConfigPath, 'utf8');

    expect(viteConfig).toContain('includeAssets: ["icons/apple-touch-icon.png"]');
    expect(viteConfig).toContain(
      '{ src: "/icons/icon.svg", type: "image/svg+xml", purpose: "any" }',
    );
  });
});
