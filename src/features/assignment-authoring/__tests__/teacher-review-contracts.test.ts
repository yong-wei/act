import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildDeterministicReviewQueue,
  buildTeacherReviewApiUrl,
  buildTeacherReviewHref,
  buildTeacherSubmissionQueueUrl,
  deriveReviewTotal,
  filterTeacherReviewQueue,
  findQueueNeighbours,
  normalizeTeacherReviewDetail,
  normalizeTeacherSubmissionQueue,
  responseKindToSubmissionResponseType,
  type TeacherReviewSubmissionItem,
} from "../../assignments/teacher-review-contracts";
import {
  buildTeacherAssignmentReviewHref,
  normalizeTeacherAssignmentListItem,
} from "../teacher-assignment-list";

const source = (file: string) =>
  readFileSync(path.join(process.cwd(), file), "utf8");

const submissions: TeacherReviewSubmissionItem[] = [
  {
    id: "submission-b",
    studentId: "student-b",
    studentName: "赵六",
    studentNumber: "002",
    submittedAt: null,
    status: "READY",
    questions: [
      {
        id: "q2",
        stableQuestionId: "stable-q2",
        title: "第二题",
        orderIndex: 1,
        status: "APPROVED",
        responseKind: "DOCUMENT",
        reviewId: "review-b-q2",
        gradingRunId: "run-b-q2",
      },
      {
        id: "q1",
        stableQuestionId: "stable-q1",
        title: "第一题",
        orderIndex: 0,
        status: "READY",
        responseKind: "TEXT",
        reviewId: "review-b-q1",
        gradingRunId: "run-b-q1",
      },
    ],
  },
  {
    id: "submission-a",
    studentId: "student-a",
    studentName: "李四",
    studentNumber: "001",
    submittedAt: null,
    status: "READY",
    questions: [
      {
        id: "q2",
        stableQuestionId: "stable-q2",
        title: "第二题",
        orderIndex: 1,
        status: "READY",
        responseKind: "DOCUMENT",
        reviewId: "review-a-q2",
        gradingRunId: "run-a-q2",
      },
      {
        id: "q1",
        stableQuestionId: "stable-q1",
        title: "第一题",
        orderIndex: 0,
        status: "IN_REVIEW",
        responseKind: "TEXT",
        reviewId: "review-a-q1",
        gradingRunId: "run-a-q1",
      },
    ],
  },
];

describe("teacher assignment review UI contracts", () => {
  it("matches returned resubmission types to the current question kind", () => {
    expect(responseKindToSubmissionResponseType("TEXT")).toBe(
      "SUBJECTIVE_TEXT",
    );
    expect(responseKindToSubmissionResponseType("DOCUMENT")).toBe(
      "SUBJECTIVE_FILE",
    );
    expect(
      normalizeTeacherReviewDetail({
        submission: { id: "submission-1" },
        question: {
          id: "question-1",
          responseType: "SUBJECTIVE_FILE",
        },
        review: { id: "review-1" },
      })?.responseKind,
    ).toBe("DOCUMENT");
  });

  it("consumes the real assignment-list summary and preserves its review locator", () => {
    const item = normalizeTeacherAssignmentListItem({
      id: "assignment-1",
      state: "PUBLISHED",
      updatedAt: "2026-07-17T00:00:00.000Z",
      revisions: [{
        id: "revision-1",
        revisionNumber: 1,
        version: 1,
        title: "控制作业",
        state: "PUBLISHED",
        audiences: [],
      }],
      reviewSummary: {
        submissionCount: 3,
        pendingReviewCount: 2,
        reviewedCount: 1,
        nextReview: {
          submissionId: "submission-1",
          questionId: "question-1",
          reviewId: "review-1",
          gradingRunId: "run-1",
        },
      },
    });

    expect(item).toMatchObject({
      submissionCount: 3,
      pendingReviewCount: 2,
      reviewedCount: 1,
      submissionCountsAvailable: true,
      nextReview: {
        submissionId: "submission-1",
        questionId: "question-1",
        reviewId: "review-1",
        gradingRunId: "run-1",
      },
    });
    expect(buildTeacherAssignmentReviewHref(item)).toBe(
      "/teacher/assignments/assignment-1/submissions/submission-1/review?questionId=question-1&mode=student&reviewId=review-1",
    );
    expect(buildTeacherAssignmentReviewHref({
      ...item,
      nextReview: { ...item.nextReview!, reviewId: null },
    })).toBe(
      "/teacher/assignments/assignment-1/submissions/submission-1/review?questionId=question-1&mode=student&gradingRunId=run-1",
    );
  });

  it("builds only assignment-scoped submissions API and UI routes", () => {
    expect(
      buildTeacherSubmissionQueueUrl("assignment / 1", {
        mode: "question",
        status: "PENDING",
        questionId: "q/1",
      }),
    ).toBe(
      "/api/teacher/assignments/assignment%20%2F%201/submissions?mode=question&status=PENDING&questionId=q%2F1",
    );
    expect(buildTeacherReviewApiUrl("a1", "s1", { reviewId: "review-1" })).toBe(
      "/api/teacher/assignments/a1/submissions/s1/review?reviewId=review-1",
    );
    expect(
      buildTeacherReviewHref(
        "a1",
        {
          submissionId: "s1",
          questionId: "q1",
          reviewId: "review-1",
        },
        "student",
      ),
    ).toBe(
      "/teacher/assignments/a1/submissions/s1/review?questionId=q1&mode=student&reviewId=review-1",
    );
    expect(
      buildTeacherReviewHref(
        "a1",
        { submissionId: "s1", questionId: "q1" },
        "student",
        "PENDING",
      ),
    ).toContain("&status=PENDING");
  });

  it("keeps by-student navigation deterministic and question navigation inside each student", () => {
    const queue = buildDeterministicReviewQueue(submissions, "student");
    expect(queue.map((item) => item.key)).toEqual([
      "submission-a:q1",
      "submission-b:q1",
    ]);
    expect(findQueueNeighbours(queue, "submission-a:q1")).toEqual({
      previous: null,
      next: queue[1],
    });
    expect(findQueueNeighbours(queue, "submission-b:q1")).toEqual({
      previous: queue[0],
      next: null,
    });
    expect(
      buildDeterministicReviewQueue(submissions, "student", "q2").map(
        (item) => item.key,
      ),
    ).toEqual(["submission-a:q2", "submission-b:q2"]);
    expect(
      buildDeterministicReviewQueue(
        submissions,
        "student",
        undefined,
        "APPROVED",
      ).map((item) => item.key),
    ).toEqual(["submission-b:q2"]);
  });

  it("keeps the selected question fixed in by-question navigation", () => {
    const queue = buildDeterministicReviewQueue(submissions, "question", "q2");
    expect(queue.map((item) => [item.studentName, item.questionId])).toEqual([
      ["李四", "q2"],
      ["赵六", "q2"],
    ]);
    expect(
      filterTeacherReviewQueue(queue, "PENDING").map((item) => item.key),
    ).toEqual(["submission-a:q2"]);
  });

  it("derives totals only from bounded criterion edits without exposing a total override", () => {
    expect(
      deriveReviewTotal([
        { score: 2.33 },
        { score: 4.12 },
        { score: Number.NaN },
      ]),
    ).toBe(6.45);
    const workspace = source(
      "src/features/assignments/teacher-review-workspace.tsx",
    );
    expect(workspace).toContain("data-derived-review-total");
    expect(workspace).not.toContain("setTotal");
    expect(workspace).toContain(
      "criteria.map(({ id, levelId, score, comment })",
    );
    expect(workspace).toContain("reviewId: detail.reviewId");
    expect(workspace).toContain("expectedVersion:");
    expect(workspace).toContain("annotations: detail.annotations");
  });

  it("normalizes nested queue and review payloads without inventing review evidence", () => {
    const queue = normalizeTeacherSubmissionQueue({
      assignment: { title: "控制作业" },
      submissions: [
        {
          id: "s1",
          student: { id: "u1", name: "学生甲" },
          state: "SUBMITTED",
          answers: [
            {
              questionId: "q1",
              title: "题目",
              responseKind: "SUBJECTIVE_TEXT",
              reviewStatus: "AWAITING_REVIEW",
              reviewId: "review-1",
              gradingRunId: "run-1",
            },
          ],
        },
      ],
    });
    expect(queue.submissions[0]).toMatchObject({
      id: "s1",
      studentName: "学生甲",
      status: "READY",
      questions: [
        {
          id: "q1",
          status: "READY",
          responseKind: "TEXT",
          reviewId: "review-1",
          gradingRunId: "run-1",
        },
      ],
    });

    expect(
      normalizeTeacherReviewDetail({
        submission: {
          id: "s1",
          student: { name: "学生甲", profile: { studentNumber: "2026001" } },
        },
        question: { id: "q1" },
        review: { id: "review-1", version: 1, criteria: [] },
      }),
    ).toMatchObject({ submissionId: "s1", questionId: "q1", studentNumber: "2026001", evidence: null });
    expect(
      normalizeTeacherReviewDetail({
        submission: { id: "s1" },
        question: {
          id: "q1",
          rubric: {
            criteria: [
              {
                id: "model",
                label: "建模",
                maxPoints: 4,
                levels: [
                  { id: "full", label: "完整", minPoints: 3, maxPoints: 4 },
                ],
              },
            ],
          },
        },
        review: {
          id: "review-1",
          version: 1,
          criterionValues: [
            {
              criterionId: "model",
              levelId: "full",
              score: 3.5,
              comment: "证据完整",
            },
          ],
        },
      })?.criteria[0],
    ).toMatchObject({
      id: "model",
      levelId: "full",
      score: 3.5,
      scoreStep: 0.01,
      levels: [{ id: "full", minPoints: 3, maxPoints: 4 }],
    });
    expect(
      normalizeTeacherReviewDetail({
        submission: { id: "s1" },
        question: {
          id: "q1",
          rubric: {
            schemaVersion: "assignment-scoring-rubric.v2",
            criteria: [{
              id: "quality",
              label: "完成质量",
              maxPoints: 10,
              detailedRubricEnabled: false,
              levels: [],
            }],
          },
        },
        review: {
          id: "review-1",
          version: 1,
          criterionValues: [{
            criterionId: "quality",
            levelId: null,
            score: 8.5,
            comment: "证据完整",
          }],
        },
      })?.criteria[0],
    ).toMatchObject({
      id: "quality",
      levelId: null,
      score: 8.5,
      scoreStep: 0.1,
      levels: [],
    });
    expect(
      normalizeTeacherReviewDetail({
        submission: {},
        question: {},
        review: {},
      }),
    ).toBeNull();
  });

  it("exposes complete queue/review states, desktop panes, phone handoff, and conflict recovery", () => {
    const list = source(
      "src/features/assignment-authoring/teacher-assignment-list.tsx",
    );
    const queue = source("src/features/assignments/teacher-review-queue.tsx");
    const workspace = source(
      "src/features/assignments/teacher-review-workspace.tsx",
    );
    expect(list).toContain("查看提交");
    expect(list).toContain("进入批阅");
    for (const token of ['"loading"', '"error"', '"empty"', '"filtered-empty"'])
      expect(queue).toContain(token);
    expect(workspace).toContain("md:grid-cols-[16rem_minmax(0,1fr)_22rem]");
    expect(workspace).toContain("data-review-mobile-handoff");
    expect(workspace).toContain("请在平板或电脑端继续批阅");
    expect(workspace).toContain("response.status === 409");
    expect(workspace).toContain("重新加载最新版本");
    expect(workspace).toContain('action: "return" | "approve"');
    expect(workspace).toContain("step={criterion.scoreStep}");
    expect(workspace).toContain("max={criterion.maxPoints}");
    expect(workspace).not.toContain("max={selectedLevel?.maxPoints");
    expect(workspace).not.toContain("Math.max(level.minPoints, criterion.score)");
  });

  it("maps the persisted WORKING review state to an editable review detail", () => {
    expect(normalizeTeacherReviewDetail({
      submission: { id: "submission-1", status: "READY" },
      question: { id: "question-1", title: "Question" },
      review: { id: "review-1", submissionId: "submission-1", questionId: "question-1", state: "WORKING", version: 1 },
    })?.status).toBe("IN_REVIEW");
  });
});
