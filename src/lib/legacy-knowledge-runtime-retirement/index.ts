/**
 * Legacy knowledge runtime retirement (#1277).
 *
 * Evidence-gated removal of obsolete legacy runtime dependencies with retained
 * audit/rollback artifacts. Must not modify activation pointers.
 */

export * from './contracts';
export * from './hash';
export * from './inventory';
export * from './old-id-scan';
export * from './fallback-export';
export * from './preflight';
export * from './archive';
export * from './manifest';
export * from './gate';
export * from './historical';
export * from './store';
