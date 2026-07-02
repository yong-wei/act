import { describe, expect, it } from 'vitest';

import {
  AUTHORING_API_TASK_STATUSES,
  buildKnowledgeNodeAuthoringTasks,
  buildLessonPlanAuthoringTasks,
  buildResourceNodeAuthoringTasks,
  buildTeachingResourceAuthoringTasks,
} from '../authoring-api-task-consumption';
import type { TeacherResourceNodeView } from '../teacher-resource-node-management';

describe('authoring API task consumption contract', () => {
  it('defines the required task state taxonomy', () => {
    expect(AUTHORING_API_TASK_STATUSES).toEqual([
      'available',
      'disabled',
      'pending',
      'saved',
      'failed',
      'rolled-back',
      'not-reversible',
    ]);
  });

  it('taskizes lesson plans with edit, validation, start, and irreversible archive states', () => {
    const tasks = buildLessonPlanAuthoringTasks({
      id: 'plan-empty',
      itemCount: 0,
      canEdit: true,
      editHref: '/teacher/lesson-plans/plan-empty/edit',
    });

    expect(tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectType: 'lesson-plan', taskType: 'edit', status: 'available' }),
      expect.objectContaining({ taskType: 'validate', status: 'disabled', reason: 'missing-metadata' }),
      expect.objectContaining({ taskType: 'start-class', status: 'disabled', recoveryAction: '补全教学环节后再开始' }),
      expect.objectContaining({ taskType: 'archive', status: 'not-reversible', reason: 'unsupported-rollback' }),
    ]));
  });

  it('taskizes teaching resources with registry-backed attach and save failure states', () => {
    const tasks = buildTeachingResourceAuthoringTasks({
      id: 'resource-1',
      title: 'Bode 练习',
      type: 'INTERACTIVE_COMP',
      registryId: null,
      description: null,
      canPreview: false,
      canEdit: false,
      canAttach: false,
      editState: 'error',
    });

    expect(tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskType: 'preview', status: 'disabled', reason: 'invalid-reference' }),
      expect.objectContaining({ taskType: 'edit-metadata', status: 'disabled', reason: 'permission' }),
      expect.objectContaining({ taskType: 'attach', status: 'disabled', reason: 'invalid-reference' }),
      expect.objectContaining({ taskType: 'rollback', status: 'not-reversible' }),
    ]));
  });

  it('taskizes ResourceNodes with blocked-state recovery and save lifecycle states', () => {
    const node = {
      id: 'teaching-resource:blocked',
      title: 'Blocked resource',
      editable: true,
      audit: { pathEligible: false },
    } as TeacherResourceNodeView;
    const tasks = buildResourceNodeAuthoringTasks({ node, saveState: 'saving' });

    expect(tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskType: 'inspect', status: 'available' }),
      expect.objectContaining({ taskType: 'resolve-blocked', status: 'available', reason: 'blocked-resource-node' }),
      expect.objectContaining({ taskType: 'save', status: 'pending' }),
      expect.objectContaining({ taskType: 'rollback', status: 'not-reversible' }),
    ]));
  });

  it('taskizes knowledge nodes with metadata and graph-reference recovery states', () => {
    const tasks = buildKnowledgeNodeAuthoringTasks({
      id: 'kn-1',
      name: '空节点',
      description: '',
      sourceLinks: [],
      targetLinks: [],
      editState: 'saved',
    });

    expect(tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskType: 'preview', status: 'disabled', reason: 'missing-metadata' }),
      expect.objectContaining({ taskType: 'cite', status: 'disabled', reason: 'invalid-reference' }),
      expect.objectContaining({ taskType: 'edit-metadata', status: 'saved' }),
      expect.objectContaining({ taskType: 'rollback', status: 'not-reversible' }),
    ]));
  });
});
