/**
 * Layered graph workspace UI contracts (#1273).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  LAYERED_GRAPH_INSPECTOR_REGIONS,
  defaultLayeredGraphFilterMode,
} from '@/features/knowledge/layered-graph-workspace-contracts';
import {
  LAYERED_GRAPH_FILTER_MODES,
  buildLayeredGraphWorkspaceFilterState,
  layeredStatusLabel,
} from '@/lib/layered-graph/workspace';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('layered graph workspace UI contracts (#1273)', () => {
  it('exposes engineering-only, teaching-only, mixed, and all filter modes', () => {
    expect(LAYERED_GRAPH_FILTER_MODES).toEqual(
      expect.arrayContaining([
        'engineering-only',
        'teaching-only',
        'resources-only',
        'mixed',
        'all',
      ]),
    );
    expect(defaultLayeredGraphFilterMode()).toBe('mixed');

    const engineering = buildLayeredGraphWorkspaceFilterState('engineering-only');
    expect(engineering.showEngineering).toBe(true);
    expect(engineering.showTeachingPrerequisites).toBe(false);
    expect(engineering.showTeachingResources).toBe(false);

    const teaching = buildLayeredGraphWorkspaceFilterState('teaching-only');
    expect(teaching.showEngineering).toBe(false);
    expect(teaching.showTeachingPrerequisites).toBe(true);

    const mixed = buildLayeredGraphWorkspaceFilterState('mixed');
    expect(mixed.showEngineering).toBe(true);
    expect(mixed.showTeachingPrerequisites).toBe(true);
    expect(mixed.showTeachingResources).toBe(true);
  });

  it('keeps inspector regions for resources, prerequisites, projection, and fallback', () => {
    expect(LAYERED_GRAPH_INSPECTOR_REGIONS).toEqual(
      expect.arrayContaining([
        'engineering-relations',
        'teaching-prerequisites',
        'teaching-resources',
        'projection-identity',
        'fallback-provenance',
        'not-projected',
      ]),
    );
    expect(layeredStatusLabel('fallback')).toBe('兼容回退');
    expect(layeredStatusLabel('NOT_PROJECTED')).toBe('未投影到当前课程');
  });

  it('step knowledge drawer accepts layered entries and never treats card absence as node-not-found', () => {
    const drawer = readRepoFile(
      'src/features/interactive/shared/step-knowledge-drawer.tsx',
    );
    expect(drawer).toContain('layeredDrawerEntries');
    expect(drawer).toContain('data-card-status');
    expect(drawer).toContain('data-node-not-found');
    expect(drawer).toContain('studentMessage');
    expect(drawer).toContain('兼容来源');
  });

  it('unit-1-1 course pages wire layered resolver into StepKnowledgeDrawer', () => {
    const student = readRepoFile(
      'src/features/interactive/unit-1-1-see-the-full-picture/student-page.tsx',
    );
    const teacher = readRepoFile(
      'src/features/interactive/unit-1-1-see-the-full-picture/teacher-page.tsx',
    );
    const studentRoute = readRepoFile(
      'src/app/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]/page.tsx',
    );
    const teacherRoute = readRepoFile(
      'src/app/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/[sessionId]/page.tsx',
    );
    const consumers = readRepoFile('src/lib/layered-graph/consumers.ts');
    const pageContext = readRepoFile('src/lib/layered-graph/course-page-context.ts');

    expect(consumers).toContain('resolveCoursePageLayeredDrawerEntries');
    expect(consumers).toContain('resolveClassroomStepDrawerEntries');
    expect(pageContext).toContain('resolveCoursePageLayeredGraphContext');
    expect(student).toContain('resolveCoursePageLayeredDrawerEntries');
    expect(student).toContain('payload: layeredGraphPayload');
    expect(student).toContain('layeredDrawerEntries={layeredDrawerEntries}');
    expect(teacher).toContain('resolveCoursePageLayeredDrawerEntries');
    expect(teacher).toContain('payload: layeredGraphPayload');
    expect(teacher).toContain('layeredDrawerEntries={layeredDrawerEntries}');
    expect(studentRoute).toContain('resolveCoursePageLayeredGraphContext');
    expect(teacherRoute).toContain('resolveCoursePageLayeredGraphContext');
  });

  it('does not change engineering predicate rendering contracts', () => {
    const relationContract = readRepoFile(
      'src/features/knowledge/graph/relation-contract.ts',
    );
    // Existing engineering predicate contract module remains the source of truth.
    expect(relationContract).toContain('getKnowledgeGraphRelationContract');
    const workspace = readRepoFile(
      'src/lib/layered-graph/workspace.ts',
    );
    expect(workspace).toContain('selectLayeredGraphView');
    expect(workspace).toContain('Does not change engineering predicate rendering');
  });
});
