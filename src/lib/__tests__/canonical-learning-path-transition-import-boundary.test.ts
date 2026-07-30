import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Client components import control-correction-path-rounds via adaptive-path
 * journey contracts. That module must never import the transition barrel, which
 * re-exports replan → authority-capability → prisma (server-only).
 */
describe('canonical learning path transition import boundary', () => {
  it('keeps control-correction-path-rounds free of the transition barrel', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/lib/control-correction-path-rounds.ts'),
      'utf8',
    );
    expect(source).not.toMatch(
      /from ['"]\.\/canonical-learning-path-transition['"]/,
    );
    expect(source).toMatch(
      /from ['"]\.\/canonical-learning-path-transition\/mutation-guard['"]/,
    );
    expect(source).toMatch(
      /from ['"]\.\/canonical-learning-path-transition\/write-fence['"]/,
    );
    expect(source).not.toMatch(
      /from ['"]\.\/canonical-learning-path-transition\/replan['"]/,
    );
  });

  it('keeps write-fence free of replan and prisma singleton imports', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/lib/canonical-learning-path-transition/write-fence.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/from ['"]\.\/replan['"]/);
    expect(source).not.toMatch(/from ['"]@\/lib\/prisma['"]/);
    expect(source).not.toMatch(/from ['"]\.\/\.\.\/prisma['"]/);
  });
});
