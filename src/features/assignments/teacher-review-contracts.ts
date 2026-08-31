export type TeacherReviewQueueMode = "student" | "question";

export type TeacherReviewStatus =
  | "NOT_SUBMITTED"
  | "PROCESSING"
  | "READY"
  | "IN_REVIEW"
  | "RETURNED"
  | "APPROVED"
  | "BLOCKED";

export interface TeacherReviewQuestionItem {
  id: string;
  stableQuestionId: string;
  title: string;
  orderIndex: number;
  status: TeacherReviewStatus;
  responseKind: "TEXT" | "DOCUMENT" | "UNKNOWN";
  reviewId: string | null;
  gradingRunId: string | null;
}

export function responseKindToSubmissionResponseType(
  responseKind: TeacherReviewQuestionItem["responseKind"],
) {
  return responseKind === "DOCUMENT" ? "SUBJECTIVE_FILE" : "SUBJECTIVE_TEXT";
}

export interface TeacherReviewSubmissionItem {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string | null;
  submittedAt: string | null;
  status: TeacherReviewStatus;
  questions: TeacherReviewQuestionItem[];
}

export interface TeacherReviewQueueItem {
  key: string;
  submissionId: string;
  studentId: string;
  studentName: string;
  studentNumber: string | null;
  submittedAt: string | null;
  status: TeacherReviewStatus;
  questionId: string;
  stableQuestionId: string;
  questionTitle: string;
  questionOrder: number;
  responseKind: TeacherReviewQuestionItem["responseKind"];
  reviewId: string | null;
  gradingRunId: string | null;
}

export interface TeacherReviewCriterion {
  id: string;
  label: string;
  maxPoints: number;
  levels: Array<{
    id: string;
    label: string;
    minPoints: number;
    maxPoints: number;
  }>;
  levelId: string | null;
  aiScore: number | null;
  aiLevelId: string | null;
  aiComment: string;
  score: number;
  scoreStep: 0.01 | 0.1;
  comment: string;
}

export interface TeacherOriginalResponseAsset {
  id: string;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  role: "EMBEDDED_IMAGE" | "ATTACHMENT";
  orderIndex: number | null;
  embeddedPosition: string | null;
  accessEndpoint: string;
}

export interface TeacherOriginalResponse {
  textSnapshot: string | null;
  attachmentOrderProvenance: string | null;
  assets: TeacherOriginalResponseAsset[];
}

export interface TeacherReviewDetail {
  reviewId: string;
  assignmentTitle: string;
  version: number;
  submissionId: string;
  studentName: string;
  studentNumber: string | null;
  questionId: string;
  questionTitle: string;
  questionPrompt: string;
  responseKind: TeacherReviewQuestionItem["responseKind"];
  status: TeacherReviewStatus;
  questions: TeacherReviewQuestionItem[];
  originalResponse: TeacherOriginalResponse | null;
  criteria: TeacherReviewCriterion[];
  overallComment: string;
  incompleteEvidence: boolean;
  omittedEvidence: Array<{ assetId: string; displayName: string }>;
  aiAnnotations: ReviewAnnotationValue[];
  annotations: ReviewAnnotationValue[];
}

export interface ReviewAnnotationValue {
  id?: string;
  criterionId: string;
  status: "ACTIVE" | "SUPPRESSED";
  comment: string;
  anchor: {
    blockId?: string;
    pageNumber?: number;
    spanStart?: number;
    spanEnd?: number;
    bbox?: number[];
    precision: "SPAN" | "BLOCK" | "PAGE";
    excerpt?: string;
  };
  origin?: "AI_DRAFT" | "TEACHER";
}

const STATUS_ORDER: Record<TeacherReviewStatus, number> = {
  READY: 0,
  IN_REVIEW: 1,
  PROCESSING: 2,
  RETURNED: 3,
  BLOCKED: 4,
  APPROVED: 5,
  NOT_SUBMITTED: 6,
};

export function buildTeacherSubmissionQueueUrl(
  assignmentId: string,
  options: {
    mode: TeacherReviewQueueMode;
    status?: string;
    questionId?: string;
  },
): string {
  const params = new URLSearchParams({ mode: options.mode });
  if (options.status && options.status !== "ALL")
    params.set("status", options.status);
  if (options.questionId) params.set("questionId", options.questionId);
  return `/api/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions?${params.toString()}`;
}

export function buildTeacherAssignmentGradingHref(assignmentId: string): string {
  return `/teacher/assignments/${encodeURIComponent(assignmentId)}/grading`;
}

export function buildTeacherReviewApiUrl(
  assignmentId: string,
  submissionId: string,
  locator: { reviewId?: string | null; gradingRunId?: string | null },
): string {
  const params = new URLSearchParams();
  if (locator.reviewId) params.set("reviewId", locator.reviewId);
  else if (locator.gradingRunId)
    params.set("gradingRunId", locator.gradingRunId);
  return `/api/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}/review?${params.toString()}`;
}

export function buildTeacherReviewHref(
  assignmentId: string,
  item: Pick<TeacherReviewQueueItem, "submissionId" | "questionId"> &
    Partial<Pick<TeacherReviewQueueItem, "reviewId" | "gradingRunId">>,
  mode: TeacherReviewQueueMode,
  status = "ALL",
): string {
  const params = new URLSearchParams({ questionId: item.questionId, mode });
  if (item.reviewId) params.set("reviewId", item.reviewId);
  else if (item.gradingRunId) params.set("gradingRunId", item.gradingRunId);
  if (status !== "ALL") params.set("status", status);
  return `/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(item.submissionId)}/review?${params.toString()}`;
}

export function normalizeTeacherSubmissionQueue(payload: unknown): {
  assignmentTitle: string;
  submissions: TeacherReviewSubmissionItem[];
} {
  const root = asRecord(payload);
  const assignment = asRecord(root.assignment);
  const rawSubmissions = arrayFrom(root.submissions ?? root.items);
  return {
    assignmentTitle: stringFrom(
      assignment.title ?? root.assignmentTitle,
      "作业提交",
    ),
    submissions: rawSubmissions.map((raw, submissionIndex) =>
      normalizeSubmission(raw, submissionIndex),
    ),
  };
}

export function buildDeterministicReviewQueue(
  submissions: TeacherReviewSubmissionItem[],
  mode: TeacherReviewQueueMode,
  selectedQuestionId?: string,
  status = "ALL",
): TeacherReviewQueueItem[] {
  const items = submissions.flatMap((submission) => {
    const statusScopedQuestions = submission.questions
      .filter((question) => matchesReviewStatus(question.status, status))
      .sort(
        (left, right) =>
          left.orderIndex - right.orderIndex || compareText(left.id, right.id),
      );
    const questions =
      mode === "student"
        ? [
            statusScopedQuestions.find(
              (question) =>
                question.id === selectedQuestionId ||
                question.stableQuestionId === selectedQuestionId,
            ) ??
              statusScopedQuestions.find(
                (question) =>
                  question.status === "READY" ||
                  question.status === "IN_REVIEW",
              ) ??
              statusScopedQuestions[0],
          ].filter(
            (question): question is TeacherReviewQuestionItem =>
              question !== undefined,
          )
        : statusScopedQuestions;
    return questions.map((question) => ({
      key: `${submission.id}:${question.id}`,
      submissionId: submission.id,
      studentId: submission.studentId,
      studentName: submission.studentName,
      studentNumber: submission.studentNumber,
      submittedAt: submission.submittedAt,
      status:
        question.status === "NOT_SUBMITTED"
          ? submission.status
          : question.status,
      questionId: question.id,
      stableQuestionId: question.stableQuestionId,
      questionTitle: question.title,
      questionOrder: question.orderIndex,
      responseKind: question.responseKind,
      reviewId: question.reviewId,
      gradingRunId: question.gradingRunId,
    }));
  });

  const scoped =
    mode === "question" && selectedQuestionId
      ? items.filter(
          (item) =>
            item.questionId === selectedQuestionId ||
            item.stableQuestionId === selectedQuestionId,
        )
      : items;

  return scoped.sort((left, right) => {
    if (mode === "question") {
      return (
        compareText(left.studentName, right.studentName) ||
        compareText(left.studentNumber ?? "", right.studentNumber ?? "") ||
        compareText(left.submissionId, right.submissionId)
      );
    }
    return (
      compareText(left.studentName, right.studentName) ||
      compareText(left.studentNumber ?? "", right.studentNumber ?? "") ||
      compareText(left.submissionId, right.submissionId)
    );
  });
}

export function filterTeacherReviewQueue(
  items: TeacherReviewQueueItem[],
  status: string,
): TeacherReviewQueueItem[] {
  if (status === "ALL") return items;
  if (status === "PENDING")
    return items.filter((item) => ["READY", "IN_REVIEW"].includes(item.status));
  return items.filter((item) => item.status === status);
}

function matchesReviewStatus(status: TeacherReviewStatus, filter: string) {
  if (filter === "ALL") return true;
  if (filter === "PENDING") return status === "READY" || status === "IN_REVIEW";
  return status === filter;
}

export function findQueueNeighbours(
  items: TeacherReviewQueueItem[],
  currentKey: string,
) {
  const index = items.findIndex((item) => item.key === currentKey);
  return {
    previous: index > 0 ? items[index - 1] : null,
    next: index >= 0 && index < items.length - 1 ? items[index + 1] : null,
  };
}

export function firstReviewableQueueItem(items: TeacherReviewQueueItem[]) {
  return (
    items.find(
      (item) => item.status === "READY" || item.status === "IN_REVIEW",
    ) ?? null
  );
}

export function deriveReviewTotal(
  criteria: Array<Pick<TeacherReviewCriterion, "score">>,
): number {
  return (
    Math.round(
      criteria.reduce(
        (sum, criterion) => sum + finiteNumber(criterion.score, 0),
        0,
      ) * 100,
    ) / 100
  );
}

export function buildTeacherReviewApprovalPayload(
  detail: Pick<
    TeacherReviewDetail,
    "reviewId" | "incompleteEvidence" | "omittedEvidence"
  >,
  input: {
    expectedVersion: number;
    idempotencyKey: string;
    confirmIncompleteEvidence: boolean;
  },
) {
  return {
    reviewId: detail.reviewId,
    expectedVersion: input.expectedVersion,
    idempotencyKey: input.idempotencyKey,
    ...(detail.incompleteEvidence
      ? {
          confirmIncompleteEvidence: input.confirmIncompleteEvidence,
          omittedAssetIds: detail.omittedEvidence.map((item) => item.assetId),
        }
      : {}),
  };
}

export function teacherReviewConflictMutationState(payload: unknown) {
  return asRecord(payload).error ===
    "teacher-review-incomplete-evidence-confirmation-required"
    ? "confirmation-required" as const
    : "conflict" as const;
}

export function normalizeTeacherReviewDetail(
  payload: unknown,
): TeacherReviewDetail | null {
  const root = asRecord(payload);
  const review = asRecord(root.review ?? root.item);
  const gradingRun = asRecord(review.gradingRun);
  const questionSnapshot = asRecord(gradingRun.questionSnapshot);
  const submission = asRecord(root.submission ?? review.submission);
  const student = asRecord(submission.student ?? review.student);
  const studentProfile = asRecord(student.profile);
  const question = asRecord(
    root.question ?? review.question ?? gradingRun.question ?? questionSnapshot,
  );
  const promptSnapshot = asRecord(question.promptSnapshot);
  const rubric = asRecord(
    review.rubric ?? question.rubric ?? questionSnapshot.rubric,
  );
  const teacherValues = new Map(
    arrayFrom(review.criterionValues).map((entry) => {
      const value = asRecord(entry);
      return [stringFrom(value.criterionId), value];
    }),
  );
  const aiValues = new Map(
    arrayFrom(gradingRun.assessments).map((entry) => {
      const value = asRecord(entry);
      return [stringFrom(value.criterionId), value];
    }),
  );
  const rawCriteria = review.criteria
    ? arrayFrom(review.criteria)
    : arrayFrom(rubric.criteria).map((entry) => {
        const criterion = asRecord(entry);
        const criterionId = stringFrom(criterion.id ?? criterion.criterionId);
        return {
          ...criterion,
          teacher: teacherValues.get(criterionId),
          aiDraft: aiValues.get(criterionId),
        };
      });
  const originalResponse = normalizeOriginalResponse(review.originalResponse);
  const omittedEvidence = arrayFrom(review.omittedEvidence).flatMap((entry) => {
    const row = asRecord(entry);
    const assetId = stringFrom(row.assetId);
    if (!assetId) return [];
    return [{
      assetId,
      displayName: safeDisplayBasename(row.displayName),
    }];
  });
  const submissionId = stringFrom(submission.id ?? review.submissionId);
  const questionId = stringFrom(question.id ?? review.questionId);
  const reviewId = stringFrom(review.id ?? root.reviewId);
  if (!reviewId || !submissionId || !questionId) return null;

  return {
    reviewId,
    assignmentTitle: stringFrom(
      asRecord(root.assignment ?? review.assignment).title ??
        root.assignmentTitle,
      "作业批阅",
    ),
    version: Math.max(0, Math.trunc(finiteNumber(review.version, 0))),
    submissionId,
    studentName: stringFrom(student.name ?? submission.studentName, "未知学生"),
    studentNumber: nullableString(
      studentProfile.studentNumber ?? student.studentNumber ?? student.number ?? submission.studentNumber,
    ),
    questionId,
    questionTitle: stringFrom(question.title ?? question.label ?? promptSnapshot.title, "未命名题目"),
    questionPrompt: stringFrom(question.prompt ?? promptSnapshot.prompt ?? promptSnapshot.text),
    responseKind: normalizeQuestion(question, 0).responseKind,
    status: statusFrom(review.status ?? review.state ?? question.status ?? submission.status),
    questions: (arrayFrom(root.questions ?? submission.questions).length
      ? arrayFrom(root.questions ?? submission.questions)
      : [question]
    ).map((entry, index) => {
      const item = normalizeQuestion(entry, index);
      return item.id === questionId
        ? {
            ...item,
            reviewId,
            gradingRunId: nullableString(gradingRun.id),
          }
        : item;
    }),
    originalResponse,
    criteria: rawCriteria.map((entry, index) =>
      normalizeCriterion(
        entry,
        index,
        rubric.schemaVersion === "assignment-scoring-rubric.v2" ? 0.1 : 0.01,
      ),
    ),
    overallComment: stringFrom(review.overallComment ?? review.comment),
    incompleteEvidence: review.incompleteEvidence === true,
    omittedEvidence,
    aiAnnotations: normalizeReviewAnnotations(gradingRun.annotations),
    annotations: normalizeReviewAnnotations(
      review.annotationValues ?? review.annotations,
    ),
  };
}

function normalizeSubmission(
  value: unknown,
  index: number,
): TeacherReviewSubmissionItem {
  const row = asRecord(value);
  const student = asRecord(row.student);
  const questions = arrayFrom(
    row.questions ?? row.answers ?? row.reviewItems ?? row.runs,
  ).map((entry, questionIndex) => normalizeQuestion(entry, questionIndex));
  return {
    id: stringFrom(row.id ?? row.submissionId, `submission-${index + 1}`),
    studentId: stringFrom(student.id ?? row.studentId, `student-${index + 1}`),
    studentName: stringFrom(student.name ?? row.studentName, "未知学生"),
    studentNumber: nullableString(
      student.studentNumber ?? student.number ?? row.studentNumber,
    ),
    submittedAt: nullableString(row.submittedAt ?? row.updatedAt),
    status: statusFrom(row.status ?? row.state),
    questions,
  };
}

function normalizeQuestion(
  value: unknown,
  index: number,
): TeacherReviewQuestionItem {
  const row = asRecord(value);
  const question = asRecord(row.question);
  const id = stringFrom(
    question.id ?? row.questionId ?? row.id,
    `question-${index + 1}`,
  );
  const rawKind = stringFrom(
    row.responseKind ?? row.answerKind ?? row.responseType ?? question.responseType,
  ).toUpperCase();
  return {
    id,
    stableQuestionId: stringFrom(
      question.stableQuestionId ?? row.stableQuestionId,
      id,
    ),
    title: stringFrom(
      question.title ?? row.title ?? question.prompt,
      `第 ${index + 1} 题`,
    ),
    orderIndex: finiteNumber(question.orderIndex ?? row.orderIndex, index),
    status: statusFrom(row.status ?? row.reviewStatus ?? row.state),
    responseKind:
      rawKind.includes("DOCUMENT") || rawKind.includes("FILE")
        ? "DOCUMENT"
        : rawKind.includes("TEXT")
          ? "TEXT"
          : "UNKNOWN",
    reviewId: nullableString(row.reviewId ?? asRecord(row.review).id),
    gradingRunId: nullableString(
      row.gradingRunId ?? asRecord(row.gradingRun).id,
    ),
  };
}

function normalizeCriterion(
  value: unknown,
  index: number,
  scoreStep: 0.01 | 0.1,
): TeacherReviewCriterion {
  const row = asRecord(value);
  const ai = asRecord(row.aiDraft ?? row.machine);
  const teacher = asRecord(row.teacher ?? row.override);
  const maxPoints = Math.max(0, finiteNumber(row.maxPoints, 0));
  const aiScore = nullableNumber(ai.score ?? row.aiScore);
  const levels = arrayFrom(row.levels).map((entry, levelIndex) => {
    const level = asRecord(entry);
    return {
      id: stringFrom(level.id, `level-${levelIndex + 1}`),
      label: stringFrom(level.label, `档位 ${levelIndex + 1}`),
      minPoints: Math.max(0, finiteNumber(level.minPoints, 0)),
      maxPoints: Math.min(
        maxPoints,
        Math.max(0, finiteNumber(level.maxPoints, maxPoints)),
      ),
    };
  });
  const aiLevelId = nullableString(ai.levelId ?? row.aiLevelId);
  const levelId = nullableString(
    teacher.levelId ?? row.levelId ?? aiLevelId,
  ) ?? levels[0]?.id ?? null;
  return {
    id: stringFrom(row.id ?? row.criterionId, `criterion-${index + 1}`),
    label: stringFrom(row.label ?? row.title, `评分项 ${index + 1}`),
    maxPoints,
    levels,
    levelId,
    aiScore,
    aiLevelId,
    aiComment: stringFrom(ai.comment ?? ai.rationale ?? row.aiComment),
    score: Math.min(
      maxPoints,
      Math.max(0, finiteNumber(teacher.score ?? row.score ?? aiScore, 0)),
    ),
    scoreStep,
    comment: stringFrom(
      teacher.comment ??
        teacher.rationale ??
        row.comment ??
        ai.comment ??
        ai.rationale,
    ),
  };
}

function normalizeOriginalResponse(value: unknown): TeacherOriginalResponse | null {
  if (!value || typeof value !== "object") return null;
  const row = asRecord(value);
  const assets = arrayFrom(row.assets).flatMap((entry) => {
    const asset = asRecord(entry);
    const id = stringFrom(asset.id);
    const accessEndpoint = safeOriginalAccessEndpoint(asset.accessEndpoint);
    if (!id || !accessEndpoint) return [];
    const role = asset.role === "EMBEDDED_IMAGE"
      ? "EMBEDDED_IMAGE"
      : "ATTACHMENT";
    return [{
      id,
      displayName: safeDisplayBasename(asset.displayName),
      mimeType: stringFrom(asset.mimeType, "application/octet-stream"),
      sizeBytes: Math.max(0, Math.trunc(finiteNumber(asset.sizeBytes, 0))),
      role,
      orderIndex: nonnegativeInteger(asset.orderIndex),
      embeddedPosition: nullableString(asset.embeddedPosition),
      accessEndpoint,
    } satisfies TeacherOriginalResponseAsset];
  });
  const textSnapshot = nullableString(row.textSnapshot);
  if (!textSnapshot && assets.length === 0) return null;
  return {
    textSnapshot,
    attachmentOrderProvenance: nullableString(
      row.attachmentOrderProvenance,
    ),
    assets,
  };
}

function safeDisplayBasename(value: unknown) {
  const normalized = stringFrom(value)
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .at(-1) ?? "";
  const safe = normalized
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return !safe || /^\.+$/.test(safe)
    ? "未命名附件"
    : safe.slice(0, 180);
}

function safeOriginalAccessEndpoint(value: unknown) {
  const endpoint = stringFrom(value);
  if (!endpoint.startsWith("/api/teacher/assignments/")) return "";
  try {
    const url = new URL(endpoint, "https://assignment-review.invalid");
    if (url.origin !== "https://assignment-review.invalid"
      || url.searchParams.has("token")) return "";
    return `${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}

function normalizeReviewAnnotations(value: unknown): ReviewAnnotationValue[] {
  return arrayFrom(value).flatMap((entry) => {
    const row = asRecord(entry);
    const anchor = asRecord(row.anchor);
    const criterionId = stringFrom(row.criterionId);
    const precision = stringFrom(anchor.precision).toUpperCase();
    if (!criterionId || !["SPAN", "BLOCK", "PAGE"].includes(precision))
      return [];
    const bbox = Array.isArray(anchor.bbox)
      ? anchor.bbox.map(Number).filter(Number.isFinite)
      : undefined;
    return [
      {
        ...(nullableString(row.id) ? { id: String(row.id) } : {}),
        criterionId,
        status: row.status === "SUPPRESSED" ? "SUPPRESSED" : "ACTIVE",
        comment: stringFrom(row.comment),
        anchor: {
          ...(nullableString(anchor.blockId)
            ? { blockId: String(anchor.blockId) }
            : {}),
          ...(positiveInteger(anchor.pageNumber) !== null
            ? { pageNumber: positiveInteger(anchor.pageNumber)! }
            : {}),
          ...(nonnegativeInteger(anchor.spanStart) !== null
            ? { spanStart: nonnegativeInteger(anchor.spanStart)! }
            : {}),
          ...(nonnegativeInteger(anchor.spanEnd) !== null
            ? { spanEnd: nonnegativeInteger(anchor.spanEnd)! }
            : {}),
          ...(bbox?.length === 4 ? { bbox } : {}),
          precision: precision as "SPAN" | "BLOCK" | "PAGE",
          ...(nullableString(anchor.excerpt)
            ? { excerpt: String(anchor.excerpt) }
            : {}),
        },
        ...(row.origin === "AI_DRAFT" || row.origin === "TEACHER"
          ? { origin: row.origin }
          : {}),
      },
    ];
  });
}

function statusFrom(value: unknown): TeacherReviewStatus {
  const status = stringFrom(value).toUpperCase();
  if (status in STATUS_ORDER) return status as TeacherReviewStatus;
  if (["SUBMITTED", "AWAITING_REVIEW", "READY_FOR_REVIEW"].includes(status))
    return "READY";
  if (status === "WORKING") return "IN_REVIEW";
  if (["QUEUED", "RUNNING", "CONVERTING", "GRADING"].includes(status))
    return "PROCESSING";
  if (["FAILED", "CONTENT_UNAVAILABLE", "STALE"].includes(status))
    return "BLOCKED";
  return "NOT_SUBMITTED";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function arrayFrom(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function stringFrom(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}
function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}
function finiteNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function nullableNumber(value: unknown) {
  const number = Number(value);
  return value !== null && value !== undefined && Number.isFinite(number)
    ? number
    : null;
}
function positiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
function nonnegativeInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}
function compareText(left: string, right: string) {
  return left.localeCompare(right, "zh-CN");
}
