import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { ComponentType } from 'react';

import { CourseBundleDriftState } from '@/features/lesson-engine/course-bundle-drift-state';
import { authOptions } from '@/lib/auth';
import { buildLoginRedirectForPath } from '@/lib/auth-redirect';
import { loadLessonRuntimeEntry, loadSessionBoundLessonRuntime, type RuntimeLessonEntryBundle } from '@/lib/course-bundle';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';
import {
  buildCoursePackageLayeredScope,
  resolveCoursePageLayeredGraphContext,
} from '@/lib/layered-graph';
import type { LayeredGraphPayload } from '@/lib/layered-graph/contracts';

import { TeacherClassroomWaitingRoute } from './teacher-classroom-waiting-route';
import { isTeacherOrAdminRole, resolveBatchALesson, type BatchACanonicalId } from './batch-a-classroom-shell';
import { resolveBatchBLesson, type BatchBCanonicalId } from './batch-b-classroom-shell';
import { resolveStudentRouteDemoStepId, type StudentRouteSearchParams } from './student-route-query';

type EntryPage = ComponentType<{ initialRole?: string; lessonRuntime: RuntimeLessonEntryBundle }>;
type StudentPage = ComponentType<{
  sessionId: string;
  lessonRuntime: RuntimeLessonEntryBundle;
  demoStepId?: string;
  layeredGraphPayload?: LayeredGraphPayload;
  layeredResourceLaunchTargets?: Record<string, string | null>;
  layeredResourceRegistryIds?: Record<string, string>;
}>;
type TeacherPage = StudentPage;

type BatchAPages = { EntryPage: EntryPage; StudentPage: StudentPage; TeacherPage: TeacherPage };

type SharedCanonicalId = BatchACanonicalId | BatchBCanonicalId;

type BatchALessonConfig = {
  canonicalId: SharedCanonicalId;
  loadPages: () => Promise<BatchAPages>;
  layeredGraph?: boolean;
  studentMetadata?: { title: string; description: string };
  demo?: boolean;
};

function pages<E, S, T>(
  load: () => Promise<[E, S, T]>,
  pick: (entry: E, student: S, teacher: T) => BatchAPages,
) {
  return async () => {
    const [entry, student, teacher] = await load();
    return pick(entry, student, teacher);
  };
}

function resolveLayered(config: BatchALessonConfig, canonicalId: SharedCanonicalId, lessonRuntime: RuntimeLessonEntryBundle) {
  if (!config.layeredGraph) return null;
  return resolveCoursePageLayeredGraphContext({
    scope: buildCoursePackageLayeredScope({
      packageCanonicalId: canonicalId,
      lessonKey: canonicalId,
    }),
    lessonRuntime,
  });
}

const BATCH_A_LESSONS: Record<string, BatchALessonConfig> = {
  'unit-1-1-see-the-full-picture': {
    canonicalId: '1-1', layeredGraph: true,
    studentMetadata: { title: '看见控制全貌 - 学生互动课', description: '进入看见控制全貌互动课程的学生学习页面' },
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-1-1-see-the-full-picture/entry-page'),
        import('@/features/interactive/unit-1-1-see-the-full-picture/student-page'),
        import('@/features/interactive/unit-1-1-see-the-full-picture/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_1_1CourseEntryPage,
        StudentPage: student.UNIT_1_1StudentPage as StudentPage,
        TeacherPage: teacher.UNIT_1_1TeacherPage as TeacherPage,
      }),
    ),
  },
  'unit-1-2-modeling-from-object-to-system': {
    canonicalId: '1-2',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-1-2-modeling-from-object-to-system/entry-page'),
        import('@/features/interactive/unit-1-2-modeling-from-object-to-system/student-page'),
        import('@/features/interactive/unit-1-2-modeling-from-object-to-system/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_1_2CourseEntryPage, StudentPage: student.UNIT_1_2StudentPage, TeacherPage: teacher.UNIT_1_2TeacherPage,
      }),
    ),
  },
  'unit-1-3-parameter-pole-migration': {
    canonicalId: '1-3',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-1-3-parameter-pole-migration/entry-page'),
        import('@/features/interactive/unit-1-3-parameter-pole-migration/student-page'),
        import('@/features/interactive/unit-1-3-parameter-pole-migration/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_1_3CourseEntryPage, StudentPage: student.UNIT_1_3StudentPage, TeacherPage: teacher.UNIT_1_3TeacherPage,
      }),
    ),
  },
  'unit-1-4-time-frequency-views': {
    canonicalId: '1-4',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-1-4-time-frequency-views/entry-page'),
        import('@/features/interactive/unit-1-4-time-frequency-views/student-page'),
        import('@/features/interactive/unit-1-4-time-frequency-views/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_1_4CourseEntryPage, StudentPage: student.UNIT_1_4StudentPage, TeacherPage: teacher.UNIT_1_4TeacherPage,
      }),
    ),
  },
  'unit-1-5-three-domain-gain-sweep': {
    canonicalId: '1-5', demo: true,
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-1-5-three-domain-gain-sweep/entry-page'),
        import('@/features/interactive/unit-1-5-three-domain-gain-sweep/student-page'),
        import('@/features/interactive/unit-1-5-three-domain-gain-sweep/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_1_5CourseEntryPage, StudentPage: student.UNIT_1_5StudentPage, TeacherPage: teacher.UNIT_1_5TeacherPage,
      }),
    ),
  },
  'unit-2-1-modeling-language': {
    canonicalId: '2-1',
    studentMetadata: { title: '建模语言 - 学生互动课', description: '进入建模语言互动课程的学生学习页面' },
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-2-1-modeling-language/entry-page'),
        import('@/features/interactive/unit-2-1-modeling-language/student-page'),
        import('@/features/interactive/unit-2-1-modeling-language/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_2_1CourseEntryPage, StudentPage: student.UNIT_2_1StudentPage, TeacherPage: teacher.UNIT_2_1TeacherPage,
      }),
    ),
  },
  'unit-2-2-time-domain-response': {
    canonicalId: '2-2',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-2-2-time-response/entry-page'),
        import('@/features/interactive/unit-2-2-time-response/student-page'),
        import('@/features/interactive/unit-2-2-time-response/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_2_2CourseEntryPage, StudentPage: student.UNIT_2_2StudentPage, TeacherPage: teacher.UNIT_2_2TeacherPage,
      }),
    ),
  },
  'unit-2-3-frequency-response-bode-intro': {
    canonicalId: '2-3',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-2-3-frequency-response/entry-page'),
        import('@/features/interactive/unit-2-3-frequency-response/student-page'),
        import('@/features/interactive/unit-2-3-frequency-response/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_2_3CourseEntryPage, StudentPage: student.UNIT_2_3StudentPage, TeacherPage: teacher.UNIT_2_3TeacherPage,
      }),
    ),
  },
  'unit-2-4-nyquist-margin-entry': {
    canonicalId: '2-4',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-2-4-nyquist-margin-entry/entry-page'),
        import('@/features/interactive/unit-2-4-nyquist-margin-entry/student-page'),
        import('@/features/interactive/unit-2-4-nyquist-margin-entry/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_2_4CourseEntryPage, StudentPage: student.UNIT_2_4StudentPage, TeacherPage: teacher.UNIT_2_4TeacherPage,
      }),
    ),
  },
  'unit-3-1-pure-pole-stability-and-dynamics': {
    canonicalId: '3-1',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/entry-page'),
        import('@/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/student-page'),
        import('@/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_3_1CourseEntryPage, StudentPage: student.UNIT_3_1StudentPage, TeacherPage: teacher.UNIT_3_1TeacherPage,
      }),
    ),
  },
  'unit-3-2-routh-stability-boundary': {
    canonicalId: '3-2',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-3-2-routh-stability-boundary/entry-page'),
        import('@/features/interactive/unit-3-2-routh-stability-boundary/student-page'),
        import('@/features/interactive/unit-3-2-routh-stability-boundary/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_3_2CourseEntryPage, StudentPage: student.UNIT_3_2StudentPage, TeacherPage: teacher.UNIT_3_2TeacherPage,
      }),
    ),
  },
  'unit-3-3-root-locus-rules': {
    canonicalId: '3-3',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-3-3-root-locus-rules/entry-page'),
        import('@/features/interactive/unit-3-3-root-locus-rules/student-page'),
        import('@/features/interactive/unit-3-3-root-locus-rules/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_3_3CourseEntryPage, StudentPage: student.UNIT_3_3StudentPage, TeacherPage: teacher.UNIT_3_3TeacherPage,
      }),
    ),
  },
  'unit-3-4-root-locus-reading-validation': {
    canonicalId: '3-4',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-3-4-root-locus-reading-validation/entry-page'),
        import('@/features/interactive/unit-3-4-root-locus-reading-validation/student-page'),
        import('@/features/interactive/unit-3-4-root-locus-reading-validation/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_3_4CourseEntryPage, StudentPage: student.UNIT_3_4StudentPage, TeacherPage: teacher.UNIT_3_4TeacherPage,
      }),
    ),
  },
  'unit-3-5-zero-dynamic-improvement': {
    canonicalId: '3-5',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-3-5-zero-dynamic-improvement/entry-page'),
        import('@/features/interactive/unit-3-5-zero-dynamic-improvement/student-page'),
        import('@/features/interactive/unit-3-5-zero-dynamic-improvement/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_3_5CourseEntryPage, StudentPage: student.UNIT_3_5StudentPage, TeacherPage: teacher.UNIT_3_5TeacherPage,
      }),
    ),
  },
  'unit-3-6-zero-design-workshop': {
    canonicalId: '3-6',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-3-6-zero-design-workshop/entry-page'),
        import('@/features/interactive/unit-3-6-zero-design-workshop/student-page'),
        import('@/features/interactive/unit-3-6-zero-design-workshop/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_3_6CourseEntryPage, StudentPage: student.UNIT_3_6StudentPage, TeacherPage: teacher.UNIT_3_6TeacherPage,
      }),
    ),
  },
  'unit-3-7-steady-error-low-frequency-compensation': {
    canonicalId: '3-7',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-3-7-steady-error-low-frequency-compensation/entry-page'),
        import('@/features/interactive/unit-3-7-steady-error-low-frequency-compensation/student-page'),
        import('@/features/interactive/unit-3-7-steady-error-low-frequency-compensation/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_3_7CourseEntryPage, StudentPage: student.UNIT_3_7StudentPage, TeacherPage: teacher.UNIT_3_7TeacherPage,
      }),
    ),
  },
  'unit-3-8-frequency-domain-translation-judgment': {
    canonicalId: '3-8',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-3-8-frequency-domain-translation-judgment/entry-page'),
        import('@/features/interactive/unit-3-8-frequency-domain-translation-judgment/student-page'),
        import('@/features/interactive/unit-3-8-frequency-domain-translation-judgment/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_3_8CourseEntryPage, StudentPage: student.UNIT_3_8StudentPage, TeacherPage: teacher.UNIT_3_8TeacherPage,
      }),
    ),
  },
  'unit-3-9-cross-domain-mapping-lab': {
    canonicalId: '3-9',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-3-9-cross-domain-mapping-lab/entry-page'),
        import('@/features/interactive/unit-3-9-cross-domain-mapping-lab/student-page'),
        import('@/features/interactive/unit-3-9-cross-domain-mapping-lab/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_3_9CourseEntryPage, StudentPage: student.UNIT_3_9StudentPage, TeacherPage: teacher.UNIT_3_9TeacherPage,
      }),
    ),
  },
};

const BATCH_B_LESSONS: Record<string, BatchALessonConfig> = {
  'unit-4-1-design-task-expression': {
    canonicalId: '4-1',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-4-1-design-task-expression/entry-page'),
        import('@/features/interactive/unit-4-1-design-task-expression/student-page'),
        import('@/features/interactive/unit-4-1-design-task-expression/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_4_1CourseEntryPage, StudentPage: student.UNIT_4_1StudentPage, TeacherPage: teacher.UNIT_4_1TeacherPage,
      }),
    ),
  },
  'unit-4-2-controller-selection-first-start': {
    canonicalId: '4-2',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-4-2-controller-selection-first-start/entry-page'),
        import('@/features/interactive/unit-4-2-controller-selection-first-start/student-page'),
        import('@/features/interactive/unit-4-2-controller-selection-first-start/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_4_2CourseEntryPage, StudentPage: student.UNIT_4_2StudentPage, TeacherPage: teacher.UNIT_4_2TeacherPage,
      }),
    ),
  },
  'unit-4-3-initial-scheme-practice-first-validation': {
    canonicalId: '4-3',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-4-3-initial-scheme-practice-first-validation/entry-page'),
        import('@/features/interactive/unit-4-3-initial-scheme-practice-first-validation/student-page'),
        import('@/features/interactive/unit-4-3-initial-scheme-practice-first-validation/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_4_3CourseEntryPage, StudentPage: student.UNIT_4_3StudentPage, TeacherPage: teacher.UNIT_4_3TeacherPage,
      }),
    ),
  },
  'unit-4-4-fixed-structure-optimization-modeling': {
    canonicalId: '4-4',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-4-4-fixed-structure-optimization-modeling/entry-page'),
        import('@/features/interactive/unit-4-4-fixed-structure-optimization-modeling/student-page'),
        import('@/features/interactive/unit-4-4-fixed-structure-optimization-modeling/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_4_4CourseEntryPage, StudentPage: student.UNIT_4_4StudentPage, TeacherPage: teacher.UNIT_4_4TeacherPage,
      }),
    ),
  },
  'unit-4-5-constraint-aware-parameter-optimization': {
    canonicalId: '4-5',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-4-5-constraint-aware-parameter-optimization/entry-page'),
        import('@/features/interactive/unit-4-5-constraint-aware-parameter-optimization/student-page'),
        import('@/features/interactive/unit-4-5-constraint-aware-parameter-optimization/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_4_5CourseEntryPage, StudentPage: student.UNIT_4_5StudentPage, TeacherPage: teacher.UNIT_4_5TeacherPage,
      }),
    ),
  },
  'unit-4-6-fixed-structure-boundary-structural-encoding': {
    canonicalId: '4-6',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-4-6-fixed-structure-boundary-structural-encoding/entry-page'),
        import('@/features/interactive/unit-4-6-fixed-structure-boundary-structural-encoding/student-page'),
        import('@/features/interactive/unit-4-6-fixed-structure-boundary-structural-encoding/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_4_6CourseEntryPage, StudentPage: student.UNIT_4_6StudentPage, TeacherPage: teacher.UNIT_4_6TeacherPage,
      }),
    ),
  },
  'unit-4-7-destroyer-hifi-design-closure': {
    canonicalId: '4-7',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-4-7-destroyer-hifi-design-closure/entry-page'),
        import('@/features/interactive/unit-4-7-destroyer-hifi-design-closure/student-page'),
        import('@/features/interactive/unit-4-7-destroyer-hifi-design-closure/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_4_7CourseEntryPage, StudentPage: student.UNIT_4_7StudentPage, TeacherPage: teacher.UNIT_4_7TeacherPage,
      }),
    ),
  },
  'unit-5-1-linear-backbone-boundaries': {
    canonicalId: '5-1',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-5-1-linear-backbone-boundaries/entry-page'),
        import('@/features/interactive/unit-5-1-linear-backbone-boundaries/student-page'),
        import('@/features/interactive/unit-5-1-linear-backbone-boundaries/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_5_1CourseEntryPage, StudentPage: student.UNIT_5_1StudentPage, TeacherPage: teacher.UNIT_5_1TeacherPage,
      }),
    ),
  },
  'unit-5-2-nonlinear-analysis-entry': {
    canonicalId: '5-2',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-5-2-nonlinear-analysis-entry/entry-page'),
        import('@/features/interactive/unit-5-2-nonlinear-analysis-entry/student-page'),
        import('@/features/interactive/unit-5-2-nonlinear-analysis-entry/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_5_2CourseEntryPage, StudentPage: student.UNIT_5_2StudentPage, TeacherPage: teacher.UNIT_5_2TeacherPage,
      }),
    ),
  },
  'unit-5-3-mass-coordination-chain': {
    canonicalId: '5-3',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-5-3-mass-coordination-chain/entry-page'),
        import('@/features/interactive/unit-5-3-mass-coordination-chain/student-page'),
        import('@/features/interactive/unit-5-3-mass-coordination-chain/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_5_3CourseEntryPage, StudentPage: student.UNIT_5_3StudentPage, TeacherPage: teacher.UNIT_5_3TeacherPage,
      }),
    ),
  },
  'unit-5-4-data-driven-mpc-transition': {
    canonicalId: '5-4',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-5-4-data-driven-mpc-transition/entry-page'),
        import('@/features/interactive/unit-5-4-data-driven-mpc-transition/student-page'),
        import('@/features/interactive/unit-5-4-data-driven-mpc-transition/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_5_4CourseEntryPage, StudentPage: student.UNIT_5_4StudentPage, TeacherPage: teacher.UNIT_5_4TeacherPage,
      }),
    ),
  },
  'unit-5-5-policy-learning-entry-risk': {
    canonicalId: '5-5',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-5-5-policy-learning-entry-risk/entry-page'),
        import('@/features/interactive/unit-5-5-policy-learning-entry-risk/student-page'),
        import('@/features/interactive/unit-5-5-policy-learning-entry-risk/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_5_5CourseEntryPage, StudentPage: student.UNIT_5_5StudentPage, TeacherPage: teacher.UNIT_5_5TeacherPage,
      }),
    ),
  },
  'unit-5-6-method-comparison-cold-chain': {
    canonicalId: '5-6',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/unit-5-6-method-comparison-cold-chain/entry-page'),
        import('@/features/interactive/unit-5-6-method-comparison-cold-chain/student-page'),
        import('@/features/interactive/unit-5-6-method-comparison-cold-chain/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.UNIT_5_6CourseEntryPage, StudentPage: student.UNIT_5_6StudentPage, TeacherPage: teacher.UNIT_5_6TeacherPage,
      }),
    ),
  },
  'cruise-comfort-boppps': {
    canonicalId: 'cruise-comfort-boppps',
    loadPages: pages(
      () => Promise.all([
        import('@/features/interactive/cruise-comfort-standard-course/entry-page'),
        import('@/features/interactive/cruise-comfort-standard-course/student-page'),
        import('@/features/interactive/cruise-comfort-standard-course/teacher-page'),
      ]),
      (entry, student, teacher) => ({
        EntryPage: entry.CruiseStandardCourseEntryPage,
        StudentPage: student.CruiseStandardStudentPage,
        TeacherPage: teacher.CruiseStandardTeacherPage,
      }),
    ),
  },
};

function lessonConfig(routeSegment: string) {
  const resolved = resolveBatchALesson(routeSegment) ?? resolveBatchBLesson(routeSegment);
  const config = BATCH_A_LESSONS[routeSegment] ?? BATCH_B_LESSONS[routeSegment];
  if (!resolved || !config || config.canonicalId !== resolved.canonicalId) return null;
  return { ...resolved, config };
}

export function batchAStudentMetadata(routeSegment: string) {
  return BATCH_A_LESSONS[routeSegment]?.studentMetadata;
}

export async function renderBatchAEntry(routeSegment: string) {
  const lesson = lessonConfig(routeSegment);
  if (!lesson) return null;
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry(lesson.canonicalId);
  const { EntryPage } = await lesson.config.loadPages();
  return <EntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}

export async function renderBatchAStudent(input: {
  routeSegment: string;
  sessionId: string;
  searchParams?: StudentRouteSearchParams;
}) {
  const lesson = lessonConfig(input.routeSegment);
  if (!lesson) return null;
  const demoStepId = resolveStudentRouteDemoStepId(input.searchParams);
  await redirectInactiveStudentSessionToLessonEntry(
    input.sessionId,
    `/interactive-learning/courses/${input.routeSegment}`,
  );
  if (input.sessionId !== 'demo') {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      redirect(`/interactive-learning/courses/${input.routeSegment}`);
    }
    if (isTeacherOrAdminRole(session.user.role)) {
      redirect(`/interactive-learning/courses/${input.routeSegment}/teacher/${input.sessionId}`);
    }
  }
  const runtimeResult = await loadSessionBoundLessonRuntime({
    sessionId: input.sessionId,
    expectedCanonicalId: lesson.canonicalId,
    role: 'student',
  });
  if (runtimeResult.status === 'drift') {
    return <CourseBundleDriftState code={runtimeResult.code} sessionId={runtimeResult.sessionId} />;
  }
  if (runtimeResult.status === 'route-mismatch') {
    redirect(runtimeResult.redirectHref);
  }
  const { StudentPage } = await lesson.config.loadPages();
  const layered = resolveLayered(lesson.config, lesson.canonicalId, runtimeResult.lessonRuntime);
  return (
    <StudentPage
      sessionId={input.sessionId}
      lessonRuntime={runtimeResult.lessonRuntime}
      demoStepId={demoStepId}
      layeredGraphPayload={layered?.payload}
      layeredResourceLaunchTargets={layered?.resourceLaunchTargets}
      layeredResourceRegistryIds={layered?.resourceRegistryIds}
    />
  );
}

export async function renderBatchATeacher(input: { routeSegment: string; sessionId: string }) {
  const lesson = lessonConfig(input.routeSegment);
  if (!lesson) return null;
  const session = await getServerSession(authOptions);
  if (!session?.user || !isTeacherOrAdminRole(session.user.role)) {
    redirect(buildLoginRedirectForPath(
      `/interactive-learning/courses/${input.routeSegment}/teacher/${input.sessionId}`,
    ));
  }
  const runtimeResult = await loadSessionBoundLessonRuntime({
    sessionId: input.sessionId,
    expectedCanonicalId: lesson.canonicalId,
    role: 'teacher',
  });
  if (runtimeResult.status === 'drift') {
    return <CourseBundleDriftState code={runtimeResult.code} sessionId={runtimeResult.sessionId} viewerRole="teacher" />;
  }
  if (runtimeResult.status === 'route-mismatch') {
    redirect(runtimeResult.redirectHref);
  }
  const { TeacherPage } = await lesson.config.loadPages();
  const layered = resolveLayered(lesson.config, lesson.canonicalId, runtimeResult.lessonRuntime);
  return (
    <TeacherPage
      sessionId={input.sessionId}
      lessonRuntime={runtimeResult.lessonRuntime}
      layeredGraphPayload={layered?.payload}
      layeredResourceLaunchTargets={layered?.resourceLaunchTargets}
      layeredResourceRegistryIds={layered?.resourceRegistryIds}
    />
  );
}

export async function renderBatchAWaiting(input: { routeSegment: string; sessionId: string }) {
  if (!resolveBatchALesson(input.routeSegment)) return null;
  const session = await getServerSession(authOptions);
  if (!session?.user || !isTeacherOrAdminRole(session.user.role)) {
    redirect(buildLoginRedirectForPath(
      `/interactive-learning/courses/${input.routeSegment}/teacher/${input.sessionId}/waiting`,
    ));
  }
  return <TeacherClassroomWaitingRoute routeSegment={input.routeSegment} sessionId={input.sessionId} />;
}

export async function renderBatchADemo(routeSegment: string) {
  const lesson = lessonConfig(routeSegment);
  if (!lesson?.config.demo) return null;
  const lessonRuntime = await loadLessonRuntimeEntry(lesson.canonicalId);
  const { StudentPage } = await lesson.config.loadPages();
  return <StudentPage sessionId="demo" lessonRuntime={lessonRuntime} />;
}
