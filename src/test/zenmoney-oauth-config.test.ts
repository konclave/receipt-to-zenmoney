import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ZenMoney OAuth deployment config', () => {
  const packageJson = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8');
  const svelteConfig = readFileSync(resolve(process.cwd(), 'svelte.config.js'), 'utf8');
  const envExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
  const vercelConfig = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8');

  it('uses adapter-vercel instead of adapter-static', () => {
    expect(packageJson).toContain('@sveltejs/adapter-vercel');
    expect(svelteConfig).toContain("@sveltejs/adapter-vercel");
  });

  it('does not expose ZenMoney OAuth secret material in PUBLIC env vars', () => {
    expect(envExample).not.toContain('PUBLIC_ZENMONEY_CLIENT_SECRET');
    expect(envExample).toContain('ZENMONEY_CLIENT_SECRET=');
    expect(envExample).toContain('PUBLIC_ZENMONEY_OAUTH_ENABLED=');
  });

  it('does not rewrite every request to index.html', () => {
    expect(vercelConfig).not.toContain('"destination": "/index.html"');
  });
});
