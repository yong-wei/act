/**
 * Canonical learning-path transition surface (#1115).
 *
 * Stop unfinished Legacy paths as immutable historical records, preserve
 * declared goals independently of Legacy steps, and replan Canonical paths
 * only when the formal teaching-input set is version-closed and ready.
 */

export * from './contracts';
export * from './mutation-guard';
export * from './stop-legacy-paths';
export * from './write-fence';
export {
  replanCanonicalLearningPath,
  resolveGoalCanonicalTargets,
  type CanonicalPathReplanInput,
} from './replan';
