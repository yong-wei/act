import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ClassifiedArtifact, EvidenceClass, PrivacyClass, RetentionDecision } from './types';

const RUN_OUTPUT_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'html', 'har', 'log']);
const AUDIT_EXT = new Set(['md']);
const MANIFEST_EXT = new Set(['json', 'jsonl', 'txt']);

function extensionOf(path: string): string {
  const name = path.split('/').pop() ?? path;
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function loadProductionArtifactRetainPaths(cwd: string): Set<string> {
  const retain = new Set<string>();
  const output = execFileSync('git', ['ls-files', '-z', '--', 'src'], { cwd, encoding: 'utf8' });
  const files = output.split('\0').filter((path) => (
    path.endsWith('.ts') || path.endsWith('.tsx')
  ) && !path.includes('/__tests__/') && !/\.(?:test|spec)\./.test(path));
  const pattern = /['"](artifacts\/[^'"]+)['"]/g;
  for (const file of files) {
    const text = readFileSync(join(cwd, file), 'utf8');
    for (const match of text.matchAll(pattern)) {
      if (match[1]) retain.add(match[1]);
    }
  }
  return retain;
}

export function listArtifactBlobs(cwd: string): { path: string; blobHash: string }[] {
  const output = execFileSync('git', ['ls-files', '-s', '-z', '--', 'artifacts'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const entries: { path: string; blobHash: string }[] = [];
  for (const record of output.split('\0').filter(Boolean)) {
    const parts = record.split('\t');
    const meta = parts[0]?.split(' ') ?? [];
    const path = parts[1];
    const blobHash = meta[1];
    if (!path || !blobHash) continue;
    entries.push({ path, blobHash });
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

export function classifyArtifact(
  path: string,
  blobHash: string,
  retainPaths: ReadonlySet<string>,
): ClassifiedArtifact {
  const ext = extensionOf(path);
  let evidenceClass: EvidenceClass;
  let retentionDecision: RetentionDecision;
  let privacyClass: PrivacyClass;
  if (retainPaths.has(path) && RUN_OUTPUT_EXT.has(ext)) {
    evidenceClass = 'representative-fixture';
    retentionDecision = 'retain-in-repo';
    privacyClass = 'public-fixture';
  } else if (RUN_OUTPUT_EXT.has(ext)) {
    evidenceClass = 'run-specific-output';
    retentionDecision = 'externalize-then-delete';
    privacyClass = 'private-run-evidence';
  } else if (AUDIT_EXT.has(ext) || path.includes('/product-design-audits/') && ext === 'md') {
    evidenceClass = 'audit-closure-document';
    retentionDecision = 'keep-as-audit-ledger';
    privacyClass = 'none';
  } else if (MANIFEST_EXT.has(ext) || path.endsWith('.mjs')) {
    evidenceClass = 'portable-manifest';
    retentionDecision = 'retain-in-repo';
    privacyClass = 'none';
  } else {
    evidenceClass = 'run-specific-output';
    retentionDecision = 'externalize-then-delete';
    privacyClass = 'private-run-evidence';
  }
  return {
    path,
    evidenceClass,
    owner: path.startsWith('artifacts/commercial-ui/') ? 'assessment' : 'platform',
    privacyClass,
    retentionDecision,
    blobHash,
  };
}
