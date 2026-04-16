import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

const repoRoot = process.cwd();

function walk(relativeDir: string, results: string[] = []) {
  const absoluteDir = join(repoRoot, relativeDir);
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const nextRelativePath = join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      walk(nextRelativePath, results);
      continue;
    }
    results.push(nextRelativePath);
  }
  return results;
}

function getGuardedRouteFiles() {
  return walk('src/app/api').filter((relativePath) => {
    if (!relativePath.endsWith('/route.ts')) {
      return false;
    }

    const source = readFileSync(join(repoRoot, relativePath), 'utf8');
    const usesDynamicApi =
      /getServerSession\(|getServerAuthSession\(|new URL\(request\.url\)|\bheaders\(|\bcookies\(/.test(source);
    const hasCatch = /catch\s*\(error\)/.test(source);

    return usesDynamicApi && hasCatch;
  });
}

describe('rethrowIfNextDynamicError', () => {
  it('rethrows Next.js dynamic usage errors', () => {
    const dynamicError = { digest: 'DYNAMIC_SERVER_USAGE' };

    expect(() => rethrowIfNextDynamicError(dynamicError)).toThrow(dynamicError);
  });

  it('ignores regular application errors', () => {
    expect(() => rethrowIfNextDynamicError(new Error('normal error'))).not.toThrow();
  });
});

describe('request-bound API routes', () => {
  it('explicitly declare dynamic rendering and rethrow Next.js dynamic probe errors', () => {
    for (const relativePath of getGuardedRouteFiles()) {
      const source = readFileSync(join(repoRoot, relativePath), 'utf8');

      expect(source, relativePath).toContain("export const dynamic = 'force-dynamic';");
      expect(source, relativePath).toMatch(/rethrowIfNextDynamicError\(error\);?/);
    }
  });
});
