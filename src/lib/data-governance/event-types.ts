/**
 * Event Type Registry
 *
 * Central registry of all event types with their metadata.
 * This is the single source of truth for event classification.
 */

import type { EventPriority } from './event-protocol';

export interface EventTypeMetadata {
  eventType: string;
  category: EventCategory;
  priority: EventPriority;
  description: string;
  schema?: Record<string, unknown>; // JSON Schema for payload validation
  competencyMapping?: Record<string, number>; // Which competencies this affects
}

export type EventCategory =
  | 'assessment'
  | 'simulation'
  | 'ai'
  | 'design'
  | 'ethics'
  | 'navigation'
  | 'interaction';

// ============================================
// CORE EVENTS - Must be reliably persisted
// ============================================

export const CORE_EVENTS: EventTypeMetadata[] = [
  {
    eventType: 'answer_submit',
    category: 'assessment',
    priority: 'core',
    description: '学生提交题目答案',
    schema: {
      type: 'object',
      properties: {
        questionId: { type: 'string' },
        answer: { type: 'string' },
        isCorrect: { type: 'boolean' },
        timeSpent: { type: 'number' },
      },
      required: ['questionId', 'answer'],
    },
    competencyMapping: {
      controlModeling: 0.8,
      crossDomainTransfer: 0.5,
    },
  },
  {
    eventType: 'assessment_complete',
    category: 'assessment',
    priority: 'core',
    description: '测评完成，包含总分和分项得分',
    schema: {
      type: 'object',
      properties: {
        assessmentId: { type: 'string' },
        totalScore: { type: 'number' },
        correctCount: { type: 'number' },
        totalCount: { type: 'number' },
        timeSpent: { type: 'number' },
      },
      required: ['assessmentId', 'totalScore'],
    },
    competencyMapping: {
      controlModeling: 1.0,
      selfDirectedLearning: 0.3,
    },
  },
  {
    eventType: 'simulation_finish',
    category: 'simulation',
    priority: 'core',
    description: '仿真任务完成',
    schema: {
      type: 'object',
      properties: {
        simulationId: { type: 'string' },
        taskType: { type: 'string' },
        score: { type: 'number' },
        metrics: { type: 'object' },
        duration: { type: 'number' },
      },
      required: ['simulationId', 'score'],
    },
    competencyMapping: {
      parameterDesign: 1.0,
      engineeringDecision: 0.6,
      selfDirectedLearning: 0.4,
    },
  },
  {
    eventType: 'ai_intervention_complete',
    category: 'ai',
    priority: 'core',
    description: 'AI介入完成，记录结果和有效性',
    schema: {
      type: 'object',
      properties: {
        interventionId: { type: 'string' },
        triggerType: { type: 'string' },
        wasHelpful: { type: 'boolean' },
        followUpAction: { type: 'string' },
      },
    },
    competencyMapping: {
      inquiryReflection: 0.7,
      selfDirectedLearning: 0.5,
    },
  },
  {
    eventType: 'prompt_assessed',
    category: 'ai',
    priority: 'core',
    description: '提示词被AI评价',
    schema: {
      type: 'object',
      properties: {
        promptId: { type: 'string' },
        overallScore: { type: 'number' },
        completenessScore: { type: 'number' },
        precisionScore: { type: 'number' },
        suggestions: { type: 'array' },
      },
    },
    competencyMapping: {
      inquiryReflection: 1.0,
      selfDirectedLearning: 0.3,
    },
  },
  {
    eventType: 'design_session_complete',
    category: 'design',
    priority: 'core',
    description: '设计会话完成',
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        taskType: { type: 'string' },
        consistencyScore: { type: 'number' },
        finalResult: { type: 'object' },
      },
    },
    competencyMapping: {
      controlModeling: 0.8,
      parameterDesign: 0.8,
      engineeringDecision: 0.5,
    },
  },
  {
    eventType: 'ethical_violation',
    category: 'ethics',
    priority: 'core',
    description: '伦理违规事件',
    schema: {
      type: 'object',
      properties: {
        violationType: { type: 'string' },
        thresholdValue: { type: 'number' },
        actualValue: { type: 'number' },
        context: { type: 'object' },
      },
    },
    competencyMapping: {
      engineeringDecision: -0.8,
    },
  },
  {
    eventType: 'ethical_resolved',
    category: 'ethics',
    priority: 'core',
    description: '伦理违规已整改',
    schema: {
      type: 'object',
      properties: {
        violationId: { type: 'string' },
        resolution: { type: 'string' },
        studentReflection: { type: 'string' },
      },
    },
    competencyMapping: {
      engineeringDecision: 0.5,
      selfDirectedLearning: 0.3,
    },
  },
  {
    eventType: 'lesson_submit',
    category: 'assessment',
    priority: 'core',
    description: '课堂步骤提交',
    competencyMapping: {
      controlModeling: 0.5,
      selfDirectedLearning: 0.3,
    },
  },
  {
    eventType: 'lesson_resubmit',
    category: 'assessment',
    priority: 'core',
    description: '课堂步骤重提',
    competencyMapping: {
      controlModeling: 0.4,
      selfDirectedLearning: 0.4,
    },
  },
  {
    eventType: 'session_finalize',
    category: 'assessment',
    priority: 'core',
    description: '课堂阶段完成',
    competencyMapping: {
      inquiryReflection: 0.5,
      selfDirectedLearning: 0.4,
    },
  },
  {
    eventType: 'resource_complete',
    category: 'interaction',
    priority: 'core',
    description: '完成课堂外资源学习',
    competencyMapping: {
      selfDirectedLearning: 0.2,
    },
  },
  {
    eventType: 'arena_challenge_open',
    category: 'navigation',
    priority: 'core',
    description: '打开竞技场挑战',
    schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
      },
      required: ['taskId'],
    },
    competencyMapping: {
      selfDirectedLearning: 0.2,
    },
  },
  {
    eventType: 'arena_workspace_start',
    category: 'design',
    priority: 'core',
    description: '开始竞技场工作台',
    schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        workspaceMode: { type: 'string' },
      },
      required: ['taskId'],
    },
    competencyMapping: {
      parameterDesign: 0.2,
      selfDirectedLearning: 0.2,
    },
  },
  {
    eventType: 'arena_simulation_run',
    category: 'simulation',
    priority: 'core',
    description: '运行竞技场仿真',
    schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        method: { type: 'string' },
      },
      required: ['taskId'],
    },
    competencyMapping: {
      parameterDesign: 0.4,
      engineeringDecision: 0.2,
    },
  },
  {
    eventType: 'arena_controller_save',
    category: 'design',
    priority: 'core',
    description: '保存竞技场控制器方案',
    schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        method: { type: 'string' },
      },
      required: ['taskId', 'method'],
    },
    competencyMapping: {
      parameterDesign: 0.5,
      selfDirectedLearning: 0.2,
    },
  },
  {
    eventType: 'arena_identification_model_save',
    category: 'design',
    priority: 'core',
    description: '保存竞技场辨识模型',
    schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        identificationQuality: { type: 'number' },
      },
      required: ['taskId'],
    },
    competencyMapping: {
      controlModeling: 0.6,
      crossDomainTransfer: 0.4,
    },
  },
  {
    eventType: 'arena_virtual_simulation_import',
    category: 'simulation',
    priority: 'core',
    description: '导入竞技场虚拟仿真对象',
    schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        objectId: { type: 'string' },
      },
      required: ['taskId'],
    },
    competencyMapping: {
      crossDomainTransfer: 0.4,
      engineeringDecision: 0.3,
    },
  },
  {
    eventType: 'arena_submit',
    category: 'assessment',
    priority: 'core',
    description: '竞技场提交评测',
    schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        score: { type: 'number' },
        valid: { type: 'boolean' },
        method: { type: 'string' },
      },
      required: ['taskId', 'score', 'valid'],
    },
    competencyMapping: {
      parameterDesign: 0.8,
      engineeringDecision: 0.5,
      selfDirectedLearning: 0.3,
    },
  },
  {
    eventType: 'arena_evaluation_complete',
    category: 'assessment',
    priority: 'core',
    description: '竞技场官方评测完成',
    schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        score: { type: 'number' },
        valid: { type: 'boolean' },
        method: { type: 'string' },
        metrics: { type: 'object' },
      },
      required: ['taskId', 'score', 'valid'],
    },
    competencyMapping: {
      parameterDesign: 0.9,
      engineeringDecision: 0.6,
      selfDirectedLearning: 0.3,
    },
  },
  {
    eventType: 'arena_result_view',
    category: 'interaction',
    priority: 'core',
    description: '查看竞技场成绩',
    competencyMapping: {
      inquiryReflection: 0.2,
      selfDirectedLearning: 0.2,
    },
  },
  {
    eventType: 'arena_leaderboard_view',
    category: 'interaction',
    priority: 'core',
    description: '查看竞技场排行榜',
    competencyMapping: {
      inquiryReflection: 0.2,
      selfDirectedLearning: 0.2,
    },
  },
  {
    eventType: 'arena_feedback_view',
    category: 'interaction',
    priority: 'core',
    description: '查看竞技场反馈',
    competencyMapping: {
      inquiryReflection: 0.3,
      selfDirectedLearning: 0.2,
    },
  },
];

// ============================================
// SECONDARY EVENTS - Can be buffered/dropped
// ============================================

export const SECONDARY_EVENTS: EventTypeMetadata[] = [
  {
    eventType: 'page_view',
    category: 'navigation',
    priority: 'secondary',
    description: '页面浏览',
    schema: {
      type: 'object',
      properties: {
        referrer: { type: 'string' },
        timeOnPage: { type: 'number' },
      },
    },
  },
  {
    eventType: 'step_enter',
    category: 'navigation',
    priority: 'secondary',
    description: '进入学习步骤',
  },
  {
    eventType: 'step_leave',
    category: 'navigation',
    priority: 'secondary',
    description: '离开学习步骤',
    schema: {
      type: 'object',
      properties: {
        timeSpent: { type: 'number' },
        completionStatus: { type: 'string' },
      },
    },
  },
  {
    eventType: 'knowledge_card_open',
    category: 'interaction',
    priority: 'secondary',
    description: '打开知识卡片',
  },
  {
    eventType: 'param_change',
    category: 'interaction',
    priority: 'secondary',
    description: '参数变更（中间状态）',
    schema: {
      type: 'object',
      properties: {
        parameterName: { type: 'string' },
        oldValue: { type: 'number' },
        newValue: { type: 'number' },
      },
    },
  },
  {
    eventType: 'hint_request',
    category: 'interaction',
    priority: 'secondary',
    description: '请求提示',
    schema: {
      type: 'object',
      properties: {
        hintType: { type: 'string' },
        context: { type: 'string' },
      },
    },
  },
  {
    eventType: 'lesson_step_view',
    category: 'navigation',
    priority: 'secondary',
    description: '查看课堂步骤',
  },
  {
    eventType: 'lesson_step_leave',
    category: 'navigation',
    priority: 'secondary',
    description: '离开课堂步骤',
  },
  {
    eventType: 'resource_view',
    category: 'navigation',
    priority: 'secondary',
    description: '查看课堂外资源',
  },
  {
    eventType: 'resource_open',
    category: 'interaction',
    priority: 'secondary',
    description: '打开课堂外资源',
  },
  {
    eventType: 'resource_play',
    category: 'interaction',
    priority: 'secondary',
    description: '开始播放课堂外媒体资源',
  },
  {
    eventType: 'resource_progress',
    category: 'interaction',
    priority: 'secondary',
    description: '课堂外媒体学习进度',
  },
  {
    eventType: 'resource_download',
    category: 'interaction',
    priority: 'secondary',
    description: '下载课堂外资源',
  },
  {
    eventType: 'workspace_param_change',
    category: 'interaction',
    priority: 'secondary',
    description: '课堂工作区参数变化',
    competencyMapping: {
      controlModeling: 0.1,
      selfDirectedLearning: 0.1,
    },
  },
  {
    eventType: 'ai_panel_open',
    category: 'interaction',
    priority: 'secondary',
    description: '打开课堂 AI 面板',
  },
  {
    eventType: 'ai_query_submit',
    category: 'ai',
    priority: 'secondary',
    description: '课堂内提交 AI 查询',
  },
  {
    eventType: 'sync_error',
    category: 'interaction',
    priority: 'secondary',
    description: '课堂同步错误',
  },
  {
    eventType: 'knowledge_graph_node_focus',
    category: 'interaction',
    priority: 'secondary',
    description: '聚焦知识图谱节点',
  },
  {
    eventType: 'external_module_open',
    category: 'interaction',
    priority: 'secondary',
    description: '打开跨域互动模块',
  },
];

// ============================================
// Registry Operations
// ============================================

export const ALL_EVENTS: EventTypeMetadata[] = [...CORE_EVENTS, ...SECONDARY_EVENTS];

const EVENT_TYPE_MAP = new Map(ALL_EVENTS.map(e => [e.eventType, e]));

/**
 * Get metadata for an event type
 */
export function getEventMetadata(eventType: string): EventTypeMetadata | undefined {
  return EVENT_TYPE_MAP.get(eventType);
}

/**
 * Check if an event type is a core event
 */
export function isCoreEvent(eventType: string): boolean {
  const meta = EVENT_TYPE_MAP.get(eventType);
  return meta?.priority === 'core';
}

/**
 * Check if an event type is a secondary event
 */
export function isSecondaryEvent(eventType: string): boolean {
  const meta = EVENT_TYPE_MAP.get(eventType);
  return meta?.priority === 'secondary';
}

/**
 * Get competency mapping for an event type
 */
export function getCompetencyMapping(eventType: string): Record<string, number> | undefined {
  return EVENT_TYPE_MAP.get(eventType)?.competencyMapping;
}

/**
 * Get all core event types
 */
export function getCoreEventTypes(): string[] {
  return CORE_EVENTS.map(e => e.eventType);
}

/**
 * Get all secondary event types
 */
export function getSecondaryEventTypes(): string[] {
  return SECONDARY_EVENTS.map(e => e.eventType);
}
