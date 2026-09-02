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
