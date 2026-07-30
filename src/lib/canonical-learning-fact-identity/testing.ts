/**
 * Test-only capability mints for #1116. Not re-exported from the production
 * public index. Runtime-guarded to VITEST / NODE_ENV=test.
 */

export {
  mintCanonicalLearningFactSelectorForTests,
  mintFormalWriteLearningFactAdmissionForTests,
  mintCanonicalLearningFactWriteCapabilityForTests,
  buildShadowLearningFactAdmission,
  mintFormalLegacyLearningFactSelector,
  mintShadowLearningFactSelector,
} from './capability';
