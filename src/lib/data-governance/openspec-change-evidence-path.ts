import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

export function resolveOpenSpecChangeEvidencePath(
  root: string,
  changeId: string,
  fileName: string,
): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(changeId)) throw new Error(`Invalid OpenSpec change ID: ${changeId}`);
  if (path.basename(fileName) !== fileName || fileName === '.' || fileName === '..') {
    throw new Error(`Invalid OpenSpec evidence file name: ${fileName}`);
  }

  const activeDir = path.join(root, 'openspec/changes', changeId);
  const activePath = path.join(activeDir, 'evidence', fileName);
  if (existsSync(activeDir)) {
    if (!existsSync(activePath)) throw new Error(`Missing active OpenSpec evidence: ${activePath}`);
    return activePath;
  }

  const archiveDir = path.join(root, 'openspec/changes/archive');
  const archivedChanges = existsSync(archiveDir)
    ? readdirSync(archiveDir).filter((entry) => entry.endsWith(`-${changeId}`)).sort()
    : [];
  if (archivedChanges.length !== 1) {
    throw new Error(`Expected one archived OpenSpec change for ${changeId}, found ${archivedChanges.length}`);
  }

  const archivedPath = path.join(archiveDir, archivedChanges[0], 'evidence', fileName);
  if (!existsSync(archivedPath)) throw new Error(`Missing archived OpenSpec evidence: ${archivedPath}`);
  return archivedPath;
}
