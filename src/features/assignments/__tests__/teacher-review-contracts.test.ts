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
        gradingRun: {
          id: "run-1",
          evidenceState: "EVIDENCE_INCOMPLETE",
          question: { id: "question-1", responseType: "SUBJECTIVE_FILE" },
        },
        incompleteEvidence: true,
        omittedEvidence: [{ assetId: "asset-1", displayName: "answer.pdf" }],
      },
      submission: { id: "submission-1" },
    });

    expect(detail).toMatchObject({
      incompleteEvidence: true,
      omittedEvidence: [{ assetId: "asset-1", displayName: "answer.pdf" }],
    });
  });
});
