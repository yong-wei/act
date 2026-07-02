import type { TeacherResourceNodeView } from './teacher-resource-node-management';

export type AuthoringApiTaskObjectType = 'lesson-plan' | 'resource' | 'resource-node' | 'knowledge-node';

export type AuthoringApiTaskStatus =
  | 'available'
  | 'disabled'
  | 'pending'
  | 'saved'
  | 'failed'
  | 'rolled-back'
  | 'not-reversible';

export type AuthoringApiTaskReason =
  | 'none'
  | 'missing-metadata'
  | 'invalid-reference'
  | 'blocked-resource-node'
  | 'permission'
  | 'unsupported-rollback';

export interface AuthoringApiTask {
  id: string;
  objectType: AuthoringApiTaskObjectType;
  taskType: string;
  label: string;
  status: AuthoringApiTaskStatus;
  reason: AuthoringApiTaskReason;
  recoveryAction: string;
  href?: string;
}

export const AUTHORING_API_TASK_STATUSES: readonly AuthoringApiTaskStatus[] = [
  'available',
  'disabled',
  'pending',
  'saved',
  'failed',
  'rolled-back',
  'not-reversible',
];

export function authoringApiTaskStatusLabel(status: AuthoringApiTaskStatus): string {
  const labels: Record<AuthoringApiTaskStatus, string> = {
    available: '可执行',
    disabled: '不可执行',
    pending: '处理中',
    saved: '已保存',
    failed: '失败',
    'rolled-back': '已回滚',
    'not-reversible': '不可回滚',
  };
  return labels[status];
}

export function buildLessonPlanAuthoringTasks(input: {
  id: string;
  itemCount: number;
  canEdit: boolean;
  editHref: string;
}): AuthoringApiTask[] {
  const hasItems = input.itemCount > 0;
  return [
    task({
      id: `${input.id}:edit`,
      objectType: 'lesson-plan',
      taskType: 'edit',
      label: '编辑教案',
      status: input.canEdit ? 'available' : 'disabled',
      reason: input.canEdit ? 'none' : 'permission',
      recoveryAction: input.canEdit ? '打开编辑器' : '复制教案或联系作者',
      href: input.canEdit ? input.editHref : undefined,
    }),
    task({
      id: `${input.id}:validate-items`,
      objectType: 'lesson-plan',
      taskType: 'validate',
      label: '校验环节',
      status: hasItems ? 'saved' : 'disabled',
      reason: hasItems ? 'none' : 'missing-metadata',
      recoveryAction: hasItems ? '环节可用于上课' : '先添加至少一个教学环节',
    }),
    task({
      id: `${input.id}:start-class`,
      objectType: 'lesson-plan',
      taskType: 'start-class',
      label: '开始上课',
      status: hasItems ? 'available' : 'disabled',
      reason: hasItems ? 'none' : 'missing-metadata',
      recoveryAction: hasItems ? '创建课堂' : '补全教学环节后再开始',
    }),
    task({
      id: `${input.id}:archive`,
      objectType: 'lesson-plan',
      taskType: 'archive',
      label: '归档/删除',
      status: input.canEdit ? 'not-reversible' : 'disabled',
      reason: input.canEdit ? 'unsupported-rollback' : 'permission',
      recoveryAction: input.canEdit ? '删除前确认引用课堂' : '仅作者可处理',
    }),
  ];
}

export function buildTeachingResourceAuthoringTasks(input: {
  id: string;
  title: string;
  type: string;
  registryId: string | null;
  description: string | null;
  canPreview?: boolean;
  canEdit?: boolean;
  canAttach?: boolean;
  previewHref?: string;
  editState?: 'idle' | 'saving' | 'saved' | 'error';
}): AuthoringApiTask[] {
  const hasRegistry = Boolean(input.registryId);
  const hasDescription = Boolean(input.description?.trim());
  const canPreview = input.canPreview ?? (hasRegistry || hasDescription);
  const canEdit = input.canEdit ?? true;
  const canAttach = input.canAttach ?? hasRegistry;
  return [
    task({
      id: `${input.id}:preview`,
      objectType: 'resource',
      taskType: 'preview',
      label: '预览资源',
      status: canPreview ? 'available' : 'disabled',
      reason: canPreview ? 'none' : 'invalid-reference',
      recoveryAction: canPreview ? '检查资源展示' : '补充注册入口或描述',
      href: canPreview ? input.previewHref : undefined,
    }),
    task({
      id: `${input.id}:edit-metadata`,
      objectType: 'resource',
      taskType: 'edit-metadata',
      label: '编辑元数据',
      status: canEdit ? mutationStatus(input.editState) : 'disabled',
      reason: canEdit ? (input.editState === 'error' ? 'invalid-reference' : 'none') : 'permission',
      recoveryAction: canEdit
        ? (input.editState === 'error' ? '检查保存权限和字段' : '保存标题与说明')
        : '当前表面只读，请到资源编辑入口处理',
    }),
    task({
      id: `${input.id}:attach-lesson`,
      objectType: 'resource',
      taskType: 'attach',
      label: '加入教案',
      status: canAttach ? 'available' : 'disabled',
      reason: canAttach ? 'none' : (hasRegistry ? 'permission' : 'invalid-reference'),
      recoveryAction: canAttach ? '从教案编辑器引用' : (hasRegistry ? '当前表面不支持直接加入教案' : '先绑定 registryId'),
    }),
    task({
      id: `${input.id}:rollback`,
      objectType: 'resource',
      taskType: 'rollback',
      label: '回滚说明',
      status: 'not-reversible',
      reason: 'unsupported-rollback',
      recoveryAction: '资源元数据保存不提供一键回滚',
    }),
  ];
}

export function buildKnowledgeNodeAuthoringTasks(input: {
  id: string;
  name: string;
  description: string;
  sourceLinks: readonly unknown[];
  targetLinks: readonly unknown[];
  editState?: 'idle' | 'saving' | 'saved' | 'error';
}): AuthoringApiTask[] {
  const hasDescription = Boolean(input.description?.trim());
  const hasGraphLinks = input.sourceLinks.length + input.targetLinks.length > 0;
  return [
    task({
      id: `${input.id}:preview`,
      objectType: 'knowledge-node',
      taskType: 'preview',
      label: '预览知识卡',
      status: hasDescription ? 'available' : 'disabled',
      reason: hasDescription ? 'none' : 'missing-metadata',
      recoveryAction: hasDescription ? '检查学习说明' : '补充节点描述',
    }),
    task({
      id: `${input.id}:cite-resource`,
      objectType: 'knowledge-node',
      taskType: 'cite',
      label: '引用到资源',
      status: hasGraphLinks ? 'available' : 'disabled',
      reason: hasGraphLinks ? 'none' : 'invalid-reference',
      recoveryAction: hasGraphLinks ? '用于资源或教案引用' : '先建立图谱关系',
    }),
    task({
      id: `${input.id}:edit-metadata`,
      objectType: 'knowledge-node',
      taskType: 'edit-metadata',
      label: '保存元数据',
      status: mutationStatus(input.editState),
      reason: input.editState === 'error' ? 'invalid-reference' : 'none',
      recoveryAction: input.editState === 'error' ? '检查节点权限和字段' : '保存节点名称、描述和 metadata',
    }),
    task({
      id: `${input.id}:rollback`,
      objectType: 'knowledge-node',
      taskType: 'rollback',
      label: '回滚说明',
      status: 'not-reversible',
      reason: 'unsupported-rollback',
      recoveryAction: '知识节点编辑不提供一键回滚',
    }),
  ];
}

export function buildResourceNodeAuthoringTasks(input: {
  node: TeacherResourceNodeView;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
}): AuthoringApiTask[] {
  const { node } = input;
  const blocked = !node.audit.pathEligible;
  return [
    task({
      id: `${node.id}:inspect-mapping`,
      objectType: 'resource-node',
      taskType: 'inspect',
      label: '审查映射',
      status: 'available',
      reason: 'none',
      recoveryAction: '查看知识、能力、引用和证据映射',
    }),
    task({
      id: `${node.id}:resolve-blocked`,
      objectType: 'resource-node',
      taskType: 'resolve-blocked',
      label: '处理阻断',
      status: blocked ? (node.editable ? 'available' : 'disabled') : 'saved',
      reason: blocked ? (node.editable ? 'blocked-resource-node' : 'permission') : 'none',
      recoveryAction: blocked ? '补齐规划元数据或调整教师策略' : '路径资格已通过',
    }),
    task({
      id: `${node.id}:save-planning`,
      objectType: 'resource-node',
      taskType: 'save',
      label: '保存规划元数据',
      status: node.editable ? mutationStatus(input.saveState) : 'disabled',
      reason: node.editable ? (input.saveState === 'error' ? 'invalid-reference' : 'none') : 'permission',
      recoveryAction: node.editable ? '保存 ResourceNode 规划字段' : '该来源只读，不能保存规划字段',
    }),
    task({
      id: `${node.id}:rollback`,
      objectType: 'resource-node',
      taskType: 'rollback',
      label: '回滚说明',
      status: 'not-reversible',
      reason: 'unsupported-rollback',
      recoveryAction: 'ResourceNode 规划元数据保存后需再次编辑修正',
    }),
  ];
}

function mutationStatus(state: 'idle' | 'saving' | 'saved' | 'error' | undefined): AuthoringApiTaskStatus {
  if (state === 'saving') return 'pending';
  if (state === 'saved') return 'saved';
  if (state === 'error') return 'failed';
  return 'available';
}

function task(input: AuthoringApiTask): AuthoringApiTask {
  return input;
}
