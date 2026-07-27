import type {
  PlatformPrivacyStatus,
  PlatformReadinessStatus,
  PlatformSourceCoverageStatus,
  PlatformStatusPayload,
  PlatformStatusRoleScope,
} from '@/components/platform/platform-ui-contracts';
import {
  TEACHER_RESOURCE_NODE_IMMUTABLE_FIELDS,
  TEACHER_RESOURCE_NODE_PERMITTED_EDIT_FIELDS,
  type TeacherResourceNodeSummary,
  type TeacherResourceNodeView,
} from '@/lib/teacher-resource-node-management';
import type { GovernanceStatusPayload } from './data-governance-overview';

export type TeacherGovernanceRole = 'teacher' | 'admin';

export type TeacherGovernanceWorkspaceRegion =
  | 'resource-node-browse'
  | 'resource-node-search-filters'
  | 'warning-summary'
  | 'node-detail'
  | 'single-node-edit'
  | 'path-eligibility';

export type AdminDataCenterMode = 'presentation' | 'governance-audit';

export type AdminDataCenterPanelId =
  | 'presentation-summary'
  | 'source-coverage'
  | 'readiness'
  | 'missing-context'
  | 'replay-confidence'
  | 'privacy-status'
  | 'evaluation-events';

export type RestrictedGovernancePayloadCategory =
  | 'hidden-official-evaluation-internals'
  | 'private-learner-evidence'
  | 'raw-answers'
  | 'raw-traces'
  | 'private-konling-memory';

export interface TeacherGovernanceWorkspaceInput {
  role: TeacherGovernanceRole;
  nodes: readonly TeacherResourceNodeView[];
  summary: TeacherResourceNodeSummary;
}

export interface TeacherGovernanceNodeField {
  id:
    | 'source-reference'
    | 'knowledge-coverage'
    | 'privacy-level'
    | 'teacher-policy'
    | 'evidence-instrumentation'
    | 'path-eligibility';
  label: string;
  value: string;
  roleScope: PlatformStatusRoleScope;
  restricted?: boolean;
}

export interface TeacherGovernanceWarning {
  code: string;
  message: string;
  severity: 'blocking' | 'warning';
  roleScope: PlatformStatusRoleScope;
}

export interface TeacherGovernanceNodeView {
  nodeId: string;
  title: string;
  canEdit: boolean;
  fields: TeacherGovernanceNodeField[];
  warnings: TeacherGovernanceWarning[];
}

export interface GovernanceRedactionRule {
  category: RestrictedGovernancePayloadCategory;
  marker: string;
  roleScope: PlatformStatusRoleScope;
  exposesRawPayload: false;
}

export interface TeacherGovernanceWorkspaceView {
  role: TeacherGovernanceRole;
  managementCapability: 'teacher-resource-node-management';
  regions: TeacherGovernanceWorkspaceRegion[];
  permittedEditFields: readonly string[];
  immutableFields: readonly string[];
  outOfScope: readonly string[];
  warningSummary: {
    total: number;
    blocking: number;
    warning: number;
    excludedNodes: number;
  };
  redactions: GovernanceRedactionRule[];
  nodes: TeacherGovernanceNodeView[];
  status: PlatformStatusPayload;
}

export interface AdminDataCenterPanel {
  id: AdminDataCenterPanelId;
  title: string;
  status: PlatformStatusPayload;
  metric: string;
  details: Array<{
    label: string;
    value: string;
    roleScope: PlatformStatusRoleScope;
    restricted?: boolean;
  }>;
}

export interface AdminDataCenterWorkspaceView {
  mode: AdminDataCenterMode;
  panels: AdminDataCenterPanel[];
  status: PlatformStatusPayload;
  drilldownLimits: {
    maxRowsPerPanel: number;
    allowSampleReferences: boolean;
    allowPrivateIdentifiers: boolean;
    exportPolicy: 'aggregate-only';
  };
}

export interface AdminDataCenterExportSummary {
  generatedAt: string;
  rows: Array<{
    sourceId: string;
    reason: string;
    rowCount: number;
    affectedUsers: number;
  }>;
}

export interface TeacherOperationsNavigationEntry {
  id: string;
  label: string;
  href: string;
  workspace: 'teacher-operations';
  objectLevelActions: readonly string[];
  statusSemantics: readonly string[];
}

export interface AdminOperationsConsoleDomain {
  id: string;
  label: string;
  href: string;
  workspace: 'admin-operations';
  state: 'available' | 'future';
  actions: readonly string[];
  statusSemantics: readonly string[];
}

export interface OperationsUnavailableSlot {
  id: string;
  label: string;
  state: 'empty' | 'loading' | 'disabled' | 'feature-flagged';
  permittedAdjacentActions: readonly string[];
  fabricatesMetrics: false;
}

export const TEACHER_OPERATIONS_NAVIGATION: TeacherOperationsNavigationEntry[] = [
  {
    id: 'teacher-operations-home',
    label: '教师总览',
    href: '/teacher',
    workspace: 'teacher-operations',
    objectLevelActions: ['查看班级', '查看教案', '查看课堂历史'],
    statusSemantics: ['ready', 'degraded', 'active-session'],
  },
  {
    id: 'teacher-operations-classes',
    label: '班级',
    href: '/teacher/classes',
    workspace: 'teacher-operations',
    objectLevelActions: ['新建班级', '搜索班级', '查看学生'],
    statusSemantics: ['loading', 'active', 'closed', 'empty'],
  },
  {
    id: 'teacher-operations-lesson-plans',
    label: '教案',
    href: '/teacher/lesson-plans',
    workspace: 'teacher-operations',
    objectLevelActions: ['新建教案', '编辑教案', '进入课堂'],
    statusSemantics: ['draft', 'updated', 'empty'],
  },
  {
    id: 'teacher-operations-assignments',
    label: '作业',
    href: '/teacher/assignments',
    workspace: 'teacher-operations',
    objectLevelActions: ['新建作业', '编辑草稿', '查看发布状态'],
    statusSemantics: ['loading', 'draft', 'scheduled', 'published', 'closed', 'empty', 'error'],
  },
  {
    id: 'teacher-operations-resources',
    label: '资源',
    href: '/teacher/resources',
    workspace: 'teacher-operations',
    objectLevelActions: ['筛选资源', '查看知识节点', '管理 ResourceNode'],
    statusSemantics: ['available', 'teacher-only', 'path-eligible'],
  },
  {
    id: 'teacher-operations-smart-prep',
    label: '智能备课',
    href: '/teacher/smart-prep',
    workspace: 'teacher-operations',
    objectLevelActions: ['管理课程依据', '导入文档', '确认版本'],
    statusSemantics: ['pending', 'confirmed', 'rejected', 'retired'],
  },
  {
    id: 'teacher-operations-prep-packs',
    label: '课前包',
    href: '/teacher/prep-packs',
    workspace: 'teacher-operations',
    objectLevelActions: ['复核候选项', '预览 runtime diff', '激活或回滚 overlay'],
    statusSemantics: ['review-ready', 'active', 'rolled-back', 'archived'],
  },
  {
    id: 'teacher-operations-history',
    label: '课堂历史',
    href: '/teacher/history',
    workspace: 'teacher-operations',
    objectLevelActions: ['搜索课堂', '归档班级', '删除记录'],
    statusSemantics: ['loading', 'finished', 'unassigned-class', 'empty'],
  },
  {
    id: 'teacher-operations-analytics',
    label: '班级分析',
    href: '/teacher/classes/[classId]/analytics-v2',
    workspace: 'teacher-operations',
    objectLevelActions: ['查看班级', '查看学生证据'],
    statusSemantics: ['feature-flagged', 'ready', 'empty'],
  },
] as const;

export const TEACHER_OPERATIONS_ANALYTICS_SLOTS: OperationsUnavailableSlot[] = [
  {
    id: 'class-learning-analytics',
    label: '班级学习分析',
    state: 'feature-flagged',
    permittedAdjacentActions: ['查看班级', '查看学生证据'],
    fabricatesMetrics: false,
  },
  {
    id: 'student-learning-analytics',
    label: '学生学习分析',
    state: 'feature-flagged',
    permittedAdjacentActions: ['查看班级', '查看学生证据'],
    fabricatesMetrics: false,
  },
] as const;

export const ADMIN_OPERATIONS_CONSOLE_DOMAINS: AdminOperationsConsoleDomain[] = [
  {
    id: 'admin-operations-home',
    label: '管理总台',
    href: '/admin',
    workspace: 'admin-operations',
    state: 'available',
    actions: ['进入用户管理', '查看使用态势', '查看数据治理'],
    statusSemantics: ['ready', 'degraded', 'restricted'],
  },
  {
    id: 'admin-operations-users',
    label: '用户管理',
    href: '/admin/users',
    workspace: 'admin-operations',
    state: 'available',
    actions: ['新建账号', '批量导入', '重置密码'],
    statusSemantics: ['loading', 'active', 'role-filtered', 'import-error'],
  },
  {
    id: 'admin-operations-config',
    label: '系统配置',
    href: '/admin/config',
    workspace: 'admin-operations',
    state: 'available',
    actions: ['保存配置', '重置表单', '测试模型'],
    statusSemantics: ['loading', 'ready', 'dirty', 'saving', 'validation-error'],
  },
  {
    id: 'admin-operations-states',
    label: '系统使用量统计',
    href: '/admin/states',
    workspace: 'admin-operations',
    state: 'available',
    actions: ['刷新数据', '查看趋势'],
    statusSemantics: ['loading', 'fresh', 'stale', 'empty'],
  },
  {
    id: 'admin-operations-governance',
    label: '数据治理',
    href: '/admin/data-governance',
    workspace: 'admin-operations',
    state: 'available',
    actions: ['刷新队列', '查看风险', '导出摘要'],
    statusSemantics: ['loading', 'ready', 'partial', 'blocked'],
  },
  {
    id: 'admin-operations-model-management',
    label: '模型管理',
    href: '/admin/model-management',
    workspace: 'admin-operations',
    state: 'future',
    actions: ['查看当前模型配置'],
    statusSemantics: ['feature-flagged'],
  },
] as const;

export function buildOperationsUnavailableSlot(slot: OperationsUnavailableSlot): OperationsUnavailableSlot {
  return {
    ...slot,
    fabricatesMetrics: false,
  };
}

export const TEACHER_GOVERNANCE_WORKSPACE_REGIONS: TeacherGovernanceWorkspaceRegion[] = [
  'resource-node-browse',
  'resource-node-search-filters',
  'warning-summary',
  'node-detail',
  'single-node-edit',
  'path-eligibility',
];

export const ADMIN_DATA_CENTER_GOVERNANCE_PANELS: AdminDataCenterPanelId[] = [
  'source-coverage',
  'readiness',
  'missing-context',
  'replay-confidence',
  'privacy-status',
  'evaluation-events',
];

const PRESENTATION_MAX_ROWS_PER_PANEL = 5;
const GOVERNANCE_AUDIT_MAX_ROWS_PER_PANEL = 50;

export const GOVERNANCE_REDACTION_RULES: GovernanceRedactionRule[] = [
  {
    category: 'hidden-official-evaluation-internals',
    marker: '隐藏正式评测内部细节，仅显示审计引用。',
    roleScope: 'audit-only',
    exposesRawPayload: false,
  },
  {
    category: 'private-learner-evidence',
    marker: '学习者私有证据仅按授权范围聚合展示。',
    roleScope: 'admin-scoped',
    exposesRawPayload: false,
  },
  {
    category: 'raw-answers',
    marker: '原始作答内容不可在治理界面展开。',
    roleScope: 'system-internal',
    exposesRawPayload: false,
  },
  {
    category: 'raw-traces',
    marker: '高频轨迹只显示摘要、校验状态和引用。',
    roleScope: 'system-internal',
    exposesRawPayload: false,
  },
  {
    category: 'private-konling-memory',
    marker: 'Konling 私有记忆只允许显示脱敏来源和状态。',
    roleScope: 'system-internal',
    exposesRawPayload: false,
  },
];

export function buildTeacherGovernanceWorkspace(
  input: TeacherGovernanceWorkspaceInput,
): TeacherGovernanceWorkspaceView {
  const warnings = input.nodes.flatMap((node) => node.warnings);
  const blocking = warnings.filter((warning) => warning.severity === 'blocking').length;
  const privacy = input.nodes.some((node) => node.privacyLevel === 'admin-scoped')
    ? 'restricted'
    : 'classroom';

  return {
    role: input.role,
    managementCapability: 'teacher-resource-node-management',
    regions: TEACHER_GOVERNANCE_WORKSPACE_REGIONS,
    permittedEditFields: TEACHER_RESOURCE_NODE_PERMITTED_EDIT_FIELDS,
    immutableFields: TEACHER_RESOURCE_NODE_IMMUTABLE_FIELDS,
    outOfScope: [
      'teacher-homepage-dashboard-redesign',
      'resource-node-backend-reimplementation',
      'stage-2-bulk-resource-operations',
    ],
    warningSummary: {
      total: warnings.length,
      blocking,
      warning: warnings.length - blocking,
      excludedNodes: input.summary.excludedNodes,
    },
    redactions: GOVERNANCE_REDACTION_RULES,
    nodes: input.nodes.map((node) => buildTeacherGovernanceNode(node, input.role)),
    status: {
      id: 'teacher-governance-workspace',
      label: '教师资源治理工作区',
      source: { domain: 'teacher-management', capability: 'teacher-admin-governance-workspaces-ui' },
      summary: input.summary.warningNodes > 0
        ? `存在 ${input.summary.warningNodes} 个资源治理告警。`
        : '资源治理工作区可用。',
      categories: {
        confidence: 'medium',
        sourceCoverage: input.summary.warningNodes > 0 ? 'partial' : 'complete',
        privacy,
        replay: input.nodes.every((node) => node.evidenceInstrumentationConfigured) ? 'ready' : 'partial',
        protocol: 'current',
        evaluation: 'hidden',
        readiness: teacherReadiness(input.summary, blocking),
        fallback: 'none',
      },
      details: [
        {
          label: '能力来源',
          value: 'teacher-resource-node-management',
          roleScope: 'teacher-scoped',
        },
        {
          label: '范围边界',
          value: '不重设计教师首页，不重写 ResourceNode 后端。',
          roleScope: 'teacher-scoped',
        },
      ],
    },
  };
}

export function buildAdminDataCenterWorkspace(input: {
  mode: AdminDataCenterMode;
  payload: GovernanceStatusPayload;
}): AdminDataCenterWorkspaceView {
  const sourceCoverage = sourceCoverageStatus(input.payload);
  const readiness = dataCenterReadiness(input.payload);
  const privacy = dataCenterPrivacy(input.payload);
  const panels = input.mode === 'presentation'
    ? [
        presentationPanel(input.payload),
        sourceCoveragePanel(input.payload),
      ]
    : ADMIN_DATA_CENTER_GOVERNANCE_PANELS.map((panelId) => buildGovernancePanel(panelId, input.payload));

  return {
    mode: input.mode,
    panels,
    status: {
      id: `admin-data-center-${input.mode}`,
      label: input.mode === 'presentation' ? '数据中心展示模式' : '数据中心治理审计模式',
      source: { domain: 'teacher-management', capability: 'teacher-admin-governance-workspaces-ui' },
      summary: input.mode === 'presentation'
        ? '展示模式只提供聚合状态和演示指标。'
        : '治理审计模式提供证据源、就绪度、缺失上下文、隐私与评测事件状态。',
      categories: {
        confidence: input.payload.status === 'healthy' ? 'high' : 'medium',
        sourceCoverage,
        privacy,
        replay: replayStatus(input.payload),
        protocol: 'current',
        evaluation: evaluationStatus(input.payload),
        readiness,
        fallback: sourceCoverage === 'missing' ? 'fallback-missing-context' : 'none',
      },
    },
    drilldownLimits: {
      maxRowsPerPanel: input.mode === 'presentation'
        ? PRESENTATION_MAX_ROWS_PER_PANEL
        : GOVERNANCE_AUDIT_MAX_ROWS_PER_PANEL,
      allowSampleReferences: false,
      allowPrivateIdentifiers: false,
      exportPolicy: 'aggregate-only',
    },
  };
}

export function buildAdminDataCenterExportSummary(
  payload: GovernanceStatusPayload,
): AdminDataCenterExportSummary {
  return {
    generatedAt: payload.sourceCoverage?.generatedAt ?? payload.timestamp,
    rows: (payload.sourceCoverage?.exclusions ?? []).map((exclusion) => ({
      sourceId: exclusion.sourceId,
      reason: exclusion.reason,
      rowCount: exclusion.rowCount,
      affectedUsers: exclusion.affectedUsers,
    })),
  };
}

function buildTeacherGovernanceNode(
  node: TeacherResourceNodeView,
  role: TeacherGovernanceRole,
): TeacherGovernanceNodeView {
  return {
    nodeId: node.id,
    title: node.title,
    canEdit: node.editable,
    fields: [
      {
        id: 'source-reference',
        label: '来源引用',
        value: node.sourceRefs.map((source) => `${source.kind}:${source.ref}`).join(', '),
        roleScope: 'teacher-scoped',
      },
      {
        id: 'knowledge-coverage',
        label: '知识映射',
        value: node.knowledgeCoverage.join(', ') || '未映射',
        roleScope: 'teacher-scoped',
      },
      {
        id: 'privacy-level',
        label: '隐私级别',
        value: role === 'teacher' && node.privacyLevel === 'admin-scoped' ? '受限摘要' : node.privacyLevel,
        roleScope: node.privacyLevel === 'admin-scoped' ? 'admin-scoped' : 'teacher-scoped',
        restricted: role === 'teacher' && node.privacyLevel === 'admin-scoped',
      },
      {
        id: 'teacher-policy',
        label: '教师策略',
        value: node.teacherPolicy,
        roleScope: 'teacher-scoped',
      },
      {
        id: 'evidence-instrumentation',
        label: '证据采集',
        value: node.evidenceInstrumentationConfigured ? '已配置' : '未配置',
        roleScope: 'teacher-scoped',
      },
      {
        id: 'path-eligibility',
        label: '路径资格',
        value: node.audit.pathEligible ? '可规划' : `已排除：${node.audit.exclusionReasons.join(', ') || '无公开原因'}`,
        roleScope: 'teacher-scoped',
      },
    ],
    warnings: node.warnings.map((warning) => ({
      ...warning,
      roleScope: role === 'admin' ? 'admin-scoped' : 'teacher-scoped',
    })),
  };
}

function buildGovernancePanel(
  panelId: AdminDataCenterPanelId,
  payload: GovernanceStatusPayload,
): AdminDataCenterPanel {
  switch (panelId) {
    case 'source-coverage':
      return sourceCoveragePanel(payload);
    case 'readiness':
      return readinessPanel(payload);
    case 'missing-context':
      return missingContextPanel(payload);
    case 'replay-confidence':
      return replayConfidencePanel(payload);
    case 'privacy-status':
      return privacyStatusPanel(payload);
    case 'evaluation-events':
      return evaluationEventsPanel(payload);
    case 'presentation-summary':
      return presentationPanel(payload);
  }
}

function presentationPanel(payload: GovernanceStatusPayload): AdminDataCenterPanel {
  return panel({
    id: 'presentation-summary',
    title: '展示指标',
    metric: `${payload.data.learningFacts} facts`,
    readiness: payload.status === 'healthy' ? 'ready' : 'degraded',
    sourceCoverage: sourceCoverageStatus(payload),
    details: [
      { label: '学习事实', value: String(payload.data.learningFacts), roleScope: 'admin-scoped' },
      { label: '风险数量', value: String(payload.data.activeRiskFlags), roleScope: 'admin-scoped' },
    ],
  });
}

function sourceCoveragePanel(payload: GovernanceStatusPayload): AdminDataCenterPanel {
  const totals = payload.sourceCoverage?.totals;
  return panel({
    id: 'source-coverage',
    title: '证据源覆盖',
    metric: totals ? `${totals.eligibleRows}/${totals.totalRows}` : 'unavailable',
    readiness: totals && totals.eligibleRows > 0 && totals.unsupportedRows === 0 && totals.excludedRows === 0 ? 'ready' : 'degraded',
    sourceCoverage: sourceCoverageStatus(payload),
    details: [
      { label: '目录来源', value: payload.sourceCatalog?.coverageCommand ?? '未配置', roleScope: 'admin-scoped' },
      { label: '不支持行数', value: String(totals?.unsupportedRows ?? 0), roleScope: 'admin-scoped' },
    ],
  });
}

function readinessPanel(payload: GovernanceStatusPayload): AdminDataCenterPanel {
  const failed = Object.values(payload.queues).reduce((sum, queue) => sum + queue.failed, 0);
  return panel({
    id: 'readiness',
    title: '治理就绪度',
    metric: payload.status,
    readiness: dataCenterReadiness(payload),
    sourceCoverage: sourceCoverageStatus(payload),
    details: [
      { label: '快照新鲜度', value: payload.freshness.status, roleScope: 'admin-scoped' },
      { label: '失败队列', value: String(failed), roleScope: 'admin-scoped' },
    ],
  });
}

function missingContextPanel(payload: GovernanceStatusPayload): AdminDataCenterPanel {
  const exclusions = payload.sourceCoverage?.exclusions ?? [];
  return panel({
    id: 'missing-context',
    title: '缺失上下文',
    metric: String(exclusions.length),
    readiness: exclusions.length > 0 ? 'degraded' : 'ready',
    sourceCoverage: sourceCoverageStatus(payload),
    details: limitPanelDetails(exclusions.map((exclusion) => ({
      label: exclusion.sourceId,
      value: `${exclusion.reason}: ${exclusion.rowCount}`,
      roleScope: exclusionRoleScope(exclusion.reason),
      restricted: true,
    })), GOVERNANCE_AUDIT_MAX_ROWS_PER_PANEL),
  });
}

function replayConfidencePanel(payload: GovernanceStatusPayload): AdminDataCenterPanel {
  const replay = replayStatus(payload);
  return panel({
    id: 'replay-confidence',
    title: '回放置信',
    metric: payload.featureCache
      ? `${payload.featureCache.totalSourceFacts} source facts`
      : 'unavailable',
    readiness: replay === 'ready' ? 'ready' : 'degraded',
    replay,
    sourceCoverage: sourceCoverageStatus(payload),
    details: [
      { label: '过期缓存', value: String(payload.featureCache?.staleEntries ?? 0), roleScope: 'admin-scoped' },
      { label: '重建次数', value: String(payload.featureCache?.totalRebuilds ?? 0), roleScope: 'admin-scoped' },
    ],
  });
}

function privacyStatusPanel(payload: GovernanceStatusPayload): AdminDataCenterPanel {
  const privacy = dataCenterPrivacy(payload);
  return panel({
    id: 'privacy-status',
    title: '隐私状态',
    metric: privacy,
    readiness: privacy === 'restricted' ? 'degraded' : 'ready',
    sourceCoverage: sourceCoverageStatus(payload),
    details: [
      {
        label: '受限来源',
        value: String(restrictedExclusionCount(payload)),
        roleScope: 'admin-scoped',
        restricted: restrictedExclusionCount(payload) > 0,
      },
    ],
  });
}

function evaluationEventsPanel(payload: GovernanceStatusPayload): AdminDataCenterPanel {
  const evaluation = evaluationStatus(payload);
  const hiddenOfficialEvaluationCount = (payload.sourceCoverage?.exclusions ?? []).filter((exclusion) =>
    exclusion.reason.includes('hidden_official_evaluation')
  ).length;
  return panel({
    id: 'evaluation-events',
    title: '评测事件',
    metric: evaluation,
    evaluation,
    readiness: evaluation === 'official' ? 'ready' : 'degraded',
    sourceCoverage: sourceCoverageStatus(payload),
    details: [
      {
        label: '隐藏正式评测',
        value: String(hiddenOfficialEvaluationCount),
        roleScope: 'audit-only',
        restricted: hiddenOfficialEvaluationCount > 0,
      },
    ],
  });
}

function panel(input: {
  id: AdminDataCenterPanelId;
  title: string;
  metric: string;
  readiness: PlatformReadinessStatus;
  sourceCoverage: PlatformSourceCoverageStatus;
  replay?: 'ready' | 'partial' | 'missing';
  evaluation?: 'official' | 'preview' | 'hidden';
  details: AdminDataCenterPanel['details'];
}): AdminDataCenterPanel {
  return {
    id: input.id,
    title: input.title,
    metric: input.metric,
    details: input.details,
    status: {
      id: `admin-data-center-${input.id}`,
      label: input.title,
      source: { domain: 'teacher-management', capability: 'teacher-admin-governance-workspaces-ui' },
      categories: {
        confidence: input.metric === 'unavailable' ? 'unknown' : 'medium',
        sourceCoverage: input.sourceCoverage,
        privacy: input.details.some((detail) => detail.restricted) ? 'restricted' : 'classroom',
        replay: input.replay ?? 'ready',
        protocol: 'current',
        evaluation: input.evaluation ?? 'preview',
        readiness: input.readiness,
        fallback: input.sourceCoverage === 'missing' ? 'fallback-missing-context' : 'none',
      },
    },
  };
}

function teacherReadiness(
  summary: TeacherResourceNodeSummary,
  blockingWarnings: number,
): PlatformReadinessStatus {
  if (blockingWarnings > 0 || summary.excludedNodes === summary.totalNodes && summary.totalNodes > 0) {
    return 'blocked';
  }
  if (summary.warningNodes > 0 || summary.excludedNodes > 0) return 'degraded';
  return 'ready';
}

function sourceCoverageStatus(payload: GovernanceStatusPayload): PlatformSourceCoverageStatus {
  const totals = payload.sourceCoverage?.totals;
  if (!totals) return 'missing';
  if (totals.totalRows === 0) return 'missing';
  if (totals.unsupportedRows === totals.totalRows) return 'unsupported';
  if (totals.unsupportedRows > 0 || totals.excludedRows > 0) return 'partial';
  return totals.eligibleRows === totals.totalRows ? 'complete' : 'partial';
}

function dataCenterReadiness(payload: GovernanceStatusPayload): PlatformReadinessStatus {
  const failed = Object.values(payload.queues).reduce((sum, queue) => sum + queue.failed, 0);
  if (payload.status === 'healthy' && failed === 0 && payload.freshness.status === 'fresh') return 'ready';
  return failed > 0 || payload.status !== 'healthy' || payload.freshness.status !== 'fresh' ? 'degraded' : 'ready';
}

function dataCenterPrivacy(payload: GovernanceStatusPayload): PlatformPrivacyStatus {
  if (restrictedExclusionCount(payload) > 0) return 'restricted';
  return 'classroom';
}

function replayStatus(payload: GovernanceStatusPayload): 'ready' | 'partial' | 'missing' {
  if (!payload.featureCache) return 'missing';
  return payload.featureCache.staleEntries > 0 ? 'partial' : 'ready';
}

function evaluationStatus(payload: GovernanceStatusPayload): 'official' | 'preview' | 'hidden' {
  const hidden = (payload.sourceCoverage?.exclusions ?? []).some((exclusion) =>
    exclusion.reason.includes('hidden_official_evaluation')
  );
  if (hidden) return 'hidden';
  return payload.sourceCatalog?.sources.some((source) => source.learningScope === 'official-evaluation')
    ? 'official'
    : 'preview';
}

function restrictedExclusionCount(payload: GovernanceStatusPayload): number {
  return (payload.sourceCoverage?.exclusions ?? []).filter((exclusion) =>
    exclusion.reason.includes('hidden') ||
    exclusion.reason.includes('private') ||
    exclusion.reason.includes('raw')
  ).length;
}

function exclusionRoleScope(reason: string): PlatformStatusRoleScope {
  if (reason.includes('hidden_official_evaluation')) return 'audit-only';
  if (reason.includes('private') || reason.includes('raw')) return 'system-internal';
  return 'admin-scoped';
}

function limitPanelDetails(
  details: AdminDataCenterPanel['details'],
  maxRows: number,
): AdminDataCenterPanel['details'] {
  if (details.length <= maxRows) return details;
  const visibleRows = Math.max(0, maxRows - 1);
  return [
    ...details.slice(0, visibleRows),
    {
      label: '其余排除项',
      value: `${details.length - visibleRows} 条已按聚合方式隐藏`,
      roleScope: 'admin-scoped',
      restricted: true,
    },
  ];
}
