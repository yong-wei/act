import { listTracked, listTrackedBlobs } from '../migration-backfill/classify';

import type { ReleaseCommand, ReleaseRole, SafetyMode, SourceRoot, ToolchainId } from './types';
import { SOURCE_ROOTS } from './types';

export { listTracked, listTrackedBlobs };

export function compareCodepoints(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function startsWithPath(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

const OPERATOR_ADAPTERS = new Set([
  'scripts/knowledge-cutover/activate-actkg-v018-production-cutover.ts',
  'scripts/knowledge-cutover/activate-actkg-v022-production-cutover.ts',
  'scripts/knowledge-cutover/apply-r4-c4-runtime-selectors.ts',
  'scripts/knowledge-cutover/cleanup-failed-authority-identity.cjs',
  'scripts/knowledge-cutover/coordinate-latest-authority-oss-cutover.ts',
  'scripts/knowledge-cutover/create-operator-bundle.mjs',
  'scripts/knowledge-cutover/deploy-r4-c5-coordinated-cutover.sh',
  'scripts/knowledge-cutover/execute-actkg-to-act-first-activation.ts',
  'scripts/knowledge-cutover/production-cutover.ts',
  'scripts/knowledge-cutover/recover-actkg-to-act-first-activation.ts',
  'scripts/knowledge-cutover/refresh-state.mjs',
  'scripts/knowledge-cutover/remote-activate-actkg-v018-production-cutover.sh',
  'scripts/knowledge-cutover/remote-activate-actkg-v022-production-cutover.sh',
  'scripts/knowledge-cutover/remote-activate-r4-coordinated-cutover.sh',
  'scripts/knowledge-cutover/remote-application-refresh.sh',
  'scripts/knowledge-cutover/remote-production-cutover.sh',
  'scripts/knowledge-cutover/restage-r4-c4-consumer-activation.ts',
  'scripts/runtime-release/act-runtime-blob-ossfs.service',
  'scripts/runtime-release/act-runtime-blob-view-helper.service',
  'scripts/runtime-release/act-runtime-ossfs@.service',
  'scripts/runtime-release/activate-runtime-blob-release.sh',
  'scripts/runtime-release/activate-runtime-release.sh',
  'scripts/runtime-release/bind-runtime-blob-view-helper.sh',
  'scripts/runtime-release/configure-runtime-blob-ossfs.sh',
  'scripts/runtime-release/configure-runtime-ossfs-release.sh',
  'scripts/runtime-release/execute-production-runtime-cutover.sh',
  'scripts/runtime-release/perform-production-runtime-cutover.sh',
  'scripts/runtime-release/retire-legacy-runtime-after-oss-cutover.sh',
  'scripts/runtime-release/retire-unused-oss-runtime.py',
  'scripts/runtime-release/rollback-runtime-release.sh',
  'scripts/runtime-release/runtime-blob-activation-transaction.py',
  'scripts/runtime-release/runtime-blob-release-gc.py',
]);

const PUBLICATION_WRITERS = new Set([
  'scripts/knowledge-cutover/publish-actkg-v018-cutover-runtime.ts',
  'scripts/knowledge-cutover/publish-actkg-v022-cutover-runtime.ts',
  'scripts/runtime-release/act-runtime-release.ts',
  'scripts/runtime-release/materialize-runtime-blob-release.py',
  'scripts/runtime-release/runtime-blob-release-lifecycle.py',
  'scripts/runtime-release/runtime-release-oss-publisher-bridge.py',
]);

const READERS = new Set([
  'course-content/scripts/authority-cards/README.md',
  'course-content/scripts/authority-cards/common.py',
  'course-content/scripts/authority-cards/status_report.py',
  'course-content/scripts/canonical_nodes.py',
  'course-content/scripts/kg_query.py',
  'course-content/scripts/knowledge_card_coverage.py',
  'course-content/scripts/lesson_artifacts.py',
  'course-content/scripts/lesson_graph_order.py',
  'course-content/scripts/lesson_id_map.py',
  'course-content/scripts/pillow_font_fallback.py',
  'course-content/scripts/python_media_formula.py',
  'course-content/scripts/runtime_media_index.py',
  'course-content/scripts/structured_textbook_runtime.py',
  'course-content/scripts/textbook_hybrid_retrieval.py',
  'course-content/scripts/textbook_resource_set.py',
  'course-content/scripts/textbook_runtime_input_provenance.py',
  'course-content/scripts/textbook_visual_retrieval.py',
  'scripts/release/textbook-resource-set.mjs',
  'scripts/release/textbook-runtime-input-provenance.mjs',
  'scripts/release/textbook-runtime-v2-provenance.mjs',
  'scripts/runtime-release/runtime-media-inventory.ts',
  'scripts/runtime-release/runtime-release-host-state.py',
]);

export function toolchainFor(path: string): ToolchainId {
  if (startsWithPath(path, 'course-content/scripts') || startsWithPath(path, 'scripts/release')) {
    return 'content-compiler';
  }
  if (startsWithPath(path, 'scripts/knowledge-cutover') || startsWithPath(path, 'scripts/knowledge')) {
    return 'knowledge-release';
  }
  return 'runtime-release';
}

export function ownerFor(toolchain: ToolchainId): ReleaseCommand['owner'] {
  if (toolchain === 'content-compiler') return 'course';
  if (toolchain === 'knowledge-release') return 'knowledge';
  return 'platform';
}

function safetyFor(role: ReleaseRole): SafetyMode {
  if (role === 'reader' || role === 'validator') return 'read-only';
  return 'apply-gated';
}

function roleFor(path: string): ReleaseRole {
  if (startsWithPath(path, 'scripts/runtime-release/developer-oss') || OPERATOR_ADAPTERS.has(path)) {
    return 'operator-adapter';
  }
  if (PUBLICATION_WRITERS.has(path)) return 'publication-writer';
  if (READERS.has(path)) return 'reader';
  if (/\/(?:qualify-|prepare-|admit-)/.test(path)) return 'candidate-adapter';
  if (
    /(?:^|\/)(?:review_|validate[_-]|verify-|inspect-|benchmark_|check-)/.test(path)
    || path.includes('/tests/')
    || /(?:^|\/)generate-unavailable-label-audit/.test(path)
  ) {
    return 'validator';
  }
  return 'compiler';
}

export function classifyReleasePath(path: string): ReleaseCommand {
  const toolchain = toolchainFor(path);
  const role = roleFor(path);
  return {
    path,
    commandId: `release:${toolchain}:${path}`,
    toolchain,
    owner: ownerFor(toolchain),
    role,
    safetyMode: safetyFor(role),
    retirementCondition: role === 'operator-adapter'
      ? 'retain-as-explicit-operator-adapter'
      : role === 'reader'
        ? 'keep-as-shared-reader-or-contract'
        : 'callers-use-isolated-cli-then-archive-or-delete',
  };
}

export function inventoryReleaseCommands(cwd: string): ReleaseCommand[] {
  const paths = SOURCE_ROOTS.flatMap((root) => listTracked(cwd, root));
  return paths
    .filter((path) => !path.includes('__pycache__/') && !path.endsWith('.pyc'))
    .map(classifyReleasePath)
    .sort((left, right) => compareCodepoints(left.path, right.path));
}

export function collectReleaseBlobs(cwd: string): Map<string, string> {
  const blobs = new Map<string, string>();
  for (const root of SOURCE_ROOTS) {
    for (const [path, blob] of listTrackedBlobs(cwd, root)) blobs.set(path, blob);
  }
  return blobs;
}

export function countByRoot(commands: readonly ReleaseCommand[]): Record<SourceRoot, number> {
  const counts = {
    'course-content/scripts': 0,
    'scripts/knowledge': 0,
    'scripts/knowledge-cutover': 0,
    'scripts/runtime-release': 0,
    'scripts/release': 0,
  } satisfies Record<SourceRoot, number>;
  for (const item of commands) {
    const root = SOURCE_ROOTS.find((candidate) => startsWithPath(item.path, candidate));
    if (root) counts[root] += 1;
  }
  return counts;
}
