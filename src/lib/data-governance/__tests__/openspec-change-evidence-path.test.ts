import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveOpenSpecChangeEvidencePath } from '../openspec-change-evidence-path';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'openspec-evidence-'));
  roots.push(root);
  return root;
}

describe('resolveOpenSpecChangeEvidencePath', () => {
  it('prefers evidence from an active change', async () => {
    const root = await tempRoot();
    const active = path.join(root, 'openspec/changes/example-change/evidence/input.jsonl');
    const archived = path.join(root, 'openspec/changes/archive/2026-07-17-example-change/evidence/input.jsonl');
    mkdirSync(path.dirname(active), { recursive: true });
    mkdirSync(path.dirname(archived), { recursive: true });
    writeFileSync(active, 'active');
    writeFileSync(archived, 'archived');

    expect(resolveOpenSpecChangeEvidencePath(root, 'example-change', 'input.jsonl')).toBe(active);
  });

  it('resolves evidence after the owning change is archived', async () => {
    const root = await tempRoot();
    const archived = path.join(root, 'openspec/changes/archive/2026-07-17-example-change/evidence/input.jsonl');
    mkdirSync(path.dirname(archived), { recursive: true });
    writeFileSync(archived, 'archived');

    expect(resolveOpenSpecChangeEvidencePath(root, 'example-change', 'input.jsonl')).toBe(archived);
  });

  it('does not mix active and archived evidence', async () => {
    const root = await tempRoot();
    mkdirSync(path.join(root, 'openspec/changes/example-change'), { recursive: true });
    const archived = path.join(root, 'openspec/changes/archive/2026-07-17-example-change/evidence/input.jsonl');
    mkdirSync(path.dirname(archived), { recursive: true });
    writeFileSync(archived, 'archived');

    expect(() => resolveOpenSpecChangeEvidencePath(root, 'example-change', 'input.jsonl'))
      .toThrow('Missing active OpenSpec evidence');
  });

  it('rejects ambiguous archives and path traversal', async () => {
    const root = await tempRoot();
    for (const date of ['2026-07-16', '2026-07-17']) {
      mkdirSync(path.join(root, `openspec/changes/archive/${date}-example-change/evidence`), { recursive: true });
    }

    expect(() => resolveOpenSpecChangeEvidencePath(root, 'example-change', 'input.jsonl'))
      .toThrow('Expected one archived OpenSpec change');
    expect(() => resolveOpenSpecChangeEvidencePath(root, '../example-change', 'input.jsonl')).toThrow('Invalid OpenSpec change ID');
    expect(() => resolveOpenSpecChangeEvidencePath(root, 'example-change', '../input.jsonl')).toThrow('Invalid OpenSpec evidence file name');
  });
});
