import { describe, expect, it } from "vitest";

import { normalizeTeacherReviewDetail } from "../teacher-review-contracts";

describe("teacher review contracts", () => {
  it("projects incomplete evidence and omitted attachment names", () => {
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
          answerEvidence: {
            sourceKind: "DOCUMENT",
            canonicalMarkdown: "partial answer",
            limitationState: "evidence-incomplete",
            sourceManifest: {
              state: "EVIDENCE_INCOMPLETE",
              sources: [{
                assetId: "asset-1",
                displayName: "answer.pdf",
                state: "UNDERSTANDING_FAILED",
              }],
            },
          },
        },
      },
      submission: { id: "submission-1" },
      question: { id: "question-1", responseType: "SUBJECTIVE_FILE" },
    });

    expect(detail).toMatchObject({
      incompleteEvidence: true,
      omittedEvidence: [{ assetId: "asset-1", displayName: "answer.pdf" }],
    });
  });
});
