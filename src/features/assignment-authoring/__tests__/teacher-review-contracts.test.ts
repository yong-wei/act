import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  buildDeterministicReviewQueue,
  buildTeacherReviewApprovalPayload,
  buildTeacherReviewApiUrl,
  buildTeacherReviewHref,
  buildTeacherSubmissionQueueUrl,
  deriveReviewTotal,
  filterTeacherReviewQueue,
  findQueueNeighbours,
  normalizeTeacherReviewDetail,
  normalizeTeacherSubmissionQueue,
  responseKindToSubmissionResponseType,
  teacherReviewConflictMutationState,
  type TeacherReviewSubmissionItem,
} from "../../assignments/teacher-review-contracts";
import {
  buildTeacherAssignmentReviewHref,
  normalizeTeacherAssignmentListItem,
} from "../teacher-assignment-list";
import {
  CriterionAiSuggestion,
  openOriginalAsset,
  originalAssetAccessErrorMessage,
  OriginalResponsePanel,
} from "../../assignments/teacher-review-workspace";

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
        review: {
          id: "review-1",
          submission: { id: "submission-1" },
          gradingRun: {
            question: {
              id: "question-1",
              responseType: "SUBJECTIVE_FILE",
            },
          },
        },
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
      items: [
        {
          submissionId: "s1",
          studentId: "u1",
          studentName: "学生甲",
          state: "SUBMITTED",
          questions: [
            {
              id: "q1",
              title: "题目",
              responseKind: "SUBJECTIVE_TEXT",
              status: "AWAITING_REVIEW",
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
        review: {
          id: "review-1",
          version: 1,
          submission: {
            id: "s1",
            student: { name: "学生甲", profile: { studentNumber: "2026001" } },
          },
          gradingRun: { question: { id: "q1" } },
        },
      }),
    ).toMatchObject({ submissionId: "s1", questionId: "q1", studentNumber: "2026001", originalResponse: null });
    expect(
      normalizeTeacherReviewDetail({
        review: {
          id: "review-1",
          version: 1,
          submission: { id: "s1" },
          gradingRun: {
            question: { id: "q1" },
            questionSnapshot: {
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
          },
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
        review: {
          id: "review-1",
          version: 1,
          submission: { id: "s1" },
          gradingRun: {
            question: { id: "q1" },
            questionSnapshot: {
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
          },
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
      normalizeTeacherReviewDetail({ review: {} }),
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
      review: {
        id: "review-1",
        state: "WORKING",
        version: 1,
        submission: { id: "submission-1" },
        gradingRun: {
          question: { id: "question-1", promptSnapshot: { title: "Question" } },
        },
      },
    })?.status).toBe("IN_REVIEW");
  });

  it("lists ready attachments with truncation limitations for confirmation", () => {
    const detail = normalizeTeacherReviewDetail({
      review: {
        id: "review-1",
        incompleteEvidence: true,
        omittedEvidence: [{
          assetId: "asset-truncated",
          displayName: "\u061c\u202alarge\u2060\u200b.pdf",
        }],
        submission: { id: "submission-1" },
        gradingRun: { question: { id: "question-1" } },
      },
    });

    expect(detail?.incompleteEvidence).toBe(true);
    expect(detail?.omittedEvidence).toEqual([{
      assetId: "asset-truncated",
      displayName: "large.pdf",
    }]);
  });

  it("consumes only the safe original-response projection and keeps govern parameters revision-bound", () => {
    const detail = normalizeTeacherReviewDetail({
      review: {
        id: "review-1",
        version: 3,
        originalResponse: {
          textSnapshot: "# 解答\n\n$G(s)=1/s$",
          attachmentOrderProvenance: "student-frozen-order.v1",
          assets: [
            {
              id: "asset-image",
              displayName: "\u00ad\u180e\u200f\u202e\u206a\u206f\u2069\ufeff\ufff9diagram.png",
              mimeType: "image/png",
              sizeBytes: 20,
              role: "EMBEDDED_IMAGE",
              orderIndex: null,
              embeddedPosition: "md:diagram",
              accessEndpoint: "/api/teacher/assignments/a/submissions/s/review/assets/asset-image/read?reviewId=review-1",
            },
            {
              id: "asset-doc",
              displayName: "report.docx",
              mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              sizeBytes: 30,
              role: "ATTACHMENT",
              orderIndex: 0,
              embeddedPosition: null,
              accessEndpoint: "/api/teacher/assignments/a/submissions/s/review/assets/asset-doc/read?reviewId=review-1",
            },
          ],
        },
        incompleteEvidence: true,
        omittedEvidence: [{
          assetId: "asset-doc",
          displayName: "\u00ad\u061c\u180e\u202a\u2060\u206a\u206f\u200b\ufff9report.docx",
        }],
        submission: { id: "submission-1" },
        gradingRun: {
          question: { id: "question-1", responseType: "SUBJECTIVE_FILE" },
        },
      },
    });

    expect(detail?.originalResponse).toMatchObject({
      textSnapshot: "# 解答\n\n$G(s)=1/s$",
      assets: [
        {
          id: "asset-image",
          displayName: "diagram.png",
          embeddedPosition: "md:diagram",
        },
        { id: "asset-doc", orderIndex: 0 },
      ],
    });

    const workspace = source("src/features/assignments/teacher-review-workspace.tsx");
    const contracts = source("src/features/assignments/teacher-review-contracts.ts");
    expect(workspace).toContain("confirmIncompleteEvidence:");
    expect(contracts).toContain("omittedAssetIds:");
    expect(workspace).toContain("部分附件未纳入本次建议，请结合原件核对");
    expect(workspace).not.toContain("canonicalText");
    expect(workspace).not.toContain("evidence.anchors");

    expect(buildTeacherReviewApprovalPayload(detail!, {
      expectedVersion: 4,
      idempotencyKey: "approval-key",
      confirmIncompleteEvidence: true,
    })).toEqual({
      reviewId: "review-1",
      expectedVersion: 4,
      idempotencyKey: "approval-key",
      confirmIncompleteEvidence: true,
      omittedAssetIds: ["asset-doc"],
    });
    expect(teacherReviewConflictMutationState({
      error: "teacher-review-incomplete-evidence-confirmation-required",
    })).toBe("confirmation-required");
    expect(teacherReviewConflictMutationState({
      error: "teacher-review-version-conflict",
    })).toBe("conflict");
  });

  it("renders sealed Markdown, formulas, embedded images, PDF fallback, and protected original-file cards", () => {
    const html = renderToStaticMarkup(createElement(OriginalResponsePanel, {
      response: {
        textSnapshot: "# 解答\n\n增益为 $K=2$。\n\n![框图](/api/student/assignments/a/assets/embedded-image/read \"asset:md:diagram\")\n\n![兼容图](asset:md:legacy)",
        attachmentOrderProvenance: "student-frozen-order.v1",
        assets: [
          {
            id: "embedded-image",
            displayName: "diagram.png",
            mimeType: "image/png",
            sizeBytes: 20,
            role: "EMBEDDED_IMAGE",
            orderIndex: null,
            embeddedPosition: "md:diagram",
            accessEndpoint: "/api/teacher/assignments/a/submissions/s/review/assets/embedded-image/read?reviewId=r",
          },
          {
            id: "legacy-embedded-image",
            displayName: "legacy.png",
            mimeType: "image/png",
            sizeBytes: 21,
            role: "EMBEDDED_IMAGE",
            orderIndex: null,
            embeddedPosition: "md:legacy",
            accessEndpoint: "/api/teacher/assignments/a/submissions/s/review/assets/legacy-embedded-image/read?reviewId=r",
          },
          ...[
            ["image", "plot.jpeg", "image/jpeg"],
            ["pdf", "answer.pdf", "application/pdf"],
            ["doc", "answer.doc", "application/msword"],
            ["docx", "answer.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
            ["pptx", "answer.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
            ["markdown", "notes.md", "text/markdown"],
            ["text", "notes.txt", "text/plain"],
          ].map(([id, displayName, mimeType], index) => ({
            id,
            displayName,
            mimeType,
            sizeBytes: 30 + index,
            role: "ATTACHMENT" as const,
            orderIndex: index,
            embeddedPosition: null,
            accessEndpoint: `/api/teacher/assignments/a/submissions/s/review/assets/${id}/read?reviewId=r`,
          })),
        ],
      },
      initialAccessUrls: {
        "embedded-image": "/protected/embedded",
        "legacy-embedded-image": "/protected/legacy-embedded",
        image: "/protected/image",
        pdf: "/protected/pdf",
      },
    }));

    expect(html).toContain("<h3");
    expect(html).toContain(">解答</h3>");
    expect(html).toContain('class="katex"');
    expect(html).toContain('src="/protected/embedded"');
    expect(html).toContain('src="/protected/legacy-embedded"');
    expect(html).not.toContain("/api/student/");
    expect(html).toContain('src="/protected/image"');
    expect(html).toContain('sandbox=""');
    expect(html).toContain('src="/protected/pdf"');
    for (const name of [
      "answer.doc",
      "answer.docx",
      "answer.pptx",
      "notes.md",
      "notes.txt",
    ]) {
      expect(html).toContain(name);
    }
    expect(html).not.toMatch(/converted|provider|errorCode|objectKey|checksum/);
    expect(source("src/features/assignments/teacher-review-workspace.tsx"))
      .toContain("嵌入图片载入失败，重试");
  });

  it("renders AI rationale and safe evidence-anchor locations beside the criterion suggestion", () => {
    const html = renderToStaticMarkup(createElement(CriterionAiSuggestion, {
      criterion: {
        id: "model",
        label: "建模",
        maxPoints: 10,
        levels: [],
        levelId: null,
        aiScore: 8,
        aiLevelId: null,
        aiComment: "模型结构与题意一致",
        score: 8,
        scoreStep: 0.01,
        comment: "",
      },
      evidenceAnchors: [{
        id: "annotation-1",
        criterionId: "model",
        status: "ACTIVE",
        comment: "内部批注不应替代定位",
        origin: "AI_DRAFT",
        anchor: {
          pageNumber: 2,
          blockId: "block-2",
          precision: "BLOCK",
          excerpt: "<script>原始证据摘录</script>",
        },
      }],
    }));

    // #1852 起建议卡文案改为「自动预评分」。
    expect(html).toContain("自动预评分：");
    expect(html).toContain("模型结构与题意一致");
    expect(html).toContain("证据锚点");
    expect(html).toContain("第 2 页");
    expect(html).toContain("第 2 页 · 作答片段");
    expect(html).toContain("&lt;script&gt;原始证据摘录&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("内部批注不应替代定位");
  });

  it("pre-opens original-file windows before authorization and closes failed attempts", async () => {
    const asset = {
      id: "docx",
      displayName: "answer.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 30,
      role: "ATTACHMENT" as const,
      orderIndex: 0,
      embeddedPosition: null,
      accessEndpoint: "/api/teacher/assignments/a/submissions/s/review/assets/docx/read?reviewId=r",
    };
    const events: string[] = [];
    const popup = {
      opener: {} as unknown,
      location: { href: "about:blank" },
      close: () => events.push("close"),
    };

    await expect(openOriginalAsset(asset, true, {
      openWindow: () => {
        events.push("open");
        return popup;
      },
      requestAccess: async () => {
        events.push("authorize");
        return "/api/teacher/assignments/a/assets/docx/read?token=short";
      },
      origin: "https://act.example",
    })).resolves.toBe("opened");
    expect(events).toEqual(["open", "authorize"]);
    expect(popup.opener).toBeNull();
    expect(popup.location.href).toBe(
      "/api/teacher/assignments/a/assets/docx/read?token=short&download=1",
    );

    const requestAccess = async () => {
      events.push("unexpected-authorize");
      return "/unused";
    };
    await expect(openOriginalAsset(asset, false, {
      openWindow: () => null,
      requestAccess,
      origin: "https://act.example",
    })).resolves.toBe("popup-blocked");
    expect(events).not.toContain("unexpected-authorize");

    const failedPopup = {
      opener: {} as unknown,
      location: { href: "about:blank" },
      close: () => events.push("failed-close"),
    };
    await expect(openOriginalAsset(asset, false, {
      openWindow: () => failedPopup,
      requestAccess: async () => "",
      origin: "https://act.example",
    })).resolves.toBe("access-failed");
    expect(events).toContain("failed-close");
    expect(failedPopup.location.href).toBe("about:blank");
    expect(originalAssetAccessErrorMessage("popup-blocked")).toContain(
      "允许弹出窗口",
    );
    expect(originalAssetAccessErrorMessage("access-failed")).toContain(
      "原件授权暂时失败",
    );
  });
});
