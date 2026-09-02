import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { STUDENT_DTO_FORBIDDEN_FIELDS } from '@/lib/assignments/public-api';
import { deriveStudentAssignmentPresentation } from '@/lib/assignments/submission-dto';

const ROOT = process.cwd();

const LIFECYCLE_ROUTE_ROOTS = [
  'src/app/api/teacher/assignments',
  'src/app/api/student/assignments',
  'src/app/api/assignments',
  'src/app/api/student/submission-objects',
] as const;

const HANDOFF = [
  '/__tests__/',
] as const;

const FORBIDDEN = [
  "@/lib/prisma",
  "@/lib/assignments/assignment-service",
  "@/lib/assignments/submission-service",
  "@/lib/assignments/assignment-content-assets",
  "@/lib/assignments/assignment-question-catalog",
  "@/lib/assignments/assignment-review",
  "@/lib/assignments/assignment-domain",
  "@/lib/assignments/submission-domain",
  "@/lib/assignments/assignment-rubric-generation",
  "@/lib/assignments/submission-object-store",
  "@/lib/data-governance/teacher-assignment-review",
  "@/lib/data-governance/assignment-grading-orchestration",
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) walk(rel, acc);
    else if (rel.endsWith('route.ts')) acc.push(rel);
  }
  return acc;
}

function isHandoff(path: string): boolean {
  return HANDOFF.some((token) => path.includes(token));
}

describe('assignment lifecycle public API', () => {
  it('keeps lifecycle routes off Prisma and private assignment helpers', () => {
    const routes = LIFECYCLE_ROUTE_ROOTS.flatMap((root) => walk(root)).filter((path) => !isHandoff(path));
    expect(routes.length).toBeGreaterThan(10);
    const violations: string[] = [];
    for (const path of routes) {
      const source = readFileSync(join(ROOT, path), 'utf8');
      if (!source.includes('@/lib/assignments/public-api')) {
        violations.push(`missing-public-api:${path}`);
      }
      for (const token of FORBIDDEN) {
        if (source.includes(token)) violations.push(`${token}:${path}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('owns teacher assignment lookup instead of leaving it in the route', () => {
    const source = readFileSync(join(ROOT, 'src/lib/assignments/public-api.ts'), 'utf8');
    expect(source).toContain('export async function teacherGetAssignment');
    expect(source).toContain('export async function teacherListManagedClasses');
    expect(source).toContain('export async function studentReadFeedbackAsset');
    expect(source).toContain('export async function teacherApproveReview');
    expect(source).toContain('export async function teacherListAssignmentSubmissions');
    expect(source).toContain('export async function teacherGenerateRubricGuidelines');
    expect(source).not.toContain("from '@/app/api/");
  });

  it('routes remaining production consumers through the public API', () => {
    const workshop = readFileSync(join(ROOT, 'src/features/ai/ai-workshop-collections.server.ts'), 'utf8');
    expect(workshop).toContain("from '@/lib/assignments/public-api'");
    expect(workshop).toContain('studentListAssignments');
    expect(workshop).not.toContain("from '@/lib/assignments/submission-service'");
    expect(workshop).not.toContain("from '@/lib/assignments/submission-dto'");

    const catalog = readFileSync(join(ROOT, 'src/lib/assignments/assignment-question-catalog.ts'), 'utf8');
    expect(catalog).toContain("from '@/features/assessment/public-api'");
    expect(catalog).not.toContain('prisma.adaptiveAssessmentItemRef');
    expect(catalog).not.toContain("from '@/lib/prisma'");
    expect(catalog).not.toContain("from '@/features/assessment/adaptive-assessment-item-catalog'");

    const owner = readFileSync(join(ROOT, 'src/lib/assignments/public-api.ts'), 'utf8')
      + readFileSync(join(ROOT, 'src/lib/assignments/assignment-question-catalog.ts'), 'utf8');
    expect(owner).not.toContain('learningFact.create');
    expect(owner).not.toContain("from '@/features/learning-record");
    expect(owner).not.toContain('@/lib/data-governance/assignment-grading-orchestration');
    expect(readFileSync(join(ROOT, 'src/lib/data-governance/index.ts'), 'utf8'))
      .not.toContain('assignment-grading-orchestration');
    expect(readFileSync(join(ROOT, 'scripts/workers/math-document-grading-worker.ts'), 'utf8'))
      .toContain("src/lib/assignments/public-api");
    expect(readFileSync(join(ROOT, 'scripts/workers/math-document-grading-worker.ts'), 'utf8'))
      .not.toContain('assignment-grading-orchestration');
  });

  it('omits teacher-only fields from student presentation DTOs', () => {
    const presented = deriveStudentAssignmentPresentation({
      persistedState: 'IN_PROGRESS',
      dueAt: new Date('2099-01-01T00:00:00.000Z'),
      now: new Date('2026-01-01T00:00:00.000Z'),
      lateClosed: false,
    });
    const serialized = JSON.stringify(presented);
    for (const field of STUDENT_DTO_FORBIDDEN_FIELDS) {
      expect(serialized).not.toContain(field);
    }
  });

  it('fails closed on a missing teacher assignment without leaking another identity', () => {
    const source = readFileSync(join(ROOT, 'src/lib/assignments/public-api.ts'), 'utf8');
    expect(source).toContain("throw new AssignmentDomainError('assignment-not-found')");
    expect(source).toContain("throw new SubmissionError('reviewed-asset-not-found', 404)");
  });
});
