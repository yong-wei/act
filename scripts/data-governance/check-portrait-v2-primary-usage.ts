#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  inspectPortraitV2PrimaryUsage,
  type PortraitV2PrimaryGateIssue,
} from '@/lib/data-governance/portrait-v2-primary-gate';

const options = resolveDiffOptions(parseArgs(process.argv.slice(2)));
const renameSources = new Map<string, string>();
const changedFiles = readChangedFiles(options).filter(isPotentiallyScannablePath);
const issues = changedFiles.flatMap((filePath) => inspectDiff(readGitDiff(options, filePath), filePath));

if (issues.length > 0) {
  console.error(`portrait-v2 primary usage gate failed (${issues.length} issue(s))`);
  for (const issue of issues) {
    console.error(`- ${issue.filePath}:${issue.line} ${issue.code}: ${issue.message}`);
  }
  process.exit(1);
}

console.log(`portrait-v2 primary usage gate passed (${changedFiles.length} changed file(s) scanned)`);

function parseArgs(args: string[]) {
  const staged = args.includes('--staged');
  const baseIndex = args.indexOf('--base');
  if (baseIndex >= 0 && !args[baseIndex + 1]) {
    throw new Error('--base requires a git commit reference');
  }
  return {
    staged,
    base: baseIndex >= 0 ? args[baseIndex + 1] ?? null : null,
  };
}

function resolveDiffOptions(input: { staged: boolean; base: string | null }) {
  return {
    staged: input.staged,
    base: input.staged ? null : resolveDiffBase(input.base),
    stagedBase: input.staged ? resolveStagedDiffBase() : null,
  };
}

function readChangedFiles(input: { staged: boolean; base: string | null; stagedBase: string | null }): string[] {
  renameSources.clear();
  if (!input.staged) {
    try {
      return execFileSync('git', buildUnstagedDiffArgs(input.base, true), {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      }).split('\0').filter(Boolean);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`无法读取 portrait-v2 门禁文件列表：${message}`);
    }
  }
  try {
    const tokens = execFileSync('git', [
      'diff',
      '--cached',
      '-M',
      '--name-status',
      '-z',
      '--diff-filter=ACMR',
      '--no-ext-diff',
      input.stagedBase!,
    ], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    }).split('\0').filter(Boolean);
    const files: string[] = [];
    for (let index = 0; index < tokens.length; ) {
      const status = tokens[index] ?? '';
      if (status.startsWith('R') || status.startsWith('C')) {
        const fromPath = tokens[index + 1] ?? '';
        const toPath = tokens[index + 2] ?? '';
        if (toPath) {
          files.push(toPath);
          if (fromPath) renameSources.set(toPath, fromPath);
        }
        index += 3;
        continue;
      }
      const filePath = tokens[index + 1];
      if (filePath) files.push(filePath);
      index += 2;
    }
    return files;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`无法读取 portrait-v2 门禁文件列表：${message}`);
  }
}

function readGitDiff(input: { staged: boolean; base: string | null; stagedBase: string | null }, filePath: string): string {
  const renameSource = renameSources.get(filePath);
  const followRename = Boolean(renameSource && isPotentiallyScannablePath(renameSource));
  const paths = followRename && renameSource ? [renameSource, filePath] : [filePath];
  const args = input.staged
    ? ['diff', '--cached', '-M', '--unified=0', '--no-ext-diff', input.stagedBase!, '--', ...paths]
    : [...buildUnstagedDiffArgs(input.base, false), '--', ...paths];
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`无法读取 portrait-v2 门禁差异：${message}`);
  }
}

function buildUnstagedDiffArgs(requestedBase: string | null, namesOnly: boolean): string[] {
  const outputArgs = namesOnly
    ? ['--name-only', '--diff-filter=ACMR', '-z']
    : ['--unified=0'];
  return requestedBase
    ? ['diff', ...outputArgs, '--no-ext-diff', `${requestedBase}...HEAD`]
    : ['diff-tree', '--root', ...outputArgs, '--no-commit-id', '-r', 'HEAD'];
}

function isPotentiallyScannablePath(filePath: string): boolean {
  return /^(?:src|scripts)\/.+\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) &&
    !/(^|\/)__tests__(\/|$)/.test(filePath) &&
    !/(^|\/)tests?(\/|\.|$)/.test(filePath) &&
    !/(^|\/)fixtures?(\/|\.|$)/.test(filePath) &&
    !/(^|\/)portrait-v2-primary-gate\.ts$/.test(filePath);
}

function resolveDiffBase(requestedBase: string | null): string | null {
  if (requestedBase) {
    const resolved = resolveGitRef(requestedBase);
    if (!resolved) {
      throw new Error(`无法解析显式 portrait-v2 门禁基线：${requestedBase}`);
    }
    return resolved;
  }

  const candidates = ['origin/integration', '@{upstream}', 'HEAD^'];
  for (const candidate of candidates) {
    const resolved = resolveGitRef(candidate);
    if (resolved) return resolved;
  }
  return null;
}

function resolveStagedDiffBase(): string {
  try {
    const mergeHeadPath = execFileSync('git', ['rev-parse', '--git-path', 'MERGE_HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const fullMergeHeadPath = path.resolve(process.cwd(), mergeHeadPath);
    if (!existsSync(fullMergeHeadPath)) return 'HEAD';
    const mergeHeads = readFileSync(fullMergeHeadPath, 'utf8').trim().split(/\s+/).filter(Boolean);
    if (mergeHeads.length > 1) {
      throw new Error('portrait-v2 primary usage gate does not support octopus merge staging');
    }
    const incomingHead = resolveCommit(mergeHeads[0]);
    const integrationHead = resolveCommit('origin/integration');
    const currentHead = resolveCommit('HEAD');
    if (
      incomingHead &&
      integrationHead &&
      currentHead &&
      isAncestor(incomingHead, integrationHead) &&
      !isAncestor(currentHead, integrationHead)
    ) {
      return incomingHead;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not support octopus merge staging')) {
      throw error;
    }
    // Missing or malformed merge metadata conservatively compares the index with HEAD.
  }
  return 'HEAD';
}

function resolveCommit(ref: string | undefined): string | null {
  if (!ref) return null;
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch {
    return null;
  }
}

function isAncestor(candidate: string, descendant: string): boolean {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', candidate, descendant], { stdio: 'ignore' });
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 1) {
      return false;
    }
    throw error;
  }
}

function resolveGitRef(ref: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
      encoding: 'utf8',
    }).trim() || null;
  } catch {
    return null;
  }
}

function inspectDiff(diff: string, expectedFilePath: string): PortraitV2PrimaryGateIssue[] {
  const issues: PortraitV2PrimaryGateIssue[] = [];
  let filePath: string | null = expectedFilePath;
  let addedLines: string[] = [];
  let addedLineNumbers: number[] = [];
  let compatibilityRanges: Array<{ start: number; end: number }> = [];
  let newLine = 0;

  const flush = () => {
    if (!filePath) return;
    const source = readVersionedSource(
      filePath,
      options.staged ? 'index' : 'HEAD',
      addedLines.join('\n'),
    );
    issues.push(...inspectPortraitV2PrimaryUsage({
      filePath,
      addedLines,
      addedLineNumbers,
      compatibilityRanges,
      source,
    }));
    filePath = null;
    addedLines = [];
    addedLineNumbers = [];
    compatibilityRanges = [];
    newLine = 0;
  };

  for (const line of diff.split('\n')) {
    const hunkMatch = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunkMatch) {
      newLine = Number(hunkMatch[1]);
      const lineCount = Number(hunkMatch[2] ?? 1);
      compatibilityRanges.push({ start: newLine, end: newLine + lineCount - 1 });
      continue;
    }
    if (!filePath || line.startsWith('+++')) continue;
    if (line.startsWith('+')) {
      addedLines.push(line.slice(1));
      addedLineNumbers.push(newLine);
      newLine += 1;
    } else if (!line.startsWith('-') && !line.startsWith('\\')) {
      newLine += 1;
    }
  }
  flush();
  return issues;
}

function readVersionedSource(
  filePath: string,
  version: 'index' | 'HEAD',
  fallback: string,
): string {
  try {
    return execFileSync('git', ['show', version === 'index' ? `:${filePath}` : `HEAD:${filePath}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return fallback;
  }
}
