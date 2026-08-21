import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertRuntimeCaptureRevisionProofMatches,
  computeCaptureRevisionProof,
  createRuntimeCaptureRevisionProbeUrl,
  fetchRuntimeCaptureRevisionProof,
  parseRuntimeCaptureRevisionProof,
} from '../commercial-ui-capture-revision';
import {
  commercialRuntimeRevisionProofObjectProblems,
  commercialRuntimeRevisionProofProblems,
} from '../commercial-ui-governance';

const localProof = {
  commitSha: 'a'.repeat(40),
  treeSha: 'b'.repeat(40),
  sourceFingerprint: 'c'.repeat(64),
  clean: true,
} as const;

const manifestRuntimeProof = {
  endpoint: 'http://localhost:3002/api/internal/local-qa/revision',
  expected: localProof,
  beforeCapture: localProof,
  afterCapture: localProof,
} as const;

function git(repositoryRoot: string, args: string[]) {
  execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

describe('commercial UI runtime capture proof', () => {
  it('fails closed when the target service reports another commit', () => {
    const runtimeProof = {
      ...localProof,
      commitSha: 'd'.repeat(40),
    };
    expect(() => assertRuntimeCaptureRevisionProofMatches(localProof, runtimeProof, 'knowledge capture service'))
      .toThrow(/commitSha/u);
  });

  it('requires a complete, internally consistent runtime proof in governed artifacts', () => {
    expect(commercialRuntimeRevisionProofProblems(manifestRuntimeProof)).toEqual([]);
    expect(commercialRuntimeRevisionProofProblems(undefined)).toContain('runtimeRevisionProof:missing');
    expect(commercialRuntimeRevisionProofProblems({
      ...manifestRuntimeProof,
      beforeCapture: { ...localProof, treeSha: 'd'.repeat(40) },
    })).toContain('runtimeRevisionProof.beforeCapture.treeSha=expected');
    expect(commercialRuntimeRevisionProofProblems({
      ...manifestRuntimeProof,
      extra: true,
    })).toContain('runtimeRevisionProof:fields');
  });

  it('rejects runtime proofs whose commit and tree are not real related Git objects', () => {
    const repositoryRoot = mkdtempSync(path.join(os.tmpdir(), 'commercial-ui-runtime-proof-git-'));
    try {
      mkdirSync(path.join(repositoryRoot, 'src'), { recursive: true });
      writeFileSync(path.join(repositoryRoot, 'src/source.ts'), 'export const source = true;\n');
      git(repositoryRoot, ['init']);
      git(repositoryRoot, ['config', 'user.name', 'Capture Test']);
      git(repositoryRoot, ['config', 'user.email', 'capture-test@example.invalid']);
      git(repositoryRoot, ['add', 'src/source.ts']);
      git(repositoryRoot, ['commit', '-m', 'capture proof']);
      const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
      const treeSha = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
      expect(commercialRuntimeRevisionProofObjectProblems({
        ...manifestRuntimeProof,
        expected: { ...localProof, commitSha, treeSha },
        beforeCapture: { ...localProof, commitSha, treeSha },
        afterCapture: { ...localProof, commitSha, treeSha },
      }, repositoryRoot)).toEqual([]);
      expect(commercialRuntimeRevisionProofObjectProblems(manifestRuntimeProof, repositoryRoot))
        .toContain('runtimeRevisionProof.expected.commitSha:object');
      expect(commercialRuntimeRevisionProofObjectProblems({
        ...manifestRuntimeProof,
        expected: { ...localProof, commitSha, treeSha: '0'.repeat(40) },
      }, repositoryRoot)).toContain('runtimeRevisionProof.expected.treeSha=commit');

      git(repositoryRoot, ['tag', '-a', 'annotated-proof', '-m', 'annotated capture proof', commitSha]);
      const annotatedTagSha = execFileSync('git', ['rev-parse', 'refs/tags/annotated-proof^{tag}'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
      }).trim();
      expect(commercialRuntimeRevisionProofObjectProblems({
        ...manifestRuntimeProof,
        expected: { ...localProof, commitSha: annotatedTagSha, treeSha },
        beforeCapture: { ...localProof, commitSha: annotatedTagSha, treeSha },
        afterCapture: { ...localProof, commitSha: annotatedTagSha, treeSha },
      }, repositoryRoot)).toContain('runtimeRevisionProof.expected.commitSha:object');

      const primaryBranch = execFileSync('git', ['branch', '--show-current'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
      }).trim();
      git(repositoryRoot, ['checkout', '-b', 'foreign-proof']);
      writeFileSync(path.join(repositoryRoot, 'src/source.ts'), 'export const source = false;\n');
      git(repositoryRoot, ['add', 'src/source.ts']);
      git(repositoryRoot, ['commit', '-m', 'foreign capture proof']);
      const foreignCommitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
      }).trim();
      const foreignTreeSha = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
      }).trim();
      git(repositoryRoot, ['checkout', primaryBranch]);
      expect(commercialRuntimeRevisionProofObjectProblems({
        ...manifestRuntimeProof,
        expected: { ...localProof, commitSha: foreignCommitSha, treeSha: foreignTreeSha },
        beforeCapture: { ...localProof, commitSha: foreignCommitSha, treeSha: foreignTreeSha },
        afterCapture: { ...localProof, commitSha: foreignCommitSha, treeSha: foreignTreeSha },
      }, repositoryRoot)).toContain('runtimeRevisionProof.expected.commitSha=current-head');
    } finally {
      rmSync(repositoryRoot, { recursive: true, force: true });
    }
  });

  it('reads the same-origin probe before accepting a capture', async () => {
    const baseUrl = 'http://localhost:3002';
    const probeUrl = 'http://localhost:3002/api/internal/local-qa/revision';
    expect(createRuntimeCaptureRevisionProbeUrl(baseUrl)).toBe(probeUrl);
    expect(parseRuntimeCaptureRevisionProof(localProof)).toEqual(localProof);

    const proof = await fetchRuntimeCaptureRevisionProof(baseUrl, async (input) => {
      expect(input).toBe(probeUrl);
      return new Response(JSON.stringify(localProof), { status: 200 });
    });
    expect(proof).toEqual(localProof);

    await expect(fetchRuntimeCaptureRevisionProof(baseUrl, async () => (
      new Response(JSON.stringify({ ...localProof, clean: false }), { status: 200 })
    ))).rejects.toThrow(/dirty service/u);
  });

  it('allows capture output paths to change after the source checkpoint', () => {
    const repositoryRoot = mkdtempSync(path.join(os.tmpdir(), 'commercial-ui-capture-proof-'));
    const sourceFile = 'src/capture-source.ts';
    const outputFile = 'artifacts/knowledge-workspace-product-qa-489/screenshot.png';

    try {
      mkdirSync(path.join(repositoryRoot, 'src'), { recursive: true });
      mkdirSync(path.join(repositoryRoot, 'artifacts/knowledge-workspace-product-qa-489'), { recursive: true });
      writeFileSync(path.join(repositoryRoot, sourceFile), 'export const captureSource = true;\n');
      writeFileSync(path.join(repositoryRoot, outputFile), 'before\n');
      git(repositoryRoot, ['init']);
      git(repositoryRoot, ['config', 'user.name', 'Capture Test']);
      git(repositoryRoot, ['config', 'user.email', 'capture-test@example.invalid']);
      git(repositoryRoot, ['add', sourceFile, outputFile]);
      git(repositoryRoot, ['commit', '-m', 'test capture proof']);

      writeFileSync(path.join(repositoryRoot, outputFile), 'after\n');

      expect(computeCaptureRevisionProof(
        repositoryRoot,
        [sourceFile],
        ['artifacts/knowledge-workspace-product-qa-489/'],
      ).clean).toBe(true);
    } finally {
      rmSync(repositoryRoot, { recursive: true, force: true });
    }
  });
});
