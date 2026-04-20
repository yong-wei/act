import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_4_3StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export type UNIT_4_3TeacherControlMode =
  | 'not_applicable'
  | 'page_load_open'
  | 'teacher_toggle'
  | 'teacher_direct';

export type UNIT_4_3PageType =
  | 'display'
  | 'quiz_group'
  | 'activity_card_set'
  | 'single_choice'
  | 'worked_example_reveal'
  | 'task_card_workspace';

export interface UNIT_4_3PageRegionContract {
  id: string;
  width: 'full' | 'half';
  order: number;
}

export interface UNIT_4_3PageContract {
  layout: {
    template: string;
    regions: UNIT_4_3PageRegionContract[];
  };
  interactionKind: Exclude<UNIT_4_3PageType, 'display'> | 'none';
  teacherControls: {
    releaseActivity: UNIT_4_3TeacherControlMode;
    openBrowse: UNIT_4_3TeacherControlMode;
    teacherStepReveal: UNIT_4_3TeacherControlMode;
    revealReferenceAnswer: UNIT_4_3TeacherControlMode;
  };
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  aiPageGoal: string;
  previewDemoPath: string;
}

export interface UNIT_4_3StepDefinition {
  id: string;
  stage: UNIT_4_3StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_4_3PageType;
  aiContext?: StepAIContext;
}

export interface UNIT_4_3StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, string>;
}

export interface UNIT_4_3StudentCourseState {
  kind: 'unit43_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_4_3StepResponse>;
}

export interface UNIT_4_3TeacherCourseSyncState {
  kind: 'teacher_sync_unit43';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt: number;
}

export interface UNIT_4_3TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  browseEnabled: Record<string, boolean>;
  teacherRevealProgress: Record<string, number>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_4_3TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_4_3TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_4_3_ROUTE_SEGMENT = 'unit-4-3-initial-scheme-practice-first-validation';
export const UNIT_4_3_PRESET_KEY = 'unit-4-3-initial-scheme-practice-first-validation-v1';
export const UNIT_4_3_RESOURCE_KEY = 'unit-4-3-initial-scheme-practice-first-validation';
export const UNIT_4_3_LESSON_KEY = UNIT_4_3_PRESET_KEY;
export const UNIT_4_3_STUDENT_ITEM_ID = 'student:unit43:state';
export const UNIT_4_3_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_4_3_STUDENT_STATE_KEY = 'course';
export const UNIT_4_3_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_4_3_COURSE_TITLE = '4-3：初始方案落地实践：从对象分析到结构组合与首轮验证';
export const UNIT_4_3_COURSE_SUBTITLE = 'Initial Scheme Practice';
export const UNIT_4_3_COURSE_DESCRIPTION =
  '围绕对象分析、结构分流、复合结构职责、客船首轮验证与问题清单，把 4-2 的起步卡推进成 4-4 可继续使用的第一版方案。';

export const UNIT_4_3_STAGE_LABEL: Record<UNIT_4_3StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_4_3_STAGE_MAP: Record<UNIT_4_3StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_4_3_PAGE_CONTRACTS: Record<string, UNIT_4_3PageContract> = {
  "step-01": {
    layout: {
      template: "map_goal_boundary_slide",
      regions: [
        {
          id: "header",
          width: "full",
          order: 1
        },
        {
          id: "lead",
          width: "full",
          order: 2
        },
        {
          id: "assessment",
          width: "full",
          order: 3
        }
      ]
    },
    interactionKind: "quiz_group",
    teacherControls: {
      releaseActivity: "page_load_open",
      openBrowse: "not_applicable",
      teacherStepReveal: "not_applicable",
      revealReferenceAnswer: "teacher_toggle"
    },
    teacherInsightWidgets: [
      "question_distribution",
      "top_misconceptions"
    ],
    telemetrySummaryFields: [
      "attemptCount",
      "resultState",
      "errorBucket"
    ],
    misconceptionTags: [
      "structure_name_only",
      "skip_validation",
      "skip_issue_list"
    ],
    aiPageGoal: "固定 4-3 是把起步卡推进成第一版方案的课程。",
    previewDemoPath: "/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/demo?step=step-01"
  },
  "step-02": {
    layout: {
      template: "question_stack",
      regions: [
        {
          id: "prompt",
          width: "full",
          order: 1
        },
        {
          id: "workspace",
          width: "full",
          order: 2
        }
      ]
    },
    interactionKind: "activity_card_set",
    teacherControls: {
      releaseActivity: "teacher_toggle",
      openBrowse: "page_load_open",
      teacherStepReveal: "not_applicable",
      revealReferenceAnswer: "teacher_toggle"
    },
    teacherInsightWidgets: [
      "error_bucket_distribution",
      "card_completion_rate"
    ],
    telemetrySummaryFields: [
      "cardSubmitted",
      "errorBucket",
      "timeOnStep"
    ],
    misconceptionTags: [
      "restate_model_only",
      "no_constraint",
      "no_validation_target"
    ],
    aiPageGoal: "固定对象分析是设计入口，而不是背景重复。",
    previewDemoPath: "/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/demo?step=step-02"
  },
  "step-03": {
    layout: {
      template: "comparison_panel_with_sort",
      regions: [
        {
          id: "table",
          width: "full",
          order: 1
        },
        {
          id: "interaction",
          width: "full",
          order: 2
        }
      ]
    },
    interactionKind: "single_choice",
    teacherControls: {
      releaseActivity: "teacher_toggle",
      openBrowse: "page_load_open",
      teacherStepReveal: "not_applicable",
      revealReferenceAnswer: "teacher_toggle"
    },
    teacherInsightWidgets: [
      "question_distribution",
      "top_misconceptions"
    ],
    telemetrySummaryFields: [
      "attemptCount",
      "resultState",
      "errorBucket"
    ],
    misconceptionTags: [
      "compound_is_longer_name",
      "feedforward_replaces_feedback",
      "keep_single_structure_forever"
    ],
    aiPageGoal: "让学生把分流判断与表 1 建立一一对应。",
    previewDemoPath: "/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/demo?step=step-03"
  },
  "step-04": {
    layout: {
      template: "formula_table_reasoning",
      regions: [
        {
          id: "formula",
          width: "full",
          order: 1
        },
        {
          id: "summary",
          width: "full",
          order: 2
        }
      ]
    },
    interactionKind: "none",
    teacherControls: {
      releaseActivity: "not_applicable",
      openBrowse: "not_applicable",
      teacherStepReveal: "not_applicable",
      revealReferenceAnswer: "not_applicable"
    },
    teacherInsightWidgets: [
      "view_count",
      "sync_status"
    ],
    telemetrySummaryFields: [
      "viewed",
      "timeOnStep",
      "teacherFollowSync"
    ],
    misconceptionTags: [],
    aiPageGoal: "固定三类复合结构的适用问题与分工。",
    previewDemoPath: "/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/demo?step=step-04"
  },
  "step-05": {
    layout: {
      template: "compound_structure_board",
      regions: [
        {
          id: "problem",
          width: "full",
          order: 1
        },
        {
          id: "media",
          width: "full",
          order: 2
        },
        {
          id: "interaction",
          width: "full",
          order: 3
        }
      ]
    },
    interactionKind: "activity_card_set",
    teacherControls: {
      releaseActivity: "teacher_toggle",
      openBrowse: "page_load_open",
      teacherStepReveal: "not_applicable",
      revealReferenceAnswer: "teacher_toggle"
    },
    teacherInsightWidgets: [
      "card_completion_rate",
      "error_bucket_distribution"
    ],
    telemetrySummaryFields: [
      "cardSubmitted",
      "errorBucket",
      "timeOnStep"
    ],
    misconceptionTags: [
      "pi_lead_same_job",
      "ignore_mid_frequency_role"
    ],
    aiPageGoal: "把 PI+超前 的职责分工落成完整方法页。",
    previewDemoPath: "/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/demo?step=step-05"
  },
  "step-06": {
    layout: {
      template: "compound_structure_board",
      regions: [
        {
          id: "problem",
          width: "full",
          order: 1
        },
        {
          id: "media",
          width: "full",
          order: 2
        },
        {
          id: "interaction",
          width: "full",
          order: 3
        }
      ]
    },
    interactionKind: "activity_card_set",
    teacherControls: {
      releaseActivity: "teacher_toggle",
      openBrowse: "page_load_open",
      teacherStepReveal: "not_applicable",
      revealReferenceAnswer: "teacher_toggle"
    },
    teacherInsightWidgets: [
      "card_completion_rate",
      "error_bucket_distribution"
    ],
    telemetrySummaryFields: [
      "cardSubmitted",
      "errorBucket",
      "timeOnStep"
    ],
    misconceptionTags: [
      "lag_only_speed_up",
      "ignore_margin_recovery"
    ],
    aiPageGoal: "把滞后+超前 的稳健收益与速度代价写清。",
    previewDemoPath: "/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/demo?step=step-06"
  },
  "step-07": {
    layout: {
      template: "compound_structure_board",
      regions: [
        {
          id: "problem",
          width: "full",
          order: 1
        },
        {
          id: "media",
          width: "full",
          order: 2
        },
        {
          id: "interaction",
          width: "full",
          order: 3
        }
      ]
    },
    interactionKind: "activity_card_set",
    teacherControls: {
      releaseActivity: "teacher_toggle",
      openBrowse: "page_load_open",
      teacherStepReveal: "not_applicable",
      revealReferenceAnswer: "teacher_toggle"
    },
    teacherInsightWidgets: [
      "card_completion_rate",
      "error_bucket_distribution"
    ],
    telemetrySummaryFields: [
      "cardSubmitted",
      "errorBucket",
      "timeOnStep"
    ],
    misconceptionTags: [
      "pid_default_answer",
      "ignore_filter_role"
    ],
    aiPageGoal: "把带微分滤波 PID 的紧凑表达与高频克制写完整。",
    previewDemoPath: "/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/demo?step=step-07"
  },
  "step-08": {
    layout: {
      template: "case_evidence_board",
      regions: [
        {
          id: "case",
          width: "full",
          order: 1
        },
        {
          id: "interaction",
          width: "full",
          order: 2
        }
      ]
    },
    interactionKind: "activity_card_set",
    teacherControls: {
      releaseActivity: "teacher_toggle",
      openBrowse: "page_load_open",
      teacherStepReveal: "not_applicable",
      revealReferenceAnswer: "teacher_toggle"
    },
    teacherInsightWidgets: [
      "card_completion_rate",
      "error_bucket_distribution"
    ],
    telemetrySummaryFields: [
      "cardSubmitted",
      "errorBucket",
      "timeOnStep"
    ],
    misconceptionTags: [
      "add_integral_first",
      "ignore_control_peak",
      "ignore_existing_integrator"
    ],
    aiPageGoal: "固定客船案例当前主矛盾在中频动态品质。",
    previewDemoPath: "/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/demo?step=step-08"
  },
  "step-09": {
    layout: {
      template: "worked_example_compare",
      regions: [
        {
          id: "problem",
          width: "full",
          order: 1
        },
        {
          id: "worked-example",
          width: "full",
          order: 2
        }
      ]
    },
    interactionKind: "worked_example_reveal",
    teacherControls: {
      releaseActivity: "not_applicable",
      openBrowse: "teacher_toggle",
      teacherStepReveal: "teacher_direct",
      revealReferenceAnswer: "teacher_toggle"
    },
    teacherInsightWidgets: [
      "step_reveal_progress",
      "view_count",
      "top_misconceptions"
    ],
    telemetrySummaryFields: [
      "stepRevealCount",
      "timeOnStep",
      "errorBucket"
    ],
    misconceptionTags: [
      "parameter_table_only",
      "skip_phase_margin",
      "skip_gain_condition"
    ],
    aiPageGoal: "把参数方向写成五步可解释链，而非参数表。",
    previewDemoPath: "/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/demo?step=step-09"
  },
  "step-10": {
    layout: {
      template: "validation_issue_board",
      regions: [
        {
          id: "validation",
          width: "full",
          order: 1
        },
        {
          id: "interaction",
          width: "full",
          order: 2
        }
      ]
    },
    interactionKind: "activity_card_set",
    teacherControls: {
      releaseActivity: "teacher_toggle",
      openBrowse: "page_load_open",
      teacherStepReveal: "not_applicable",
      revealReferenceAnswer: "teacher_toggle"
    },
    teacherInsightWidgets: [
      "card_completion_rate",
      "error_bucket_distribution"
    ],
    telemetrySummaryFields: [
      "cardSubmitted",
      "errorBucket",
      "timeOnStep"
    ],
    misconceptionTags: [
      "validation_as_finish",
      "no_tradeoff_sentence",
      "no_next_iteration"
    ],
    aiPageGoal: "把首轮验证结果转成下一轮问题清单。",
    previewDemoPath: "/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/demo?step=step-10"
  },
  "step-11": {
    layout: {
      template: "worked_example_compare",
      regions: [
        {
          id: "problem",
          width: "full",
          order: 1
        },
        {
          id: "worked-example",
          width: "full",
          order: 2
        }
      ]
    },
    interactionKind: "worked_example_reveal",
    teacherControls: {
      releaseActivity: "not_applicable",
      openBrowse: "teacher_toggle",
      teacherStepReveal: "teacher_direct",
      revealReferenceAnswer: "teacher_toggle"
    },
    teacherInsightWidgets: [
      "step_reveal_progress",
      "view_count"
    ],
    telemetrySummaryFields: [
      "stepRevealCount",
      "timeOnStep"
    ],
    misconceptionTags: [
      "stay_single_structure",
      "compound_without_reason"
    ],
    aiPageGoal: "用最小例题固定转入复合结构的触发条件。",
    previewDemoPath: "/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/demo?step=step-11"
  },
  "step-12": {
    layout: {
      template: "task_card_workspace",
      regions: [
        {
          id: "template",
          width: "full",
          order: 1
        },
        {
          id: "workspace",
          width: "full",
          order: 2
        }
      ]
    },
    interactionKind: "task_card_workspace",
    teacherControls: {
      releaseActivity: "teacher_toggle",
      openBrowse: "page_load_open",
      teacherStepReveal: "not_applicable",
      revealReferenceAnswer: "teacher_toggle"
    },
    teacherInsightWidgets: [
      "field_completion_rate",
      "error_bucket_distribution"
    ],
    telemetrySummaryFields: [
      "fieldCompletion",
      "cardSubmitted",
      "timeOnStep"
    ],
    misconceptionTags: [
      "missing_tradeoff",
      "missing_validation",
      "missing_issue_handover"
    ],
    aiPageGoal: "输出三份最小提交物，而不是单一大表单。",
    previewDemoPath: "/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/demo?step=step-12"
  },
  "step-13": {
    layout: {
      template: "boundary_case_board",
      regions: [
        {
          id: "problem",
          width: "full",
          order: 1
        },
        {
          id: "media",
          width: "full",
          order: 2
        },
        {
          id: "interaction",
          width: "full",
          order: 3
        }
      ]
    },
    interactionKind: "activity_card_set",
    teacherControls: {
      releaseActivity: "teacher_toggle",
      openBrowse: "page_load_open",
      teacherStepReveal: "not_applicable",
      revealReferenceAnswer: "teacher_toggle"
    },
    teacherInsightWidgets: [
      "card_completion_rate",
      "error_bucket_distribution"
    ],
    telemetrySummaryFields: [
      "cardSubmitted",
      "errorBucket",
      "timeOnStep"
    ],
    misconceptionTags: [
      "all_compound_from_frequency_split",
      "ignore_channel_rewrite"
    ],
    aiPageGoal: "说明复合结构还可能来自通道重写。",
    previewDemoPath: "/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/demo?step=step-13"
  },
  "step-14": {
    layout: {
      template: "summary_quiz_board",
      regions: [
        {
          id: "assessment_region",
          width: "full",
          order: 1
        },
        {
          id: "summary_region",
          width: "full",
          order: 2
        }
      ]
    },
    interactionKind: "quiz_group",
    teacherControls: {
      releaseActivity: "page_load_open",
      openBrowse: "not_applicable",
      teacherStepReveal: "not_applicable",
      revealReferenceAnswer: "teacher_toggle"
    },
    teacherInsightWidgets: [
      "question_distribution",
      "top_misconceptions"
    ],
    telemetrySummaryFields: [
      "attemptCount",
      "resultState",
      "errorBucket"
    ],
    misconceptionTags: [
      "skip_issue_list",
      "compound_equals_formula_length",
      "validation_equals_finish"
    ],
    aiPageGoal: "检查判断链是否形成，并把学生送往 4-4。",
    previewDemoPath: "/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/demo?step=step-14"
  }
};

export const UNIT_4_3_INTERACTIVE_PAGE_TYPES = new Set<UNIT_4_3PageType>([
  'quiz_group',
  'activity_card_set',
  'single_choice',
  'worked_example_reveal',
  'task_card_workspace',
]);

export const UNIT_4_3_LESSON_STEPS: UNIT_4_3StepDefinition[] = [
  {
    id: "step-01",
    stage: "B",
    title: "回到地图：4-2 的起步卡如何长成 4-3 的第一版方案",
    hint: "固定 4-3 是把起步卡推进成第一版方案的课程。",
    duration: "4 min",
    pageType: "quiz_group"
  },
  {
    id: "step-02",
    stage: "P1",
    title: "对象分析四问：对象入口不是重抄模型",
    hint: "固定对象分析是设计入口，而不是背景重复。",
    duration: "6 min",
    pageType: "activity_card_set"
  },
  {
    id: "step-03",
    stage: "P2",
    title: "结构分流：什么时候继续单结构，什么时候进入复合结构",
    hint: "让学生把分流判断与表 1 建立一一对应。",
    duration: "6 min",
    pageType: "single_choice"
  },
  {
    id: "step-04",
    stage: "P2",
    title: "复合结构总览：三类常见写法不是公式堆长",
    hint: "固定三类复合结构的适用问题与分工。",
    duration: "6 min",
    pageType: "display"
  },
  {
    id: "step-05",
    stage: "P2",
    title: "结构 A：`PI + 超前`——低频托举与中频整理分工",
    hint: "把 PI+超前 的职责分工落成完整方法页。",
    duration: "7 min",
    pageType: "activity_card_set"
  },
  {
    id: "step-06",
    stage: "P2",
    title: "结构 B：`滞后 + 超前`——低频补偿与裕量回收并行",
    hint: "把滞后+超前 的稳健收益与速度代价写清。",
    duration: "7 min",
    pageType: "activity_card_set"
  },
  {
    id: "step-07",
    stage: "P2",
    title: "结构 C：带微分滤波的 `PID`——紧凑表达与高频克制",
    hint: "把带微分滤波 PID 的紧凑表达与高频克制写完整。",
    duration: "7 min",
    pageType: "activity_card_set"
  },
  {
    id: "step-08",
    stage: "P2",
    title: "客船案例入口：为什么这里先上超前，而不是立刻复合",
    hint: "固定客船案例当前主矛盾在中频动态品质。",
    duration: "6 min",
    pageType: "activity_card_set"
  },
  {
    id: "step-09",
    stage: "P2",
    title: "客船参数方向显影：五步把超前初始方案写成可运行表达",
    hint: "把参数方向写成五步可解释链，而非参数表。",
    duration: "8 min",
    pageType: "worked_example_reveal"
  },
  {
    id: "step-10",
    stage: "P2",
    title: "客船首轮验证：表 6 与问题清单怎样接成下一轮输入",
    hint: "把首轮验证结果转成下一轮问题清单。",
    duration: "8 min",
    pageType: "activity_card_set"
  },
  {
    id: "step-11",
    stage: "P2",
    title: "最小例题：什么时候从单结构走向复合结构",
    hint: "用最小例题固定转入复合结构的触发条件。",
    duration: "7 min",
    pageType: "worked_example_reveal"
  },
  {
    id: "step-12",
    stage: "P2",
    title: "实践工作区：对象分析记录单 + 初始方案表达卡 + 问题清单移交表",
    hint: "输出三份最小提交物，而不是单一大表单。",
    duration: "10 min",
    pageType: "task_card_workspace"
  },
  {
    id: "step-13",
    stage: "P2",
    title: "边界案例：横摇减摇鳍说明复合不只来自频段叠加",
    hint: "说明复合结构还可能来自通道重写。",
    duration: "6 min",
    pageType: "activity_card_set"
  },
  {
    id: "step-14",
    stage: "S",
    title: "后测与收束：从第一版方案走向 4-4 的多目标权衡",
    hint: "检查判断链是否形成，并把学生送往 4-4。",
    duration: "5 min",
    pageType: "quiz_group"
  }
] as const;

export function getUNIT_4_3Step(stepId: string) {
  return UNIT_4_3_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_4_3_LESSON_STEPS[0];
}

export function getUNIT_4_3PageContract(stepId: string) {
  return UNIT_4_3_PAGE_CONTRACTS[stepId] ?? UNIT_4_3_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_4_3InteractivePageType(pageType: UNIT_4_3PageType) {
  return UNIT_4_3_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function isUNIT_4_3AiPageType(_pageType: UNIT_4_3PageType) {
  return false;
}

export function createEmptyUNIT_4_3StudentState(studentName: string): UNIT_4_3StudentCourseState {
  return {
    kind: 'unit43_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_4_3_PREMIUM_LESSON_CARD = {
  id: 'unit-4-3-initial-scheme-practice-first-validation',
  title: UNIT_4_3_COURSE_TITLE,
  description: '精品互动课：把对象分析、复合结构职责、参数方向和首轮验证连接成第一版方案。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_4_3_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_4_3_MEDIA_BY_STEP_ID: Record<string, string> = {
  "step-05": "/course-runtime/lessons/4-3/media/4-3-pi-lead-compound-quad.png",
  "step-06": "/course-runtime/lessons/4-3/media/4-3-lag-lead-compound-quad.png",
  "step-07": "/course-runtime/lessons/4-3/media/4-3-pid-compound-quad.png",
  "step-10": "/course-runtime/lessons/4-3/media/4-3-heading-case-quad.png",
  "step-13": "/course-runtime/lessons/4-3/media/4-3-roll-fin-compensation-structure.png",
  "step-01": "/course-runtime/lessons/4-3/media/4-3-cover-comic.png",
  "step-14": "/course-runtime/lessons/4-3/media/4-3-info.png"
};

export function getUNIT_4_3MediaSrc(stepId: string) {
  return UNIT_4_3_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_4_3StudentState(value: unknown): value is UNIT_4_3StudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_4_3StudentCourseState>;
  return data.kind === 'unit43_student_state' && data.version === 1;
}

export function isUNIT_4_3TeacherSyncState(value: unknown): value is UNIT_4_3TeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<UNIT_4_3TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit43' && typeof data.activeStepId === 'string';
}

export const UNIT_4_3_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_4_3StudentCourseState,
  UNIT_4_3TeacherCourseSyncState,
  UNIT_4_3TeacherSyncInput
> = {
  lessonKey: UNIT_4_3_LESSON_KEY,
  studentItemId: UNIT_4_3_STUDENT_ITEM_ID,
  teacherItemId: UNIT_4_3_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_4_3_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_4_3_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_4_3StudentState,
  isStudentState: isUNIT_4_3StudentState,
  isTeacherSyncState: isUNIT_4_3TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit43',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      browseEnabled: input.browseEnabled,
      teacherRevealProgress: input.teacherRevealProgress,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_4_3TeacherSync(input: UNIT_4_3TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_4_3TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  localBrowseEnabled: Record<string, boolean> | null;
  localTeacherRevealProgress: Record<string, number> | null;
  teacherSyncState: UNIT_4_3TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
    browseEnabled: input.localBrowseEnabled ?? input.teacherSyncState?.browseEnabled ?? {},
    teacherRevealProgress: input.localTeacherRevealProgress ?? input.teacherSyncState?.teacherRevealProgress ?? {},
  };
}

export async function finalizeUNIT_4_3TeacherSession(input: UNIT_4_3TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({ currentStepId: input.currentStepId });
}
