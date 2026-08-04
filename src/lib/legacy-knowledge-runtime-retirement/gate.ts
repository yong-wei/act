/**
 * Runtime retirement gate: no dual authority after retire (#1277).
 *
 * Production consumers consult this gate before using legacy readers,
 * global CourseCoverage selectors, or allowLegacyFallback paths.
 * Historical adapters remain reachable via explicit historical mode.
 */

import {
  LegacyRetirementGateError,
  RETIREABLE_RUNTIME_DEPENDENCIES,
  type RemovalReceipt,
  type RetireableRuntimeDependency,
  type RetirementManifest,
} from './contracts';
import { assertRetirementManifestReady } from './manifest';

export type LegacyRuntimeAccessMode =
  | 'production'
  | 'historical'
  | 'audit';

export interface RetirementGateState {
  /** When true, production dual-authority / legacy readers are disabled. */
  retired: boolean;
  retirementId: string | null;
  manifestDigest: string | null;
  removedDependencies: readonly RetireableRuntimeDependency[];
  reasons: string[];
}

const EMPTY_GATE: RetirementGateState = {
  retired: false,
  retirementId: null,
  manifestDigest: null,
  removedDependencies: [],
  reasons: ['retirement-not-applied'],
};

let activeGate: RetirementGateState = { ...EMPTY_GATE };

/**
 * Derive gate state from a reviewed retirement manifest + optional removal
 * receipt. Does not mutate activation pointers.
 */
export function deriveRetirementGateState(input: {
  manifest: RetirementManifest | null;
  removalReceipt?: RemovalReceipt | null;
}): RetirementGateState {
  if (!input.manifest) {
    return { ...EMPTY_GATE };
  }

  try {
    assertRetirementManifestReady(input.manifest);
  } catch (error) {
    return {
      retired: false,
      retirementId: input.manifest.retirementId,
      manifestDigest: input.manifest.manifestDigest,
      removedDependencies: [],
      reasons:
        error instanceof LegacyRetirementGateError
          ? error.reasons
          : [error instanceof Error ? error.message : 'gate-blocked'],
    };
  }

  const receipt = input.removalReceipt;
  const removedFromReceipt =
    receipt?.status === 'removed' ? receipt.removedDependencies : null;
  const removedFromManifest = input.manifest.removedDependencies
    .filter((row) => row.removed)
    .map((row) => row.dependencyId);

  // Once the immutable manifest is ready-for-removal or removed, production
  // dual-authority paths are disabled. Explicit removal receipt records which
  // dependencies were deleted; otherwise all retireable deps are gated.
  const removedDependencies = [
    ...(removedFromReceipt
      ?? (removedFromManifest.length > 0
        ? removedFromManifest
        : RETIREABLE_RUNTIME_DEPENDENCIES)),
  ].sort() as RetireableRuntimeDependency[];

  const retired =
    input.manifest.status === 'ready-for-removal'
    || input.manifest.status === 'removed'
    || receipt?.status === 'removed';

  return {
    retired,
    retirementId: input.manifest.retirementId,
    manifestDigest: input.manifest.manifestDigest,
    removedDependencies,
    reasons:
      input.manifest.status === 'ready-for-removal'
        ? ['retirement-ready-production-legacy-disabled']
        : input.manifest.status === 'removed'
          ? ['retirement-removed']
          : input.manifest.reasons,
  };
}

/** Process-local gate for production resolution (tests reset via clear). */
export function applyRetirementGate(state: RetirementGateState): void {
  activeGate = {
    retired: state.retired,
    retirementId: state.retirementId,
    manifestDigest: state.manifestDigest,
    removedDependencies: [...state.removedDependencies],
    reasons: [...state.reasons],
  };
}

export function clearRetirementGate(): void {
  activeGate = { ...EMPTY_GATE, removedDependencies: [], reasons: ['retirement-not-applied'] };
}

export function getRetirementGateState(): RetirementGateState {
  return {
    retired: activeGate.retired,
    retirementId: activeGate.retirementId,
    manifestDigest: activeGate.manifestDigest,
    removedDependencies: [...activeGate.removedDependencies],
    reasons: [...activeGate.reasons],
  };
}

export function isRuntimeDependencyRetired(
  dependencyId: RetireableRuntimeDependency,
  state: RetirementGateState = activeGate,
): boolean {
  if (!state.retired) return false;
  return state.removedDependencies.includes(dependencyId);
}

/**
 * Production access to a retireable dependency.
 * Historical/audit modes remain allowed so LearningFact / audit reads work.
 */
export function assertLegacyRuntimeAccess(input: {
  dependencyId: RetireableRuntimeDependency;
  mode: LegacyRuntimeAccessMode;
  state?: RetirementGateState;
}): void {
  const state = input.state ?? activeGate;
  if (input.mode === 'historical' || input.mode === 'audit') {
    return;
  }
  if (isRuntimeDependencyRetired(input.dependencyId, state)) {
    throw new LegacyRetirementGateError(
      'legacy-runtime-retired',
      `production access to retired dependency refused: ${input.dependencyId}`,
      [
        `retired:${input.dependencyId}`,
        state.retirementId ? `retirementId:${state.retirementId}` : 'retirementId:null',
      ],
    );
  }
}

/**
 * Whether production legacy fallback dual authority is permitted.
 * After retirement: false (fail closed — no dual authority).
 */
export function isProductionLegacyFallbackPermitted(
  state: RetirementGateState = activeGate,
): boolean {
  if (!state.retired) return true;
  return !isRuntimeDependencyRetired('production-legacy-fallback-path', state);
}

/**
 * Whether the global CourseCoverage runtime selector may be used for
 * production authority selection. Audit reads remain separate.
 */
export function isGlobalCourseCoverageRuntimeSelectorPermitted(
  state: RetirementGateState = activeGate,
): boolean {
  if (!state.retired) return true;
  return !isRuntimeDependencyRetired(
    'global-course-coverage-runtime-selector',
    state,
  );
}

/**
 * Whether production may use the lesson-runtime graph overlay reader as a
 * dual-authority source.
 */
export function isLegacyGraphOverlayReaderPermitted(
  state: RetirementGateState = activeGate,
): boolean {
  if (!state.retired) return true;
  return !isRuntimeDependencyRetired(
    'legacy-runtime-graph-overlay-reader',
    state,
  );
}

/**
 * Whether production may use the legacy card direct reader path.
 * Historical LearningFact crosswalk adapter remains available.
 */
export function isLegacyCardDirectReaderPermitted(
  state: RetirementGateState = activeGate,
): boolean {
  if (!state.retired) return true;
  return !isRuntimeDependencyRetired('legacy-card-direct-reader', state);
}

/**
 * Assert production does not retain dual authority after retirement.
 */
export function assertNoProductionDualAuthority(input: {
  usingLegacyFallback: boolean;
  usingGlobalCourseCoverageSelector: boolean;
  usingLegacyGraphReader: boolean;
  usingLegacyCardReader: boolean;
  state?: RetirementGateState;
}): void {
  const state = input.state ?? activeGate;
  if (!state.retired) return;

  const reasons: string[] = [];
  if (input.usingLegacyFallback) {
    reasons.push('dual-authority:production-legacy-fallback');
  }
  if (input.usingGlobalCourseCoverageSelector) {
    reasons.push('dual-authority:global-course-coverage-selector');
  }
  if (input.usingLegacyGraphReader) {
    reasons.push('dual-authority:legacy-graph-reader');
  }
  if (input.usingLegacyCardReader) {
    reasons.push('dual-authority:legacy-card-reader');
  }
  if (reasons.length > 0) {
    throw new LegacyRetirementGateError(
      'dual-authority-after-retire',
      'production dual authority is forbidden after legacy retirement',
      reasons,
    );
  }
}
