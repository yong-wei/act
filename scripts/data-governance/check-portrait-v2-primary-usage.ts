#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';

import {
  inspectPortraitV2PrimaryUsage,
  type PortraitV2PrimaryGateIssue,
} from '@/lib/data-governance/portrait-v2-primary-gate';

const options = parseArgs(process.argv.slice(2));
const diff = readGitDiff(options);
const issues = inspectDiff(diff);

if (issues.length > 0) {
  console.error(`portrait-v2 primary usage gate failed (${issues.length} issue(s))`);
  for (const issue of issues) {
    console.error(`- ${issue.filePath}:${issue.line} ${issue.code}: ${issue.message}`);
  }
  process.exit(1);
}

console.log(`portrait-v2 primary usage gate passed (${countChangedFiles(diff)} changed file(s) scanned)`);

function parseArgs(args: string[]) {
  const staged = args.includes('--staged');
  const baseIndex = args.indexOf('--base');
  return {
    staged,
    base: baseIndex >= 0 ? args[baseIndex + 1] ?? null : null,
  };
}

function readGitDiff(input: { staged: boolean; base: string | null }): string {
  const args = input.staged
    ? ['diff', '--cached', '--unified=0', '--no-ext-diff']
    : buildUnstagedDiffArgs(input.base);
  try {
    return execFileSync('git', args, { encoding: 'utf8' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`无法读取 portrait-v2 门禁差异：${message}`);
  }
}

function buildUnstagedDiffArgs(requestedBase: string | null): string[] {
  const base = resolveDiffBase(requestedBase);
  return base
    ? ['diff', '--unified=0', '--no-ext-diff', `${base}...HEAD`]
    : ['diff-tree', '--root', '--unified=0', '--no-commit-id', '-r', 'HEAD'];
}

function resolveDiffBase(requestedBase: string | null): string | null {
  const candidates = requestedBase
    ? [requestedBase, 'origin/integration', '@{upstream}', 'HEAD^']
    : ['origin/integration', '@{upstream}', 'HEAD^'];
  for (const candidate of candidates) {
    const resolved = resolveGitRef(candidate);
    if (resolved) return resolved;
  }
  return null;
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

function inspectDiff(diff: string): PortraitV2PrimaryGateIssue[] {
  const issues: PortraitV2PrimaryGateIssue[] = [];
  let filePath: string | null = null;
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
    const fileMatch = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (fileMatch) {
      flush();
      filePath = fileMatch[2];
      continue;
    }
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

function countChangedFiles(diff: string): number {
  return new Set(
    diff.split('\n')
      .map((line) => /^diff --git a\/(.+) b\/(.+)$/.exec(line)?.[2])
      .filter((filePath): filePath is string => Boolean(filePath)),
  ).size;
}
