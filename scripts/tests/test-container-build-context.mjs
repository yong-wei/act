import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dockerignore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8');
const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
const nextConfig = fs.readFileSync(path.join(root, 'next.config.js'), 'utf8');
const rules = dockerignore
  .split(/\r?\n/u)
  .map((rule) => rule.trim())
  .filter((rule) => rule && !rule.startsWith('#'));

function ruleIndex(rule) {
  return rules.indexOf(rule);
}

function requireRule(rule) {
  assert.notEqual(ruleIndex(rule), -1, `.dockerignore missing required rule: ${rule}`);
}

function requirePath(relativePath) {
  assert.ok(
    fs.existsSync(path.join(root, relativePath)),
    `release context input is missing: ${relativePath}`,
  );
}

for (const forbiddenPath of [
  'course-content/docs',
  'course-content/notes',
  'course-content/questions',
  'course-content/resource-library',
  'course-content/scripts',
  'course-content/slides-ref',
  'course-content/syllabus-refactor',
  'course-content/tests',
  'docs',
  'generated-images',
  'openspec',
  'rust',
  'tests',
]) {
  requireRule(forbiddenPath);
  assert.ok(
    nextConfig.includes(`'./${forbiddenPath}/**/*'`),
    `Next trace exclusions must justify Docker context exclusion: ${forbiddenPath}`,
  );
}

requireRule('course-content/authoring/lessons/*');
for (const compiledLessonInput of [
  'course-content/authoring/lessons/3-6/media/raw/generated-data/3-6-design-data.json',
  'course-content/authoring/lessons/4-1/media/raw/generated-data/4-1-case-data.json',
  'course-content/authoring/lessons/4-3/media/raw/generated-data/4-3-compound-design-data.json',
]) {
  requireRule(`!${compiledLessonInput}`);
  requirePath(compiledLessonInput);
}

const knowledgeDenyIndex = ruleIndex('course-content/authoring/knowledge/*');
assert.ok(knowledgeDenyIndex >= 0, 'authoring knowledge must be default-deny');
for (const admittedKnowledgePath of [
  '!course-content/authoring/knowledge/releases/**',
  '!course-content/authoring/knowledge/course-coverage/**',
  '!course-content/authoring/knowledge/authority/**',
  '!course-content/authoring/knowledge/cutover/envelopes/actkg-composite-envelope-registry.json',
]) {
  requireRule(admittedKnowledgePath);
  assert.ok(
    ruleIndex(admittedKnowledgePath) > knowledgeDenyIndex,
    `${admittedKnowledgePath} must follow the authoring knowledge deny rule`,
  );
}

for (const requiredInput of [
  'package.json',
  'package-lock.json',
  'next.config.js',
  'tsconfig.json',
  'prisma.config.ts',
  'prisma/schema.prisma',
  'docker-entrypoint.sh',
  'src/resources/control-system/wasm/control_engine/index.js',
  'src/resources/control-system/wasm/control_engine/index_bg.wasm',
  'src/resources/control-system/wasm/control_engine/index.d.ts',
  'scripts/wasm/build-control-engine.mjs',
  'scripts/build-next-with-trace-check.mjs',
  'scripts/prune-next-trace-boundary.mjs',
  'scripts/assets/validate-optimized-models.mjs',
  'tools/glb-model-optimizer/optimize-models.mjs',
  'course-content/authoring/shared/lesson-id-map.json',
  'course-content/authoring/knowledge/releases',
  'course-content/authoring/knowledge/course-coverage',
  'course-content/authoring/knowledge/authority',
  'course-content/authoring/knowledge/cutover/envelopes/actkg-composite-envelope-registry.json',
  'course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl',
  'course-content/runtime/resource-governance/assessment-item-semantic-review-snapshots.jsonl',
  'course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
  'course-content/runtime/knowledge/authority-domain-shards',
  'course-content/runtime/knowledge/authority-learning-content-manifest.json',
  'course-content/runtime/knowledge/cards/authority',
  'course-content/runtime/knowledge/infographs/authority',
  'course-content/runtime/knowledge/projection',
  'public/assets/models-opt/manifest.json',
]) {
  requirePath(requiredInput);
}

for (const requiredRunnerCopy of [
  '/app/course-content/authoring/knowledge/releases',
  '/app/course-content/authoring/knowledge/course-coverage',
  '/app/course-content/authoring/knowledge/authority',
  '/app/course-content/runtime/knowledge/authority-domain-shards',
  '/app/course-content/runtime/knowledge/cards/authority',
  '/app/course-content/runtime/knowledge/infographs/authority',
  '/app/course-content/runtime/knowledge/projection',
]) {
  assert.ok(dockerfile.includes(requiredRunnerCopy), `Docker runner copy missing: ${requiredRunnerCopy}`);
}

assert.equal(
  rules.includes('course-content/authoring/resources')
    || rules.includes('course-content/authoring/resources/**'),
  false,
  'authoring resources remain admitted until standalone trace ownership is corrected',
);
for (const authorityAllowlist of [
  '!course-content/runtime/knowledge/authority-domain-shards/**',
  '!course-content/runtime/knowledge/cards/authority/**',
  '!course-content/runtime/knowledge/infographs/authority/**',
  '!course-content/runtime/knowledge/projection/**',
]) {
  requireRule(authorityAllowlist);
}

console.log('container build context contract passed');
