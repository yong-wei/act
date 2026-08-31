import type { ReactNode } from 'react';

export {
  MANIFEST_COURSE_ROUTE_SEGMENTS,
  type ManifestCourseRouteSegment,
  isManifestCourseRouteSegment,
} from './manifest-course-route-segments';

export type ManifestCoursePageModule = {
  default: (props?: never) => ReactNode | Promise<ReactNode>;
};

export type ManifestCourseSessionPageModule = {
  default: (props: {
    params: Promise<{ sessionId: string }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
  }) => ReactNode | Promise<ReactNode>;
};

export const MANIFEST_COURSE_ENTRY_LOADERS = {
  'cruise-comfort-boppps': () => import('@/features/interactive/course-app-routes/cruise-comfort-boppps/entry'),
  'unit-1-1-see-the-full-picture': () => import('@/features/interactive/course-app-routes/unit-1-1-see-the-full-picture/entry'),
  'unit-1-2-modeling-from-object-to-system': () => import('@/features/interactive/course-app-routes/unit-1-2-modeling-from-object-to-system/entry'),
  'unit-1-3-parameter-pole-migration': () => import('@/features/interactive/course-app-routes/unit-1-3-parameter-pole-migration/entry'),
  'unit-1-4-time-frequency-views': () => import('@/features/interactive/course-app-routes/unit-1-4-time-frequency-views/entry'),
  'unit-1-5-three-domain-gain-sweep': () => import('@/features/interactive/course-app-routes/unit-1-5-three-domain-gain-sweep/entry'),
  'unit-2-1-modeling-language': () => import('@/features/interactive/course-app-routes/unit-2-1-modeling-language/entry'),
  'unit-2-2-time-domain-response': () => import('@/features/interactive/course-app-routes/unit-2-2-time-domain-response/entry'),
  'unit-2-3-frequency-response-bode-intro': () => import('@/features/interactive/course-app-routes/unit-2-3-frequency-response-bode-intro/entry'),
  'unit-2-4-nyquist-margin-entry': () => import('@/features/interactive/course-app-routes/unit-2-4-nyquist-margin-entry/entry'),
  'unit-3-1-pure-pole-stability-and-dynamics': () => import('@/features/interactive/course-app-routes/unit-3-1-pure-pole-stability-and-dynamics/entry'),
  'unit-3-2-routh-stability-boundary': () => import('@/features/interactive/course-app-routes/unit-3-2-routh-stability-boundary/entry'),
  'unit-3-3-root-locus-rules': () => import('@/features/interactive/course-app-routes/unit-3-3-root-locus-rules/entry'),
  'unit-3-4-root-locus-reading-validation': () => import('@/features/interactive/course-app-routes/unit-3-4-root-locus-reading-validation/entry'),
  'unit-3-5-zero-dynamic-improvement': () => import('@/features/interactive/course-app-routes/unit-3-5-zero-dynamic-improvement/entry'),
  'unit-3-6-zero-design-workshop': () => import('@/features/interactive/course-app-routes/unit-3-6-zero-design-workshop/entry'),
  'unit-3-7-steady-error-low-frequency-compensation': () => import('@/features/interactive/course-app-routes/unit-3-7-steady-error-low-frequency-compensation/entry'),
  'unit-3-8-frequency-domain-translation-judgment': () => import('@/features/interactive/course-app-routes/unit-3-8-frequency-domain-translation-judgment/entry'),
  'unit-3-9-cross-domain-mapping-lab': () => import('@/features/interactive/course-app-routes/unit-3-9-cross-domain-mapping-lab/entry'),
  'unit-4-1-design-task-expression': () => import('@/features/interactive/course-app-routes/unit-4-1-design-task-expression/entry'),
  'unit-4-2-controller-selection-first-start': () => import('@/features/interactive/course-app-routes/unit-4-2-controller-selection-first-start/entry'),
  'unit-4-3-initial-scheme-practice-first-validation': () => import('@/features/interactive/course-app-routes/unit-4-3-initial-scheme-practice-first-validation/entry'),
  'unit-4-4-fixed-structure-optimization-modeling': () => import('@/features/interactive/course-app-routes/unit-4-4-fixed-structure-optimization-modeling/entry'),
  'unit-4-5-constraint-aware-parameter-optimization': () => import('@/features/interactive/course-app-routes/unit-4-5-constraint-aware-parameter-optimization/entry'),
  'unit-4-6-fixed-structure-boundary-structural-encoding': () => import('@/features/interactive/course-app-routes/unit-4-6-fixed-structure-boundary-structural-encoding/entry'),
  'unit-4-7-destroyer-hifi-design-closure': () => import('@/features/interactive/course-app-routes/unit-4-7-destroyer-hifi-design-closure/entry'),
  'unit-5-1-linear-backbone-boundaries': () => import('@/features/interactive/course-app-routes/unit-5-1-linear-backbone-boundaries/entry'),
  'unit-5-2-nonlinear-analysis-entry': () => import('@/features/interactive/course-app-routes/unit-5-2-nonlinear-analysis-entry/entry'),
  'unit-5-3-mass-coordination-chain': () => import('@/features/interactive/course-app-routes/unit-5-3-mass-coordination-chain/entry'),
  'unit-5-4-data-driven-mpc-transition': () => import('@/features/interactive/course-app-routes/unit-5-4-data-driven-mpc-transition/entry'),
  'unit-5-5-policy-learning-entry-risk': () => import('@/features/interactive/course-app-routes/unit-5-5-policy-learning-entry-risk/entry'),
  'unit-5-6-method-comparison-cold-chain': () => import('@/features/interactive/course-app-routes/unit-5-6-method-comparison-cold-chain/entry'),
} as const;

export const MANIFEST_COURSE_STUDENT_LOADERS = {
  'cruise-comfort-boppps': () => import('@/features/interactive/course-app-routes/cruise-comfort-boppps/student'),
  'unit-1-1-see-the-full-picture': () => import('@/features/interactive/course-app-routes/unit-1-1-see-the-full-picture/student'),
  'unit-1-2-modeling-from-object-to-system': () => import('@/features/interactive/course-app-routes/unit-1-2-modeling-from-object-to-system/student'),
  'unit-1-3-parameter-pole-migration': () => import('@/features/interactive/course-app-routes/unit-1-3-parameter-pole-migration/student'),
  'unit-1-4-time-frequency-views': () => import('@/features/interactive/course-app-routes/unit-1-4-time-frequency-views/student'),
  'unit-1-5-three-domain-gain-sweep': () => import('@/features/interactive/course-app-routes/unit-1-5-three-domain-gain-sweep/student'),
  'unit-2-1-modeling-language': () => import('@/features/interactive/course-app-routes/unit-2-1-modeling-language/student'),
  'unit-2-2-time-domain-response': () => import('@/features/interactive/course-app-routes/unit-2-2-time-domain-response/student'),
  'unit-2-3-frequency-response-bode-intro': () => import('@/features/interactive/course-app-routes/unit-2-3-frequency-response-bode-intro/student'),
  'unit-2-4-nyquist-margin-entry': () => import('@/features/interactive/course-app-routes/unit-2-4-nyquist-margin-entry/student'),
  'unit-3-1-pure-pole-stability-and-dynamics': () => import('@/features/interactive/course-app-routes/unit-3-1-pure-pole-stability-and-dynamics/student'),
  'unit-3-2-routh-stability-boundary': () => import('@/features/interactive/course-app-routes/unit-3-2-routh-stability-boundary/student'),
  'unit-3-3-root-locus-rules': () => import('@/features/interactive/course-app-routes/unit-3-3-root-locus-rules/student'),
  'unit-3-4-root-locus-reading-validation': () => import('@/features/interactive/course-app-routes/unit-3-4-root-locus-reading-validation/student'),
  'unit-3-5-zero-dynamic-improvement': () => import('@/features/interactive/course-app-routes/unit-3-5-zero-dynamic-improvement/student'),
  'unit-3-6-zero-design-workshop': () => import('@/features/interactive/course-app-routes/unit-3-6-zero-design-workshop/student'),
  'unit-3-7-steady-error-low-frequency-compensation': () => import('@/features/interactive/course-app-routes/unit-3-7-steady-error-low-frequency-compensation/student'),
  'unit-3-8-frequency-domain-translation-judgment': () => import('@/features/interactive/course-app-routes/unit-3-8-frequency-domain-translation-judgment/student'),
  'unit-3-9-cross-domain-mapping-lab': () => import('@/features/interactive/course-app-routes/unit-3-9-cross-domain-mapping-lab/student'),
  'unit-4-1-design-task-expression': () => import('@/features/interactive/course-app-routes/unit-4-1-design-task-expression/student'),
  'unit-4-2-controller-selection-first-start': () => import('@/features/interactive/course-app-routes/unit-4-2-controller-selection-first-start/student'),
  'unit-4-3-initial-scheme-practice-first-validation': () => import('@/features/interactive/course-app-routes/unit-4-3-initial-scheme-practice-first-validation/student'),
  'unit-4-4-fixed-structure-optimization-modeling': () => import('@/features/interactive/course-app-routes/unit-4-4-fixed-structure-optimization-modeling/student'),
  'unit-4-5-constraint-aware-parameter-optimization': () => import('@/features/interactive/course-app-routes/unit-4-5-constraint-aware-parameter-optimization/student'),
  'unit-4-6-fixed-structure-boundary-structural-encoding': () => import('@/features/interactive/course-app-routes/unit-4-6-fixed-structure-boundary-structural-encoding/student'),
  'unit-4-7-destroyer-hifi-design-closure': () => import('@/features/interactive/course-app-routes/unit-4-7-destroyer-hifi-design-closure/student'),
  'unit-5-1-linear-backbone-boundaries': () => import('@/features/interactive/course-app-routes/unit-5-1-linear-backbone-boundaries/student'),
  'unit-5-2-nonlinear-analysis-entry': () => import('@/features/interactive/course-app-routes/unit-5-2-nonlinear-analysis-entry/student'),
  'unit-5-3-mass-coordination-chain': () => import('@/features/interactive/course-app-routes/unit-5-3-mass-coordination-chain/student'),
  'unit-5-4-data-driven-mpc-transition': () => import('@/features/interactive/course-app-routes/unit-5-4-data-driven-mpc-transition/student'),
  'unit-5-5-policy-learning-entry-risk': () => import('@/features/interactive/course-app-routes/unit-5-5-policy-learning-entry-risk/student'),
  'unit-5-6-method-comparison-cold-chain': () => import('@/features/interactive/course-app-routes/unit-5-6-method-comparison-cold-chain/student'),
} as const;

export const MANIFEST_COURSE_TEACHER_LOADERS = {
  'cruise-comfort-boppps': () => import('@/features/interactive/course-app-routes/cruise-comfort-boppps/teacher'),
  'unit-1-1-see-the-full-picture': () => import('@/features/interactive/course-app-routes/unit-1-1-see-the-full-picture/teacher'),
  'unit-1-2-modeling-from-object-to-system': () => import('@/features/interactive/course-app-routes/unit-1-2-modeling-from-object-to-system/teacher'),
  'unit-1-3-parameter-pole-migration': () => import('@/features/interactive/course-app-routes/unit-1-3-parameter-pole-migration/teacher'),
  'unit-1-4-time-frequency-views': () => import('@/features/interactive/course-app-routes/unit-1-4-time-frequency-views/teacher'),
  'unit-1-5-three-domain-gain-sweep': () => import('@/features/interactive/course-app-routes/unit-1-5-three-domain-gain-sweep/teacher'),
  'unit-2-1-modeling-language': () => import('@/features/interactive/course-app-routes/unit-2-1-modeling-language/teacher'),
  'unit-2-2-time-domain-response': () => import('@/features/interactive/course-app-routes/unit-2-2-time-domain-response/teacher'),
  'unit-2-3-frequency-response-bode-intro': () => import('@/features/interactive/course-app-routes/unit-2-3-frequency-response-bode-intro/teacher'),
  'unit-2-4-nyquist-margin-entry': () => import('@/features/interactive/course-app-routes/unit-2-4-nyquist-margin-entry/teacher'),
  'unit-3-1-pure-pole-stability-and-dynamics': () => import('@/features/interactive/course-app-routes/unit-3-1-pure-pole-stability-and-dynamics/teacher'),
  'unit-3-2-routh-stability-boundary': () => import('@/features/interactive/course-app-routes/unit-3-2-routh-stability-boundary/teacher'),
  'unit-3-3-root-locus-rules': () => import('@/features/interactive/course-app-routes/unit-3-3-root-locus-rules/teacher'),
  'unit-3-4-root-locus-reading-validation': () => import('@/features/interactive/course-app-routes/unit-3-4-root-locus-reading-validation/teacher'),
  'unit-3-5-zero-dynamic-improvement': () => import('@/features/interactive/course-app-routes/unit-3-5-zero-dynamic-improvement/teacher'),
  'unit-3-6-zero-design-workshop': () => import('@/features/interactive/course-app-routes/unit-3-6-zero-design-workshop/teacher'),
  'unit-3-7-steady-error-low-frequency-compensation': () => import('@/features/interactive/course-app-routes/unit-3-7-steady-error-low-frequency-compensation/teacher'),
  'unit-3-8-frequency-domain-translation-judgment': () => import('@/features/interactive/course-app-routes/unit-3-8-frequency-domain-translation-judgment/teacher'),
  'unit-3-9-cross-domain-mapping-lab': () => import('@/features/interactive/course-app-routes/unit-3-9-cross-domain-mapping-lab/teacher'),
  'unit-4-1-design-task-expression': () => import('@/features/interactive/course-app-routes/unit-4-1-design-task-expression/teacher'),
  'unit-4-2-controller-selection-first-start': () => import('@/features/interactive/course-app-routes/unit-4-2-controller-selection-first-start/teacher'),
  'unit-4-3-initial-scheme-practice-first-validation': () => import('@/features/interactive/course-app-routes/unit-4-3-initial-scheme-practice-first-validation/teacher'),
  'unit-4-4-fixed-structure-optimization-modeling': () => import('@/features/interactive/course-app-routes/unit-4-4-fixed-structure-optimization-modeling/teacher'),
  'unit-4-5-constraint-aware-parameter-optimization': () => import('@/features/interactive/course-app-routes/unit-4-5-constraint-aware-parameter-optimization/teacher'),
  'unit-4-6-fixed-structure-boundary-structural-encoding': () => import('@/features/interactive/course-app-routes/unit-4-6-fixed-structure-boundary-structural-encoding/teacher'),
  'unit-4-7-destroyer-hifi-design-closure': () => import('@/features/interactive/course-app-routes/unit-4-7-destroyer-hifi-design-closure/teacher'),
  'unit-5-1-linear-backbone-boundaries': () => import('@/features/interactive/course-app-routes/unit-5-1-linear-backbone-boundaries/teacher'),
  'unit-5-2-nonlinear-analysis-entry': () => import('@/features/interactive/course-app-routes/unit-5-2-nonlinear-analysis-entry/teacher'),
  'unit-5-3-mass-coordination-chain': () => import('@/features/interactive/course-app-routes/unit-5-3-mass-coordination-chain/teacher'),
  'unit-5-4-data-driven-mpc-transition': () => import('@/features/interactive/course-app-routes/unit-5-4-data-driven-mpc-transition/teacher'),
  'unit-5-5-policy-learning-entry-risk': () => import('@/features/interactive/course-app-routes/unit-5-5-policy-learning-entry-risk/teacher'),
  'unit-5-6-method-comparison-cold-chain': () => import('@/features/interactive/course-app-routes/unit-5-6-method-comparison-cold-chain/teacher'),
} as const;

export const MANIFEST_COURSE_WAITING_LOADERS = {
  'cruise-comfort-boppps': () => import('@/features/interactive/course-app-routes/cruise-comfort-boppps/waiting'),
  'unit-1-1-see-the-full-picture': () => import('@/features/interactive/course-app-routes/unit-1-1-see-the-full-picture/waiting'),
  'unit-1-2-modeling-from-object-to-system': () => import('@/features/interactive/course-app-routes/unit-1-2-modeling-from-object-to-system/waiting'),
  'unit-1-3-parameter-pole-migration': () => import('@/features/interactive/course-app-routes/unit-1-3-parameter-pole-migration/waiting'),
  'unit-1-4-time-frequency-views': () => import('@/features/interactive/course-app-routes/unit-1-4-time-frequency-views/waiting'),
  'unit-1-5-three-domain-gain-sweep': () => import('@/features/interactive/course-app-routes/unit-1-5-three-domain-gain-sweep/waiting'),
  'unit-2-1-modeling-language': () => import('@/features/interactive/course-app-routes/unit-2-1-modeling-language/waiting'),
  'unit-2-2-time-domain-response': () => import('@/features/interactive/course-app-routes/unit-2-2-time-domain-response/waiting'),
  'unit-2-3-frequency-response-bode-intro': () => import('@/features/interactive/course-app-routes/unit-2-3-frequency-response-bode-intro/waiting'),
  'unit-2-4-nyquist-margin-entry': () => import('@/features/interactive/course-app-routes/unit-2-4-nyquist-margin-entry/waiting'),
  'unit-3-1-pure-pole-stability-and-dynamics': () => import('@/features/interactive/course-app-routes/unit-3-1-pure-pole-stability-and-dynamics/waiting'),
  'unit-3-2-routh-stability-boundary': () => import('@/features/interactive/course-app-routes/unit-3-2-routh-stability-boundary/waiting'),
  'unit-3-3-root-locus-rules': () => import('@/features/interactive/course-app-routes/unit-3-3-root-locus-rules/waiting'),
  'unit-3-4-root-locus-reading-validation': () => import('@/features/interactive/course-app-routes/unit-3-4-root-locus-reading-validation/waiting'),
  'unit-3-5-zero-dynamic-improvement': () => import('@/features/interactive/course-app-routes/unit-3-5-zero-dynamic-improvement/waiting'),
  'unit-3-6-zero-design-workshop': () => import('@/features/interactive/course-app-routes/unit-3-6-zero-design-workshop/waiting'),
  'unit-3-7-steady-error-low-frequency-compensation': () => import('@/features/interactive/course-app-routes/unit-3-7-steady-error-low-frequency-compensation/waiting'),
  'unit-3-8-frequency-domain-translation-judgment': () => import('@/features/interactive/course-app-routes/unit-3-8-frequency-domain-translation-judgment/waiting'),
  'unit-3-9-cross-domain-mapping-lab': () => import('@/features/interactive/course-app-routes/unit-3-9-cross-domain-mapping-lab/waiting'),
  'unit-4-1-design-task-expression': () => import('@/features/interactive/course-app-routes/unit-4-1-design-task-expression/waiting'),
  'unit-4-2-controller-selection-first-start': () => import('@/features/interactive/course-app-routes/unit-4-2-controller-selection-first-start/waiting'),
  'unit-4-3-initial-scheme-practice-first-validation': () => import('@/features/interactive/course-app-routes/unit-4-3-initial-scheme-practice-first-validation/waiting'),
  'unit-4-4-fixed-structure-optimization-modeling': () => import('@/features/interactive/course-app-routes/unit-4-4-fixed-structure-optimization-modeling/waiting'),
  'unit-4-5-constraint-aware-parameter-optimization': () => import('@/features/interactive/course-app-routes/unit-4-5-constraint-aware-parameter-optimization/waiting'),
  'unit-4-6-fixed-structure-boundary-structural-encoding': () => import('@/features/interactive/course-app-routes/unit-4-6-fixed-structure-boundary-structural-encoding/waiting'),
  'unit-4-7-destroyer-hifi-design-closure': () => import('@/features/interactive/course-app-routes/unit-4-7-destroyer-hifi-design-closure/waiting'),
  'unit-5-1-linear-backbone-boundaries': () => import('@/features/interactive/course-app-routes/unit-5-1-linear-backbone-boundaries/waiting'),
  'unit-5-2-nonlinear-analysis-entry': () => import('@/features/interactive/course-app-routes/unit-5-2-nonlinear-analysis-entry/waiting'),
  'unit-5-3-mass-coordination-chain': () => import('@/features/interactive/course-app-routes/unit-5-3-mass-coordination-chain/waiting'),
  'unit-5-4-data-driven-mpc-transition': () => import('@/features/interactive/course-app-routes/unit-5-4-data-driven-mpc-transition/waiting'),
  'unit-5-5-policy-learning-entry-risk': () => import('@/features/interactive/course-app-routes/unit-5-5-policy-learning-entry-risk/waiting'),
  'unit-5-6-method-comparison-cold-chain': () => import('@/features/interactive/course-app-routes/unit-5-6-method-comparison-cold-chain/waiting'),
} as const;

export const MANIFEST_COURSE_DEMO_LOADERS = {
  'unit-1-5-three-domain-gain-sweep': () => import('@/features/interactive/course-app-routes/unit-1-5-three-domain-gain-sweep/demo'),
} as const;

export const MANIFEST_COURSE_STUDENT_METADATA = {
  'unit-1-1-see-the-full-picture': { title: '看见控制全貌 - 学生互动课', description: '进入看见控制全貌互动课程的学生学习页面' },
  'unit-2-1-modeling-language': { title: '建模语言 - 学生互动课', description: '进入建模语言互动课程的学生学习页面' },
} as const;
