import type { BopppsStage } from '@prisma/client';

import type { LessonSessionAdapter } from '@/features/interactive/session-framework/session-contract';
import type { StepAIContext } from '@/types/ai-context';

export type UNIT_2_1StageCode = 'B' | 'O' | 'P1' | 'P2' | 'P3' | 'S';
export interface UNIT_2_1CoverageTable {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface UNIT_2_1StepCoverage {
  requiredFormulas?: string[];
  requiredTables?: UNIT_2_1CoverageTable[];
  requiredTableTitles?: string[];
  requiredConclusions?: string[];
}

export type UNIT_2_1PageType =
  | 'display'
  | 'summary'
  | 'binary_choice'
  | 'quiz_group'
  | 'short_response'
  | 'multi_check'
  | 'reflection_form'
  | 'drag_match'
  | 'rule_judge'
  | 'hotspot_labeling'
  | 'bucket_sort'
  | 'choice_check'
  | 'path_highlight';

export interface UNIT_2_1PageRegionContract {
  id: string;
  width: 'full' | '1/2';
  order: number;
}

export interface UNIT_2_1PageContract {
  layout: {
    template: string;
    regions: UNIT_2_1PageRegionContract[];
  };
  interactionKind: UNIT_2_1PageType | 'none';
  teacherInsightWidgets: string[];
  telemetrySummaryFields: string[];
  misconceptionTags?: string[];
  previewDemoPath: string;
}

export type Unit21WorkspaceKind =
  | 'object-chain'
  | 'initial-state'
  | 'typical-elements'
  | 'connection-rules'
  | 'signal-flow-terms'
  | 'mason-highlight'
  | 'none';

export interface UNIT_2_1StepDefinition {
  id: string;
  stage: UNIT_2_1StageCode;
  title: string;
  hint: string;
  duration: string;
  pageType: UNIT_2_1PageType;
  coverage: UNIT_2_1StepCoverage;
  workspaceKind?: Unit21WorkspaceKind;
  aiContext?: StepAIContext;
}

export interface UNIT_2_1StepResponse {
  stepId: string;
  submittedAt: number;
  answers: Record<string, unknown>;
  summary?: Record<string, unknown>;
}

export interface UNIT_2_1StudentCourseState {
  kind: 'unit21_student_state';
  version: 1;
  studentName: string;
  updatedAt: number;
  responses: Record<string, UNIT_2_1StepResponse>;
}

export interface UNIT_2_1TeacherCourseSyncState {
  kind: 'teacher_sync_unit21';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt: number;
}

export interface UNIT_2_1TeacherSyncInput {
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  releasedActivities: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface UNIT_2_1TeacherSyncPostGateInput {
  loadingSession: boolean;
  teacherViewHydrated: boolean;
}

export interface UNIT_2_1TeacherFinalizeInput {
  finishSession: () => Promise<void>;
  trackSessionFinalize: (data: { currentStepId: string }) => void;
  currentStepId: string;
}

export const UNIT_2_1_ROUTE_SEGMENT = 'unit-2-1-modeling-language';
export const UNIT_2_1_PRESET_KEY = 'unit-2-1-modeling-language-v1';
export const UNIT_2_1_RESOURCE_KEY = 'unit-2-1-modeling-language';
export const UNIT_2_1_LESSON_KEY = UNIT_2_1_PRESET_KEY;
export const UNIT_2_1_STUDENT_ITEM_ID = 'student:unit21:state';
export const UNIT_2_1_TEACHER_SYNC_ITEM_ID = 'teacher:course-sync';
export const UNIT_2_1_STUDENT_STATE_KEY = 'course';
export const UNIT_2_1_TEACHER_STATE_KEY = 'teacher-sync';
export const UNIT_2_1_COURSE_TITLE = '2-1：建模与变换语言——从真实对象到统一分析对象';
export const UNIT_2_1_COURSE_SUBTITLE = 'Modeling Language';
export const UNIT_2_1_COURSE_DESCRIPTION =
  '围绕微分方程、拉氏变换、零初值传递函数、典型环节、结构图、信号流图与梅森公式，建立模块 2 的统一对象语言。';

export const UNIT_2_1_STAGE_LABEL: Record<UNIT_2_1StageCode, string> = {
  B: 'B · 导入',
  O: 'O · 目标',
  P1: 'P1 · 前测',
  P2: 'P2 · 参与式学习',
  P3: 'P3 · 后测',
  S: 'S · 总结',
};

export const UNIT_2_1_STAGE_MAP: Record<UNIT_2_1StageCode, BopppsStage> = {
  B: 'BRIDGE_IN',
  O: 'OBJECTIVE',
  P1: 'PRE_ASSESSMENT',
  P2: 'PARTICIPATORY',
  P3: 'POST_ASSESSMENT',
  S: 'SUMMARY',
};

export const UNIT_2_1_PAGE_CONTRACTS: Record<string, UNIT_2_1PageContract> = {
  'step-01': {
    layout: {
      template: 'map_hero_slide',
      regions: [
        { id: 'header', width: 'full', order: 1 },
        { id: 'lead', width: 'full', order: 2 },
        { id: 'summary', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count', 'sync_status'],
    telemetrySummaryFields: ['viewed', 'timeOnStep', 'teacherFollowSync'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-01',
  },
  'step-02': {
    layout: {
      template: 'cover_top_formula_then_judge',
      regions: [
        { id: 'comic', width: 'full', order: 1 },
        { id: 'equation', width: 'full', order: 2 },
        { id: 'interaction', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'binary_choice',
    teacherInsightWidgets: ['option_distribution', 'reveal_correction_rate'],
    telemetrySummaryFields: ['selectedOption', 'resultState', 'teacherRevealSeen', 'timeOnStep'],
    misconceptionTags: ['equation_is_enough'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-02',
  },
  'step-03': {
    layout: {
      template: 'center_chain_slide',
      regions: [
        { id: 'chain', width: 'full', order: 1 },
        { id: 'cards', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['view_count'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-03',
  },
  'step-04': {
    layout: {
      template: 'question_stack',
      regions: [
        { id: 'question-stack', width: 'full', order: 1 },
        { id: 'submit-bar', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'top_misconceptions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket', 'teacherRevealSeen'],
    misconceptionTags: ['omit_zero_initial_state', 'calculate_before_identify', 'block_equals_sfg'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-04',
  },
  'step-05': {
    layout: {
      template: 'table_plus_formula_plus_short_response',
      regions: [
        { id: 'contrast', width: 'full', order: 1 },
        { id: 'formula-strip', width: 'full', order: 2 },
        { id: 'reflection', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'short_response',
    teacherInsightWidgets: ['keyword_cloud', 'ai_usage_rate'],
    telemetrySummaryFields: ['submitted', 'aiUsed', 'resultState', 'durationBand'],
    misconceptionTags: ['laplace_as_integration_trick'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-05',
  },
  'step-06': {
    layout: {
      template: 'formula_explain_checklist',
      regions: [
        { id: 'formula-card', width: 'full', order: 1 },
        { id: 'explain-cards', width: 'full', order: 2 },
        { id: 'reason-checklist', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'multi_check',
    teacherInsightWidgets: ['checklist_accuracy', 'reveal_correction_rate'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['transfer_function_is_rewritten_equation'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-06',
  },
  'step-07': {
    layout: {
      template: 'compare_then_ai',
      regions: [
        { id: 'compare-table', width: 'full', order: 1 },
        { id: 'self-judgment', width: 'full', order: 2 },
        { id: 'ai-panel', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'reflection_form',
    teacherInsightWidgets: ['ai_usage_rate', 'misconception_tags', 'keyword_cloud'],
    telemetrySummaryFields: ['submitted', 'aiUsed', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['mix_object_and_state'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-07',
  },
  'step-08': {
    layout: {
      template: 'courseware_top_game_stage_bottom',
      regions: [
        { id: 'table-zone', width: 'full', order: 1 },
        { id: 'map-zone', width: 'full', order: 2 },
        { id: 'game-stage', width: 'full', order: 3 },
        { id: 'submit-zone', width: 'full', order: 4 },
      ],
    },
    interactionKind: 'drag_match',
    teacherInsightWidgets: ['first_pass_rate', 'retry_rate', 'error_hotspots', 'misconception_tag_distribution'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'durationBand', 'hintUsed', 'teacherRevealSeen', 'misconceptionTags'],
    misconceptionTags: ['identify_after_calculation', 'integral_meaning_missing', 'inertia_vs_oscillation_confusion'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-08',
  },
  'step-09': {
    layout: {
      template: 'formula_strip_plus_rule_check',
      regions: [
        { id: 'formula-strip', width: 'full', order: 1 },
        { id: 'rule-cards', width: 'full', order: 2 },
        { id: 'judge-zone', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'rule_judge',
    teacherInsightWidgets: ['option_distribution', 'feedback_explanation_keywords'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'misconceptionTags'],
    misconceptionTags: ['feedback_as_sum', 'parallel_as_product'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-09',
  },
  'step-10': {
    layout: {
      template: 'engineering_block_diagram',
      regions: [
        { id: 'diagram', width: 'full', order: 1 },
        { id: 'role-cards', width: 'full', order: 2 },
        { id: 'feedback-task', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'hotspot_labeling',
    teacherInsightWidgets: ['hotspot_accuracy', 'common_feedback_errors'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'teacherRevealSeen'],
    misconceptionTags: ['sensor_role_unclear'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-10',
  },
  'step-11': {
    layout: {
      template: 'comparison_slide',
      regions: [
        { id: 'left-diagram', width: '1/2', order: 1 },
        { id: 'right-diagram', width: '1/2', order: 2 },
        { id: 'comparison-table', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'bucket_sort',
    teacherInsightWidgets: ['task_assignment_accuracy'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'misconceptionTags'],
    misconceptionTags: ['block_equals_sfg'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-11',
  },
  'step-12': {
    layout: {
      template: 'formula_then_term_match',
      regions: [
        { id: 'formula-zone', width: 'full', order: 1 },
        { id: 'term-cards', width: 'full', order: 2 },
        { id: 'match-stage', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'drag_match',
    teacherInsightWidgets: ['term_accuracy', 'common_term_confusions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'misconceptionTags', 'teacherRevealSeen'],
    misconceptionTags: ['delta_as_loop', 'touching_definition_blur'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-12',
  },
  'step-13': {
    layout: {
      template: 'prompt_image_then_worked_example',
      regions: [
        { id: 'diagram-zone', width: 'full', order: 1 },
        { id: 'step-cards', width: 'full', order: 2 },
        { id: 'check-zone', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'choice_check',
    teacherInsightWidgets: ['choice_distribution', 'closed_loop_focus_rate'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'misconceptionTags'],
    misconceptionTags: ['local_module_as_final_object'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-13',
  },
  'step-14': {
    layout: {
      template: 'prompt_image_then_path_reasoning',
      regions: [
        { id: 'highlight-stage', width: 'full', order: 1 },
        { id: 'formula-chain', width: 'full', order: 2 },
        { id: 'explain-box', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'path_highlight',
    teacherInsightWidgets: ['highlight_accuracy', 'common_contact_confusions'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'misconceptionTags', 'teacherRevealSeen'],
    misconceptionTags: ['non_touching_loops_vs_non_touching_path'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-14',
  },
  'step-15': {
    layout: {
      template: 'post_quiz_stack',
      regions: [
        { id: 'quiz-stack', width: 'full', order: 1 },
        { id: 'distribution', width: 'full', order: 2 },
      ],
    },
    interactionKind: 'quiz_group',
    teacherInsightWidgets: ['question_distribution', 'top_error_question'],
    telemetrySummaryFields: ['attemptCount', 'resultState', 'errorBucket', 'teacherRevealSeen'],
    misconceptionTags: ['zero_initial_state', 'typical_element_identification', 'delta_k_judgment'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-15',
  },
  'step-16': {
    layout: {
      template: 'summary_infographic',
      regions: [
        { id: 'summary-chain', width: 'full', order: 1 },
        { id: 'finished-steps', width: 'full', order: 2 },
        { id: 'next-lesson', width: 'full', order: 3 },
      ],
    },
    interactionKind: 'none',
    teacherInsightWidgets: ['session_finalize_ready'],
    telemetrySummaryFields: ['viewed', 'timeOnStep'],
    previewDemoPath: '/interactive-learning/courses/unit-2-1-modeling-language/student/demo?step=step-16',
  },
};

export const UNIT_2_1_INTERACTIVE_PAGE_TYPES = new Set<UNIT_2_1PageType>([
  'binary_choice',
  'quiz_group',
  'short_response',
  'multi_check',
  'reflection_form',
  'drag_match',
  'rule_judge',
  'hotspot_labeling',
  'bucket_sort',
  'choice_check',
  'path_highlight',
]);

export const UNIT_2_1_STEP_CONTENT_CONTRACTS: Record<string, UNIT_2_1StepCoverage> = {
  'step-02': {
    requiredFormulas: ['J\\ddot{\\theta}(t)+B\\dot{\\theta}(t)=Ku(t)'],
  },
  'step-03': {
    requiredConclusions: ['微分方程 -> 拉氏变换 -> 传递函数 -> 典型环节 -> 结构表达 -> 总体对象'],
  },
  'step-05': {
    requiredFormulas: [
      'F(s)=\\mathcal{L}\\{f(t)\\}',
      '\\mathcal{L}\\{\\dot f(t)\\}=sF(s)',
      '\\mathcal{L}\\{\\ddot f(t)\\}=s^2F(s)',
    ],
    requiredTableTitles: ['本课最少要记住的拉氏对应关系'],
    requiredTables: [
      {
        title: '本课最少要记住的拉氏对应关系',
        headers: ['时域表达', '变换域表达', '本课只抓的意义'],
        rows: [
          ['1(t)', '1/s', '常值输入在变换域里变成最简单的代数对象'],
          ['\\dot f(t)', 'sF(s)-f(0^-)', '导数关系被改写为关于 s 的代数项'],
          ['\\ddot f(t)', 's^2F(s)-sf(0^-)-\\dot f(0^-)', '二阶动态同样能被统一搬到变换域表达'],
          ['\\int_0^t f(\\tau)\\,d\\tau', 'F(s)/s', '积分关系也能并入同一对象语言中'],
        ],
      },
    ],
  },
  'step-06': {
    requiredFormulas: ['G(s)=\\frac{Y(s)}{U(s)}\\bigg|_{\\text{零初值}}'],
  },
  'step-07': {
    requiredFormulas: ['Y(s)=G(s)U(s)', 'Y(s)=G(s)U(s)+\\text{初值项}'],
    requiredConclusions: ['初值项会影响输出，但不属于传递函数定义中的系统对象。'],
  },
  'step-08': {
    requiredTableTitles: ['五类典型环节及其第一判断'],
    requiredTables: [
      {
        title: '五类典型环节及其第一判断',
        headers: ['典型环节', '传递函数形式', '你应先抓住的物理或工程含义', '第一眼判断'],
        rows: [
          ['比例环节', 'G(s)=K', '只有比例放大或缩小，不引入动态记忆', '改变强弱，不改变动态阶次'],
          ['积分环节', 'G(s)=\\dfrac{1}{s}', '输出是输入随时间的累积', '引入“记忆”，常使系统更容易慢慢积累'],
          ['微分环节', 'G(s)=s', '输出更敏感于输入变化率', '强调变化趋势，对快变化敏感'],
          ['一阶惯性环节', 'G(s)=\\dfrac{1}{Ts+1}', '存在滞后，响应不会立刻到位', '不振荡，主要体现快慢差异'],
          ['振荡环节', 'G(s)=\\dfrac{\\omega_n^2}{s^2+2\\zeta\\omega_n s+\\omega_n^2}', '同时包含快慢与振荡特征', '可能超调、振荡、再稳定'],
        ],
      },
    ],
  },
  'step-09': {
    requiredFormulas: ['G(s)=G_1(s)G_2(s)', 'G(s)=G_1(s)+G_2(s)', '\\frac{Y(s)}{R(s)}=\\frac{G(s)}{1+G(s)H(s)}'],
  },
  'step-12': {
    requiredFormulas: [
      '\\frac{Y(s)}{R(s)}=\\frac{\\sum P_k\\Delta_k}{\\Delta}',
      '\\frac{Y(s)}{R(s)}=\\frac{\\sum_{k=1}^{N} P_k \\Delta_k}{\\Delta}',
    ],
  },
  'step-13': {
    requiredFormulas: [
      '\\displaystyle G(s)=\\frac{K_cK_p}{s(T_as+1)(T_ps+1)}',
      '\\displaystyle \\Phi(s)=\\frac{Y(s)}{R(s)}=\\frac{K_cK_p}{s(T_as+1)(T_ps+1)+K_cK_pK_h}',
    ],
    requiredConclusions: ['例题一最终真正要分析的是闭环对象，而不是局部模块。'],
  },
  'step-14': {
    requiredFormulas: [
      'P_1=\\frac{K_cK_p}{s(T_as+1)(T_ps+1)}',
      'L_1=-\\frac{K_cK_pK_h}{s(T_as+1)(T_ps+1)}',
      '\\Delta=1-L_1',
      '\\Delta_1=1',
    ],
    requiredConclusions: ['附录补充情形下，只有存在不接触该前向通路的局部回路时，才会出现 \\Delta_k=1-L_1。'],
  },
  'step-16': {
    requiredConclusions: ['对象建立 -> 对象识别 -> 结构表达 -> 总体对象'],
  },
};

export const UNIT_2_1_LESSON_STEPS: UNIT_2_1StepDefinition[] = [
  {
    id: 'step-01',
    stage: 'B',
    title: '回到地图——为什么模块 2 先从建模语言开始',
    hint: '从模块 1 的现象直觉，切换到模块 2 的对象语言。',
    duration: '3 min',
    pageType: 'display',
    coverage: {},
    workspaceKind: 'object-chain',
  },
  {
    id: 'step-02',
    stage: 'B',
    title: '情境引入——为什么光有微分方程还不够',
    hint: '先判断：微分方程是终点，还是统一分析对象的起点。',
    duration: '5 min',
    pageType: 'binary_choice',
    coverage: UNIT_2_1_STEP_CONTENT_CONTRACTS['step-02'] ?? {},
  },
  {
    id: 'step-03',
    stage: 'O',
    title: '学习目标——今天要建哪条对象链',
    hint: '把“微分方程 -> 传递函数 -> 结构表达 -> 总体对象”一次看清。',
    duration: '2 min',
    pageType: 'display',
    coverage: UNIT_2_1_STEP_CONTENT_CONTRACTS['step-03'] ?? {},
    workspaceKind: 'object-chain',
  },
  {
    id: 'step-04',
    stage: 'P1',
    title: '前测——对象、初值与结构的三个误区',
    hint: '先暴露最容易混淆的三件事：对象定义、初始状态、结构表达。',
    duration: '4 min',
    pageType: 'quiz_group',
    coverage: {},
  },
  {
    id: 'step-05',
    stage: 'P2',
    title: '拉氏变换的工程动机',
    hint: '不讲积分技巧，讲清为什么它能把微分方程改写成统一代数对象。',
    duration: '6 min',
    pageType: 'short_response',
    coverage: UNIT_2_1_STEP_CONTENT_CONTRACTS['step-05'] ?? {},
  },
  {
    id: 'step-06',
    stage: 'P2',
    title: '零初值下传递函数怎样形成',
    hint: '明确传递函数为什么不是“原方程换个写法”。',
    duration: '8 min',
    pageType: 'multi_check',
    coverage: UNIT_2_1_STEP_CONTENT_CONTRACTS['step-06'] ?? {},
  },
  {
    id: 'step-07',
    stage: 'P2',
    title: '非零初值为什么不能混进对象定义',
    hint: '先自己区分对象项和初值项，再让 AI 只对照推理链。',
    duration: '6 min',
    pageType: 'reflection_form',
    coverage: UNIT_2_1_STEP_CONTENT_CONTRACTS['step-07'] ?? {},
    workspaceKind: 'initial-state',
  },
  {
    id: 'step-08',
    stage: 'P2',
    title: '典型环节对象库：先看清对象由什么组成',
    hint: '先认对象，再做运算，把形式、名称和工程判断配起来。',
    duration: '8 min',
    pageType: 'drag_match',
    coverage: UNIT_2_1_STEP_CONTENT_CONTRACTS['step-08'] ?? {},
    workspaceKind: 'typical-elements',
  },
  {
    id: 'step-09',
    stage: 'P2',
    title: '结构图三类基本连接',
    hint: '串联、并联、反馈三类规则先立住，不进入复杂变换技巧。',
    duration: '8 min',
    pageType: 'rule_judge',
    coverage: UNIT_2_1_STEP_CONTENT_CONTRACTS['step-09'] ?? {},
    workspaceKind: 'connection-rules',
  },
  {
    id: 'step-10',
    stage: 'P2',
    title: '船舶航向系统：把对象真正连成系统',
    hint: '把控制器、舵机、船体和传感器放进同一张结构图。',
    duration: '5 min',
    pageType: 'hotspot_labeling',
    coverage: {},
    workspaceKind: 'connection-rules',
  },
  {
    id: 'step-11',
    stage: 'P2',
    title: '方框图为什么还不够：信号流图补位',
    hint: '结构图看模块组成，信号流图看节点路径与回路。',
    duration: '5 min',
    pageType: 'bucket_sort',
    coverage: {},
  },
  {
    id: 'step-12',
    stage: 'P2',
    title: '梅森公式的最小使用集',
    hint: '只抓四个术语和一个公式：前向通路、回路、互不接触回路、余子式。',
    duration: '6 min',
    pageType: 'drag_match',
    coverage: UNIT_2_1_STEP_CONTENT_CONTRACTS['step-12'] ?? {},
    workspaceKind: 'signal-flow-terms',
  },
  {
    id: 'step-13',
    stage: 'P2',
    title: '例题一：单回路闭环对象如何收束',
    hint: '从对象识别到信号流图验证，走完整个对象收束链。',
    duration: '8 min',
    pageType: 'choice_check',
    coverage: UNIT_2_1_STEP_CONTENT_CONTRACTS['step-13'] ?? {},
    workspaceKind: 'mason-highlight',
  },
  {
    id: 'step-14',
    stage: 'P2',
    title: '补充辨析：余子式为什么不一定等于 1',
    hint: '重点分清：互不接触回路，与“不接触某条前向通路”不是一回事。',
    duration: '6 min',
    pageType: 'path_highlight',
    coverage: UNIT_2_1_STEP_CONTENT_CONTRACTS['step-14'] ?? {},
    workspaceKind: 'mason-highlight',
  },
  {
    id: 'step-15',
    stage: 'P3',
    title: '后测——会不会用对象语言复述本课',
    hint: '后测看的是对象建立链是否真正站稳，不只是术语记忆。',
    duration: '5 min',
    pageType: 'quiz_group',
    coverage: {},
  },
  {
    id: 'step-16',
    stage: 'S',
    title: '总结——对象语言已建立，下一课进入响应分析',
    hint: '把对象建立、对象识别、结构表达和总体对象四段主线收束起来。',
    duration: '5 min',
    pageType: 'summary',
    coverage: UNIT_2_1_STEP_CONTENT_CONTRACTS['step-16'] ?? {},
  },
] as const;

export function getUNIT_2_1Step(stepId: string) {
  return UNIT_2_1_LESSON_STEPS.find((step) => step.id === stepId) ?? UNIT_2_1_LESSON_STEPS[0];
}

export function getUNIT_2_1PageContract(stepId: string) {
  return UNIT_2_1_PAGE_CONTRACTS[stepId] ?? UNIT_2_1_PAGE_CONTRACTS['step-01'];
}

export function isUNIT_2_1InteractivePageType(pageType: UNIT_2_1PageType) {
  return UNIT_2_1_INTERACTIVE_PAGE_TYPES.has(pageType);
}

export function createEmptyUNIT_2_1StudentState(studentName: string): UNIT_2_1StudentCourseState {
  return {
    kind: 'unit21_student_state',
    version: 1,
    studentName,
    updatedAt: Date.now(),
    responses: {},
  };
}

export const UNIT_2_1_PREMIUM_LESSON_CARD = {
  id: 'unit-2-1-modeling-language',
  title: UNIT_2_1_COURSE_TITLE,
  description: '精品互动课：把微分方程、传递函数、结构图和梅森公式收束成模块 2 的统一对象语言。',
  duration: '90 分钟',
  href: `/interactive-learning/courses/${UNIT_2_1_ROUTE_SEGMENT}`,
  badge: '精品课程',
} as const;

const UNIT_2_1_MEDIA_BY_STEP_ID: Record<string, string> = {
  'step-02': '/course-runtime/lessons/2-1/media/2-1-cover-comic.png',
  'step-08': '/course-runtime/lessons/2-1/media/2-1-md-01-typical-elements-map.png',
  'step-09': '/course-runtime/lessons/2-1/media/2-1-md-02-series-equivalent.png',
  'step-10': '/course-runtime/lessons/2-1/media/2-1-md-05-ship-heading-physical-blocks.png',
  'step-11': '/course-runtime/lessons/2-1/media/2-1-md-06-block-vs-sfg.png',
  'step-13': '/course-runtime/lessons/2-1/media/2-1-md-08-example-ship-sfg.png',
  'step-14': '/course-runtime/lessons/2-1/media/2-1-md-14-example2-sfg.png',
  'step-16': '/course-runtime/lessons/2-1/media/2-1-info.png',
};

export function getUNIT_2_1MediaSrc(stepId: string) {
  return UNIT_2_1_MEDIA_BY_STEP_ID[stepId] ?? null;
}

export function isUNIT_2_1StudentState(value: unknown): value is UNIT_2_1StudentCourseState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_2_1StudentCourseState>;
  return data.kind === 'unit21_student_state' && data.version === 1;
}

export function isUNIT_2_1TeacherSyncState(value: unknown): value is UNIT_2_1TeacherCourseSyncState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Partial<UNIT_2_1TeacherCourseSyncState>;
  return data.kind === 'teacher_sync_unit21' && typeof data.activeStepId === 'string';
}

export const UNIT_2_1_SESSION_ADAPTER: LessonSessionAdapter<
  UNIT_2_1StudentCourseState,
  UNIT_2_1TeacherCourseSyncState,
  UNIT_2_1TeacherSyncInput
> = {
  lessonKey: UNIT_2_1_LESSON_KEY,
  studentItemId: UNIT_2_1_STUDENT_ITEM_ID,
  teacherItemId: UNIT_2_1_TEACHER_SYNC_ITEM_ID,
  studentStateKey: UNIT_2_1_STUDENT_STATE_KEY,
  teacherStateKey: UNIT_2_1_TEACHER_STATE_KEY,
  createEmptyStudentState: createEmptyUNIT_2_1StudentState,
  isStudentState: isUNIT_2_1StudentState,
  isTeacherSyncState: isUNIT_2_1TeacherSyncState,
  buildTeacherSyncPayload(input) {
    return {
      kind: 'teacher_sync_unit21',
      activeStepId: input.activeStepId,
      revealedAnswers: input.revealedAnswers,
      releasedActivities: input.releasedActivities,
      updatedAt: input.updatedAt ?? Date.now(),
    };
  },
};

export function shouldPostUNIT_2_1TeacherSync(input: UNIT_2_1TeacherSyncPostGateInput) {
  return !input.loadingSession && input.teacherViewHydrated;
}

export function resolveUNIT_2_1TeacherSyncDraft(input: {
  localRevealedAnswers: Record<string, boolean> | null;
  localReleasedActivities: Record<string, boolean> | null;
  teacherSyncState: UNIT_2_1TeacherCourseSyncState | null;
}) {
  return {
    revealedAnswers: input.localRevealedAnswers ?? input.teacherSyncState?.revealedAnswers ?? {},
    releasedActivities: input.localReleasedActivities ?? input.teacherSyncState?.releasedActivities ?? {},
  };
}

export async function finalizeUNIT_2_1TeacherSession(input: UNIT_2_1TeacherFinalizeInput) {
  await input.finishSession();
  input.trackSessionFinalize({
    currentStepId: input.currentStepId,
  });
}
