import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { CANONICAL_CLOSURE_COMMAND, CANONICAL_CLOSURE_MODULE, CANONICAL_CLOSURE_SCRIPT, UPSTREAM_AUTHORITY_COMMANDS } from './stages';

const FORBIDDEN_IMPORT_PREFIXES = [
  'src/app/',
  'src/features/',
  'src/resources/',
  'src/components/',
  'src/hooks/',
  'src/workers/',
  'prisma/',
];

const ALLOWED_PATH_PREFIXES = [
  `${CANONICAL_CLOSURE_MODULE}/`,
  'src/lib/__tests__/architecture-closure',
];

const ALLOWED_PATHS = new Set([
  CANONICAL_CLOSURE_SCRIPT,
  `${CANONICAL_CLOSURE_MODULE}/index.ts`,
]);

const CLOSURE_IMPORT = /architecture-closure/;
const COMPETING_SCRIPT = /(?:global[-:]closure|architecture[-:]closure|refactor[-:]closure)/i;

export interface CharacterizationFinding {
  readonly identity: string;
  readonly reason: string;
}

export function isAllowedClosurePath(path: string): boolean {
  const normalized = path.replaceAll('\\', '/');
  if (ALLOWED_PATHS.has(normalized)) return true;
  return ALLOWED_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function competingScriptsFromPackage(scripts: Record<string, string>): CharacterizationFinding[] {
  const findings: CharacterizationFinding[] = [];
  for (const [name, value] of Object.entries(scripts).sort(([left], [right]) => left.localeCompare(right))) {
    if (name === CANONICAL_CLOSURE_COMMAND) continue;
    if ((UPSTREAM_AUTHORITY_COMMANDS as readonly string[]).includes(name)) continue;
    if (COMPETING_SCRIPT.test(name) || COMPETING_SCRIPT.test(value)) {
      findings.push({ identity: `script:${name}`, reason: 'competing-global-closure-command' });
    }
  }
  return findings;
}

export function competingFile(path: string, content: string): CharacterizationFinding | null {
  const normalized = path.replaceAll('\\', '/');
  if (isAllowedClosurePath(normalized)) return null;
  if (FORBIDDEN_IMPORT_PREFIXES.some((prefix) => normalized.startsWith(prefix)) && CLOSURE_IMPORT.test(content)) {
    return { identity: `import:${normalized}`, reason: 'forbidden-closure-consumer' };
  }
  if (COMPETING_SCRIPT.test(normalized) && !normalized.startsWith('openspec/')) {
    return { identity: `file:${normalized}`, reason: 'competing-global-closure-artifact' };
  }
  if (/\b(?:export\s+\*\s+from|export\s+\{[^}]*\}\s+from)\s+['"][^'"]*architecture-closure/u.test(content)
    && !isAllowedClosurePath(normalized)) {
    return { identity: `facade:${normalized}`, reason: 'unbounded-closure-reexport' };
  }
  return null;
}

export function characterizeSources(
  scripts: Record<string, string>,
  files: readonly { path: string; content: string }[],
): CharacterizationFinding[] {
  const findings = [...competingScriptsFromPackage(scripts)];
  for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
    const finding = competingFile(file.path, file.content);
    if (finding) findings.push(finding);
  }
  return findings;
}

function walk(root: string, relativeDir: string, acc: { path: string; content: string }[]): void {
  const dir = join(root, relativeDir);
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries.sort()) {
    if (name === 'node_modules' || name === '.next' || name === '.git' || name === 'coverage') continue;
    const rel = relativeDir ? `${relativeDir}/${name}` : name;
    const full = join(root, rel);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walk(root, rel, acc);
      continue;
    }
    if (!/\.(?:ts|tsx|mjs|js|md)$/u.test(name)) continue;
    if (stat.size > 2 * 1024 * 1024) continue;
    acc.push({ path: rel.replaceAll('\\', '/'), content: readFileSync(full, 'utf8') });
  }
}

export function characterizeRepository(repoRoot: string): CharacterizationFinding[] {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
  const files: { path: string; content: string }[] = [];
  for (const dir of ['src/app', 'src/features', 'src/resources', 'src/components', 'src/hooks', 'src/lib', 'scripts', 'prisma']) {
    walk(repoRoot, dir, files);
  }
  return characterizeSources(pkg.scripts ?? {}, files);
}
