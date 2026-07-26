import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const CHANGE_NAME = 'harden-smart-lesson-generation-experience';

export function resolveSmartLessonEvidenceDirectory(repoRoot = process.cwd()) {
  const changesRoot = path.join(repoRoot, 'openspec', 'changes');
  const activeChange = path.join(changesRoot, CHANGE_NAME);
  if (existsSync(activeChange)) {
    if (!statSync(activeChange).isDirectory()) {
      throw new Error('smart-lesson-evidence-active-change-invalid');
    }
    return path.join(activeChange, 'evidence');
  }

  const archiveRoot = path.join(changesRoot, 'archive');
  if (!existsSync(archiveRoot) || !statSync(archiveRoot).isDirectory()) {
    throw new Error('smart-lesson-evidence-archive-match-missing');
  }
  const matches = readdirSync(archiveRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(`-${CHANGE_NAME}`))
    .map((entry) => entry.name)
    .sort();
  if (matches.length === 0) {
    throw new Error('smart-lesson-evidence-archive-match-missing');
  }
  if (matches.length > 1) {
    throw new Error('smart-lesson-evidence-archive-match-ambiguous');
  }
  return path.join(archiveRoot, matches[0], 'evidence');
}

export function resolveSmartLessonEvidenceFile(fileName: string, repoRoot = process.cwd()) {
  if (!fileName || path.basename(fileName) !== fileName) {
    throw new Error('smart-lesson-evidence-file-name-invalid');
  }
  return path.join(resolveSmartLessonEvidenceDirectory(repoRoot), fileName);
}
