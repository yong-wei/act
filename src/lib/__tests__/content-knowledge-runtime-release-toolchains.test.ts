import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { worktreeIsClean } from '../../../tools/boundary/git-source';
import { buildCommandReceipt, commandInputHash, evaluateApplyGate } from '../../../tools/content-knowledge-runtime-release/apply-gate';
import { checkContentKnowledgeRuntimeRelease } from '../../../tools/content-knowledge-runtime-release/check';
import { classifyReleasePath } from '../../../tools/content-knowledge-runtime-release/classify';
import { findUngatedPublicationPackageScripts } from '../../../tools/content-knowledge-runtime-release/entrypoints';
import {
  CHARACTERIZATION_PATHS,
  FROZEN_COUNTS,
  PROJECTION_HANDOFF,
} from '../../../tools/content-knowledge-runtime-release/types';

describe('content knowledge runtime release toolchains', () => {
  it('classifies compilers, writers, readers, and operator adapters', () => {
    expect(classifyReleasePath('course-content/scripts/export-runtime.sh')).toMatchObject({
      toolchain: 'content-compiler',
      role: 'compiler',
      safetyMode: 'apply-gated',
    });
    expect(classifyReleasePath('course-content/scripts/review_lesson_content.py').role).toBe('validator');
    expect(classifyReleasePath('course-content/scripts/textbook_hybrid_retrieval.py').role).toBe('reader');
    expect(classifyReleasePath('scripts/release/export-textbook-runtime-v2.mjs')).toMatchObject({
      toolchain: 'content-compiler',
      role: 'compiler',
    });
    expect(classifyReleasePath('scripts/knowledge-cutover/publish-actkg-v018-cutover-runtime.ts')).toMatchObject({
      toolchain: 'knowledge-release',
      role: 'publication-writer',
    });
    expect(classifyReleasePath('scripts/knowledge-cutover/prepare-actkg-v022-authority-candidate.ts').role).toBe('candidate-adapter');
    expect(classifyReleasePath('scripts/knowledge-cutover/activate-actkg-v018-production-cutover.ts')).toMatchObject({
      role: 'operator-adapter',
      retirementCondition: 'retain-as-explicit-operator-adapter',
    });
    expect(classifyReleasePath('scripts/runtime-release/materialize-runtime-blob-release.py')).toMatchObject({
      toolchain: 'runtime-release',
      role: 'publication-writer',
    });
    expect(classifyReleasePath('scripts/runtime-release/developer-oss/cli.py').role).toBe('operator-adapter');
    expect(classifyReleasePath('scripts/runtime-release/activate-runtime-release.sh').role).toBe('operator-adapter');
  });

  it('rejects apply without approval and never executes publication or activation', () => {
    expect(evaluateApplyGate({
      mode: 'apply',
      approval: null,
      planHash: 'a',
      currentInputHash: 'a',
      targetIdentity: 'fixture:local',
    })).toMatchObject({ status: 'apply-rejected', reason: 'approval-absent', executed: false });
    expect(evaluateApplyGate({
      mode: 'apply',
      approval: 'fixture-approval',
      planHash: 'same',
      currentInputHash: 'same',
      targetIdentity: 'production',
    })).toMatchObject({ status: 'apply-rejected', reason: 'production-apply-forbidden', executed: false });
    expect(evaluateApplyGate({
      mode: 'apply',
      approval: 'fixture-approval',
      planHash: 'same',
      currentInputHash: 'same',
      targetIdentity: 'fixture:local',
    })).toMatchObject({ status: 'apply-authorized-not-executed', executed: false });
    const classified = classifyReleasePath(CHARACTERIZATION_PATHS.runtime);
    expect(buildCommandReceipt({
      command: classified,
      sourceRevision: 'abc',
      sourceTree: 'def',
      planHash: 'same',
      inputHash: 'same',
      targetIdentity: 'fixture:local',
      gate: evaluateApplyGate({
        mode: 'dry-run',
        approval: null,
        planHash: 'same',
        currentInputHash: 'same',
        targetIdentity: 'fixture:local',
      }),
    })).toMatchObject({
      executed: false,
      productionActivation: false,
      selectorMutation: false,
    });
  });

  it('qualifies the live captured-tree inventory without product writer imports', () => {
    const result = checkContentKnowledgeRuntimeRelease(process.cwd());
    expect(result.counts).toEqual(FROZEN_COUNTS);
    expect(result.commands).toHaveLength(41 + 7 + 75 + 33 + 5);
    expect(result.commands.some((item) => item.role === 'operator-adapter')).toBe(true);
    expect(result.commands.some((item) => item.path === CHARACTERIZATION_PATHS.content)).toBe(true);
    expect(result.characterization.knowledge.projectionHandoff).toEqual(PROJECTION_HANDOFF);
    expect(JSON.stringify(result.sampleReceipt)).not.toMatch(/DATABASE_URL=/);
    expect(findUngatedPublicationPackageScripts(process.cwd(), result.commands)).toEqual([]);
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['actkg:prepare-v022-candidate']).toContain('tools/content-knowledge-runtime-release/cli.ts apply');
    expect(pkg.scripts['db:export-textbook-resources']).toContain('tools/content-knowledge-runtime-release/cli.ts apply');
    expect(pkg.scripts['db:export-textbook-resources']).toContain('scripts/release/export-textbook-runtime-v2.mjs');
    expect(readFileSync(join(process.cwd(), 'tools/content-knowledge-runtime-release/cli.ts'), 'utf8')).not.toContain('spawnSync');
    expect(result.characterization.content.outputDigest).not.toEqual(result.characterization.knowledge.outputDigest);
    expect(result.characterization.knowledge.outputDigest).not.toEqual(result.characterization.runtime.outputDigest);
    expect(result.sampleReceipt.artifactDigest).toBeNull();
    expect(result.characterization.runtime.artifactDigest).toBeNull();
    expect(result.sampleReceipt.sourceRevision).toBe(result.characterization.content.sourceRevision);
    expect(pkg.scripts['deploy:runtime']).toContain('scripts/deploy-runtime-blob-release.sh');
    expect(pkg.scripts['startup:oss-runtime']).toContain('scripts/runtime-release/developer-oss/cli.py');
    const exportCommand = result.commands.find((item) => item.path === 'scripts/release/export-textbook-runtime-v2.mjs');
    const publishCommand = result.commands.find((item) => item.path === CHARACTERIZATION_PATHS.knowledge);
    expect(exportCommand && publishCommand).toBeTruthy();
    if (exportCommand && publishCommand) {
      expect(commandInputHash(exportCommand, result.blobs.get(exportCommand.path) ?? '')).not.toEqual(
        commandInputHash(publishCommand, result.blobs.get(publishCommand.path) ?? ''),
      );
    }
    const remaining = result.failures.filter((item) => item !== 'dirty-worktree');
    if (result.failures.includes('dirty-worktree')) {
      expect(worktreeIsClean(process.cwd())).toBe(false);
    }
    expect(remaining.filter((item) => !item.startsWith('inventory-'))).toEqual([]);
    if (!result.failures.includes('dirty-worktree') && remaining.every((item) => item.startsWith('inventory-'))) {
      return;
    }
    if (!result.failures.includes('dirty-worktree')) {
      expect(result.failures).toEqual([]);
      expect(result.ok).toBe(true);
    }
  });
});
