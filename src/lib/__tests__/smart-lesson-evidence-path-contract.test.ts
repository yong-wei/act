import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  resolveSmartLessonEvidenceDirectory,
  resolveSmartLessonEvidenceFile,
} from '../../../scripts/tests/smart-lesson-evidence-path';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('smart lesson evidence path contract', () => {
  it('prefers the active change even when archives also match', () => {
    const root = temporaryRepo();
    const active = changePath(root);
    mkdirSync(active, { recursive: true });
    mkdirSync(archivePath(root, '2026-07-26'), { recursive: true });

    expect(resolveSmartLessonEvidenceDirectory(root))
      .toBe(path.join(active, 'evidence'));
    expect(resolveSmartLessonEvidenceFile('result.json', root))
      .toBe(path.join(active, 'evidence', 'result.json'));
  });

  it('uses the unique matching archived change when active is absent', () => {
    const root = temporaryRepo();
    const archived = archivePath(root, '2026-07-27');
    mkdirSync(archived, { recursive: true });
    mkdirSync(path.join(root, 'openspec', 'changes', 'archive', 'unrelated-change'), { recursive: true });

    expect(resolveSmartLessonEvidenceDirectory(root))
      .toBe(path.join(archived, 'evidence'));
  });

  it('fails closed when matching archived changes are ambiguous', () => {
    const root = temporaryRepo();
    mkdirSync(archivePath(root, '2026-07-26'), { recursive: true });
    mkdirSync(archivePath(root, '2026-07-27'), { recursive: true });

    expect(() => resolveSmartLessonEvidenceDirectory(root))
      .toThrowError('smart-lesson-evidence-archive-match-ambiguous');
  });

  it('fails closed when neither active nor archived change exists', () => {
    const root = temporaryRepo();
    mkdirSync(path.join(root, 'openspec', 'changes', 'archive'), { recursive: true });

    expect(() => resolveSmartLessonEvidenceDirectory(root))
      .toThrowError('smart-lesson-evidence-archive-match-missing');
  });

  it('rejects a non-directory active change and nested file names', () => {
    const root = temporaryRepo();
    mkdirSync(path.dirname(changePath(root)), { recursive: true });
    writeFileSync(changePath(root), 'not-a-directory');

    expect(() => resolveSmartLessonEvidenceDirectory(root))
      .toThrowError('smart-lesson-evidence-active-change-invalid');
    expect(() => resolveSmartLessonEvidenceFile('../result.json', root))
      .toThrowError('smart-lesson-evidence-file-name-invalid');
  });
});

function temporaryRepo() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'smart-lesson-evidence-path-'));
  temporaryRoots.push(root);
  return root;
}

function changePath(root: string) {
  return path.join(root, 'openspec', 'changes', 'harden-smart-lesson-generation-experience');
}

function archivePath(root: string, date: string) {
  return path.join(
    root,
    'openspec',
    'changes',
    'archive',
    `${date}-harden-smart-lesson-generation-experience`,
  );
}
