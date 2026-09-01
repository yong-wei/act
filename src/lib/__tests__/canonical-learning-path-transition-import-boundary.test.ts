import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

/**
 * Collect static import/export-from module specifiers from a TypeScript source.
 */
function collectModuleSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const importRe = /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(source)) !== null) {
    specs.push(match[1]!);
  }
  const sideEffectRe = /import\s+['"]([^'"]+)['"]/g;
  while ((match = sideEffectRe.exec(source)) !== null) {
    specs.push(match[1]!);
  }
  return specs;
}

function resolveLocalImport(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) {
    const base = `src/${specifier.slice(2)}`;
    const candidates = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`];
    for (const candidate of candidates) {
      try {
        readFileSync(join(ROOT, candidate), 'utf8');
        return candidate;
      } catch {
        // try next
      }
    }
    return null;
  }
  if (specifier.startsWith('.')) {
    const fromDir = fromFile.includes('/')
      ? fromFile.slice(0, fromFile.lastIndexOf('/'))
      : '';
    const joined = join(fromDir, specifier).replace(/\\/g, '/');
    const candidates = [
      `${joined}.ts`,
      `${joined}.tsx`,
      `${joined}/index.ts`,
      joined.endsWith('.ts') || joined.endsWith('.tsx') ? joined : null,
    ].filter((value): value is string => Boolean(value));
    for (const candidate of candidates) {
      try {
        readFileSync(join(ROOT, candidate), 'utf8');
        return candidate;
      } catch {
        // try next
      }
    }
  }
  return null;
}

function specifierHitsForbidden(
  specifier: string,
  forbiddenSubstrings: readonly string[],
): string | null {
  for (const forbidden of forbiddenSubstrings) {
    if (
      specifier === forbidden
      || specifier.endsWith(`/${forbidden}`)
      || specifier.includes(forbidden)
    ) {
      return forbidden;
    }
  }
  return null;
}

/**
 * Client adaptive-path contracts must never pull path-round persistence,
 * write-fence, or Prisma into the client chunk graph via the
 * isStudentVisiblePathTarget import path.
 */
describe('canonical learning path transition import boundary', () => {
  it('keeps control-correction-path-rounds free of the transition barrel', () => {
    const source = readSource('src/features/personalization/path-planning/control-correction-path-rounds.ts');
    expect(source).not.toMatch(
      /from ['"]\.\/canonical-learning-path-transition['"]/,
    );
    expect(source).toMatch(
      /from ['"]@\/lib\/canonical-learning-path-transition\/mutation-guard['"]/,
    );
    expect(source).toMatch(
      /from ['"]@\/lib\/canonical-learning-path-transition\/write-fence['"]/,
    );
    expect(source).not.toMatch(
      /from ['"]@\/lib\/canonical-learning-path-transition\/replan['"]/,
    );
    expect(source).toMatch(
      /from ['"]@\/lib\/student-visible-path-target['"]/,
    );
  });

  it('keeps write-fence free of replan and prisma singleton imports', () => {
    const source = readSource(
      'src/lib/canonical-learning-path-transition/write-fence.ts',
    );
    expect(source).not.toMatch(/from ['"]\.\/replan['"]/);
    expect(source).not.toMatch(/from ['"]@\/lib\/prisma['"]/);
    expect(source).not.toMatch(/from ['"]\.\/\.\.\/prisma['"]/);
  });

  it('keeps adaptive-path-journey-contracts free of path-rounds / write-fence / prisma', () => {
    const source = readSource(
      'src/features/personalization/experience/adaptive-path-journey-contracts.ts',
    );
    expect(source).not.toMatch(/control-correction-path-rounds/);
    expect(source).not.toMatch(/write-fence/);
    expect(source).not.toMatch(/@prisma\/client/);
    expect(source).toMatch(
      /from ['"]@\/lib\/adaptive-path-destination-contract['"]/,
    );
  });

  it('keeps pure student-visible helper free of server modules', () => {
    const source = readSource('src/lib/student-visible-path-target.ts');
    // Match import/export paths only — comments may mention forbidden names.
    expect(source).not.toMatch(
      /from ['"][^'"]*(control-correction-path-rounds|write-fence|@prisma\/client|canonical-learning-path-transition)[^'"]*['"]/,
    );
    expect(source).not.toMatch(/from ['"]@\/lib\/prisma['"]/);
    // Pure leaf: no local project imports.
    const specs = collectModuleSpecifiers(source);
    expect(specs.every((spec) => !spec.startsWith('.') && !spec.startsWith('@/'))).toBe(true);
  });

  it('does not reach path-rounds or write-fence from client adaptive contracts', () => {
    const entry = 'src/features/personalization/experience/adaptive-path-journey-contracts.ts';
    const forbidden = [
      'control-correction-path-rounds',
      'canonical-learning-path-transition/write-fence',
      'canonical-learning-path-transition/replan',
    ] as const;
    const visited = new Set<string>();
    const queue = [entry];
    const hits: Array<{ file: string; forbidden: string; via: string }> = [];

    while (queue.length > 0) {
      const file = queue.shift()!;
      if (visited.has(file)) continue;
      visited.add(file);

      let source: string;
      try {
        source = readSource(file);
      } catch {
        continue;
      }

      for (const specifier of collectModuleSpecifiers(source)) {
        const forbiddenHit = specifierHitsForbidden(specifier, forbidden);
        if (forbiddenHit) {
          hits.push({ file, forbidden: forbiddenHit, via: specifier });
          continue;
        }
        const resolved = resolveLocalImport(file, specifier);
        if (resolved && resolved.startsWith('src/') && !visited.has(resolved)) {
          queue.push(resolved);
        }
      }
    }

    expect(hits).toEqual([]);
    expect(visited.has('src/lib/student-visible-path-target.ts')).toBe(true);
    expect(visited.has('src/features/personalization/path-planning/control-correction-path-rounds.ts')).toBe(false);
    expect(
      [...visited].some((file) => file.includes('write-fence')),
    ).toBe(false);
  });
});
