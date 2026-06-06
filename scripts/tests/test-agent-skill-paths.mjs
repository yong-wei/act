import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scanRoots = [
  '.agents/skills',
  'scripts',
  'src',
  'course-content/authoring',
  'course-content/scripts',
  'course-content/tests',
  'docs/memory',
];
const pathPattern = /\.agents\/skills\/[A-Za-z0-9._/-]+/g;
const missing = [];
const oldCodexSkillReferences = [];
const symlinkProblems = [];
const externalBuddySkills = new Set(['openspec-buddy', 'openspec-buddy-auto']);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    if (entry.isFile() && /\.(md|mjs|js|ts|tsx|py|sh)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function normalizeReference(raw) {
  return raw
    .replace(/[\\`'"),.;:]+$/g, '')
    .replace(/\/SKILL\.md\/?$/, '/SKILL.md');
}

for (const scanRoot of scanRoots) {
  for (const file of walk(path.join(root, scanRoot))) {
    const text = fs.readFileSync(file, 'utf8');
    const relativeFile = path.relative(root, file);
    if (
      relativeFile !== 'scripts/tests/test-agent-skill-paths.mjs' &&
      (/\.codex\/skills|\.codex\\\/skills|['"]\.codex['"]\s*\/\s*['"]skills['"]/.test(text))
    ) {
      oldCodexSkillReferences.push(relativeFile);
    }
    for (const match of text.matchAll(pathPattern)) {
      const reference = normalizeReference(match[0]);
      if (text.slice(Math.max(0, match.index - 80), match.index).includes('Path.home()')) continue;
      const absolute = path.join(root, reference);
      if (!fs.existsSync(absolute)) {
        missing.push(`${path.relative(root, file)} -> ${reference}`);
      }
    }
  }
}

if (oldCodexSkillReferences.length) {
  throw new Error(`Old ${'.codex' + '/skills'} references remain:\n${oldCodexSkillReferences.join('\n')}`);
}

if (missing.length) {
  throw new Error(`Missing .agents skill path references:\n${missing.join('\n')}`);
}

function assertSkillSymlinks(baseDir) {
  const absoluteBase = path.join(root, baseDir);
  if (!fs.existsSync(absoluteBase)) return;

  for (const name of fs.readdirSync(absoluteBase)) {
    const full = path.join(absoluteBase, name);
    const stat = fs.lstatSync(full);
    if (!stat.isSymbolicLink()) continue;

    const target = fs.readlinkSync(full);
    if (path.isAbsolute(target)) {
      symlinkProblems.push(`${baseDir}/${name} uses absolute symlink target: ${target}`);
      continue;
    }

    const resolved = path.resolve(path.dirname(full), target);
    if (!fs.existsSync(path.join(resolved, 'SKILL.md'))) {
      symlinkProblems.push(`${baseDir}/${name} target has no SKILL.md: ${target}`);
    }

    if (baseDir === '.claude/skills' && externalBuddySkills.has(name) && target.includes('/.agents/skills/')) {
      symlinkProblems.push(`${baseDir}/${name} must link directly to external Buddy source, not through .agents: ${target}`);
    }
  }
}

assertSkillSymlinks('.agents/skills');
assertSkillSymlinks('.claude/skills');
assertSkillSymlinks('.gemini/skills');

if (symlinkProblems.length) {
  throw new Error(`Invalid skill symlinks:\n${symlinkProblems.join('\n')}`);
}

console.log('agent skill path references test passed');
