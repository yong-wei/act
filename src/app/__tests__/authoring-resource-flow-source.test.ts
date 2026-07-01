import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('authoring resource flow source contracts', () => {
  it('keeps lesson plan lists searchable and bad edit links recoverable', () => {
    const listSource = readSource('src/features/lesson-engine/lesson-plan-list.tsx');
    const recoverySource = readSource('src/features/lesson-engine/lesson-plan-missing-recovery.tsx');
    const teacherEditSource = readSource('src/app/teacher/lesson-plans/[id]/edit/page.tsx');
    const adminEditSource = readSource('src/app/admin/lesson-plans/[id]/edit/page.tsx');
    const teacherNewSource = readSource('src/app/teacher/lesson-plans/new/page.tsx');
    const adminNewSource = readSource('src/app/admin/lesson-plans/new/page.tsx');
    const builderSource = readSource('src/features/lesson-engine/orchestrator-builder.tsx');
    const templateCloneSource = readSource('src/features/lesson-engine/preset-template-clone-redirect.tsx');

    expect(listSource).toContain('aria-label="搜索教案"');
    expect(listSource).toContain('显示 {visiblePlans.length} / {localPlans.length} 个教案');
    expect(recoverySource).toContain('返回教案列表');
    expect(teacherEditSource).toContain('<LessonPlanMissingRecovery');
    expect(adminEditSource).toContain('<LessonPlanMissingRecovery');
    expect(teacherEditSource).toContain("['/teacher', '/playlists']");
    expect(adminEditSource).toContain("['/admin', '/playlists']");
    expect(teacherNewSource).toContain('ALL_PRESETS.find((preset) => preset.key === requestedTemplateId)');
    expect(adminNewSource).toContain('ALL_PRESETS.find((preset) => preset.key === requestedTemplateId)');
    expect(teacherNewSource).toContain('<PresetTemplateCloneRedirect');
    expect(adminNewSource).toContain('<PresetTemplateCloneRedirect');
    expect(teacherNewSource).toContain('editBaseHref="/teacher/lesson-plans"');
    expect(adminNewSource).toContain('editBaseHref="/admin/lesson-plans"');
    expect(templateCloneSource).toContain("fetch('/api/teacher/preset-lessons/clone'");
    expect(templateCloneSource).toContain('const inFlightCloneRequests = new Map');
    expect(templateCloneSource).not.toContain('sessionStorage');
    expect(templateCloneSource).toContain('window.location.replace(target)');
    expect(adminNewSource).toContain('templateRecoveryHref="/admin/lesson-plans"');
    expect(builderSource).toContain('missingTemplateId');
    expect(builderSource).toContain('重新选择模板');
  });

  it('keeps ResourceNode authoring management query-driven and paged', () => {
    const source = readSource('src/features/teacher/resources/teacher-resource-node-management.tsx');
    const resourceEditSource = readSource('src/features/teacher/resources/resource-edit-dialog.tsx');
    const knowledgeNodeSource = readSource('src/features/teacher/resources/knowledge-node-manager.tsx');

    expect(source).toContain("useSearchParams");
    expect(source).toContain("searchParams.get('status')");
    expect(source).toContain("initialStatus === 'blocked'");
    expect(source).toContain('RESOURCE_NODE_PAGE_SIZE');
    expect(source).toContain('加载更多');
    expect(source).toContain('ariaLabel="筛选 ResourceNode 类型"');
    expect(source).toContain('aria-label={`查看 ResourceNode：${node.title}`}');
    expect(source).toContain('aria-label="加载更多 ResourceNode"');
    expect(resourceEditSource).toContain('使用影响');
    expect(knowledgeNodeSource).toContain('KNOWLEDGE_TREE_PAGE_SIZE');
    expect(knowledgeNodeSource).toContain('加入课程流');
    expect(knowledgeNodeSource).toContain('折叠知识节点');
    expect(knowledgeNodeSource).toContain('aria-label="加载更多知识节点"');
  });

  it('taskizes authoring API data across lesson plan, resource, ResourceNode, and knowledge-node surfaces', () => {
    const listSource = readSource('src/features/lesson-engine/lesson-plan-list.tsx');
    const interactiveSource = readSource('src/features/teacher/resources/interactive-resource-list.tsx');
    const classroomSource = readSource('src/features/teacher/resources/classroom-component-list.tsx');
    const resourceNodeSource = readSource('src/features/teacher/resources/teacher-resource-node-management.tsx');
    const knowledgeNodeSource = readSource('src/features/teacher/resources/knowledge-node-manager.tsx');
    const taskStripSource = readSource('src/features/teacher/resources/authoring-api-task-strip.tsx');
    const contractSource = readSource('src/lib/authoring-api-task-consumption.ts');
    const reportSource = readSource('artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/report.md');

    expect(listSource).toContain('buildLessonPlanAuthoringTasks');
    expect(listSource).toContain('surface="lesson-plan"');
    expect(interactiveSource).toContain('buildTeachingResourceAuthoringTasks');
    expect(interactiveSource).toContain('resourceSaveState');
    expect(interactiveSource).toContain('canAttach: false');
    expect(interactiveSource).toContain('previewHref: `/interactive-learning/resources/${encodeURIComponent(resource.id)}`');
    expect(classroomSource).toContain('buildTeachingResourceAuthoringTasks');
    expect(classroomSource).toContain('canEdit: false');
    expect(classroomSource).toContain('canAttach: false');
    expect(resourceNodeSource).toContain('buildResourceNodeAuthoringTasks');
    expect(resourceNodeSource).toContain('API 任务消费');
    expect(knowledgeNodeSource).toContain('buildKnowledgeNodeAuthoringTasks');
    expect(knowledgeNodeSource).toContain('nodeSaveState');
    expect(knowledgeNodeSource).not.toContain('limit={3}');
    expect(taskStripSource).toContain('data-authoring-api-task-surface={surface}');
    expect(taskStripSource).toContain("'data-authoring-api-task-state': task.status");
    expect(taskStripSource).toContain("'data-authoring-api-task-reason': task.reason");
    expect(taskStripSource).toContain('return task.href ? (');
    expect(contractSource).toContain("'rolled-back'");
    expect(contractSource).toContain("'not-reversible'");
    expect(contractSource).toContain("'blocked-resource-node'");
    expect(reportSource).toContain('2026-07-02 / #754');
    expect(reportSource).toContain('不重复关闭课程流保存/播放、图谱筛选、移动构建器或按钮命名范围');
  });

  it('keeps interactive course catalog search bound to the q query', () => {
    const source = readSource('src/app/interactive-learning/courses/page.tsx');

    expect(source).toContain('searchParams?: Promise<{ q?: string | string[] }>');
    expect(source).toContain('function normalizeSearchQuery');
    expect(source).toContain('Array.isArray(value) ? value[0] : value');
    expect(source).toContain('function moduleMatchesQuery');
    expect(source).toContain('module.chipLabel');
    expect(source).toContain('moduleMatched');
    expect(source).toContain('defaultValue={searchQuery}');
    expect(source).toContain('显示 {visibleLessonCount} 个课程入口');
    expect(source).toContain('没有匹配“{searchQuery}”的互动课程');
  });

  it('preserves playlist and knowledge-node follow-up intent', () => {
    const builderSource = readSource('src/features/knowledge/playlist-builder.tsx');
    const playSource = readSource('src/app/playlists/[id]/play/page.tsx');
    const graphSource = readSource('src/features/knowledge/knowledge-graph-system.tsx');
    const panelSource = readSource('src/features/knowledge/resource-panel/resource-panel.tsx');
    const launcherSource = readSource('src/features/knowledge/playlist-play-launcher.tsx');

    expect(builderSource).toContain('initialNodeId');
    expect(builderSource).toContain('/api/knowledge/nodes?source=db');
    expect(builderSource).toContain('/play?intent=start-class');
    expect(builderSource).toContain('KNOWLEDGE_NODE_PAGE_SIZE');
    expect(builderSource).toContain('data-playlist-builder-mobile-steps="library-selection-then-course-flow"');
    expect(builderSource).toContain('setFlowStatusMessage');
    expect(builderSource).not.toContain("alert('请输入标题')");
    expect(builderSource).toContain('aria-label={`上移：${item.nodeName}`}');
    expect(builderSource).toContain('aria-label={`移除：${item.nodeName}`}');
    expect(playSource).toContain('<PlaylistPlayLauncher');
    expect(playSource).toContain('data-playlist-play-recovery="unavailable"');
    expect(playSource).toContain('课程流不存在或当前账号不可见。');
    expect(playSource).not.toContain('notFound()');
    expect(playSource).toContain('!plan.isPublic && !isAdmin && !isAuthor');
    expect(playSource).toContain('editHref={editHref}');
    expect(playSource).toContain('canStartClass={canStartClass}');
    expect(graphSource).toContain("params.get('node') ?? params.get('nodeId')");
    expect(graphSource).toContain('aria-label={`${item.label}工具`}');
    expect(graphSource).toContain('data-knowledge-mobile-filter-group="density-mode"');
    expect(graphSource).toContain('data-knowledge-mobile-filter-group="relation-types"');
    expect(graphSource).toContain('data-knowledge-mobile-filter-group="advanced-thresholds"');
    expect(panelSource).toContain('data-resource-node-action="add-to-course-flow"');
    expect(panelSource).toContain('data-resource-node-action="create-learning-task"');
    expect(panelSource).toContain('intent=contextual-recommendation');
    expect(launcherSource).toContain('try {');
    expect(launcherSource).toContain('课程流启动失败，请检查网络后重试');
  });

  it('keeps data-governance authoring links on report context instead of generic overview', () => {
    const pageSource = readSource('src/app/admin/data-governance/page.tsx');
    const dashboardSource = readSource('src/features/admin/data-governance-dashboard.tsx');
    const statusSource = readSource('src/app/api/admin/data-governance/status/route.ts');

    expect(pageSource).toContain('lessonPlanId?: string');
    expect(dashboardSource).toContain("initialActionQuery?.surface === 'authoring'");
    expect(dashboardSource).toContain('data-admin-governance-authoring-surface="quality-reports"');
    expect(dashboardSource).toContain('查看质量报告');
    expect(statusSource).toContain('authoringContext');
    expect(statusSource).toContain('lessonPlanMissing');
    expect(dashboardSource).toContain('目标教案 ${authoringLessonPlanId} 当前不存在');
  });
});
