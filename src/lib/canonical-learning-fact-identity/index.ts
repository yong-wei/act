/**
 * Canonical LearningFact fixed-identity surface (#1116).
 *
 * Production exports never mint formal Canonical write capabilities.
 * Test-only mints live in `./testing`.
 */

export * from './authority';
export {
  assertCanonicalLearningFactWriteCapability,
  assertRegisteredLearningFactSelector,
  assertVerifiedLearningFactAdmission,
  assertAdmissionAllowsFormalWrite,
  buildShadowLearningFactAdmission,
  readVerifiedLearningFactAdmission,
  VERIFIED_LEARNING_FACT_ADMISSION_VERSION,
  CANONICAL_LEARNING_FACT_WRITE_CAPABILITY_VERSION,
  LearningFactCapabilityError,
  type VerifiedLearningFactAdmission,
  type RegisteredLearningFactAuthoritySelector,
  type CanonicalLearningFactWriteCapability,
  type LearningFactAdmissionMode,
} from './capability';
export * from './contracts';
export * from './inventory';
export * from './serving';
export * from './static-gate';
export * from './validation';
export {
  writeLegacyKnowledgeScopedLearningFacts,
  writeCanonicalKnowledgeScopedLearningFacts,
  shadowValidateCanonicalLearningFacts,
  writeKnowledgeScopedLearningFacts,
  type KnowledgeScopedLearningFactWriteRequest,
  type WriteKnowledgeScopedLearningFactsOptions,
  type LegacyLearningFactWriteOptions,
} from './writer';
export {
  runCanonicalLearningFactShadowValidation,
  runCanonicalLearningFactShadowValidationAsync,
  type CanonicalLearningFactShadowValidationInput,
  type CanonicalLearningFactShadowValidationReport,
} from './shadow';
