/**
 * Versioned knowledge consumer activation (#1276).
 *
 * Per-consumer readiness, staged immutable materialization, atomic pointer,
 * shadow comparison, and digest-checked rollback.
 */

export * from './contracts';
export * from './hash';
export * from './readiness';
export * from './resolve';
export * from './shadow';
export * from './stage';
export * from './store';
