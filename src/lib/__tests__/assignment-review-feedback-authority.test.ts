import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const REVIEW_ROUTE_ROOTS = [
  'src/app/api/teacher/assignments/[assignmentId]/submissions',
] as const;

const FORBIDDEN_ROUTE_IMPORTS = [
  "@/lib/prisma",
  "@/lib/data-governance/teacher-assignment-review",
  "@/lib/data-governance/teacher-assignment-review-api",
  "@/lib/assignments/assignment-review",
  "@/lib/data-governance/learning-fact",
];

const LEARNING_FACT_WRITERS = [
  'writeLearningFact',
  'createLearningFact',
  '@/lib/data-governance/learning-record',
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

describe('assignment review feedback authority', () => {
  it('owns review orchestration under the Assignment public API', () => {
    const application = readFileSync(join(ROOT, 'src/lib/assignments/assignment-review.ts'), 'utf8');
    const publicApi = readFileSync(join(ROOT, 'src/lib/assignments/public-api.ts'), 'utf8');
    expect(existsSync(join(ROOT, 'src/lib/data-governance/teacher-assignment-review.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/lib/data-governance/teacher-assignment-review-api.ts'))).toBe(false);
    expect(application).toContain('export async function approveTeacherAssignmentReview');
    expect(application).toContain('tx.teacherAssignmentApprovalSnapshot.create');
    expect(application).toContain('PROCESS_GOVERNED_EVIDENCE');
    expect(application).not.toMatch(/export async function approveTeacherAssignmentReview[\s\S]{0,200}return approveTeacherAssignmentReview\(/);
    expect(publicApi).toContain('export async function teacherApproveReview');
    expect(publicApi).toContain("from './assignment-review'");
    expect(publicApi).not.toContain("from '@/lib/data-governance/teacher-assignment-review'");
    expect(publicApi).not.toContain('from "@/lib/data-governance/teacher-assignment-review"');
  });

  it('keeps review routes on the public API and off Prisma, private helpers, and LearningFact writers', () => {
    const routes = REVIEW_ROUTE_ROOTS.flatMap((root) => walk(root)).filter((path) => !path.includes('/__tests__/'));
    expect(routes.length).toBeGreaterThan(4);
    const violations: string[] = [];
    for (const path of routes) {
      const source = readFileSync(join(ROOT, path), 'utf8');
      if (!source.includes('@/lib/assignments/public-api')) violations.push(`missing-public-api:${path}`);
      for (const token of FORBIDDEN_ROUTE_IMPORTS) {
        if (source.includes(token)) violations.push(`${token}:${path}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps LearningFact writeback on the governed outbox adapter', () => {
    const application = readFileSync(join(ROOT, 'src/lib/assignments/assignment-review.ts'), 'utf8');
    const publicApi = readFileSync(join(ROOT, 'src/lib/assignments/public-api.ts'), 'utf8');
    const outbox = readFileSync(join(ROOT, 'src/lib/data-governance/teacher-assignment-review-outbox.ts'), 'utf8');
    for (const token of LEARNING_FACT_WRITERS) {
      expect(application).not.toContain(token);
      expect(publicApi).not.toContain(token);
    }
    expect(outbox).toContain('PROCESS_GOVERNED_EVIDENCE');
    expect(outbox).toContain('async function processGovernedEvidence');
  });
});
