#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

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
    base: baseIndex >= 0 ? args[baseIndex + 1] ?? 'origin/integration' : 'origin/integration',
  };
}

function readGitDiff(input: { staged: boolean; base: string }): string {
  const args = input.staged
    ? ['diff', '--cached', '--unified=0', '--no-ext-diff']
    : ['diff', '--unified=0', '--no-ext-diff', `${input.base}...HEAD`];
  try {
    return execFileSync('git', args, { encoding: 'utf8' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`无法读取 portrait-v2 门禁差异：${message}`);
  }
}

function inspectDiff(diff: string): PortraitV2PrimaryGateIssue[] {
  const issues: PortraitV2PrimaryGateIssue[] = [];
  let filePath: string | null = null;
  let addedLines: string[] = [];
  let addedLineNumbers: number[] = [];
  let newLine = 0;

  const flush = () => {
    if (!filePath) return;
    const source = existsSync(filePath) ? readFileSync(filePath, 'utf8') : addedLines.join('\n');
    issues.push(...inspectPortraitV2PrimaryUsage({
      filePath,
      addedLines,
      addedLineNumbers,
      source,
    }));
    filePath = null;
    addedLines = [];
    addedLineNumbers = [];
    newLine = 0;
  };

  for (const line of diff.split('\n')) {
    const fileMatch = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (fileMatch) {
      flush();
      filePath = fileMatch[2];
      continue;
    }
    const hunkMatch = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunkMatch) {
      newLine = Number(hunkMatch[1]);
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

function countChangedFiles(diff: string): number {
  return new Set(
    diff.split('\n')
      .map((line) => /^diff --git a\/(.+) b\/(.+)$/.exec(line)?.[2])
      .filter((filePath): filePath is string => Boolean(filePath)),
  ).size;
}
