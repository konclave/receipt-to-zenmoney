import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('about page copy', () => {
  it('mentions local receipt history and backup restore support', () => {
    const aboutPage = readFileSync(resolve(process.cwd(), 'src/routes/about/+page.svelte'), 'utf8');

    expect(aboutPage).toMatch(/local history/i);
    expect(aboutPage).toMatch(/receipt images/i);
    expect(aboutPage).toMatch(/backup/i);
    expect(aboutPage).toMatch(/restore/i);
  });
});
