/**
 * 盲审评测 CLI 共享辅助（Issue #1820）：git 修订与 flag 参数解析。
 */

import { execFileSync } from 'node:child_process';

export function gitRevision(): string {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
    return dirty ? `${commit}-dirty` : commit;
  } catch {
    return 'unknown';
  }
}

export type CliFlagValues = Record<string, string>;

/**
 * 解析 `--flag value` 形式参数；unknown flag 追加到 rest。
 */
export function parseCliFlags(argv: readonly string[], knownFlags: readonly string[]): {
  values: CliFlagValues;
  rest: string[];
} {
  const values: CliFlagValues = {};
  const rest: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const flagName = arg.startsWith('--') ? arg.slice(2) : null;
    if (flagName && knownFlags.includes(flagName) && index + 1 < argv.length) {
      values[flagName] = argv[index + 1];
      index += 1;
    } else {
      rest.push(arg);
    }
  }
  return { values, rest };
}

export function defaultRunId(suffix: string): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${suffix}`;
}
