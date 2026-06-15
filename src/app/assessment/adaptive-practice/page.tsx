'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AppShell } from '@/components/platform/app-shell';
import {
  ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG,
  buildControlCorrectionLearningCenterView,
  buildLearnerDataRouteShell,
  buildPracticeEntryRouteNodes,
  type ControlCorrectionLearningCenterView,
  type ControlCorrectionCenterRouteIntent,
  type PracticeEntryRouteNode,
} from '@/features/adaptive/adaptive-learning-center-contracts';
import type { AdaptiveLearningPathPlan } from '@/lib/adaptive-learning-path-planner';
import type { AdaptiveLearnerState } from '@/lib/data-governance/adaptive-learner-state-service';
import { getCommercialStudentEntryIntentGroups } from '@/lib/platform-role-navigation';

type PostLearningPathNodeAction = {
  href: string;
  method: 'POST';
  body?: Record<string, unknown>;
  redirectHref?: string;
};

type LearningPathNodeCompletionAction = {
  href: string;
  label: string;
  method: 'POST';
  body: Record<string, unknown>;
};

function isPostLearningPathNodeAction(action: {
  method: 'GET' | 'POST';
  href: string;
  body?: Record<string, unknown>;
  redirectHref?: string;
}): action is PostLearningPathNodeAction {
  return action.method === 'POST';
}

interface DiagnosticResponse {
  knowledgeDimensions: {
    computational: number;
    crossDomain: number;
    design: number;
  };
  weakAreas: string[];
  recommendedFocus: string[];
}

interface PracticeQuestion {
  id: string;
  stem: string;
  domains: string[];
  type: string;
  difficulty: number;
  knowledgeTags: string[];
  options: Array<{
    label: string;
    text: string;
    explanation: string;
  }>;
}

interface NextQuestionResponse {
  question: PracticeQuestion;
  estimatedAbility: number;
  confidenceInterval: [number, number];
}

interface SubmitAnswerResponse {
  isCorrect: boolean;
  correctOption: string;
  explanation: string;
  estimatedAbility: number;
  recommendedFocus: string[];
}

interface LearningPathRoundResponse {
  path?: {
    id: string;
    userId: string;
    title: string;
    goalId: string;
    plannerVersion?: string | null;
    pathStatus?: string | null;
    currentNodeId?: string | null;
    pathPayload?: Record<string, unknown> | null;
    explanationPayload?: Record<string, unknown> | null;
    alternativePayload?: unknown[] | null;
    terminalValidation?: Record<string, unknown> | null;
    lastExecutionMetadata?: Record<string, unknown> | null;
    executions?: Array<Record<string, unknown>>;
    deviations?: Array<Record<string, unknown>>;
    interventions?: Array<Record<string, unknown>>;
  } | null;
}

type LearningPathRoundView = NonNullable<LearningPathRoundResponse['path']>;

interface PathOptionView {
  styleId: string;
  policyFamily: string;
  label: string;
  targetDeficits: Array<Record<string, unknown>>;
  evidenceBasis: string[];
  resourceMix: Record<string, number>;
  effort: {
    estimatedMinutes?: number;
    relative?: string;
  };
  terminalValidationNodeIds: string[];
  terminalValidationStrategy: {
    summary?: string;
  };
  limitations: string[];
}

interface PathSelectionHistoryView {
  type: string;
  createdAt?: string;
  selectedStyleId?: string | null;
  previousStyleId?: string | null;
  rejectedStyleIds?: string[];
  helpful?: boolean | null;
}

interface PathExecutionNodeView {
  nodeId: string;
  title: string;
  type: string;
  resourceLabel: string;
  status: 'current' | 'completed' | 'skipped' | 'blocked' | 'next' | 'optional';
  target: string;
  estimatedMinutes: number;
  reason: string;
  evidence: string;
  checkpoint: string;
}

interface PathActivityTimelineItem {
  id: string;
  nodeId: string;
  type: string;
  title: string;
  detail: string;
  nodeTitle: string;
  sourceLabel: string;
  stateLabel: '已记录' | '待复核' | '可用于推荐' | '仅作参考';
  createdAt: string;
  sortTime: number;
}

type DemoScene = 'stable' | 'generate';

const DEMO_SCENES: Record<DemoScene, {
  diagnostic: DiagnosticResponse;
  questionState: NextQuestionResponse;
  feedback: SubmitAnswerResponse | null;
  defaultSelectedOption: string;
}> = {
  stable: {
    diagnostic: {
      knowledgeDimensions: {
        computational: 76,
        crossDomain: 63,
        design: 58,
      },
      weakAreas: ['phase-margin', 'disturbance-rejection', 'controller-tuning'],
      recommendedFocus: [
        '优先练习“相位裕度-超调量”映射题',
        '补强扰动抑制与鲁棒性分析',
        '加强 PID 参数因果调节训练',
      ],
    },
    questionState: {
      estimatedAbility: 0.54,
      confidenceInterval: [0.31, 0.77],
      question: {
        id: 'demo-classic-stable',
        stem: '某系统相位裕度从 45° 降至 20°，且交叉频率上升。以下哪项最符合“频域→时域”映射规律？',
        domains: ['frequency', 'time'],
        type: 'bode-to-stability',
        difficulty: 0.58,
        knowledgeTags: ['phase-margin', 'overshoot'],
        options: [
          { label: 'A', text: '超调风险升高且鲁棒性下降', explanation: '相位裕度下降通常对应阻尼降低，超调增加且鲁棒性变差。' },
          { label: 'B', text: '超调下降且抗扰增强', explanation: '该选项与相位裕度下降的典型结果相反。' },
          { label: 'C', text: '动态几乎不变，仅稳态误差变化', explanation: '动态指标会明显变化，不仅是稳态误差。' },
          { label: 'D', text: '系统一定变为无振荡响应', explanation: '该结论与裕度降低趋势不一致。' },
        ],
      },
    },
    feedback: null,
    defaultSelectedOption: '',
  },
  generate: {
    diagnostic: {
      knowledgeDimensions: {
        computational: 68,
        crossDomain: 71,
        design: 64,
      },
      weakAreas: ['comfort-constraint', 'robustness', 'controller-tuning'],
      recommendedFocus: [
        '关注舒适度约束与控制带宽权衡',
        '增加参数摄动场景下的决策练习',
        '加强 PID 参数因果调节训练',
      ],
    },
    questionState: {
      estimatedAbility: 0.89,
      confidenceInterval: [0.65, 1.12],
      question: {
        id: 'demo-generated-live',
        stem: '【AI现场生成】邮轮横摇舒适度未达标（MSI 偏高），请在保持稳定裕度 > 30° 约束下，给出可执行调参策略。',
        domains: ['time', 'frequency', 'complex'],
        type: 'multi-criteria',
        difficulty: 0.72,
        knowledgeTags: ['comfort-constraint', 'robustness', 'controller-tuning'],
        options: [
          {
            label: 'A',
            text: '先识别主导约束，再按跨域因果逐步调参',
            explanation: '跨域问题应先明确约束，再基于“极点-频域-时域”因果做迭代优化。',
          },
          { label: 'B', text: '直接大幅提高 Kp 并忽略约束', explanation: '忽略约束会导致舒适度与鲁棒性风险。' },
          { label: 'C', text: '仅根据单一指标一次性定参', explanation: '单指标决策难以应对跨域耦合。' },
          { label: 'D', text: '只追求最快响应，不评估稳定裕度', explanation: '稳定裕度是硬约束，不能跳过。' },
        ],
      },
    },
    feedback: {
      isCorrect: true,
      correctOption: 'A',
      explanation: '本题强调“约束优先 + 跨域因果”的设计流程，先保稳定再优化舒适度。',
      estimatedAbility: 0.96,
      recommendedFocus: ['围绕 comfort-constraint 继续练习跨域题目', '增加参数摄动场景下的决策练习'],
    },
    defaultSelectedOption: 'A',
  },
};

const DEMO_PATH_ROUND: LearningPathRoundView = {
  id: 'demo-control-correction-active-path',
  userId: 'demo-student',
  title: '控制校正入门到验证路径',
  goalId: 'control-correction',
  pathStatus: 'active',
  currentNodeId: 'control-workbench:lead-design',
  pathPayload: {
    mainPathNodeIds: [
      'interactive-lesson:control-correction-overview',
      'control-workbench:lead-design',
      'simulation:step-response-lab',
      'checkpoint:design-review',
      'arena-task:lead-pid-challenge',
    ],
    planNodes: [
      {
        nodeId: 'interactive-lesson:control-correction-overview',
        title: '校正目标与指标回顾',
        type: 'interactive_lesson',
        pathNodeType: 'interactive_lesson',
        displayName: '互动课程',
        iconKey: 'lesson',
        shapeHint: 'course-card',
        evidenceBehavior: 'completion',
        evidenceStatus: 'instrumented',
        externalResource: null,
        checkpoint: null,
        target: '/interactive-learning/courses/unit-3-6-control-correction',
        estimatedTimeMinutes: 12,
        prerequisiteNodeIds: [],
        knowledgeCoverage: ['稳态误差', '超调量', '调节时间'],
        teacherPolicy: 'allowed',
        privacyLevel: 'student-visible',
        terminalConstraints: [],
        score: 0.86,
        reasonCodes: ['先回顾指标，再进入参数实验'],
        status: 'completed',
      },
      {
        nodeId: 'control-workbench:lead-design',
        title: '控制工作台调参',
        type: 'control_workbench',
        pathNodeType: 'control_workbench',
        displayName: '控制工作台',
        iconKey: 'workbench',
        shapeHint: 'lab',
        evidenceBehavior: 'instrumented-run',
        evidenceStatus: 'instrumented',
        externalResource: null,
        checkpoint: null,
        target: '/interactive-learning/control-workbench?mode=lead-design',
        estimatedTimeMinutes: 18,
        prerequisiteNodeIds: ['interactive-lesson:control-correction-overview'],
        knowledgeCoverage: ['超前校正', '相位裕度'],
        teacherPolicy: 'allowed',
        privacyLevel: 'student-visible',
        terminalConstraints: [],
        score: 0.9,
        reasonCodes: ['当前节点用于把频域指标转化为可执行参数'],
        status: 'current',
      },
      {
        nodeId: 'simulation:step-response-lab',
        title: '阶跃响应虚拟仿真',
        type: 'simulation',
        pathNodeType: 'simulation',
        displayName: '虚拟仿真',
        iconKey: 'simulation',
        shapeHint: 'simulation-node',
        evidenceBehavior: 'instrumented-run',
        evidenceStatus: 'instrumented',
        externalResource: null,
        checkpoint: null,
        target: '/simulations/cruise',
        estimatedTimeMinutes: 15,
        prerequisiteNodeIds: ['control-workbench:lead-design'],
        knowledgeCoverage: ['时域验证', '鲁棒性'],
        teacherPolicy: 'allowed',
        privacyLevel: 'student-visible',
        terminalConstraints: [],
        score: 0.82,
        reasonCodes: ['用仿真验证工作台参数效果'],
        status: 'next',
      },
      {
        nodeId: 'checkpoint:design-review',
        title: '设计检查点',
        type: 'checkpoint',
        pathNodeType: 'checkpoint',
        displayName: '检查点',
        iconKey: 'checkpoint',
        shapeHint: 'diamond',
        evidenceBehavior: 'checkpoint',
        evidenceStatus: 'instrumented',
        externalResource: null,
        checkpoint: {
          criteria: ['参数记录完整', '仿真结果可复核'],
        },
        target: '/assessment/adaptive-practice?intent=evidence-review',
        estimatedTimeMinutes: 8,
        prerequisiteNodeIds: ['simulation:step-response-lab'],
        knowledgeCoverage: ['设计复核'],
        teacherPolicy: 'allowed',
        privacyLevel: 'student-visible',
        terminalConstraints: ['checkpoint-pass-required'],
        score: 0.78,
        reasonCodes: ['检查是否满足进入 Arena 前的证据要求'],
        status: 'next',
      },
      {
        nodeId: 'arena-task:lead-pid-challenge',
        title: 'Arena 综合挑战',
        type: 'arena_task',
        pathNodeType: 'arena_task',
        displayName: 'Arena',
        iconKey: 'arena',
        shapeHint: 'flag',
        evidenceBehavior: 'official-evaluation',
        evidenceStatus: 'instrumented',
        externalResource: null,
        checkpoint: null,
        target: '/arena/challenges/task-second-order-lead-pid',
        estimatedTimeMinutes: 20,
        prerequisiteNodeIds: ['checkpoint:design-review'],
        knowledgeCoverage: ['综合验证'],
        teacherPolicy: 'allowed',
        privacyLevel: 'student-visible',
        terminalConstraints: ['official-arena-required'],
        score: 0.84,
        reasonCodes: ['作为路径终端验证'],
        status: 'next',
      },
    ],
  },
  terminalValidation: {
    nodeId: 'arena-task:lead-pid-challenge',
    state: 'pending',
  },
  lastExecutionMetadata: {
    completedNodeIds: ['interactive-lesson:control-correction-overview'],
    failedNodeIds: [],
  },
  executions: [
    {
      id: 'demo-exec-1',
      nodeId: 'interactive-lesson:control-correction-overview',
      resourceType: 'interactive_lesson',
      status: 'completed',
      activityKind: 'initial-completion',
      completedAt: '2026-06-15T08:00:00.000Z',
      createdAt: '2026-06-15T08:00:00.000Z',
    },
    {
      id: 'demo-exec-2',
      nodeId: 'interactive-lesson:control-correction-overview',
      resourceType: 'interactive_lesson',
      status: 'started',
      activityKind: 'continued-interaction',
      completedAt: '2026-06-15T08:18:00.000Z',
      createdAt: '2026-06-15T08:18:00.000Z',
    },
  ],
  deviations: [
    {
      id: 'demo-dev-1',
      deviationType: 'skip',
      targetNodeId: 'simulation:step-response-lab',
      evidenceConfidence: 'medium',
      createdAt: '2026-06-15T08:26:00.000Z',
    },
  ],
  interventions: [
    {
      id: 'demo-int-1',
      interventionKind: 'hint',
      studentOutcome: 'accepted',
      privacySafeSummary: '控灵建议先完成工作台参数记录，再回到仿真节点。',
      createdAt: '2026-06-15T08:32:00.000Z',
    },
  ],
};

const learnerDataShell = buildLearnerDataRouteShell('/assessment/adaptive-practice');

function percentLabel(value: number): string {
  return `${Math.round(value)}%`;
}

function formatConfidence(value: string): string {
  if (value === 'high') return '高';
  if (value === 'medium') return '中';
  if (value === 'low') return '低';
  return '未知';
}

function formatEvidenceLimitation(value: string): string {
  if (value === 'complete') return '完整';
  if (value === 'partial') return '部分';
  if (value === 'missing') return '缺失';
  return '未知';
}

function resolveDemoScene(sceneParam: string | null): DemoScene {
  return sceneParam === 'generate' ? 'generate' : 'stable';
}

function resolveControlCorrectionIntent(intentParam: string | null): ControlCorrectionCenterRouteIntent {
  if (
    intentParam === 'learner-state-review' ||
    intentParam === 'path-execution' ||
    intentParam === 'evidence-review' ||
    intentParam === 'contextual-recommendation'
  ) {
    return intentParam;
  }
  return 'practice';
}

function restoreLearningPathPlan(round: LearningPathRoundResponse['path']): AdaptiveLearningPathPlan | null {
  if (!round || round.goalId !== 'control-correction') return null;
  const payload = round.pathPayload ?? {};
  const planNodes = Array.isArray(payload.planNodes) ? payload.planNodes : [];
  const alternatives = Array.isArray(payload.alternatives)
    ? payload.alternatives
    : Array.isArray(round.alternativePayload)
      ? round.alternativePayload
      : [];
  const explanations = typeof round.explanationPayload === 'object' && round.explanationPayload
    ? round.explanationPayload
    : payload.explanations;

  return {
    id: round.id,
    userId: round.userId,
    goal: {
      id: 'control-correction',
      title: round.title,
      knowledgeTargets: [],
    },
    stage: 'stage-1-rules-graph',
    policyFamily: typeof payload.policyFamily === 'string' ? payload.policyFamily as AdaptiveLearningPathPlan['policyFamily'] : 'rules-plus-graph-search',
    policyMetadata: payload.policyMetadata as AdaptiveLearningPathPlan['policyMetadata'],
    policyBundle: payload.policyBundle as AdaptiveLearningPathPlan['policyBundle'],
    excludedPolicyFamilies: ['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid'],
    status: round.pathStatus === 'active' || round.pathStatus === 'completed' ? 'ready' : 'fallback',
    currentNodeId: round.currentNodeId ?? null,
    mainPath: planNodes as AdaptiveLearningPathPlan['mainPath'],
    alternatives: alternatives as AdaptiveLearningPathPlan['alternatives'],
    score: payload.score as AdaptiveLearningPathPlan['score'],
    confidence: payload.confidence as AdaptiveLearningPathPlan['confidence'] ?? {
      level: 'unknown',
      score: 0,
      sourceCoverage: 0,
    },
    explanations: (explanations as AdaptiveLearningPathPlan['explanations']) ?? {
      selectedReasons: [],
      rejectedAlternatives: [],
      fallbackReasons: [],
    },
    executionStatus: payload.executionStatus as AdaptiveLearningPathPlan['executionStatus'],
    deviations: payload.deviations as AdaptiveLearningPathPlan['deviations'] ?? [],
    corrections: payload.corrections as AdaptiveLearningPathPlan['corrections'] ?? [],
    feedbackEvents: Array.isArray(payload.feedbackEvents)
      ? payload.feedbackEvents as AdaptiveLearningPathPlan['feedbackEvents']
      : Array.isArray(payload.selectionHistory)
        ? payload.selectionHistory.map((item) => {
            const history = getRecord(item);
            return {
              id: typeof history.id === 'string' ? history.id : `selection-history:${Math.random().toString(36).slice(2)}`,
              type: typeof history.type === 'string' ? history.type as AdaptiveLearningPathPlan['feedbackEvents'][number]['type'] : 'selection',
              nodeId: null,
              createdAt: typeof history.createdAt === 'string' ? history.createdAt : new Date().toISOString(),
              helpful: typeof history.helpful === 'boolean' ? history.helpful : undefined,
              context: {
                selectedStyleId: typeof history.selectedStyleId === 'string' ? history.selectedStyleId : undefined,
                previousStyleId: typeof history.previousStyleId === 'string' ? history.previousStyleId : undefined,
                rejectedStyleIds: getStringArray(history.rejectedStyleIds),
                helpful: typeof history.helpful === 'boolean' ? history.helpful : undefined,
              },
            };
          }) as AdaptiveLearningPathPlan['feedbackEvents']
        : [],
    visualization: payload.visualization as AdaptiveLearningPathPlan['visualization'],
  };
}

function controlCorrectionAlternativeCount(view: ControlCorrectionLearningCenterView): number {
  const currentPath = view.panels.find((panel) => panel.region === 'current-path');
  const payload = currentPath?.payload;
  if (!payload || typeof payload !== 'object' || !('alternatives' in payload)) return 0;
  return Array.isArray(payload.alternatives) ? payload.alternatives.length : 0;
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function getNumberRecord(value: unknown): Record<string, number> {
  const record = getRecord(value);
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );
}

function getPathOptions(view: ControlCorrectionLearningCenterView | null): PathOptionView[] {
  const currentPath = view?.panels.find((panel) => panel.region === 'current-path');
  const payload = getRecord(currentPath?.payload);
  const pathOptions = Array.isArray(payload.pathOptions) ? payload.pathOptions : [];
  return pathOptions.map((item) => {
    const option = getRecord(item);
    const effort = getRecord(option.effort);
    const terminalValidationStrategy = getRecord(option.terminalValidationStrategy);
    return {
      styleId: typeof option.styleId === 'string' ? option.styleId : 'unknown-style',
      policyFamily: typeof option.policyFamily === 'string' ? option.policyFamily : 'unknown-policy',
      label: typeof option.label === 'string' ? option.label : '未命名路径',
      targetDeficits: Array.isArray(option.targetDeficits)
        ? option.targetDeficits.map(getRecord)
        : [],
      evidenceBasis: getStringArray(option.evidenceBasis),
      resourceMix: getNumberRecord(option.resourceMix),
      effort: {
        estimatedMinutes: typeof effort.estimatedMinutes === 'number' ? effort.estimatedMinutes : undefined,
        relative: typeof effort.relative === 'string' ? effort.relative : undefined,
      },
      terminalValidationNodeIds: getStringArray(option.terminalValidationNodeIds),
      terminalValidationStrategy: {
        summary: typeof terminalValidationStrategy.summary === 'string' ? terminalValidationStrategy.summary : undefined,
      },
      limitations: getStringArray(option.limitations),
    };
  });
}

function getPathSelectionHistory(view: ControlCorrectionLearningCenterView | null): PathSelectionHistoryView[] {
  const currentPath = view?.panels.find((panel) => panel.region === 'current-path');
  const payload = getRecord(currentPath?.payload);
  const selectionHistory = Array.isArray(payload.selectionHistory) ? payload.selectionHistory : [];
  return selectionHistory.map((item) => {
    const history = getRecord(item);
    return {
      type: typeof history.type === 'string' ? history.type : 'unknown',
      createdAt: typeof history.createdAt === 'string' ? history.createdAt : undefined,
      selectedStyleId: typeof history.selectedStyleId === 'string' ? history.selectedStyleId : null,
      previousStyleId: typeof history.previousStyleId === 'string' ? history.previousStyleId : null,
      rejectedStyleIds: getStringArray(history.rejectedStyleIds),
      helpful: typeof history.helpful === 'boolean' ? history.helpful : null,
    };
  });
}

function getPathOptionFallback(view: ControlCorrectionLearningCenterView | null): Record<string, unknown> | null {
  const currentPath = view?.panels.find((panel) => panel.region === 'current-path');
  const payload = getRecord(currentPath?.payload);
  const fallback = getRecord(payload.pathOptionFallback);
  return Object.keys(fallback).length > 0 ? fallback : null;
}

function formatResourceMix(resourceMix: Record<string, number>): string {
  const entries = Object.entries(resourceMix);
  if (entries.length === 0) return '未声明资源组合';
  return entries.map(([key, value]) => `${formatResourceType(key)}×${value}`).join(' · ');
}

function formatPathDeficits(deficits: Array<Record<string, unknown>>): string {
  if (deficits.length === 0) return '未声明薄弱项';
  return deficits
    .map((deficit) => {
      const target = typeof deficit.targetId === 'string' ? deficit.targetId : 'unknown-target';
      const confidence = typeof deficit.confidence === 'number' ? `置信 ${Math.round(deficit.confidence * 100)}%` : '置信未知';
      return `${target} (${confidence})`;
    })
    .join(' · ');
}

function formatPathHistoryType(type: string): string {
  if (type === 'selection') return '选择';
  if (type === 'rejection') return '拒绝';
  if (type === 'switch') return '切换';
  if (type === 'helpfulness') return '有用性反馈';
  return type;
}

function formatStudentEvidenceBasis(values: string[]): string {
  if (values.length === 0) return '依据当前学习记录生成';
  return '依据学习记录、资源完成情况和检查节点生成';
}

function formatStudentLimitations(values: string[]): string {
  if (values.length === 0) return '无额外提醒';
  return '部分建议需要在后续学习中继续验证';
}

function formatTeachingTag(value: string): string {
  const labels: Record<string, string> = {
    'phase-margin': '相位裕度',
    'disturbance-rejection': '抗扰能力',
    'controller-tuning': '控制器整定',
    'comfort-constraint': '舒适度约束',
    robustness: '鲁棒性',
    frequency: '频域分析',
    time: '时域分析',
    complex: '复域分析',
  };
  return labels[value] ?? value;
}

function formatTerminalValidation(round: LearningPathRoundView | null, option?: PathOptionView): string {
  const terminal = getRecord(round?.terminalValidation);
  const state = typeof terminal.state === 'string' ? terminal.state : 'pending';
  const strategy = option?.terminalValidationStrategy.summary ?? '完成路径中的检查节点后更新';
  const stateLabel = state === 'completed'
    ? '已通过'
    : state === 'failed' || state === 'low-confidence'
      ? '待复核'
      : '进行中';
  return `${strategy} · ${stateLabel}`;
}

const SKIP_WARNING_TEXT = '跳过后该资源不会计入完成进度，但会记录为路径偏离，可稍后返回。';

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  interactive_lesson: '互动课程',
  lesson_step: '互动课程',
  knowledge_card: '知识卡',
  knowledge_node: '知识卡',
  adaptive_quiz: '自适应练习',
  quiz: '自适应练习',
  control_workbench: '控制工作台',
  simulation: '虚拟仿真',
  arena_task: 'Arena',
  external_resource: '外部资源',
  reflection: '反思复盘',
  checkpoint: '检查点',
  konling: '控灵建议',
  ai_intervention: '控灵建议',
  intervention: '控灵建议',
};

function formatResourceType(type: string): string {
  return RESOURCE_TYPE_LABELS[type] ?? '学习资源';
}

function resourceGlyph(type: string): string {
  if (type === 'interactive_lesson' || type === 'lesson_step') return '课';
  if (type === 'adaptive_quiz' || type === 'quiz') return '练';
  if (type === 'control_workbench') return '台';
  if (type === 'simulation') return '仿';
  if (type === 'arena_task') return '赛';
  if (type === 'external_resource') return '外';
  if (type === 'konling' || type === 'ai_intervention' || type === 'intervention') return '控';
  if (type === 'checkpoint') return '检';
  return '学';
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '待估算';
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function getEstimatedMinutes(node: Record<string, unknown>): number {
  const value = node.estimatedTimeMinutes ?? node.estimatedMinutes ?? node.durationMinutes;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function getPathExecutionNodes(plan: AdaptiveLearningPathPlan | null, round: LearningPathRoundView | null): PathExecutionNodeView[] {
  if (!plan) return [];
  const metadata = getRecord(round?.lastExecutionMetadata);
  const completedNodeIds = new Set(getStringArray(metadata.completedNodeIds));
  const failedNodeIds = new Set(getStringArray(metadata.failedNodeIds));
  const skippedNodeIds = new Set((round?.deviations ?? [])
    .filter((item) => getRecord(item).deviationType === 'skip')
    .map((item) => getRecord(item).targetNodeId)
    .filter((value): value is string => typeof value === 'string'));
  const currentNodeId = plan.currentNodeId ?? round?.currentNodeId ?? null;

  const nodes = plan.mainPath.map((item, index) => {
    const node = getRecord(item);
    const nodeId = typeof node.nodeId === 'string' ? node.nodeId : `path-node-${index + 1}`;
    const type = typeof node.type === 'string' ? node.type : typeof node.sourceKind === 'string' ? node.sourceKind : 'resource';
    const rawStatus = typeof node.status === 'string' ? node.status : 'optional';
    const status: PathExecutionNodeView['status'] = completedNodeIds.has(nodeId) || rawStatus === 'completed'
      ? 'completed'
      : currentNodeId === nodeId || rawStatus === 'current'
        ? 'current'
        : skippedNodeIds.has(nodeId)
          ? 'skipped'
          : failedNodeIds.has(nodeId) || rawStatus === 'blocked'
            ? 'blocked'
            : rawStatus === 'next'
              ? 'next'
              : 'optional';
    const reasonCodes = getStringArray(node.reasonCodes);
    const knowledgeCoverage = getStringArray(node.knowledgeCoverage);
    return {
      nodeId,
      title: typeof node.title === 'string' ? node.title : `学习节点 ${index + 1}`,
      type,
      resourceLabel: formatResourceType(type),
      status,
      target: typeof node.target === 'string' ? node.target : '/assessment/adaptive-practice',
      estimatedMinutes: getEstimatedMinutes(node),
      reason: reasonCodes.length > 0 ? reasonCodes.join('、') : '这一步用于衔接当前目标和后续检查节点。',
      evidence: knowledgeCoverage.length > 0 ? knowledgeCoverage.join('、') : `${formatResourceType(type)}完成记录`,
      checkpoint: type === 'checkpoint' || type === 'arena_task' || type === 'simulation'
        ? '完成后用于判断是否进入下一段路径。'
        : '完成学习动作并留下可复核记录。',
    };
  });
  if (nodes.some((node) => node.status === 'current')) return nodes;

  const currentIndex = typeof currentNodeId === 'string'
    ? nodes.findIndex((node) => node.nodeId === currentNodeId)
    : -1;
  const promotedCurrentNode = nodes.find((node, index) => (
    index > currentIndex &&
    (node.status === 'next' || node.status === 'optional')
  )) ?? nodes.find((node) => node.status === 'next' || node.status === 'optional');

  return promotedCurrentNode
    ? nodes.map((node) => (
        node.nodeId === promotedCurrentNode.nodeId
          ? { ...node, status: 'current' }
          : node
      ))
    : nodes;
}

function getPathExecutionSummary(nodes: PathExecutionNodeView[], round: LearningPathRoundView | null) {
  const completed = nodes.filter((node) => node.status === 'completed').length;
  const totalMinutes = nodes.reduce((sum, node) => sum + node.estimatedMinutes, 0);
  const elapsedMinutes = nodes
    .filter((node) => node.status === 'completed')
    .reduce((sum, node) => sum + node.estimatedMinutes, 0);
  const remainingMinutes = Math.max(0, totalMinutes - elapsedMinutes);
  const terminalState = getRecord(round?.terminalValidation).state;
  const checkpointExecutions = (round?.executions ?? [])
    .map((execution) => getRecord(execution))
    .filter((record) => (
      record.resourceType === 'checkpoint' ||
      record.activityKind === 'checkpoint-pass' ||
      record.activityKind === 'checkpoint-fail'
    ));
  const checkpointPassed = checkpointExecutions.filter((record) => (
    record.activityKind === 'checkpoint-pass' ||
    record.status === 'completed'
  )).length;
  const checkpointReviewed = checkpointExecutions.filter((record) => (
    record.activityKind === 'checkpoint-pass' ||
    record.activityKind === 'checkpoint-fail' ||
    record.status === 'completed' ||
    record.status === 'failed' ||
    record.status === 'low-confidence'
  )).length;
  const checkpointPass = checkpointReviewed > 0
    ? `${Math.round((checkpointPassed / checkpointReviewed) * 100)}%`
    : terminalState === 'completed'
      ? '100%'
      : terminalState === 'failed' || terminalState === 'low-confidence'
        ? '0%'
        : '待产生';
  return {
    elapsed: formatMinutes(elapsedMinutes),
    remaining: formatMinutes(remainingMinutes),
    total: formatMinutes(totalMinutes),
    completed: `${completed}/${nodes.length}`,
    checkpointPass,
    weekly: `${completed} 个节点`,
  };
}

function getPathActivityStateLabel(activityKind: string, status: string, resourceType: string): PathActivityTimelineItem['stateLabel'] {
  if (activityKind === 'external-resource-reference' || resourceType === 'external_resource') return '仅作参考';
  if (activityKind === 'checkpoint-fail' || status === 'failed' || status === 'low-confidence') return '待复核';
  if (
    activityKind === 'review' ||
    activityKind === 'continued-interaction' ||
    activityKind === 'return-to-skipped' ||
    status === 'started'
  ) return '已记录';
  if (activityKind === 'checkpoint-pass' || status === 'completed') return '可用于推荐';
  return '已记录';
}

function getPathActivityTimeline(
  nodes: PathExecutionNodeView[],
  round: LearningPathRoundView | null,
): PathActivityTimelineItem[] {
  const nodeTitle = new Map(nodes.map((node) => [node.nodeId, node.title]));
  const items: PathActivityTimelineItem[] = [];
  for (const execution of round?.executions ?? []) {
    const record = getRecord(execution);
    const nodeId = typeof record.nodeId === 'string' ? record.nodeId : '';
    const resourceType = typeof record.resourceType === 'string' ? record.resourceType : 'resource';
    const status = typeof record.status === 'string' ? record.status : 'started';
    const activityKind = typeof record.activityKind === 'string' ? record.activityKind : '';
    const timelineTime = readTimelineTime(record.createdAt ?? record.completedAt ?? record.startedAt);
    items.push({
      id: typeof record.id === 'string' ? record.id : `execution:${items.length}`,
      nodeId,
      type: activityKind || status,
      title: formatPathActivityTitle(activityKind, status, resourceType),
      detail: formatPathActivityDetail(activityKind, status),
      nodeTitle: nodeTitle.get(nodeId) ?? nodeId,
      sourceLabel: formatResourceType(resourceType),
      stateLabel: getPathActivityStateLabel(activityKind, status, resourceType),
      createdAt: timelineTime.label,
      sortTime: timelineTime.sortTime,
    });
  }
  for (const deviation of round?.deviations ?? []) {
    const record = getRecord(deviation);
    const targetNodeId = typeof record.targetNodeId === 'string' ? record.targetNodeId : '';
    const timelineTime = readTimelineTime(record.createdAt);
    items.push({
      id: typeof record.id === 'string' ? record.id : `deviation:${items.length}`,
      nodeId: targetNodeId,
      type: 'skip',
      title: '跳过未完成资源',
      detail: '该资源不会计入完成进度，已记录为路径偏离。',
      nodeTitle: nodeTitle.get(targetNodeId) ?? targetNodeId,
      sourceLabel: '学习路径',
      stateLabel: '待复核',
      createdAt: timelineTime.label,
      sortTime: timelineTime.sortTime,
    });
  }
  for (const intervention of round?.interventions ?? []) {
    const record = getRecord(intervention);
    const timelineTime = readTimelineTime(record.createdAt);
    items.push({
      id: typeof record.id === 'string' ? record.id : `intervention:${items.length}`,
      nodeId: '',
      type: 'konling-intervention',
      title: '控灵干预',
      detail: typeof record.privacySafeSummary === 'string' ? record.privacySafeSummary : '控灵建议已进入路径记录。',
      nodeTitle: '路径调整',
      sourceLabel: '控灵建议',
      stateLabel: '已记录',
      createdAt: timelineTime.label,
      sortTime: timelineTime.sortTime,
    });
  }
  return items.sort((left, right) => left.sortTime - right.sortTime);
}

function buildEvidenceSourceSummary(nodes: PathExecutionNodeView[]): Array<{ label: string; count: number }> {
  const labels = ['互动课程', '知识卡', '自适应练习', '控制工作台', '虚拟仿真', 'Arena', '外部资源', '控灵建议'];
  const counts = new Map(labels.map((label) => [label, 0]));
  for (const node of nodes) {
    if (counts.has(node.resourceLabel)) counts.set(node.resourceLabel, (counts.get(node.resourceLabel) ?? 0) + 1);
  }
  return labels.map((label) => ({ label, count: counts.get(label) ?? 0 }));
}

function formatPathActivityTitle(activityKind: string, status: string, resourceType: string): string {
  if (activityKind === 'continued-interaction') return '已完成节点继续互动';
  if (activityKind === 'review') return '回顾内容';
  if (activityKind === 'return-to-skipped') return '返回跳过资源';
  if (activityKind === 'retry') return '重试';
  if (activityKind === 'checkpoint-pass') return '检查点通过';
  if (activityKind === 'checkpoint-fail') return '检查点未通过';
  if (activityKind === 'external-resource-reference') return '外部资源引用';
  if (activityKind === 'konling-support') return '控灵干预';
  if (resourceType === 'checkpoint' && status === 'completed') return '检查点通过';
  if (resourceType === 'checkpoint' && status === 'failed') return '检查点未通过';
  if (status === 'completed') return '完成节点';
  return '开始节点';
}

function formatPathActivityDetail(activityKind: string, status: string): string {
  if (activityKind === 'continued-interaction') return '新的互动已记录，后续是否用于推荐由治理规则判断。';
  if (activityKind === 'review') return '回顾不会重复计算完成进度。';
  if (activityKind === 'return-to-skipped') return '此前跳过的资源已重新进入学习过程。';
  if (activityKind === 'retry') return '重试记录会用于判断是否需要调整路径。';
  if (activityKind === 'checkpoint-pass') return '检查点结果支持继续前进。';
  if (activityKind === 'checkpoint-fail') return '检查点需要复核，可能触发补强路径。';
  if (activityKind === 'external-resource-reference') return '外部资料访问已记录，证据状态按治理规则展示。';
  if (activityKind === 'konling-support') return '控灵建议已进入路径记录。';
  return status === 'completed' ? '节点完成记录已进入学习证据。' : '节点启动记录已进入学习路径。';
}

function readTimelineTime(value: unknown): { label: string; sortTime: number } {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return { label: '时间待记录', sortTime: Number.POSITIVE_INFINITY };
  }
  const date = value instanceof Date ? value : new Date(value);
  const sortTime = date.getTime();
  if (Number.isNaN(sortTime)) {
    return { label: '时间待记录', sortTime: Number.POSITIVE_INFINITY };
  }
  return { label: date.toLocaleString('zh-CN', { hour12: false }), sortTime };
}

function pathNodeContextHref(node: PathExecutionNodeView, pathId?: string | null): string {
  const href = node.target || '/assessment/adaptive-practice';
  if (/^https?:\/\//.test(href)) return href;
  const separator = href.includes('?') ? '&' : '?';
  const params = new URLSearchParams({
    goal: 'control-correction',
    intent: 'path-execution',
    nodeId: node.nodeId,
  });
  if (pathId) params.set('pathId', pathId);
  return `${href}${separator}${params.toString()}`;
}

function buildChoiceBody(
  action: 'selection' | 'rejection' | 'switch' | 'helpfulness',
  option: PathOptionView,
  allOptions: PathOptionView[],
  selectedHistory: PathSelectionHistoryView[],
  helpful?: boolean,
) {
  const latestSelection = [...selectedHistory].reverse().find((item) => item.selectedStyleId);
  return {
    action,
    selectedStyleId: action === 'rejection' ? null : option.styleId,
    selectedPolicyFamily: action === 'rejection' ? null : option.policyFamily,
    previousStyleId: action === 'switch' ? latestSelection?.selectedStyleId ?? null : null,
    rejectedStyleIds: action === 'helpfulness'
      ? []
      : action === 'selection' || action === 'switch'
        ? allOptions.filter((item) => item.styleId !== option.styleId).map((item) => item.styleId)
        : [option.styleId],
    resourceMix: option.resourceMix,
    helpful: action === 'helpfulness' ? helpful ?? true : null,
    rationaleMetadata: {
      targetDeficits: option.targetDeficits,
      evidenceBasis: option.evidenceBasis,
      terminalValidationStrategy: option.terminalValidationStrategy,
      limitations: option.limitations,
    },
    idempotencyKey: `path-choice:${action}:${option.styleId}:${Date.now()}`,
  };
}

export default function AdaptivePracticePage() {
  const searchParams = useSearchParams();
  const { status: authStatus } = useSession();
  const isDemoMode = searchParams.get('demo') === '1';
  const demoScene = resolveDemoScene(searchParams.get('scene'));
  const activePracticeFocus = searchParams.get('focus');
  const activeGoal = searchParams.get('goal') === null || searchParams.get('goal') === 'control-correction'
    ? 'control-correction'
    : null;
  const routeIntent = resolveControlCorrectionIntent(searchParams.get('intent'));
  const activePathId = searchParams.get('pathId');
  const activeNodeId = searchParams.get('nodeId');
  const controlCorrectionQuery = new URLSearchParams({ goal: 'control-correction', intent: routeIntent });
  if (activePathId) controlCorrectionQuery.set('pathId', activePathId);
  if (activeNodeId) controlCorrectionQuery.set('nodeId', activeNodeId);
  const controlCorrectionContextHref = `/assessment/adaptive-practice?${controlCorrectionQuery.toString()}`;
  const loginHref = `/login?callbackUrl=${encodeURIComponent(activeGoal ? controlCorrectionContextHref : '/assessment/adaptive-practice')}`;
  const entryIntents = getCommercialStudentEntryIntentGroups();

  const sessionId = useMemo(() => `practice-${Math.random().toString(36).slice(2, 10)}`, []);

  const [diagnostic, setDiagnostic] = useState<DiagnosticResponse | null>(null);
  const [questionState, setQuestionState] = useState<NextQuestionResponse | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [feedback, setFeedback] = useState<SubmitAnswerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [questionStartAt, setQuestionStartAt] = useState<number>(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [controlCorrectionLearnerState, setControlCorrectionLearnerState] = useState<AdaptiveLearnerState | null>(null);
  const [controlCorrectionPathPlan, setControlCorrectionPathPlan] = useState<AdaptiveLearningPathPlan | null>(null);
  const [controlCorrectionPathRound, setControlCorrectionPathRound] = useState<LearningPathRoundView | null>(null);
  const [pathChoicePending, setPathChoicePending] = useState<string | null>(null);
  const [pathChoiceMessage, setPathChoiceMessage] = useState<string | null>(null);
  const [pathNodeCompletionPending, setPathNodeCompletionPending] = useState<string | null>(null);
  const [skipCandidateNode, setSkipCandidateNode] = useState<PathExecutionNodeView | null>(null);
  const [pathActivityPending, setPathActivityPending] = useState<string | null>(null);
  const [selectedPathNodeId, setSelectedPathNodeId] = useState<string | null>(activeNodeId);
  const practiceRouteNodes = useMemo(() => buildPracticeEntryRouteNodes({
    recommendedFocus: diagnostic?.recommendedFocus ?? [],
    weakAreas: diagnostic?.weakAreas ?? [],
    estimatedAbility: questionState?.estimatedAbility,
    confidenceInterval: questionState?.confidenceInterval,
    actionHref: activeGoal ? controlCorrectionContextHref : '/assessment/adaptive-practice',
  }), [activeGoal, controlCorrectionContextHref, diagnostic, questionState]);
  const controlCorrectionCenter = useMemo(() => activeGoal
    ? buildControlCorrectionLearningCenterView({
        featureFlags: [ADAPTIVE_LEARNING_CENTER_FEATURE_FLAG],
        learnerState: controlCorrectionLearnerState,
        pathPlan: controlCorrectionPathPlan,
        routeIntent,
        entrySource: routeIntent === 'contextual-recommendation' ? 'contextual-recommendation' : 'adaptive-practice',
        networkError: Boolean(error) && !controlCorrectionLearnerState && !controlCorrectionPathPlan,
        questionAvailable: Boolean(questionState),
      })
    : null, [activeGoal, controlCorrectionLearnerState, controlCorrectionPathPlan, error, questionState, routeIntent]);
  const pathOptions = useMemo(() => getPathOptions(controlCorrectionCenter), [controlCorrectionCenter]);
  const pathSelectionHistory = useMemo(() => getPathSelectionHistory(controlCorrectionCenter), [controlCorrectionCenter]);
  const pathOptionFallback = useMemo(() => getPathOptionFallback(controlCorrectionCenter), [controlCorrectionCenter]);
  const pathExecutionNodes = useMemo(
    () => getPathExecutionNodes(controlCorrectionPathPlan, controlCorrectionPathRound),
    [controlCorrectionPathPlan, controlCorrectionPathRound],
  );
  useEffect(() => {
    if (activeNodeId) setSelectedPathNodeId(activeNodeId);
  }, [activeNodeId]);
  useEffect(() => {
    if (pathExecutionNodes.length === 0) {
      setSelectedPathNodeId(null);
      return;
    }
    setSelectedPathNodeId((current) => (
      current && pathExecutionNodes.some((node) => node.nodeId === current)
        ? current
        : pathExecutionNodes.find((node) => node.status === 'current')?.nodeId ?? pathExecutionNodes[0]?.nodeId ?? null
    ));
  }, [pathExecutionNodes]);
  const currentPathNode = useMemo(() => (
    pathExecutionNodes.find((node) => node.status === 'current') ?? null
  ), [pathExecutionNodes]);
  const focusedPathNode = useMemo(() => (
    pathExecutionNodes.find((node) => node.nodeId === selectedPathNodeId) ??
    pathExecutionNodes.find((node) => node.status === 'current') ??
    pathExecutionNodes[0] ??
    null
  ), [pathExecutionNodes, selectedPathNodeId]);
  const pathExecutionSummary = useMemo(
    () => getPathExecutionSummary(pathExecutionNodes, controlCorrectionPathRound),
    [controlCorrectionPathRound, pathExecutionNodes],
  );
  const pathActivityTimeline = useMemo(
    () => getPathActivityTimeline(pathExecutionNodes, controlCorrectionPathRound),
    [controlCorrectionPathRound, pathExecutionNodes],
  );
  const evidenceSourceSummary = useMemo(
    () => buildEvidenceSourceSummary(pathExecutionNodes),
    [pathExecutionNodes],
  );

  const applyDemoScene = useCallback((scene: DemoScene) => {
    const demoData = DEMO_SCENES[scene];
    setDiagnostic(demoData.diagnostic);
    setQuestionState(demoData.questionState);
    setSelectedOption(demoData.defaultSelectedOption);
    setFeedback(demoData.feedback);
    setQuestionStartAt(Date.now());
    setLoading(false);
    setError(null);
  }, []);

  const loadDiagnostic = useCallback(async () => {
    const response = await fetch('/api/assessment/diagnostic');
    if (!response.ok) {
      throw new Error('诊断加载失败');
    }
    const data = (await response.json()) as DiagnosticResponse;
    setDiagnostic(data);
  }, []);

  const loadNextQuestion = useCallback(async () => {
    if (isDemoMode) {
      const nextScene: DemoScene = demoScene === 'stable' ? 'generate' : 'stable';
      applyDemoScene(nextScene);
      return;
    }

    const response = await fetch('/api/assessment/next-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        goalId: activeGoal,
        routeIntent: activeGoal ? routeIntent : null,
        pathId: activePathId,
        nodeId: activeNodeId,
      }),
    });

    if (!response.ok) {
      throw new Error('下一题加载失败');
    }

    const data = (await response.json()) as NextQuestionResponse;
    setQuestionState(data);
    setSelectedOption('');
    setFeedback(null);
    setQuestionStartAt(Date.now());
  }, [activeGoal, activeNodeId, activePathId, applyDemoScene, demoScene, isDemoMode, routeIntent, sessionId]);

  const bootstrapPractice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadDiagnostic(), loadNextQuestion()]);
    } catch (bootstrapError) {
      setError(bootstrapError instanceof Error ? bootstrapError.message : '初始化失败');
    } finally {
      setLoading(false);
    }
  }, [loadDiagnostic, loadNextQuestion]);

  useEffect(() => {
    if (!activeGoal) {
      setControlCorrectionLearnerState(null);
      setControlCorrectionPathPlan(null);
      setControlCorrectionPathRound(null);
      return;
    }

    if (isDemoMode) {
      setControlCorrectionLearnerState(null);
      setControlCorrectionPathRound(DEMO_PATH_ROUND);
      setControlCorrectionPathPlan(restoreLearningPathPlan(DEMO_PATH_ROUND));
      return;
    }

    if (authStatus === 'loading') {
      return;
    }

    if (authStatus === 'unauthenticated') {
      setControlCorrectionLearnerState(null);
      setControlCorrectionPathPlan(null);
      setControlCorrectionPathRound(null);
      return;
    }

    let cancelled = false;
    async function loadControlCorrectionCenterData() {
      let learnerState: AdaptiveLearnerState | null = null;
      try {
        const learnerResponse = await fetch('/api/adaptive/learner-state?goal=control-correction');
        if (!cancelled && learnerResponse.ok) {
          learnerState = (await learnerResponse.json()) as AdaptiveLearnerState;
          setControlCorrectionLearnerState(learnerState);
        } else if (!cancelled) {
          setControlCorrectionLearnerState(null);
          setControlCorrectionPathPlan(null);
          setControlCorrectionPathRound(null);
          return;
        }
      } catch {
        if (!cancelled) {
          setControlCorrectionLearnerState(null);
          setControlCorrectionPathPlan(null);
          setControlCorrectionPathRound(null);
        }
        return;
      }

      const fallbackPathId = learnerState?.pathContext.activeControlCorrectionPath.pathId ?? null;
      const pathIdToLoad = activePathId ?? fallbackPathId;
      if (!pathIdToLoad) {
        if (!cancelled) {
          setControlCorrectionPathPlan(null);
          setControlCorrectionPathRound(null);
        }
        return;
      }

      try {
        const pathResponse = await fetch(`/api/learning-paths/${encodeURIComponent(pathIdToLoad)}`);
        if (!cancelled && pathResponse.ok) {
          const payload = (await pathResponse.json()) as LearningPathRoundResponse;
          setControlCorrectionPathRound(payload.path ?? null);
          setControlCorrectionPathPlan(restoreLearningPathPlan(payload.path ?? null));
        } else if (!cancelled) {
          setControlCorrectionPathPlan(null);
          setControlCorrectionPathRound(null);
        }
      } catch {
        if (!cancelled) {
          setControlCorrectionPathPlan(null);
          setControlCorrectionPathRound(null);
        }
      }
    }

    void loadControlCorrectionCenterData();
    return () => {
      cancelled = true;
    };
  }, [activeGoal, activePathId, authStatus, isDemoMode]);

  const reloadControlCorrectionPath = useCallback(async () => {
    const pathIdToLoad = controlCorrectionPathRound?.id ?? activePathId ?? controlCorrectionLearnerState?.pathContext.activeControlCorrectionPath.pathId;
    if (!pathIdToLoad) return;
    const pathResponse = await fetch(`/api/learning-paths/${encodeURIComponent(pathIdToLoad)}`);
    if (!pathResponse.ok) {
      throw new Error('路径状态刷新失败');
    }
    const payload = (await pathResponse.json()) as LearningPathRoundResponse;
    setControlCorrectionPathRound(payload.path ?? null);
    setControlCorrectionPathPlan(restoreLearningPathPlan(payload.path ?? null));
  }, [activePathId, controlCorrectionLearnerState, controlCorrectionPathRound]);

  const submitPathChoice = useCallback(async (
    action: 'selection' | 'rejection' | 'switch' | 'helpfulness',
    option: PathOptionView,
    helpful?: boolean,
  ) => {
    const pathId = controlCorrectionPathRound?.id ?? controlCorrectionPathPlan?.id;
    if (!pathId) {
      setPathChoiceMessage('当前没有可写入的学习路径。');
      return;
    }
    setPathChoicePending(`${action}:${option.styleId}`);
    setPathChoiceMessage(null);
    try {
      const response = await fetch(`/api/learning-paths/${encodeURIComponent(pathId)}/choices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildChoiceBody(action, option, pathOptions, pathSelectionHistory, helpful)),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : '路径选择写入失败');
      }
      await reloadControlCorrectionPath();
      setPathChoiceMessage('路径选择证据已记录。');
    } catch (choiceError) {
      setPathChoiceMessage(choiceError instanceof Error ? choiceError.message : '路径选择写入失败');
    } finally {
      setPathChoicePending(null);
    }
  }, [
    controlCorrectionPathPlan,
    controlCorrectionPathRound,
    pathOptions,
    pathSelectionHistory,
    reloadControlCorrectionPath,
  ]);

  const launchPathNodeAction = useCallback(async (action: PostLearningPathNodeAction) => {
    if (!action.body || !action.redirectHref) return;
    try {
      const response = await fetch(action.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.body),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : '路径节点启动失败');
      }
      window.location.assign(action.redirectHref);
    } catch (launchError) {
      setError(launchError instanceof Error ? launchError.message : '路径节点启动失败');
    }
  }, []);

  const launchPathNode = useCallback(async (node: PracticeEntryRouteNode) => {
    if (!isPostLearningPathNodeAction(node.action)) return;
    await launchPathNodeAction(node.action);
  }, [launchPathNodeAction]);

  const launchNextAction = useCallback(async () => {
    const nextAction = controlCorrectionCenter?.nextAction;
    if (!nextAction || !isPostLearningPathNodeAction(nextAction)) return;
    await launchPathNodeAction(nextAction);
  }, [controlCorrectionCenter, launchPathNodeAction]);

  const completePathNodeAction = useCallback(async (
    nodeId: string,
    completionAction?: LearningPathNodeCompletionAction,
  ) => {
    if (!completionAction) return;
    setPathNodeCompletionPending(nodeId);
    try {
      const response = await fetch(completionAction.href, {
        method: completionAction.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completionAction.body),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : '路径节点完成确认失败');
      }
      await reloadControlCorrectionPath();
      setError(null);
    } catch (completionError) {
      setError(completionError instanceof Error ? completionError.message : '路径节点完成确认失败');
    } finally {
      setPathNodeCompletionPending(null);
    }
  }, [reloadControlCorrectionPath]);

  const completePathNode = useCallback(async (node: PracticeEntryRouteNode) => {
    await completePathNodeAction(node.nodeId, node.action.completionAction);
  }, [completePathNodeAction]);

  const completeNextAction = useCallback(async () => {
    const nextAction = controlCorrectionCenter?.nextAction;
    if (!nextAction?.nodeId) return;
    await completePathNodeAction(nextAction.nodeId, nextAction.completionAction);
  }, [completePathNodeAction, controlCorrectionCenter]);

  const writePathNodeActivity = useCallback(async (
    node: PathExecutionNodeView,
    activityKind: string,
    status: 'started' | 'completed' | 'failed' = 'started',
  ): Promise<boolean> => {
    const pathId = controlCorrectionPathRound?.id ?? controlCorrectionPathPlan?.id;
    if (!pathId) return false;
    setPathActivityPending(`${activityKind}:${node.nodeId}`);
    try {
      const response = await fetch(`/api/learning-paths/${encodeURIComponent(pathId)}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.nodeId,
          resourceType: node.type,
          status,
          startedAt: new Date().toISOString(),
          completedAt: status === 'completed' ? new Date().toISOString() : null,
          failedAt: status === 'failed' ? new Date().toISOString() : null,
          idempotencyKey: `${activityKind}:${pathId}:${node.nodeId}:${Date.now()}`,
          liftMetadata: {
            pathActivityKind: activityKind,
          },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : '路径活动写入失败');
      }
      await reloadControlCorrectionPath();
      setError(null);
      return true;
    } catch (activityError) {
      setError(activityError instanceof Error ? activityError.message : '路径活动写入失败');
      return false;
    } finally {
      setPathActivityPending(null);
    }
  }, [controlCorrectionPathPlan, controlCorrectionPathRound, reloadControlCorrectionPath]);

  const skipPathNode = useCallback(async (node: PathExecutionNodeView) => {
    const pathId = controlCorrectionPathRound?.id ?? controlCorrectionPathPlan?.id;
    if (isDemoMode) {
      setPathActivityPending(`skip:${node.nodeId}`);
      const createdAt = new Date().toISOString();
      setControlCorrectionPathRound((current) => {
        if (!current) return current;
        const deviations = current.deviations ?? [];
        const hasSkipRecord = deviations.some((item) => {
          const record = getRecord(item);
          return record.deviationType === 'skip' && record.targetNodeId === node.nodeId;
        });
        return {
          ...current,
          deviations: hasSkipRecord
            ? deviations
            : [
                ...deviations,
                {
                  id: `demo-skip:${node.nodeId}`,
                  deviationType: 'skip',
                  priorNodeId: current.currentNodeId ?? null,
                  targetNodeId: node.nodeId,
                  evidenceConfidence: 'medium',
                  createdAt,
                },
              ],
        };
      });
      setSkipCandidateNode(null);
      setError(null);
      setPathActivityPending(null);
      return;
    }
    if (!pathId) return;
    setPathActivityPending(`skip:${node.nodeId}`);
    try {
      const response = await fetch(`/api/learning-paths/${encodeURIComponent(pathId)}/deviations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviationType: 'skip',
          priorNodeId: controlCorrectionPathPlan?.currentNodeId ?? controlCorrectionPathRound?.currentNodeId ?? null,
          targetNodeId: node.nodeId,
          evidenceConfidence: 'medium',
          idempotencyKey: `skip:${pathId}:${node.nodeId}:${Date.now()}`,
          context: {
            consequence: SKIP_WARNING_TEXT,
            returnEligible: true,
          },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : '路径偏离写入失败');
      }
      await reloadControlCorrectionPath();
      setSkipCandidateNode(null);
      setError(null);
    } catch (skipError) {
      setError(skipError instanceof Error ? skipError.message : '路径偏离写入失败');
    } finally {
      setPathActivityPending(null);
    }
  }, [controlCorrectionPathPlan, controlCorrectionPathRound, isDemoMode, reloadControlCorrectionPath]);

  const launchExecutionNode = useCallback(async (node: PathExecutionNodeView) => {
    const activityWritten = await writePathNodeActivity(
      node,
      node.status === 'skipped' ? 'return-to-skipped' : 'initial-completion',
      'started',
    );
    if (!activityWritten) return;
    window.location.assign(pathNodeContextHref(node, controlCorrectionPathPlan?.id ?? controlCorrectionPathRound?.id));
  }, [controlCorrectionPathPlan, controlCorrectionPathRound, writePathNodeActivity]);

  useEffect(() => {
    if (isDemoMode) {
      applyDemoScene(demoScene);
      return;
    }

    if (authStatus === 'loading') {
      return;
    }

    if (authStatus === 'unauthenticated') {
      setDiagnostic(null);
      setQuestionState(null);
      setFeedback(null);
      setLoading(false);
      setError('请先登录后再进入自适应练习');
      return;
    }

    void bootstrapPractice();
  }, [applyDemoScene, authStatus, bootstrapPractice, demoScene, isDemoMode]);

  const submitCurrentAnswer = async () => {
    if (!questionState || !selectedOption) {
      return;
    }

    if (isDemoMode) {
      const correctOption = questionState.question.options[0]?.label ?? '';
      const isCorrect = selectedOption === correctOption;
      setFeedback({
        isCorrect,
        correctOption,
        explanation: isCorrect
          ? '回答正确：已建立“约束优先 + 跨域映射”的解题顺序。'
          : '回答错误：请优先识别约束，再进行域间因果映射。',
        estimatedAbility: Number((questionState.estimatedAbility + (isCorrect ? 0.06 : -0.03)).toFixed(2)),
        recommendedFocus: diagnostic?.recommendedFocus ?? ['围绕关键薄弱点继续练习跨域题目'],
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/assessment/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId: questionState.question.id,
          selectedOption,
          timeSpent: Math.max(1, Math.round((Date.now() - questionStartAt) / 1000)),
          goalId: activeGoal,
          routeIntent: activeGoal ? routeIntent : null,
          pathId: activePathId,
          nodeId: activeNodeId,
        }),
      });

      if (!response.ok) {
        throw new Error('提交失败');
      }

      const data = (await response.json()) as SubmitAnswerResponse;
      setFeedback(data);
      await loadDiagnostic();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败');
    } finally {
      setLoading(false);
    }
  };

  const generateQuestion = async () => {
    if (!diagnostic) {
      return;
    }

    if (isDemoMode) {
      applyDemoScene('generate');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/assessment/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetKnowledgeTags: diagnostic.weakAreas,
          difficultyTarget: 0.6,
          domains: ['time', 'frequency', 'complex'],
          goalId: activeGoal,
          routeIntent: activeGoal ? routeIntent : null,
          pathId: activePathId,
          nodeId: activeNodeId,
        }),
      });

      if (!response.ok) {
        throw new Error('生成题目失败');
      }

      await loadNextQuestion();
    } catch (genError) {
      setError(genError instanceof Error ? genError.message : '生成失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      viewerRole="student"
      title="自适应练习"
      subtitle="证据驱动的当前路径与题目推荐"
      activeHref="/assessment/adaptive-practice"
      sidebarMode="collapsible"
      className="surface-page"
    >
      <section
      className="space-y-6"
      data-commercial-workspace="adaptive-practice"
      data-commercial-student-entry-route="/assessment/adaptive-practice"
      data-commercial-entry-intent="practice"
      data-student-entry-evidence-return="/profile/evidence"
      data-learning-path-options-slot="three-style"
      data-learning-path-history-slot="selection-history"
      data-konling-citation-slot="cited-explanation"
      data-route-family={learnerDataShell.routeFamily}
      data-route-identity={learnerDataShell.routeIdentity}
      data-learner-record-surface={learnerDataShell.archetype}
      data-learner-record-priority="current-path"
      data-learner-record-evidence-confidence={controlCorrectionCenter?.nextAction.confidence ?? 'unknown'}
      data-learner-record-missing-source={controlCorrectionCenter?.readinessGate.missing.join(',') || 'complete'}
      data-adaptive-path-dock-collision-policy="avoid-learning-record"
    >
        <header className="surface-card p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-primary">学习入口 · Practice</p>
          <h1 className="mt-1 text-2xl font-semibold">自适应跨域题库</h1>
          <p className="mt-2 text-sm text-subtle">
            基于答题历史动态估计能力值，针对薄弱知识点推荐下一题，并支持即时生成跨域题目。
          </p>
          {isDemoMode ? (
            <div className="mt-3 inline-flex items-center rounded-full border border-emerald-400/50 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200">
              报告演示模式：{demoScene === 'stable' ? '题库稳定性视图' : '差异化生成视图'}
            </div>
          ) : null}
          <div className="mt-4 hidden flex-wrap gap-2 text-xs text-subtle sm:flex">
            {entryIntents.filter((intent) => ['practice', 'learn', 'challenge', 'review'].includes(intent.intent)).map((intent) => (
              <Link key={intent.intent} href={intent.hrefs[0] ?? '/dashboard'} className="rounded-full border border-border px-3 py-1 hover:border-primary">
                {intent.label}
              </Link>
            ))}
            <Link href="/profile/evidence" className="rounded-full border border-border px-3 py-1 text-subtle hover:border-primary">
              证据复盘
            </Link>
          </div>
        </header>

        {controlCorrectionCenter ? (
          <section
            className="surface-card p-5"
            data-control-correction-center="adaptive-practice"
            data-control-correction-goal={controlCorrectionCenter.goalId}
            data-control-correction-intent={controlCorrectionCenter.entry.routeIntent}
            data-control-correction-ready={String(controlCorrectionCenter.readinessGate.ready)}
            data-control-correction-alternative-count={controlCorrectionAlternativeCount(controlCorrectionCenter)}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-primary">Learning Path</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">自适应学习路径中心</h2>
                <p className="mt-2 text-sm text-subtle">
                  {controlCorrectionCenter.readinessGate.ready
                    ? '当前路径可继续执行，系统会随学习证据更新后续建议。'
                    : '证据还少，先从入门路径开始，系统会随学习过程调整。'}
                </p>
              </div>
              {controlCorrectionCenter.nextAction.method === 'POST' ? (
                <div className="flex flex-wrap gap-2" data-learner-record-next-action="control-correction">
                  <button
                    type="button"
                    onClick={() => void launchNextAction()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    {controlCorrectionCenter.nextAction.title}
                  </button>
                  {controlCorrectionCenter.nextAction.completionAction && controlCorrectionCenter.nextAction.nodeId ? (
                    <button
                      type="button"
                      onClick={() => void completeNextAction()}
                      disabled={pathNodeCompletionPending === controlCorrectionCenter.nextAction.nodeId}
                      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary disabled:cursor-wait disabled:text-subtle"
                    >
                      {pathNodeCompletionPending === controlCorrectionCenter.nextAction.nodeId
                        ? '正在确认完成'
                        : controlCorrectionCenter.nextAction.completionAction.label}
                    </button>
                  ) : null}
                </div>
              ) : (
                <Link
                  href={controlCorrectionCenter.nextAction.href}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                  data-learner-record-next-action="control-correction"
                >
                  {controlCorrectionCenter.nextAction.title}
                </Link>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="surface-card-soft p-3">
                <p className="text-xs text-subtle">路径状态</p>
                <p className="mt-1 break-words text-sm text-foreground">
                  {controlCorrectionCenter.readinessGate.ready ? '路径可继续' : '先完成诊断或生成路径'}
                </p>
              </div>
              <div className="surface-card-soft p-3">
                <p className="text-xs text-subtle">{controlCorrectionCenter.citationAccess.title}</p>
                <p className="mt-1 break-words text-sm text-foreground">
                  证据摘要可能用于解释后续建议，具体以治理状态为准。
                </p>
              </div>
              <div className="surface-card-soft p-3">
                <p className="text-xs text-subtle">控灵校正支持</p>
                <p className="mt-1 break-words text-sm text-foreground">
                  控灵会结合当前节点和学习记录给出下一步建议。
                </p>
              </div>
            </div>

            {pathExecutionNodes.length > 0 ? (
              <div className="mt-5 border-t border-border pt-5" data-adaptive-path-execution-surface="active-route">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">当前学习路径</h3>
                    <p className="mt-1 text-sm text-subtle">完整路线、当前节点、预计时间和检查点状态保持可见。</p>
                  </div>
                  <span className="rounded-full border border-border px-3 py-1 text-xs text-subtle">
                    当前节点：{currentPathNode?.title ?? '待定位'}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                  {[
                    ['已耗时', pathExecutionSummary.elapsed],
                    ['预计剩余', pathExecutionSummary.remaining],
                    ['预计总时长', pathExecutionSummary.total],
                    ['完成节点', pathExecutionSummary.completed],
                    ['检查点通过', pathExecutionSummary.checkpointPass],
                    ['本周学习', pathExecutionSummary.weekly],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                      <p className="text-xs text-subtle">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-xl border border-border bg-muted/20 p-4" data-adaptive-path-route-map="complete">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch" data-adaptive-path-route-flow="connected">
                      {pathExecutionNodes.map((node, index) => (
                        <div key={node.nodeId} className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
                          <button
                            type="button"
                            onClick={() => setSelectedPathNodeId(node.nodeId)}
                            aria-pressed={focusedPathNode?.nodeId === node.nodeId}
                            className={`relative flex min-h-36 flex-1 flex-col rounded-xl border p-3 text-left transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                              node.status === 'current'
                                ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                : node.status === 'completed'
                                  ? 'border-platform-evidence-eligible/40 bg-platform-evidence-eligible/10'
                                  : node.status === 'skipped'
                                    ? 'border-platform-evidence-context/40 bg-platform-evidence-context/10'
                                    : 'border-border bg-background/50'
                            } ${focusedPathNode?.nodeId === node.nodeId ? 'shadow-sm ring-2 ring-primary/30' : ''}`}
                            data-adaptive-path-node={node.nodeId}
                            data-adaptive-path-node-state={node.status}
                            data-adaptive-path-node-selectable="true"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center border text-sm font-semibold ${
                                  node.type === 'checkpoint'
                                    ? 'rotate-45 rounded-sm border-platform-evidence-context bg-platform-evidence-context/15 text-platform-evidence-context'
                                    : node.status === 'completed'
                                      ? 'rounded-full border-platform-evidence-eligible bg-platform-evidence-eligible/15 text-platform-evidence-eligible'
                                      : node.status === 'current'
                                        ? 'rounded-full border-primary bg-primary/15 text-primary'
                                        : 'rounded-full border-border bg-muted text-foreground'
                                }`}
                                aria-hidden="true"
                              >
                                <span className={node.type === 'checkpoint' ? '-rotate-45' : ''}>{resourceGlyph(node.type)}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs text-subtle">第 {index + 1} 步 · {node.resourceLabel}</p>
                                <h4 className="mt-1 text-sm font-semibold text-foreground">{node.title}</h4>
                              </div>
                            </div>
                            <div className="mt-auto pt-3">
                              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-subtle">
                                {node.status === 'current'
                                  ? '当前节点'
                                  : node.status === 'completed'
                                    ? '已完成'
                                    : node.status === 'skipped'
                                      ? '已跳过'
                                      : node.status === 'blocked'
                                        ? '待复核'
                                        : '等待前置节点'}
                              </span>
                              <p className="mt-2 text-xs text-subtle">预计 {formatMinutes(node.estimatedMinutes)}</p>
                            </div>
                          </button>
                          {index < pathExecutionNodes.length - 1 ? (
                            <div
                              className="flex items-center justify-center text-subtle lg:h-full lg:w-8"
                              aria-hidden="true"
                              data-adaptive-path-route-connector="true"
                            >
                              <span className="h-8 w-px bg-border lg:h-px lg:w-8" />
                              <span className="ml-0 -mt-1 text-xs lg:ml-1 lg:mt-0">›</span>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  {focusedPathNode ? (
                    <div className="rounded-xl border border-border bg-background/50 p-4" data-adaptive-path-node-detail="selected">
                      <p className="text-xs text-primary">{focusedPathNode.resourceLabel}</p>
                      <h4 className="mt-1 text-base font-semibold text-foreground">{focusedPathNode.title}</h4>
                      <dl className="mt-4 space-y-3 text-sm">
                        <div>
                          <dt className="text-xs text-subtle">推荐理由</dt>
                          <dd className="mt-1 text-foreground">{focusedPathNode.reason}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-subtle">预计时长</dt>
                          <dd className="mt-1 text-foreground">{formatMinutes(focusedPathNode.estimatedMinutes)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-subtle">将收集的学习证据</dt>
                          <dd className="mt-1 text-foreground">{focusedPathNode.evidence}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-subtle">检查标准</dt>
                          <dd className="mt-1 text-foreground">{focusedPathNode.checkpoint}</dd>
                        </div>
                      </dl>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {focusedPathNode.status === 'completed' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void writePathNodeActivity(focusedPathNode, 'review', 'started')}
                              disabled={pathActivityPending === `review:${focusedPathNode.nodeId}`}
                              className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary disabled:cursor-wait disabled:text-subtle"
                            >
                              回顾
                            </button>
                            <button
                              type="button"
                              onClick={() => void writePathNodeActivity(focusedPathNode, 'continued-interaction', 'started')}
                              disabled={pathActivityPending === `continued-interaction:${focusedPathNode.nodeId}`}
                              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                            >
                              继续互动
                            </button>
                            <Link
                              href={`/profile/evidence?goal=control-correction&pathId=${encodeURIComponent(controlCorrectionPathPlan?.id ?? '')}&nodeId=${encodeURIComponent(focusedPathNode.nodeId)}`}
                              className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary"
                            >
                              查看证据
                            </Link>
                          </>
                        ) : focusedPathNode.status === 'current' || focusedPathNode.status === 'skipped' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void launchExecutionNode(focusedPathNode)}
                              disabled={pathActivityPending === `initial-completion:${focusedPathNode.nodeId}` ||
                                pathActivityPending === `return-to-skipped:${focusedPathNode.nodeId}`}
                              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                            >
                              {focusedPathNode.status === 'skipped' ? '返回学习' : '开始学习'}
                            </button>
                            {focusedPathNode.status !== 'skipped' ? (
                              <button
                                type="button"
                                onClick={() => setSkipCandidateNode(focusedPathNode)}
                                className="rounded-md border border-platform-evidence-context/60 px-3 py-1.5 text-xs text-foreground hover:border-platform-evidence-context"
                              >
                                跳过
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <span className="rounded-md border border-border px-3 py-1.5 text-xs text-subtle">
                            等待前置节点
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {skipCandidateNode ? (
                  <div className="mt-4 rounded-xl border border-platform-evidence-context/60 bg-platform-evidence-context/10 p-4" data-adaptive-path-skip-warning="visible">
                    <h4 className="text-sm font-semibold text-foreground">确认跳过 {skipCandidateNode.title}</h4>
                    <p className="mt-2 text-sm text-foreground">{SKIP_WARNING_TEXT}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void skipPathNode(skipCandidateNode)}
                        disabled={pathActivityPending === `skip:${skipCandidateNode.nodeId}`}
                        className="rounded-md bg-platform-evidence-context px-3 py-1.5 text-xs font-medium text-platform-fg-inverse disabled:opacity-60"
                      >
                        确认跳过
                      </button>
                      <button
                        type="button"
                        onClick={() => setSkipCandidateNode(null)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary"
                      >
                        继续保留
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {pathExecutionNodes.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-border bg-background/55 p-5" data-adaptive-path-history-surface="timeline-evidence">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-primary">Evidence Record</p>
                    <h3 className="mt-1 text-xl font-semibold text-foreground">路径完成与证据</h3>
                    <p className="mt-1 text-sm text-subtle">完成、继续互动、跳过、检查点和控灵建议会形成可复核记录。</p>
                  </div>
                  <span className="rounded-full border border-border px-3 py-1 text-xs text-subtle">
                    新增证据 {pathActivityTimeline.length}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    ['已完成节点', pathExecutionSummary.completed],
                    ['已耗时', pathExecutionSummary.elapsed],
                    ['预计节省或超出时间', pathExecutionSummary.remaining === '待估算' ? '待估算' : `剩余 ${pathExecutionSummary.remaining}`],
                    ['检查点通过率', pathExecutionSummary.checkpointPass],
                    ['回顾次数', `${pathActivityTimeline.filter((item) => item.type === 'review').length}`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                      <p className="text-xs text-subtle">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
                  <div className="rounded-xl border border-border bg-muted/20 p-4" data-adaptive-path-history-timeline="governed-activity">
                    <h4 className="text-sm font-semibold text-foreground">路径时间线</h4>
                    <div className="mt-3 space-y-3">
                      {pathActivityTimeline.map((item) => (
                        <article key={item.id} className="relative rounded-xl border border-border bg-background/55 p-4 pl-5">
                          <span className="absolute left-2 top-5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs text-primary">{item.sourceLabel} · {item.stateLabel}</p>
                              <h5 className="mt-1 text-sm font-semibold text-foreground">{item.title}</h5>
                              <p className="mt-1 text-sm text-subtle">{item.nodeTitle} · {item.detail}</p>
                            </div>
                            <div className="flex flex-col items-start gap-2 sm:items-end">
                              <span className="text-xs text-subtle">{item.createdAt}</span>
                              {item.nodeId && pathExecutionNodes.some((node) => node.nodeId === item.nodeId) ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPathNodeId(item.nodeId)}
                                  className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                  查看节点
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      ))}
                      {pathActivityTimeline.length === 0 ? (
                        <p className="rounded-xl border border-border bg-background/55 p-4 text-sm text-subtle">
                          路径执行、回顾、继续互动、跳过、检查点和控灵建议会在这里形成时间线。
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/20 p-4" data-adaptive-path-evidence-sources="complete">
                    <h4 className="text-sm font-semibold text-foreground">资源与证据来源</h4>
                    <div className="mt-3 grid gap-2">
                      {evidenceSourceSummary.map((item) => (
                        <div key={item.label} className="flex items-center justify-between rounded-lg border border-border bg-background/55 px-3 py-2 text-sm">
                          <span className="text-foreground">{item.label}</span>
                          <span className="text-xs text-subtle">{item.count} 条</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/20 p-4" data-adaptive-path-evidence-states="student-safe">
                    <h4 className="text-sm font-semibold text-foreground">证据状态</h4>
                    <div className="mt-3 grid gap-2">
                      {[
                        ['已记录', '学习动作已进入路径记录。'],
                        ['待复核', '跳过、失败或低置信记录等待后续判断。'],
                        ['可用于推荐', '可参与后续路径更新。'],
                        ['仅作参考', '外部资料需明确访问记录后再用于推荐。'],
                      ].map(([label, detail]) => (
                        <div key={label} className="rounded-lg border border-border bg-background/55 px-3 py-2">
                          <p className="text-sm font-medium text-foreground">{label}</p>
                          <p className="mt-1 text-xs text-subtle">{detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {controlCorrectionCenter.fallbackStates.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {controlCorrectionCenter.fallbackStates.map((state) => (
                  <Link
                    key={state.state}
                    href={state.actions[0]?.href ?? controlCorrectionContextHref}
                    className="rounded-full border border-border px-3 py-1 text-xs text-foreground hover:border-primary"
                    data-control-correction-state={state.state}
                  >
                    {state.title}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="mt-5 border-t border-border pt-5" data-learning-path-product-surface="path-options-selection-history-terminal-validation">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">路径选择与验证</h3>
                  <p className="mt-1 text-sm text-subtle">
                    对比不同路径风格，记录选择或拒绝，并保留官方/预览终端验证边界。
                  </p>
                </div>
                <span className="rounded-full border border-border px-3 py-1 text-xs text-subtle">
                  {pathOptions.length > 0 ? `${pathOptions.length} 条路径方案` : '路径方案待生成'}
                </span>
              </div>

              {pathOptions.length > 0 ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {pathOptions.map((option) => {
                    const isPending = pathChoicePending?.endsWith(`:${option.styleId}`) ?? false;
                    return (
                      <article
                        key={option.styleId}
                        className="rounded-xl border border-border bg-muted/20 p-4"
                        data-learning-path-option={option.styleId}
                        data-learning-path-policy-family={option.policyFamily}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-primary">路径方案</p>
                            <h4 className="mt-1 font-semibold text-foreground">{option.label}</h4>
                          </div>
                          <span className="rounded-full border border-border px-2 py-1 text-xs text-subtle">
                            {option.effort.estimatedMinutes ? `${option.effort.estimatedMinutes} 分钟` : option.effort.relative ?? '时长未知'}
                          </span>
                        </div>
                        <dl className="mt-4 space-y-3 text-sm">
                          <div>
                            <dt className="text-xs text-subtle">目标薄弱项</dt>
                            <dd className="mt-1 text-foreground">{formatPathDeficits(option.targetDeficits)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-subtle">资源组合</dt>
                            <dd className="mt-1 text-foreground">{formatResourceMix(option.resourceMix)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-subtle">证据依据</dt>
                            <dd className="mt-1 text-foreground">{formatStudentEvidenceBasis(option.evidenceBasis)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-subtle">终端验证</dt>
                            <dd className="mt-1 text-foreground">{formatTerminalValidation(controlCorrectionPathRound, option)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-subtle">限制</dt>
                            <dd className="mt-1 text-foreground">{formatStudentLimitations(option.limitations)}</dd>
                          </div>
                        </dl>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                            disabled={Boolean(pathChoicePending)}
                            onClick={() => submitPathChoice('selection', option)}
                          >
                            {isPending ? '记录中' : '选择路径'}
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground disabled:opacity-60"
                            disabled={Boolean(pathChoicePending)}
                            onClick={() => submitPathChoice('switch', option)}
                          >
                            切换到此路径
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-border px-3 py-1.5 text-xs text-subtle disabled:opacity-60"
                            disabled={Boolean(pathChoicePending)}
                            onClick={() => submitPathChoice('rejection', option)}
                          >
                            暂不采用
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-border px-3 py-1.5 text-xs text-subtle disabled:opacity-60"
                            disabled={Boolean(pathChoicePending)}
                            onClick={() => submitPathChoice('helpfulness', option, true)}
                          >
                            有帮助
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4 text-sm text-subtle">
                  {pathOptionFallback
                    ? `当前使用降级路径：${getStringArray(pathOptionFallback.fallbackReasons).join('、') || '路径多样性证据不足'}`
                    : '等待诊断结果生成三风格路径方案。'}
                </div>
              )}

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-xl border border-border bg-muted/20 p-4" data-learning-path-history="selection-history">
                  <h4 className="text-sm font-semibold text-foreground">选择历史</h4>
                  <div className="mt-3 space-y-2">
                    {pathSelectionHistory.map((history, index) => (
                      <div key={`${history.type}:${history.createdAt ?? index}`} className="rounded-lg border border-border bg-background/40 px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{formatPathHistoryType(history.type)}</span>
                          <span className="text-xs text-subtle">{history.createdAt ?? '时间待记录'}</span>
                        </div>
                        <p className="mt-1 text-subtle">
                          选择 {history.selectedStyleId ?? '无'}；拒绝 {history.rejectedStyleIds?.join('、') || '无'}；
                          {history.helpful === null || history.helpful === undefined ? ' 未评价有用性' : history.helpful ? ' 有帮助' : ' 无帮助'}
                        </p>
                      </div>
                    ))}
                    {pathSelectionHistory.length === 0 ? (
                      <p className="text-sm text-subtle">尚未记录选择、拒绝、切换或有用性反馈。</p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-4" data-learning-path-validation-timeline="checkpoint-deviation-intervention-terminal">
                  <h4 className="text-sm font-semibold text-foreground">执行与终端验证</h4>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
                      <p className="font-medium text-foreground">检查点</p>
                      <p className="mt-1 text-subtle">
                        {(controlCorrectionPathRound?.executions ?? []).length} 条执行记录；
                        当前节点 {focusedPathNode?.title ?? '待定位'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
                      <p className="font-medium text-foreground">偏离与干预</p>
                      <p className="mt-1 text-subtle">
                        {(controlCorrectionPathRound?.deviations ?? []).length} 条偏离；
                        {(controlCorrectionPathRound?.interventions ?? []).length} 条教师或控灵建议
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
                      <p className="font-medium text-foreground">官方 / 预览验证</p>
                      <p className="mt-1 text-subtle">
                        {formatTerminalValidation(controlCorrectionPathRound, pathOptions[0])}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {pathChoiceMessage ? (
                <p className="mt-3 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm text-foreground">
                  {pathChoiceMessage}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-lg font-medium">能力诊断</h2>

            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>计算型知识</span>
                  <span>{percentLabel(diagnostic?.knowledgeDimensions.computational ?? 0)}</span>
                </div>
                <div className="h-2 rounded bg-slate-800">
                  <div
                    className="h-2 rounded bg-cyan-400"
                    style={{ width: `${diagnostic?.knowledgeDimensions.computational ?? 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>跨域型知识</span>
                  <span>{percentLabel(diagnostic?.knowledgeDimensions.crossDomain ?? 0)}</span>
                </div>
                <div className="h-2 rounded bg-slate-800">
                  <div
                    className="h-2 rounded bg-emerald-400"
                    style={{ width: `${diagnostic?.knowledgeDimensions.crossDomain ?? 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>设计型知识</span>
                  <span>{percentLabel(diagnostic?.knowledgeDimensions.design ?? 0)}</span>
                </div>
                <div className="h-2 rounded bg-slate-800">
                  <div
                    className="h-2 rounded bg-violet-400"
                    style={{ width: `${diagnostic?.knowledgeDimensions.design ?? 0}%` }}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-slate-400">薄弱知识点</p>
              <div className="flex flex-wrap gap-2">
                {(diagnostic?.weakAreas ?? []).map((item) => (
                  <span key={item} className="rounded bg-rose-500/20 px-2 py-1 text-xs text-rose-300">
                    {formatTeachingTag(item)}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-slate-400">当前路径与推荐节点</p>
              <ul className="space-y-2 text-sm text-slate-300">
                {practiceRouteNodes.map((node) => (
                  <li
                    key={node.nodeId}
                    className={`rounded border px-3 py-2 ${
                      activePracticeFocus === node.nodeId
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : 'border-slate-800 bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-100">{node.title}</span>
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200">
                        {node.state === 'current' ? '当前节点' : '可选节点'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                      <span>置信度 {formatConfidence(node.confidence)}</span>
                      <span>证据覆盖 {formatEvidenceLimitation(node.evidenceLimitation)}</span>
                    </div>
                    {node.missingEvidence.length > 0 ? (
                      <p className="mt-2 text-xs text-rose-200/90">
                        缺失证据：需要更多练习记录支撑推荐。
                      </p>
                    ) : null}
                    {node.action.method === 'POST' ? (
                      <div className="mt-2 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void launchPathNode(node)}
                          className="inline-flex text-xs text-emerald-300 hover:text-emerald-200"
                        >
                          {node.action.label}
                        </button>
                        {node.action.completionAction ? (
                          <button
                            type="button"
                            onClick={() => void completePathNode(node)}
                            disabled={pathNodeCompletionPending === node.nodeId}
                            className="inline-flex text-xs text-sky-300 hover:text-sky-200 disabled:cursor-wait disabled:text-slate-500"
                          >
                            {pathNodeCompletionPending === node.nodeId ? '正在确认完成' : node.action.completionAction.label}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <Link href={node.action.href} className="mt-2 inline-flex text-xs text-emerald-300 hover:text-emerald-200">
                        {node.action.label}
                      </Link>
                    )}
                  </li>
                ))}
                {practiceRouteNodes.length === 0 ? (
                  <li className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-slate-500">
                    等待诊断结果生成当前路径节点。
                  </li>
                ) : null}
              </ul>
            </div>

            <button
              type="button"
              onClick={generateQuestion}
              disabled={loading}
              className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
            >
              AI 即时生成题目
            </button>
          </aside>

          <section className="surface-card space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">自适应练习区</h2>
              <div className="text-sm text-slate-300">
                能力值 θ: <span className="font-semibold text-emerald-300">{questionState?.estimatedAbility ?? 0}</span>
                <span className="ml-2 text-slate-400">
                  CI: [{questionState?.confidenceInterval?.[0] ?? 0}, {questionState?.confidenceInterval?.[1] ?? 0}]
                </span>
              </div>
            </div>

            {questionState ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {questionState.question.domains.map((domain) => (
                      <span key={domain} className="rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-300">
                        {formatTeachingTag(domain)}
                      </span>
                    ))}
                    <span className="rounded bg-violet-500/20 px-2 py-1 text-xs text-violet-300">
                      难度 {questionState.question.difficulty}
                    </span>
                  </div>

                  <p className="text-base leading-7 text-slate-100">{questionState.question.stem}</p>

                  <div className="mt-4 space-y-2">
                    {questionState.question.options.map((option) => {
                      const active = selectedOption === option.label;
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => setSelectedOption(option.label)}
                          className={`w-full rounded border px-3 py-2 text-left text-sm transition ${
                            active
                              ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                              : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
                          }`}
                        >
                          {option.label}. {option.text}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={submitCurrentAnswer}
                    disabled={loading || !selectedOption}
                    className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-60"
                  >
                    提交答案
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadNextQuestion()}
                    disabled={loading}
                    className="rounded bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600 disabled:opacity-60"
                  >
                    下一题
                  </button>
                </div>

                {feedback ? (
                  <div className={`rounded-xl border p-4 ${feedback.isCorrect ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10'}`}>
                    <div className="text-sm font-medium">
                      {feedback.isCorrect ? '回答正确' : `回答错误，正确选项：${feedback.correctOption}`}
                    </div>
                    <p className="mt-2 text-sm text-slate-200">{feedback.explanation}</p>
                    <div className="mt-2 text-xs text-slate-300">
                      最新能力估计 θ: <span className="text-emerald-300">{feedback.estimatedAbility}</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      {feedback.recommendedFocus.map((item) => (
                        <li key={item} className="rounded bg-slate-900/70 px-2 py-1">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : authStatus === 'unauthenticated' && !isDemoMode ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-center text-sm text-amber-100">
                <p className="font-medium">请先登录后再进入自适应练习。</p>
                <p className="mt-2 text-amber-100/80">当前 practice intent 会在登录后继续保留。</p>
                <Link
                  href={loginHref}
                  className="mt-4 inline-flex rounded bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400"
                >
                  登录后继续
                </Link>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-center text-sm text-rose-100">
                <p className="font-medium">题目加载失败</p>
                <p className="mt-2 text-rose-100/80">{error}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Link href="/profile" className="rounded border border-rose-300/40 px-3 py-2 text-xs text-rose-50 hover:bg-rose-500/20">
                    查看证据画像
                  </Link>
                  <Link href="/interactive-learning" className="rounded border border-rose-300/40 px-3 py-2 text-xs text-rose-50 hover:bg-rose-500/20">
                    返回互动学习
                  </Link>
                  <Link href="/arena" className="rounded border border-rose-300/40 px-3 py-2 text-xs text-rose-50 hover:bg-rose-500/20">
                    返回竞技场
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => void bootstrapPractice()}
                  disabled={loading}
                  className="mt-4 rounded bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
                >
                  重新加载
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-400">
                正在加载练习题...
              </div>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-400">
              {loading
                ? '系统正在评估并更新题目推荐...'
                : error
                  ? `操作失败：${error}`
                  : isDemoMode
                    ? '提示：可继续练习，也可切换到下一题观察能力估计变化。'
                    : '提示：答错后会触发跨域解释与后续补强建议。'}
            </div>
          </section>
        </section>
      </section>
    </AppShell>
  );
}
