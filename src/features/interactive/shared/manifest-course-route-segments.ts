export const MANIFEST_COURSE_ROUTE_SEGMENTS = [
  'cruise-comfort-boppps',
  'unit-1-1-see-the-full-picture',
  'unit-1-2-modeling-from-object-to-system',
  'unit-1-3-parameter-pole-migration',
  'unit-1-4-time-frequency-views',
  'unit-1-5-three-domain-gain-sweep',
  'unit-2-1-modeling-language',
  'unit-2-2-time-domain-response',
  'unit-2-3-frequency-response-bode-intro',
  'unit-2-4-nyquist-margin-entry',
  'unit-3-1-pure-pole-stability-and-dynamics',
  'unit-3-2-routh-stability-boundary',
  'unit-3-3-root-locus-rules',
  'unit-3-4-root-locus-reading-validation',
  'unit-3-5-zero-dynamic-improvement',
  'unit-3-6-zero-design-workshop',
  'unit-3-7-steady-error-low-frequency-compensation',
  'unit-3-8-frequency-domain-translation-judgment',
  'unit-3-9-cross-domain-mapping-lab',
  'unit-4-1-design-task-expression',
  'unit-4-2-controller-selection-first-start',
  'unit-4-3-initial-scheme-practice-first-validation',
  'unit-4-4-fixed-structure-optimization-modeling',
  'unit-4-5-constraint-aware-parameter-optimization',
  'unit-4-6-fixed-structure-boundary-structural-encoding',
  'unit-4-7-destroyer-hifi-design-closure',
  'unit-5-1-linear-backbone-boundaries',
  'unit-5-2-nonlinear-analysis-entry',
  'unit-5-3-mass-coordination-chain',
  'unit-5-4-data-driven-mpc-transition',
  'unit-5-5-policy-learning-entry-risk',
  'unit-5-6-method-comparison-cold-chain',
] as const;

export type ManifestCourseRouteSegment = (typeof MANIFEST_COURSE_ROUTE_SEGMENTS)[number];

const MANIFEST_COURSE_ROUTE_SEGMENT_SET = new Set<string>(MANIFEST_COURSE_ROUTE_SEGMENTS);

export function isManifestCourseRouteSegment(
  value: string | null | undefined,
): value is ManifestCourseRouteSegment {
  return typeof value === 'string' && MANIFEST_COURSE_ROUTE_SEGMENT_SET.has(value);
}
