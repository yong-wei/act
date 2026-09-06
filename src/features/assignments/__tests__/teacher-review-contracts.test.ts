import { describe, expect, it } from "vitest";

import { buildTeacherAssignmentGradingHref, normalizeTeacherReviewDetail } from "../teacher-review-contracts";

describe("teacher review contracts", () => {
  it("builds the formal grading-console link from the submission queue", () => {
    expect(buildTeacherAssignmentGradingHref("assignment / 1")).toBe("/teacher/assignments/assignment%20%2F%201/grading");
  });

  it("projects incomplete evidence and omitted attachment names", () => {
    // fixture 采用 buildTeacherAssignmentReviewApiProjection 的真实返回形状（{ review } 包装）
    const detail = normalizeTeacherReviewDetail({
      review: {
        id: "review-1",
        version: 1,
        state: "WORKING",
        submissionId: "submission-1",
        questionId: "question-1",
        assignment: { id: "assignment-1", title: "控制系统作业" },
        submission: { id: "submission-1", student: { name: "张三", profile: { studentNumber: "S001" } } },
        gradingRun: {
          id: "run-1",
          evidenceState: "EVIDENCE_INCOMPLETE",
          question: { id: "question-1", responseType: "SUBJECTIVE_FILE", promptSnapshot: { title: "第一题", prompt: "作答" } },
        },
        incompleteEvidence: true,
        omittedEvidence: [{ assetId: "asset-1", displayName: "answer.pdf" }],
      },
    });

    expect(detail).toMatchObject({
      reviewId: "review-1",
      submissionId: "submission-1",
      assignmentTitle: "控制系统作业",
      studentName: "张三",
      studentNumber: "S001",
      questionId: "question-1",
      incompleteEvidence: true,
      omittedEvidence: [{ assetId: "asset-1", displayName: "answer.pdf" }],
    });
  });
});
