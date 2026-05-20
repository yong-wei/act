import type { ManifestSubmissionGateInventoryItem } from './shared/manifest-runtime/submission-gate';

export const MODULE5_RESPONSE_PRODUCING_LESSON_INVENTORY: readonly ManifestSubmissionGateInventoryItem[] = [
  {
    lessonId: '5-2',
    routeSegment: 'unit-5-2-nonlinear-analysis-entry',
    manifestPath: 'course-content/runtime/lessons/5-2/interactive-manifest.json',
    studentPagePath: 'src/features/interactive/unit-5-2-nonlinear-analysis-entry/student-page.tsx',
    manifestGetterName: 'getUNIT_5_2ManifestStepFromManifest',
    minimumResponseSteps: 12,
  },
  {
    lessonId: '5-3',
    routeSegment: 'unit-5-3-mass-coordination-chain',
    manifestPath: 'course-content/runtime/lessons/5-3/interactive-manifest.json',
    studentPagePath: 'src/features/interactive/unit-5-3-mass-coordination-chain/student-page.tsx',
    manifestGetterName: 'getUNIT_5_3ManifestStepFromManifest',
    minimumResponseSteps: 12,
  },
  {
    lessonId: '5-4',
    routeSegment: 'unit-5-4-data-driven-mpc-transition',
    manifestPath: 'course-content/runtime/lessons/5-4/interactive-manifest.json',
    studentPagePath: 'src/features/interactive/unit-5-4-data-driven-mpc-transition/student-page.tsx',
    manifestGetterName: 'getUNIT_5_4ManifestStepFromManifest',
    minimumResponseSteps: 12,
  },
  {
    lessonId: '5-5',
    routeSegment: 'unit-5-5-policy-learning-entry-risk',
    manifestPath: 'course-content/runtime/lessons/5-5/interactive-manifest.json',
    studentPagePath: 'src/features/interactive/unit-5-5-policy-learning-entry-risk/student-page.tsx',
    manifestGetterName: 'getUNIT_5_5ManifestStepFromManifest',
    minimumResponseSteps: 12,
  },
  {
    lessonId: '5-6',
    routeSegment: 'unit-5-6-method-comparison-cold-chain',
    manifestPath: 'course-content/runtime/lessons/5-6/interactive-manifest.json',
    studentPagePath: 'src/features/interactive/unit-5-6-method-comparison-cold-chain/student-page.tsx',
    manifestGetterName: 'getUNIT_5_6ManifestStepFromManifest',
    minimumResponseSteps: 12,
  },
] as const;

export const REQUIRED_MODULE5_GATE_LESSONS = ['5-2', '5-3', '5-4', '5-5', '5-6'] as const;
