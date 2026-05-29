import type {
  PlatformRole,
  PlatformStatusPayload,
  PlatformStatusRoleScope,
} from '@/components/platform/platform-ui-contracts';
import type {
  ResourceNode,
  ResourceNodeAuditIssue,
  ResourceNodeSourceKind,
  ResourceNodeSourceOwner,
} from '@/lib/resource-node-registry';

export type ResourceNodeWorkspaceRegion =
  | 'graph-stage'
  | 'resource-list'
  | 'detail-panel'
  | 'related-resources'
  | 'mapping-warnings'
  | 'launch-actions';

export type ResourceNodeWorkspaceMode = 'legacy-knowledge-graph' | 'resource-node-workspace';

export type ResourceNodeLaunchActionKind =
  | 'direct-route'
  | 'registry-resource'
  | 'feature-owned-launcher'
  | 'unavailable';

export interface ResourceNodeWorkspaceState {
  mode: ResourceNodeWorkspaceMode;
  activeFeatureFlag: string;
  regions: ResourceNodeWorkspaceRegion[];
  status: PlatformStatusPayload;
}

export interface ResourceNodeWorkspaceStateInput {
  featureFlags: readonly string[];
  selectedNode?: ResourceNode | null;
}

export interface ResourceNodeDetailField {
  id:
    | 'source-reference'
    | 'knowledge-coverage'
    | 'prerequisites'
    | 'availability'
    | 'privacy-level'
    | 'teacher-policy'
    | 'evidence-instrumentation'
    | 'path-eligibility'
    | 'source-of-record';
  label: string;
  value: string;
  roleScope: PlatformStatusRoleScope;
}

export interface ResourceNodeWorkspaceWarning {
  code: ResourceNodeAuditIssue['code'];
  message: string;
  severity: ResourceNodeAuditIssue['severity'];
  roleScope: PlatformStatusRoleScope;
}

export interface ResourceNodeDetailView {
  nodeId: string;
  title: string;
  role: PlatformRole;
  fields: ResourceNodeDetailField[];
  warnings: ResourceNodeWorkspaceWarning[];
  status: PlatformStatusPayload;
}

export interface ResourceNodeLaunchAction {
  kind: ResourceNodeLaunchActionKind;
  label: string;
  href: string | null;
  owner: ResourceNodeSourceKind | ResourceNodeSourceOwner;
  registryId?: string;
  disabledReason?: string;
}

export interface ResourceNodeWorkspaceMigrationContract {
  legacySurface: 'KnowledgeGraphSystem' | 'ResourcePanel' | 'KnowledgeSidebar';
  platformPrimitive: 'PlatformStatusPayload' | 'PlatformNavigationItem' | 'ResourceNode';
  migrationRule: string;
  preserves: string;
}

export const RESOURCE_NODE_WORKSPACE_FEATURE_FLAG = 'knowledge.resourceNodeWorkspace';

export const RESOURCE_NODE_WORKSPACE_REGIONS: ResourceNodeWorkspaceRegion[] = [
  'graph-stage',
  'resource-list',
  'detail-panel',
  'related-resources',
  'mapping-warnings',
  'launch-actions',
];

const LEGACY_REGIONS: ResourceNodeWorkspaceRegion[] = ['graph-stage', 'detail-panel'];

export function buildResourceNodeWorkspaceState(input: ResourceNodeWorkspaceStateInput): ResourceNodeWorkspaceState {
  const enabled = input.featureFlags.includes(RESOURCE_NODE_WORKSPACE_FEATURE_FLAG);

  if (!enabled) {
    return {
      mode: 'legacy-knowledge-graph',
      activeFeatureFlag: RESOURCE_NODE_WORKSPACE_FEATURE_FLAG,
      regions: LEGACY_REGIONS,
      status: {
        id: 'resource-node-workspace-legacy-fallback',
        label: '知识图谱兼容模式',
        source: { domain: 'resource-node', capability: 'knowledge-workspace' },
        summary: 'ResourceNode 面板未启用，保留现有知识图谱和资源面板探索行为。',
        categories: {
          confidence: 'high',
          sourceCoverage: 'partial',
          privacy: 'public',
          replay: 'ready',
          protocol: 'current',
          evaluation: 'not-evaluated',
          readiness: 'ready',
          fallback: 'fallback-active',
        },
      },
    };
  }

  return {
    mode: 'resource-node-workspace',
    activeFeatureFlag: RESOURCE_NODE_WORKSPACE_FEATURE_FLAG,
    regions: RESOURCE_NODE_WORKSPACE_REGIONS,
    status: resourceNodeStatus(input.selectedNode ?? null),
  };
}

export function buildResourceNodeDetailView(node: ResourceNode, role: PlatformRole): ResourceNodeDetailView {
  return {
    nodeId: node.id,
    title: node.title,
    role,
    fields: buildDetailFields(node, role),
    warnings: buildWarnings(node, role),
    status: resourceNodeStatus(node),
  };
}

export function buildResourceNodeLaunchAction(node: ResourceNode): ResourceNodeLaunchAction {
  const registryRef = node.sourceRefs.find((source) => source.kind === 'resource_registry');
  if (registryRef) {
    return {
      kind: 'registry-resource',
      label: `启动 ${node.title}`,
      href: node.launchTarget ?? node.renderTarget,
      owner: 'resource_registry',
      registryId: registryRef.ref,
      disabledReason: node.launchTarget || node.renderTarget ? undefined : '等待资源注册入口提供启动路由。',
    };
  }

  const href = node.launchTarget ?? node.renderTarget;
  if (href) {
    return {
      kind: isFeatureOwnedSource(node.sourceKind) ? 'feature-owned-launcher' : 'direct-route',
      label: `打开 ${node.title}`,
      href,
      owner: node.sourceOfRecord.content,
    };
  }

  return {
    kind: 'unavailable',
    label: `打开 ${node.title}`,
    href: null,
    owner: node.sourceOfRecord.content,
    disabledReason: '缺少可渲染或可启动入口。',
  };
}

export function getResourceNodeWorkspaceMigrationContracts(): ResourceNodeWorkspaceMigrationContract[] {
  return [
    {
      legacySurface: 'KnowledgeGraphSystem',
      platformPrimitive: 'ResourceNode',
      migrationRule: 'Graph node selection MAY enrich the current selected node with ResourceNode detail when the feature flag is enabled.',
      preserves: 'Current graph filters, relation filtering, chapter grouping, search, label mode, and node selection remain usable.',
    },
    {
      legacySurface: 'ResourcePanel',
      platformPrimitive: 'PlatformStatusPayload',
      migrationRule: 'ResourceNode detail panels SHALL render coverage, privacy, eligibility, and audit warnings through shared platform status payloads.',
      preserves: 'Existing knowledge card, MDX, infograph, and related-node browsing remain available during the flagged rollout.',
    },
    {
      legacySurface: 'KnowledgeSidebar',
      platformPrimitive: 'PlatformNavigationItem',
      migrationRule: 'Workspace navigation MAY expose graph, resource list, warnings, and launch actions as role-scoped navigation items.',
      preserves: 'Sidebar search and category filtering continue to operate against the existing knowledge graph source.',
    },
  ];
}

function buildDetailFields(node: ResourceNode, role: PlatformRole): ResourceNodeDetailField[] {
  const fields: ResourceNodeDetailField[] = [
    {
      id: 'source-reference',
      label: '来源引用',
      value: node.sourceRefs.map((source) => `${source.kind}:${source.ref}`).join(', '),
      roleScope: 'student-visible',
    },
    {
      id: 'knowledge-coverage',
      label: '知识覆盖',
      value: node.planningMetadata.knowledgeCoverage.join(', ') || '未映射',
      roleScope: 'student-visible',
    },
    {
      id: 'prerequisites',
      label: '前置节点',
      value: node.planningMetadata.prerequisites.join(', ') || '无',
      roleScope: 'student-visible',
    },
    {
      id: 'availability',
      label: '可用性',
      value: node.planningMetadata.availability,
      roleScope: 'student-visible',
    },
    {
      id: 'privacy-level',
      label: '隐私级别',
      value: node.planningMetadata.privacyLevel,
      roleScope: privacyRoleScope(node.planningMetadata.privacyLevel),
    },
    {
      id: 'teacher-policy',
      label: '教师策略',
      value: node.planningMetadata.teacherPolicy,
      roleScope: node.planningMetadata.teacherPolicy === 'allowed' ? 'student-visible' : 'teacher-scoped',
    },
    {
      id: 'evidence-instrumentation',
      label: '证据采集',
      value: node.planningMetadata.evidenceInstrumentation.join(', ') || '未配置',
      roleScope: 'student-visible',
    },
    {
      id: 'path-eligibility',
      label: '路径可规划',
      value: node.eligibility.pathEligible ? '可纳入路径' : '暂不可纳入路径；可见告警会说明当前角色可处理的原因。',
      roleScope: 'student-visible',
    },
  ];

  if (role === 'audit') {
    fields.push({
      id: 'source-of-record',
      label: '真源归属',
      value: [
        `content:${node.sourceOfRecord.content}`,
        `catalog:${node.sourceOfRecord.catalogMetadata}`,
        `planning:${node.sourceOfRecord.planningMetadata}`,
      ].join(', '),
      roleScope: 'audit-only',
    });
  }

  return fields.filter((field) => isVisibleForRole(field.roleScope, role));
}

function buildWarnings(node: ResourceNode, role: PlatformRole): ResourceNodeWorkspaceWarning[] {
  return node.eligibility.auditIssues
    .map((issue) => ({
      code: issue.code,
      message: issue.message,
      severity: issue.severity,
      roleScope: warningRoleScope(issue),
    }))
    .filter((warning) => isVisibleForRole(warning.roleScope, role));
}

function resourceNodeStatus(node: ResourceNode | null): PlatformStatusPayload {
  if (!node) {
    return {
      id: 'resource-node-workspace-empty',
      label: '未选择资源',
      source: { domain: 'resource-node', capability: 'knowledge-workspace' },
      summary: '选择知识节点或资源后显示 ResourceNode 映射状态。',
      categories: {
        confidence: 'unknown',
        sourceCoverage: 'missing',
        privacy: 'public',
        replay: 'unsupported',
        protocol: 'current',
        evaluation: 'not-evaluated',
        readiness: 'not-ready',
        fallback: 'fallback-missing-context',
      },
    };
  }

  const hasBlockingIssue = node.eligibility.auditIssues.some((issue) => issue.severity === 'blocking');
  const hasWarnings = node.eligibility.auditIssues.length > 0;
  const hasCleanCoverage = node.eligibility.pathEligible && !hasWarnings;
  return {
    id: `${node.id}:resource-node-workspace-status`,
    label: 'ResourceNode 映射',
    source: { domain: 'resource-node', capability: 'knowledge-workspace' },
    summary: node.eligibility.pathEligible
      ? '该资源可进入学习路径规划。'
      : '该资源暂不可进入学习路径规划；可见告警会说明当前角色可处理的原因。',
    details: [
      { label: '节点类型', value: node.type, roleScope: 'student-visible' },
      { label: '来源', value: `${node.sourceKind}:${node.sourceRef}`, roleScope: 'student-visible' },
    ],
    categories: {
      confidence: hasCleanCoverage ? 'high' : hasWarnings ? 'medium' : 'unknown',
      sourceCoverage: hasCleanCoverage ? 'complete' : hasWarnings ? 'partial' : 'missing',
      privacy: node.planningMetadata.privacyLevel === 'student-visible' ? 'public' : 'restricted',
      replay: 'ready',
      protocol: 'current',
      evaluation: 'not-evaluated',
      readiness: hasBlockingIssue ? 'blocked' : hasCleanCoverage ? 'ready' : 'degraded',
      fallback: hasCleanCoverage ? 'none' : 'fallback-missing-context',
    },
  };
}

function warningRoleScope(issue: ResourceNodeAuditIssue): PlatformStatusRoleScope {
  if (issue.code === 'missing-privacy-policy' || issue.code === 'unavailable-resource') return 'teacher-scoped';
  if (issue.severity === 'blocking') return 'student-visible';
  return 'audit-only';
}

function privacyRoleScope(privacyLevel: ResourceNode['planningMetadata']['privacyLevel']): PlatformStatusRoleScope {
  if (privacyLevel === 'student-visible') return 'student-visible';
  if (privacyLevel === 'teacher-scoped') return 'teacher-scoped';
  return 'admin-scoped';
}

function isVisibleForRole(scope: PlatformStatusRoleScope, role: PlatformRole): boolean {
  if (scope === 'student-visible') return true;
  if (scope === 'teacher-scoped') return role === 'teacher' || role === 'admin' || role === 'audit';
  if (scope === 'admin-scoped') return role === 'admin' || role === 'audit';
  if (scope === 'audit-only') return role === 'audit';
  return role === 'audit';
}

function isFeatureOwnedSource(sourceKind: ResourceNodeSourceKind): boolean {
  return sourceKind === 'simulation_resource' ||
    sourceKind === 'arena_task' ||
    sourceKind === 'runtime_lesson_step' ||
    sourceKind === 'runtime_lesson_media' ||
    sourceKind === 'ai_intervention';
}
