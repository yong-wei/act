import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const standaloneRoot = path.join(root, '.next', 'standalone');
const maxTraceFiles = Number(process.env.TRACE_BOUNDARY_MAX_NFT_FILES ?? 5000);

const unexpectedStandaloneEntries = [
  'docs',
  'generated-images',
  'openspec',
  'rust',
  'tests',
  path.join('course-content', '.codex'),
  path.join('course-content', 'authoring', 'knowledge'),
  path.join('course-content', 'authoring', 'lessons'),
  path.join('course-content', 'authoring', 'shared', 'homework-problems'),
  path.join('course-content', 'authoring', 'shared', 'schema'),
  path.join('course-content', 'docs'),
  path.join('course-content', 'notes'),
  path.join('course-content', 'questions'),
  path.join('course-content', 'resource-library'),
  path.join('course-content', 'scripts'),
  path.join('course-content', 'slides-ref'),
  path.join('course-content', 'syllabus-refactor'),
  path.join('course-content', 'tests'),
  path.join('course-content', 'AGENTS.override.md'),
  path.join('course-content', 'CLAUDE.md'),
  path.join('course-content', 'README.md'),
];

const requiredStandaloneFiles = [
  path.join('course-content', 'authoring', 'shared', 'lesson-id-map.json'),
  path.join('course-content', 'runtime', 'resource-governance', 'adaptive-assessment-item-catalog-items.jsonl'),
  path.join('course-content', 'runtime', 'resource-governance', 'assessment-item-semantic-review-snapshots.jsonl'),
];

const externalRuntimeMountPoint = path.join('course-content', 'runtime');

const unexpectedTraceFragments = [
  'course-content/.codex/',
  'course-content/authoring/knowledge/',
  'course-content/authoring/lessons/',
  'course-content/authoring/shared/homework-problems/',
  'course-content/authoring/shared/schema/',
  'course-content/runtime/',
  'course-content/AGENTS.override.md',
  'course-content/CLAUDE.md',
  'course-content/README.md',
];
const allowedRuntimeTraceEntries = new Set([
  'course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl',
  'course-content/runtime/resource-governance/assessment-item-semantic-review-snapshots.jsonl',
]);

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

function traceFileCount(file) {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(payload.files) ? payload.files.length : 0;
}

assert.ok(fs.existsSync(standaloneRoot), 'Expected .next/standalone to exist after production build.');

assert.equal(
  path.join('/app', externalRuntimeMountPoint),
  '/app/course-content/runtime',
  'Runtime content must remain an external deployment mount point.',
);

for (const relativePath of unexpectedStandaloneEntries) {
  assert.ok(
    !fs.existsSync(path.join(standaloneRoot, relativePath)),
    `.next/standalone must not include non-runtime directory ${relativePath}`,
  );
}

for (const relativePath of requiredStandaloneFiles) {
  assert.ok(
    fs.existsSync(path.join(standaloneRoot, relativePath)),
    `.next/standalone is missing required runtime file ${relativePath}`,
  );
}

const nftFiles = walkFiles(path.join(root, '.next'), (file) => file.endsWith('.nft.json'));
assert.ok(nftFiles.length > 0, 'Expected Next.js .nft.json files to exist after production build.');

const largestTrace = nftFiles
  .map((file) => ({ file, count: traceFileCount(file) }))
  .sort((left, right) => right.count - left.count)[0];

assert.ok(
  largestTrace.count <= maxTraceFiles,
  `Trace expansion is too broad: ${path.relative(root, largestTrace.file)} contains ${largestTrace.count} files; limit is ${maxTraceFiles}.`,
);

for (const traceFile of nftFiles) {
  const payload = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
  const files = Array.isArray(payload.files) ? payload.files : [];
  const offender = files.find((entry) => {
    const normalized = entry.replaceAll('\\', '/').replace(/^(\.\.\/)+/, '');
    if (allowedRuntimeTraceEntries.has(normalized)) return false;
    return unexpectedTraceFragments.some((fragment) => normalized.startsWith(fragment));
  });
  assert.equal(
    offender,
    undefined,
    `${path.relative(root, traceFile)} traces non-runtime file ${offender}`,
  );
}

console.log('test-turbopack-trace-boundary passed');
