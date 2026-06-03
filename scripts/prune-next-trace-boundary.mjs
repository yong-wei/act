import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const traceRoots = [
  path.join(root, '.next', 'server'),
  path.join(root, '.next', 'standalone', '.next', 'server'),
];

const blockedTraceFragments = [
  'course-content/authoring/knowledge/',
  'course-content/authoring/lessons/',
  'course-content/authoring/shared/',
  'course-content/runtime/',
  'course-content/.codex/',
  'course-content/docs/',
  'course-content/notes/',
  'course-content/questions/',
  'course-content/resource-library/',
  'course-content/scripts/',
  'course-content/slides-ref/',
  'course-content/syllabus-refactor/',
  'course-content/tests/',
  'docs/',
  'generated-images/',
  'openspec/',
  'rust/',
  'tests/',
  '.codex/',
  '.wolf/',
];

const allowedTraceEntries = new Set([
  'course-content/authoring/shared/lesson-id-map.json',
]);

const blockedTraceEntries = new Set([
  'course-content/AGENTS.override.md',
  'course-content/CLAUDE.md',
  'course-content/README.md',
]);

const blockedStandalonePaths = [
  path.join('course-content', '.codex'),
  path.join('course-content', 'authoring', 'knowledge'),
  path.join('course-content', 'authoring', 'lessons'),
  path.join('course-content', 'authoring', 'shared'),
  path.join('course-content', 'runtime'),
  path.join('course-content', 'docs'),
  path.join('course-content', 'notes'),
  path.join('course-content', 'questions'),
  path.join('course-content', 'resource-library'),
  path.join('course-content', 'scripts'),
  path.join('course-content', 'slides-ref'),
  path.join('course-content', 'syllabus-refactor'),
  path.join('course-content', 'tests'),
  'docs',
  'generated-images',
  'openspec',
  'rust',
  'tests',
];

const blockedStandaloneFiles = [
  path.join('course-content', 'AGENTS.override.md'),
  path.join('course-content', 'CLAUDE.md'),
  path.join('course-content', 'README.md'),
];

const requiredSharedMap = path.join(
  root,
  'course-content',
  'authoring',
  'shared',
  'lesson-id-map.json',
);

function walkFiles(dir, predicate, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absolute, predicate, acc);
    } else if (predicate(absolute)) {
      acc.push(absolute);
    }
  }
  return acc;
}

function normalizeTraceEntry(entry) {
  return entry.replaceAll('\\', '/').replace(/^(\.\.\/)+/, '');
}

function isBlockedTraceEntry(entry) {
  const normalized = normalizeTraceEntry(entry);
  if (allowedTraceEntries.has(normalized)) {
    return false;
  }
  if (blockedTraceEntries.has(normalized)) {
    return true;
  }
  return blockedTraceFragments.some((fragment) => normalized.startsWith(fragment));
}

let prunedTraceEntries = 0;
for (const traceRoot of traceRoots) {
  for (const traceFile of walkFiles(traceRoot, (file) => file.endsWith('.nft.json'))) {
    const payload = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
    if (!Array.isArray(payload.files)) continue;

    const filteredFiles = payload.files.filter((entry) => !isBlockedTraceEntry(entry));
    prunedTraceEntries += payload.files.length - filteredFiles.length;
    payload.files = filteredFiles;
    fs.writeFileSync(traceFile, `${JSON.stringify(payload)}\n`);
  }
}

let removedStandaloneEntries = 0;
const standaloneRoot = path.join(root, '.next', 'standalone');
const standaloneLessonIdMap = path.join(
  standaloneRoot,
  'course-content',
  'authoring',
  'shared',
  'lesson-id-map.json',
);
if (fs.existsSync(requiredSharedMap)) {
  fs.mkdirSync(path.dirname(standaloneLessonIdMap), { recursive: true });
  fs.copyFileSync(requiredSharedMap, standaloneLessonIdMap);
}

for (const relativePath of blockedStandalonePaths) {
  const absolutePath = path.join(standaloneRoot, relativePath);
  if (fs.existsSync(absolutePath)) {
    fs.rmSync(absolutePath, { recursive: true, force: true });
    removedStandaloneEntries += 1;
  }
}

if (fs.existsSync(requiredSharedMap)) {
  fs.mkdirSync(path.dirname(standaloneLessonIdMap), { recursive: true });
  fs.copyFileSync(requiredSharedMap, standaloneLessonIdMap);
}

for (const relativePath of blockedStandaloneFiles) {
  const absolutePath = path.join(standaloneRoot, relativePath);
  if (fs.existsSync(absolutePath)) {
    fs.rmSync(absolutePath, { force: true });
    removedStandaloneEntries += 1;
  }
}

console.log(
  `Pruned ${prunedTraceEntries} non-runtime trace entries and removed ${removedStandaloneEntries} standalone directories.`,
);
