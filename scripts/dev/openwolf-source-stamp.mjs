#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, filePath);
}

function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return process.cwd();
  }
}

function inferBranch(root) {
  try {
    const branch = execFileSync('git', ['-C', root, 'branch', '--show-current'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (branch) return branch;
  } catch {
    // fall through to detached identifier
  }

  try {
    return execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function inferWorktreeId(root) {
  const marker = '/.codex/worktrees/';
  const idx = root.indexOf(marker);
  if (idx !== -1) {
    return root.slice(idx + marker.length).split('/')[0] || 'worktree';
  }
  return path.basename(root) || 'worktree';
}

function acquireLock(lockDir) {
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    try {
      fs.mkdirSync(lockDir);
      return true;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  return false;
}

function stampLines(text, stamp) {
  return text
    .split(/(\n)/)
    .map((part, index, parts) => {
      if (part === '\n') return part;
      const next = parts[index + 1] === '\n' ? '\n' : '';
      const line = part;

      if (line.startsWith('## Session:') && !line.includes(' - Source: ')) {
        return `${line} - Source: ${stamp}`;
      }

      if (/^\| \d{2}:\d{2} \| \[[^\]]+\] /.test(line)) {
        return line;
      }

      if (/^\| \d{2}:\d{2} \| /.test(line)) {
        return line.replace(/^\| (\d{2}:\d{2}) \| /, `| $1 | ${stamp} `);
      }

      if (next === '\n' || index === parts.length - 1) return line;
      return line;
    })
    .join('');
}

function main() {
  const root = repoRoot();
  const wolfDir = path.join(root, '.wolf');
  const memoryPath = path.join(wolfDir, 'memory.md');
  const statePath = path.join(wolfDir, 'source-stamp-state.json');
  const sourcePath = path.join(wolfDir, 'worktree-source.json');

  if (!fs.existsSync(memoryPath)) return;
  const writableMemoryPath = fs.realpathSync(memoryPath);

  const source = readJson(sourcePath, {
    id: inferWorktreeId(root),
    branch: inferBranch(root),
    path: root,
  });
  const label = source.label || `${source.branch || inferBranch(root)}:${source.id || inferWorktreeId(root)}`;
  const stamp = `[${label}]`;

  const realMemoryDir = path.dirname(writableMemoryPath);
  const lockDir = path.join(realMemoryDir, '.source-stamp.lock');
  if (!acquireLock(lockDir)) return;

  try {
    const contentBuffer = fs.readFileSync(writableMemoryPath);
    const size = contentBuffer.length;
    const state = readJson(statePath, {});

    if (typeof state.memorySize !== 'number') {
      writeJson(statePath, { memorySize: size, updatedAt: new Date().toISOString() });
      return;
    }

    if (size < state.memorySize) {
      writeJson(statePath, { memorySize: size, updatedAt: new Date().toISOString() });
      return;
    }

    const prefixBuffer = contentBuffer.subarray(0, state.memorySize);
    const suffix = contentBuffer.subarray(state.memorySize).toString('utf8');
    if (!suffix) {
      writeJson(statePath, { memorySize: size, updatedAt: new Date().toISOString() });
      return;
    }

    const stampedSuffix = stampLines(suffix, stamp);
    const stampedSuffixBuffer = Buffer.from(stampedSuffix, 'utf8');
    const nextContentBuffer = Buffer.concat([prefixBuffer, stampedSuffixBuffer]);
    if (!nextContentBuffer.equals(contentBuffer)) {
      const tmp = `${writableMemoryPath}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, nextContentBuffer);
      fs.renameSync(tmp, writableMemoryPath);
    }

    writeJson(statePath, {
      memorySize: nextContentBuffer.length,
      updatedAt: new Date().toISOString(),
    });
  } finally {
    try {
      fs.rmdirSync(lockDir);
    } catch {
      // best effort
    }
  }
}

main();
