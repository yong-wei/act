import type { ClassifiedEntry, PrivacyClass, SafetyMode, SourceFamilyId, ToolClass } from './types';

function startsWithPath(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function classifyPath(path: string, familyId: SourceFamilyId): ClassifiedEntry | { unresolved: true; path: string } {
  if (path.includes('__pycache__/') || path.endsWith('.pyc')) {
    return { unresolved: true, path };
  }

  if (startsWithPath(path, 'tools/boundary')) {
    return entry(path, familyId, 'adapter', 'platform', 'none', 'read-only', 'keep-as-boundary-contract', null);
  }
  if (startsWithPath(path, 'tools/glb-model-optimizer')) {
    return entry(path, familyId, 'existing-unrelated-tool', 'platform', 'public-bundle', 'read-only', 'owned-outside-this-series', null);
  }
  if (startsWithPath(path, 'tools/skillopt-sleep')) {
    return entry(path, familyId, 'existing-unrelated-tool', 'platform', 'none', 'read-only', 'owned-outside-this-series', null);
  }
  if (startsWithPath(path, 'course-content/scripts')) {
    return entry(path, familyId, 'content-export-review', 'course', 'public-bundle', 'read-only', 'migrate-then-delete-product-caller', 'isolate-content-knowledge-runtime-release-toolchains');
  }
  if (startsWithPath(path, 'scripts/knowledge-cutover') || startsWithPath(path, 'scripts/knowledge')) {
    return entry(path, familyId, 'knowledge-release', 'knowledge', 'public-bundle', 'read-only', 'migrate-then-delete-product-caller', 'isolate-content-knowledge-runtime-release-toolchains');
  }
  if (startsWithPath(path, 'scripts/runtime-release') || startsWithPath(path, 'scripts/release')) {
    return entry(path, familyId, 'runtime-oss-release', 'platform', 'public-bundle', 'read-only', 'migrate-then-delete-product-caller', 'isolate-content-knowledge-runtime-release-toolchains');
  }
  if (startsWithPath(path, 'scripts/tests')) {
    return entry(path, familyId, 'evidence-visual-qa', 'assessment', 'private-run-evidence', 'read-only', 'externalize-run-specific-outputs', 'externalize-run-specific-qa-evidence-artifacts');
  }
  if (startsWithPath(path, 'scripts/migrations') || startsWithPath(path, 'scripts/db')) {
    return entry(path, familyId, 'migration-backfill', 'learning-record', 'none', 'apply-gated', 'isolate-then-archive-or-delete', 'isolate-migration-backfill-competition-toolchains');
  }
  if (startsWithPath(path, 'evaluate')) {
    return entry(path, familyId, 'competition-material', 'arena', 'private-run-evidence', 'dry-run-default', 'isolate-then-archive-or-delete', 'isolate-migration-backfill-competition-toolchains');
  }
  if (startsWithPath(path, 'artifacts')) {
    return entry(path, familyId, 'historical-evidence', 'assessment', 'private-run-evidence', 'none', 'retain-manifest-and-externalize-bytes', 'externalize-run-specific-qa-evidence-artifacts');
  }
  if (startsWithPath(path, 'tools')) {
    return { unresolved: true, path };
  }
  return { unresolved: true, path };
}

function entry(
  path: string,
  familyId: SourceFamilyId,
  toolClass: ToolClass,
  owner: string,
  privacyClass: PrivacyClass,
  safetyMode: SafetyMode,
  retirementCondition: string,
  followUpChange: string | null,
): ClassifiedEntry {
  return {
    path,
    familyId,
    toolClass,
    owner,
    privacyClass,
    safetyMode,
    retirementCondition,
    followUpChange,
  };
}
