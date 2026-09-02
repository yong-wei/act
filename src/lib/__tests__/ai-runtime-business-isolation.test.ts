import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return readdirSync(join(process.cwd(), directory), { withFileTypes: true })
    .flatMap((entry) => {
      const child = join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(child) : [child];
    })
    .filter((path) => /\.ts$/.test(path));
}

describe('AI runtime business-fact isolation', () => {
  it('keeps the canonical AI runtime free of business-domain imports', () => {
    // AI output stays advisory: the provider/stream runtime must not reach any
    // business domain (courses, assessment, learning facts, profiles,
    // publication, production selectors), so model output can never become a
    // business fact by construction.
    for (const path of sourceFiles('src/lib/ai')) {
      const source = readFileSync(join(process.cwd(), path), 'utf8');
      expect(source, path).not.toMatch(/from '@\/features\//);
    }
  });

  it('limits database access inside the AI owner to the PlatformSetting settings store', () => {
    for (const path of sourceFiles('src/lib/ai')) {
      const source = readFileSync(join(process.cwd(), path), 'utf8');
      if (source.includes('@/lib/prisma')) {
        // provider-settings is the sole configuration authority and only reads
        // or writes the PlatformSetting-backed settings keys.
        expect(path.endsWith('src/lib/ai/provider-settings.ts')).toBe(true);
      }
    }
  });
});
