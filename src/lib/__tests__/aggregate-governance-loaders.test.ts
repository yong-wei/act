import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AGGREGATE_GIT_MAX_BUFFER_BYTES,
  formatAggregateGitFailure,
  loadTrackedBindingReviews,
  loadTrackedCrosswalkSemanticReviews,
} from '../../../scripts/course-coverage/aggregate-coverage';

const tempDirs: string[] = [];

function initGitRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'agg-loader-'));
  tempDirs.push(dir);
  const run = (args: string[]) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || args.join(' '));
    }
    return result.stdout.trim();
  };
  run(['init']);
  run(['config', 'user.email', 'test@example.com']);
  run(['config', 'user.name', 'test']);
  // Minimal tree so paths exist under aggregate/active
  const crosswalkRel =
    'course-content/authoring/knowledge/course-coverage/aggregate/active/act-crosswalk-semantic-reviews.json';
  const bindingRel =
    'course-content/authoring/knowledge/course-coverage/aggregate/active/resource-binding-reviews.json';
  mkdirSync(path.dirname(path.join(dir, crosswalkRel)), { recursive: true });
  return dir;
}

function writeAndCommit(root: string, relative: string, content: unknown): void {
  const abs = path.join(root, relative);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  const run = (args: string[]) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  };
  run(['add', relative]);
  run(['commit', '-m', `add ${relative}`, '--allow-empty']);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('loadTrackedCrosswalkSemanticReviews', () => {
  it('rejects unknown review keys outside the current workset', async () => {
    const root = initGitRepo();
    const rel =
      'course-content/authoring/knowledge/course-coverage/aggregate/active/act-crosswalk-semantic-reviews.json';
    writeAndCommit(root, rel, {
      schemaVersion: 'act-crosswalk-semantic-reviews/v1',
      deltaReceiptId: 'delta-receipt:test',
      authoringRevision: 'a'.repeat(40),
      reviews: {
        'ctc:a\u001fchunk\u001fcite': {
          outcome: 'UNSUPPORTED',
          reviewIdentity: 'agent-review:grok:test',
          reviewerPromptVersion: 'v1',
          evidenceDigest: 'b'.repeat(64),
          rationale: 'ok',
        },
        'ctc:evil\u001fchunk\u001fcite': {
          outcome: 'ACCEPT',
          reviewIdentity: 'agent-review:grok:test',
          reviewerPromptVersion: 'v1',
          evidenceDigest: 'c'.repeat(64),
          rationale: 'bad key',
          candidateId: 'd'.repeat(64),
        },
      },
    });
    await expect(
      loadTrackedCrosswalkSemanticReviews(
        root,
        'delta-receipt:test',
        new Set(['ctc:a\u001fchunk\u001fcite']),
      ),
    ).rejects.toThrow(/not in current workset/u);
  });

  it('rejects ACCEPT without candidateId', async () => {
    const root = initGitRepo();
    const rel =
      'course-content/authoring/knowledge/course-coverage/aggregate/active/act-crosswalk-semantic-reviews.json';
    writeAndCommit(root, rel, {
      schemaVersion: 'act-crosswalk-semantic-reviews/v1',
      deltaReceiptId: 'delta-receipt:test',
      authoringRevision: 'a'.repeat(40),
      reviews: {
        'ctc:a\u001fchunk\u001fcite': {
          outcome: 'ACCEPT',
          reviewIdentity: 'agent-review:grok:test',
          reviewerPromptVersion: 'v1',
          evidenceDigest: 'b'.repeat(64),
          rationale: 'missing candidate',
        },
      },
    });
    await expect(
      loadTrackedCrosswalkSemanticReviews(
        root,
        'delta-receipt:test',
        new Set(['ctc:a\u001fchunk\u001fcite']),
      ),
    ).rejects.toThrow(/requires candidateId/u);
  });
});

describe('loadTrackedBindingReviews', () => {
  it('rejects pairId not in current workset and GPT+Grok conflict', async () => {
    const root = initGitRepo();
    const rel =
      'course-content/authoring/knowledge/course-coverage/aggregate/active/resource-binding-reviews.json';
    writeAndCommit(root, rel, {
      schemaVersion: 'act-resource-binding-reviews/v1',
      deltaReceiptId: 'delta-receipt:test',
      authoringRevision: 'a'.repeat(40),
      reviews: {
        'canonical-resource-pair:abc': {
          outcome: 'ACCEPT',
          proposedRole: 'EXPLAINS',
          reviewIdentity: 'agent-review:grok:test',
          reviewerPromptVersion: 'v1',
          evidenceDigest: 'b'.repeat(64),
          rationale: 'ok',
          reviewProvider: 'GROK',
        },
      },
    });
    await expect(
      loadTrackedBindingReviews(root, 'delta-receipt:test', new Set(['other-pair'])),
    ).rejects.toThrow(/not in current workset/u);

    writeAndCommit(root, rel, {
      schemaVersion: 'act-resource-binding-reviews/v1',
      deltaReceiptId: 'delta-receipt:test',
      authoringRevision: 'a'.repeat(40),
      reviews: {
        'canonical-resource-pair:abc': {
          outcome: 'ACCEPT',
          proposedRole: 'EXPLAINS',
          reviewIdentity: 'agent-review:grok:test',
          reviewerPromptVersion: 'v1',
          evidenceDigest: 'b'.repeat(64),
          rationale: 'conflict',
          reviewProvider: 'GPT',
        },
      },
    });
    await expect(
      loadTrackedBindingReviews(
        root,
        'delta-receipt:test',
        new Set(['canonical-resource-pair:abc']),
      ),
    ).rejects.toThrow(/GPT conflicts with Grok/u);
  });
});

describe('aggregate coverage Git helper (large artifacts / diagnostics)', () => {
  it('loads a committed Crosswalk artifact larger than Node default maxBuffer (1 MiB)', async () => {
    expect(AGGREGATE_GIT_MAX_BUFFER_BYTES).toBeGreaterThan(1 * 1024 * 1024);

    const root = initGitRepo();
    const rel =
      'course-content/authoring/knowledge/course-coverage/aggregate/active/act-crosswalk-semantic-reviews.json';
    const tripleKey = 'ctc:large\u001fchunk\u001fcite';
    const sentinel = 'SENTINEL_PROTECTED_CROSSWALK_BODY_DO_NOT_ECHO';
    // Build a valid schema body > 1 MiB (default spawnSync maxBuffer) while remaining
    // under AGGREGATE_GIT_MAX_BUFFER_BYTES so clean-capture load succeeds.
    const padding = 'x'.repeat(1.2 * 1024 * 1024);
    const doc = {
      schemaVersion: 'act-crosswalk-semantic-reviews/v1',
      deltaReceiptId: 'delta-receipt:test',
      authoringRevision: 'a'.repeat(40),
      reviews: {
        [tripleKey]: {
          outcome: 'UNSUPPORTED',
          reviewIdentity: 'agent-review:grok:test',
          reviewerPromptVersion: 'v1',
          evidenceDigest: 'b'.repeat(64),
          rationale: `${sentinel}:${padding}`,
        },
      },
    };
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    const raw = `${JSON.stringify(doc)}\n`;
    expect(Buffer.byteLength(raw, 'utf8')).toBeGreaterThan(1 * 1024 * 1024);
    writeFileSync(abs, raw, 'utf8');
    const run = (args: string[]) => {
      const result = spawnSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: AGGREGATE_GIT_MAX_BUFFER_BYTES,
      });
      if (result.status !== 0) throw new Error(result.stderr || args.join(' '));
    };
    run(['add', rel]);
    run(['commit', '-m', 'large crosswalk active']);

    const loaded = await loadTrackedCrosswalkSemanticReviews(
      root,
      'delta-receipt:test',
      new Set([tripleKey]),
    );
    expect(loaded[tripleKey]?.outcome).toBe('UNSUPPORTED');
    expect(loaded[tripleKey]?.rationale).toContain(sentinel);
  });

  it('formats Git failures without echoing stdout artifact bodies', () => {
    const sentinel = 'SENTINEL_PROTECTED_JSON_PAYLOAD_{"reviews":{"secret":true}}';
    const message = formatAggregateGitFailure(
      ['show', `${'a'.repeat(40)}:course-content/authoring/knowledge/course-coverage/aggregate/active/act-crosswalk-semantic-reviews.json`],
      {
        status: 128,
        error: null,
        stdout: `{\n  "schemaVersion": "act-crosswalk-semantic-reviews/v1",\n  "payload": "${sentinel}"\n}\n`,
        stderr: 'fatal: path not in the working tree',
      },
    );
    expect(message).toContain('Aggregate coverage Git verification failed');
    expect(message).toContain('show');
    expect(message).toContain('fatal: path not in the working tree');
    expect(message).not.toContain(sentinel);
    expect(message).not.toContain('schemaVersion');
    expect(message).not.toContain('"reviews"');
  });

  it('classifies maxBuffer overflow without dumping stdout', () => {
    const sentinel = 'SENTINEL_ENOBUFS_BODY_' + 'z'.repeat(200);
    const err = Object.assign(new Error('spawnSync git ENOBUFS'), { code: 'ENOBUFS' });
    const message = formatAggregateGitFailure(
      ['show', 'HEAD:course-content/authoring/knowledge/course-coverage/aggregate/active/act-crosswalk-semantic-reviews.json'],
      {
        status: null,
        error: err,
        stdout: sentinel,
        stderr: '',
      },
    );
    expect(message).toMatch(/maxBuffer/u);
    expect(message).toContain(String(AGGREGATE_GIT_MAX_BUFFER_BYTES));
    expect(message).not.toContain(sentinel);
    expect(message).not.toContain('SENTINEL_ENOBUFS_BODY_');
  });
});
