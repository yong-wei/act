import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { assertCleanSourceRevision } from '../../../../scripts/tests/smart-lesson-source-revision';

describe('smart lesson real-provider source revision contract', () => {
  it('fails before reading HEAD when tracked or untracked files are present', () => {
    const runGit = vi.fn()
      .mockReturnValueOnce(' M src/example.ts\n?? evidence.json\n');

    expect(() => assertCleanSourceRevision('/repo', runGit))
      .toThrowError('smart-lesson-e2e-source-worktree-dirty');
    expect(runGit).toHaveBeenCalledOnce();
    expect(runGit).toHaveBeenCalledWith(
      'git',
      ['status', '--porcelain', '--untracked-files=all'],
      { cwd: '/repo', encoding: 'utf8' },
    );
  });

  it('returns the committed revision only after an empty full worktree status', () => {
    const revision = 'a'.repeat(40);
    const runGit = vi.fn()
      .mockReturnValueOnce('')
      .mockReturnValueOnce(`${revision}\n`);

    expect(assertCleanSourceRevision('/repo', runGit)).toBe(revision);
    expect(runGit).toHaveBeenNthCalledWith(
      2,
      'git',
      ['rev-parse', 'HEAD'],
      { cwd: '/repo', encoding: 'utf8' },
    );
  });

  it('rejects a malformed revision', () => {
    const runGit = vi.fn()
      .mockReturnValueOnce('')
      .mockReturnValueOnce('not-a-revision\n');

    expect(() => assertCleanSourceRevision('/repo', runGit))
      .toThrowError('smart-lesson-e2e-source-revision-invalid');
  });

  it('reuses the migration-seeded global cumulative portrait fence', () => {
    const runner = readFileSync(
      path.join(process.cwd(), 'scripts/tests/run-smart-lesson-real-e2e.ts'),
      'utf8',
    );
    const migration = readFileSync(
      path.join(
        process.cwd(),
        'prisma/migrations/20260723120000_restore_cumulative_learning_portraits/migration.sql',
      ),
      'utf8',
    );
    expect(runner).toContain('assertTemporarySchema(schema);');
    expect(runner).toContain("scoped.searchParams.set('schema', schema);");
    expect(runner).toContain("scoped.searchParams.set('options', `-c search_path=${schema},public`);");
    expect(runner).toContain("process.env.SMART_LESSON_REAL_PROVIDER_REQUIRED = '1';");
    expect(runner.indexOf("process.env.SMART_LESSON_REAL_PROVIDER_REQUIRED = '1';"))
      .toBeLessThan(runner.indexOf("await import('../../src/lib/smart-lesson-plan/worker')"));
    expect(runner).toContain('SET LOCAL search_path TO "${schemaName}", public');
    expect(runner).toContain('const currentFence = await tx.cumulativePortraitCutoverFence.findUnique({');
    expect(runner).toContain('BigInt(currentFence?.fence ?? 0) + 1n');
    expect(runner).toContain('BigInt(currentFence?.learnerGeneration ?? 0) + 1n');
    expect(runner).toContain('BigInt(currentFence?.classGeneration ?? 0) + 1n');
    expect(runner).toContain('BigInt(currentFence?.queueGeneration ?? 0) + 1n');
    expect(runner).toContain('cumulativePortraitCutoverFence.upsert({');
    expect(runner).toContain("create: { id: 'global', ...fenceData }");
    expect(runner).toContain('update: fenceData');
    expect(migration).toContain(
      'SELECT * INTO run_row FROM "CumulativePortraitMigrationRun" WHERE "id" = NEW."activeMigrationRunId"',
    );
    for (const field of [
      'cutoverFence',
      'calculationVersion',
      'classMaterializationVersion',
      'learnerGeneration',
      'classGeneration',
      'queueGeneration',
    ]) {
      expect(migration).toContain(`run_row."${field}" IS DISTINCT FROM NEW."${field === 'cutoverFence' ? 'fence' : field}"`);
    }
  });

  it('scopes real-browser status assertions to their business workspace', () => {
    const spec = readFileSync(
      path.join(process.cwd(), 'tests/smart-lesson-real-provider.spec.ts'),
      'utf8',
    );
    expect(spec).not.toContain("page.getByRole('status')");
    expect(spec).toContain("page.locator('[data-course-basis-workspace]').getByRole('status')");
    expect(spec).toContain("page.locator('[data-smart-lesson-plan-workspace]').getByRole('status')");
    expect(spec).toContain("page.locator('main').getByRole('status')");
    expect(spec).not.toMatch(/getByRole\\('status'\\)\\.first\\(\\)/);
  });

  it('targets new-task checkboxes by stable business fields', () => {
    const spec = readFileSync(
      path.join(process.cwd(), 'tests/smart-lesson-real-provider.spec.ts'),
      'utf8',
    );
    expect(spec).toContain("page.locator('form#smart-preparation-new-task')");
    expect(spec).toContain(
      "'input[name=\"confirmTextbookRange\"][type=\"checkbox\"]'",
    );
    expect(spec).toContain(
      "'input[name=\"outlineConfirmationRequired\"][type=\"checkbox\"]'",
    );
    expect(spec).not.toContain(
      "getByLabel('确认采用此教材范围').check()",
    );
    expect(spec).not.toContain(
      "getByLabel('生成提纲后暂停确认').check()",
    );
  });

  it('accepts the governed source state through its current UI and persisted projection', () => {
    const spec = readFileSync(
      path.join(process.cwd(), 'tests/smart-lesson-real-provider.spec.ts'),
      'utf8',
    );
    expect(spec).toContain(
      "card.getByText('已关联依据', { exact: true })",
    );
    expect(spec).toContain("item.sourceState === 'VERIFIED'");
    expect(spec).toContain('Array.isArray(item.sourceBindings)');
    expect(spec).not.toContain("toContainText('来源已验证')");
  });
});
