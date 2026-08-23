import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('unavailable-label audit exclusion', () => {
  it('is not a Next.js route or runtime-release input', () => {
    const appDir = path.join(process.cwd(), 'src/app');
    const appFiles = collectFiles(appDir);
    expect(appFiles.some((file) => file.includes('unavailable-label-audit'))).toBe(false);
    const nextConfigPath = ['next.config.mjs', 'next.config.ts', 'next.config.js']
      .map((name) => path.join(process.cwd(), name))
      .find((file) => existsSync(file));
    expect(nextConfigPath).toBeTruthy();
    expect(readFileSync(nextConfigPath!, 'utf8')).not.toContain('unavailable-label-audit');
    expect(existsSync(path.join(process.cwd(), 'src/app/knowledge/unavailable-label-audit'))).toBe(false);
  });
});

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}
