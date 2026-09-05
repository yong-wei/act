"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  RotateCcw,
  Save,
} from "lucide-react";

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
  type ReviewAnnotationValue,
  type TeacherOriginalResponse,
  type TeacherOriginalResponseAsset,
  type TeacherReviewCriterion,
  type TeacherReviewDetail,
  type TeacherReviewQueueItem,
  type TeacherReviewQueueMode,
} from "./teacher-review-contracts";
import { StatusBadge } from "./teacher-review-queue";

type LoadState = "loading" | "ready" | "error" | "missing";
type MutationState =
  | "idle"
  | "saving"
  | "acting"
  | "conflict"
  | "confirmation-required"
  | "error"
  | "saved";

interface TeacherReviewWorkspaceProps {
  assignmentId: string;
  submissionId: string;
  initialQuestionId: string;
  initialMode: TeacherReviewQueueMode;
  initialStatus: string;
  initialReviewId: string | null;
  initialGradingRunId: string | null;
}

export function TeacherReviewWorkspace({
  assignmentId,
  submissionId,
  initialQuestionId,
  initialMode,
  initialStatus,
  initialReviewId,
  initialGradingRunId,
}: TeacherReviewWorkspaceProps) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [mutationState, setMutationState] = useState<MutationState>("idle");
  const [detail, setDetail] = useState<TeacherReviewDetail | null>(null);
  const [queue, setQueue] = useState<TeacherReviewQueueItem[]>([]);
  const [criteria, setCriteria] = useState<TeacherReviewCriterion[]>([]);
  const [overallComment, setOverallComment] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnResponseType, setReturnResponseType] =
    useState("SUBJECTIVE_TEXT");
  const [returnDeadline, setReturnDeadline] = useState(() =>
    defaultReturnDeadline(),
  );
  const [fallbackAcknowledgement, setFallbackAcknowledgement] = useState("");
  const [incompleteEvidenceConfirmed, setIncompleteEvidenceConfirmed] =
    useState(false);

  const applyReviewSnapshot = useCallback(
    (normalized: TeacherReviewDetail) => {
      setDetail(normalized);
      setCriteria(normalized.criteria);
      setOverallComment(normalized.overallComment);
    },
    [],
  );

  const loadQueue = useCallback(async () => {
    const response = await fetch(
      buildTeacherSubmissionQueueUrl(assignmentId, {
        mode: initialMode,
        status: initialStatus,
        questionId: initialMode === "question" ? initialQuestionId : undefined,
      }),
      { cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(`teacher-review-queue:${response.status}`);
    const normalized = normalizeTeacherSubmissionQueue(await response.json());
    return filterTeacherReviewQueue(
      buildDeterministicReviewQueue(
        normalized.submissions,
        initialMode,
        initialQuestionId,
        initialStatus,
      ),
      initialStatus,
    );
  }, [assignmentId, initialMode, initialQuestionId, initialStatus]);

  const load = useCallback(async () => {
    setLoadState("loading");
    setMutationState("idle");
    try {
      const reviewUrl = buildTeacherReviewApiUrl(assignmentId, submissionId, {
        reviewId: initialReviewId,
        gradingRunId: initialGradingRunId,
      });
      let [reviewResponse, nextQueue] = await Promise.all([
        fetch(reviewUrl, { cache: "no-store" }),
        loadQueue(),
      ]);
      if (reviewResponse.status === 404 && initialGradingRunId) {
        reviewResponse = await fetch(reviewUrl.replace(/\?.*$/, ""), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ gradingRunId: initialGradingRunId }),
        });
      }
      if (isUnavailableReviewStatus(reviewResponse.status)) {
        setQueue(nextQueue);
        setLoadState("missing");
        return;
      }
      if (!reviewResponse.ok)
        throw new Error(`teacher-review-detail:${reviewResponse.status}`);
      const normalized = normalizeTeacherReviewDetail(
        await reviewResponse.json(),
      );
      if (!normalized) {
        setQueue(nextQueue);
        setLoadState("missing");
        return;
      }
      applyReviewSnapshot(normalized);
      setReturnResponseType(
        responseKindToSubmissionResponseType(normalized.responseKind),
      );
      setQueue(nextQueue);
      setIncompleteEvidenceConfirmed(false);
      setLoadState("ready");
      requestAnimationFrame(() => headingRef.current?.focus());
    } catch {
      setLoadState("error");
    }
  }, [
    applyReviewSnapshot,
    assignmentId,
    initialGradingRunId,
    initialReviewId,
    loadQueue,
    submissionId,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentKey = `${submissionId}:${initialQuestionId}`;
  const neighbours = useMemo(
    () => findQueueNeighbours(queue, currentKey),
    [currentKey, queue],
  );
  const total = deriveReviewTotal(criteria);
  const reviewMutable = detail?.status === "IN_REVIEW";
  const maxTotal = criteria.reduce(
    (sum, criterion) => sum + criterion.maxPoints,
    0,
  );
  const reviewUrl = buildTeacherReviewApiUrl(assignmentId, submissionId, {
    reviewId: detail?.reviewId ?? initialReviewId,
  });

  const navigateTo = useCallback(
    (item: TeacherReviewQueueItem | null) => {
      if (!item) return;
      router.push(
        buildTeacherReviewHref(assignmentId, item, initialMode, initialStatus),
      );
    },
    [assignmentId, initialMode, initialStatus, router],
  );

  const save = useCallback(async (): Promise<number | null> => {
    if (!detail) return null;
    setMutationState("saving");
    try {
      const response = await fetch(reviewUrl, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reviewId: detail.reviewId,
          expectedVersion: detail.version,
          criteria: criteria.map(({ id, levelId, score, comment }) => ({
            criterionId: id,
            levelId,
            score,
            comment,
          })),
          annotations: detail.annotations,
          overallComment,
        }),
      });
      if (response.status === 409) {
        setMutationState("conflict");
        return null;
      }
      if (!response.ok)
        throw new Error(`teacher-review-save:${response.status}`);
      const normalized = normalizeTeacherReviewDetail(await response.json());
      const nextVersion = normalized?.version ?? detail.version + 1;
      if (normalized) {
        applyReviewSnapshot(normalized);
      } else {
        setDetail((current) =>
          current ? { ...current, version: current.version + 1 } : current,
        );
      }
      setMutationState("saved");
      return nextVersion;
    } catch {
      setMutationState("error");
      return null;
    }
  }, [applyReviewSnapshot, criteria, detail, overallComment, reviewUrl]);

  const act = useCallback(
    async (action: "return" | "approve") => {
      if (
        !detail ||
        (action === "return" &&
          !canSubmitReturn(returnReason, returnDeadline, returnResponseType))
      )
        return;
      const actionVersion =
        action === "approve" ? await save() : detail.version;
      if (actionVersion === null) return;
      setMutationState("acting");
      const oldIndex = Math.max(
        0,
        queue.findIndex((item) => item.key === currentKey),
      );
      try {
        const idempotencyKey = createIdempotencyKey(action, detail);
        const response = await fetch(
          `${reviewUrl.replace(/\?.*$/, "")}/${action}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "idempotency-key": idempotencyKey,
            },
            body: JSON.stringify({
              ...(action === "return"
                ? {
                    reviewId: detail.reviewId,
                    expectedVersion: actionVersion,
                    idempotencyKey,
                    reason: returnReason.trim(),
                    allowedResponseType: returnResponseType,
                    newDeadlineAt: new Date(returnDeadline).toISOString(),
                  }
                : buildTeacherReviewApprovalPayload(detail, {
                    expectedVersion: actionVersion,
                    idempotencyKey,
                    confirmIncompleteEvidence: incompleteEvidenceConfirmed,
                  })),
            }),
          },
        );
        if (response.status === 409) {
          const payload = await response.json().catch(() => ({}));
          setMutationState(teacherReviewConflictMutationState(payload));
          return;
        }
        if (!response.ok)
          throw new Error(`teacher-review-${action}:${response.status}`);
        const nextQueue = await loadQueue();
        const withoutCurrent = nextQueue.filter(
          (item) => item.key !== currentKey,
        );
        const nextItem =
          withoutCurrent[
            Math.min(oldIndex, Math.max(0, withoutCurrent.length - 1))
          ] ?? null;
        setQueue(nextQueue);
        if (nextItem) navigateTo(nextItem);
        else setLoadState("missing");
      } catch {
        setMutationState("error");
      }
    },
    [
      currentKey,
      detail,
      incompleteEvidenceConfirmed,
      loadQueue,
      navigateTo,
      queue,
      returnReason,
      returnDeadline,
      returnResponseType,
      reviewUrl,
      save,
    ],
  );

  const requestRelease = useCallback(async (mode: "RETRY_DERIVATIVE" | "STRUCTURED_ONLY") => {
    if (!detail || (mode === "STRUCTURED_ONLY" && fallbackAcknowledgement.trim().length < 8)) return;
    setMutationState("acting");
    try {
      const response = await fetch(`${reviewUrl.replace(/\?.*$/, "")}/release`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewId: detail.reviewId, mode, limitationAcknowledgement: fallbackAcknowledgement.trim() || undefined }),
      });
      if (!response.ok) throw new Error(`teacher-review-release:${response.status}`);
      setMutationState("saved");
    } catch {
      setMutationState("error");
    }
  }, [detail, fallbackAcknowledgement, reviewUrl]);

  if (loadState === "loading")
    return (
      <ReviewShell>
        <ReviewLoading />
      </ReviewShell>
    );
  if (loadState === "error")
    return (
      <ReviewShell>
        <StatePanel
          kind="error"
          title="批阅内容暂时无法加载"
          detail="没有保存任何更改，可安全重试。"
          action={
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-400 px-4"
            >
              <RefreshCw className="h-4 w-4" />
              重试
            </button>
          }
        />
      </ReviewShell>
    );
  if (loadState === "missing" || !detail)
    return (
      <ReviewShell>
        <StatePanel
          kind="empty"
          title="当前批阅项目不可用"
          detail="它可能已完成、被筛选移除，或缺少可授权的证据。"
          action={
            <Link
              href={`/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions`}
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-600 px-4"
            >
              返回提交队列
            </Link>
          }
        />
      </ReviewShell>
    );

  const mutationBusy =
    mutationState === "saving" || mutationState === "acting";
  const canEditReview = criteria.length > 0 && reviewMutable && !mutationBusy;
  const canReturnReview = canSubmitReturn(
    returnReason,
    returnDeadline,
    returnResponseType,
  );
  const canApproveReview = !(
    detail.incompleteEvidence && !incompleteEvidenceConfirmed
  );

  return (
    <main
      className="surface-page min-h-screen text-slate-100"
      data-teacher-review-workspace="three-pane"
    >
      <header className="border-b border-slate-800 bg-slate-950/90 px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions`}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回提交队列
            </Link>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="truncate text-lg font-semibold text-white outline-none"
            >
              {detail.assignmentTitle} · {detail.studentName}
            </h1>
          </div>
          <StatusBadge status={detail.status} />
        </div>
      </header>

      <div
        className="border-b border-amber-500/30 bg-amber-950/30 px-4 py-4 md:hidden"
        data-review-mobile-handoff
      >
        <p className="font-medium text-amber-100">请在平板或电脑端继续批阅</p>
        <p className="mt-1 text-sm text-amber-200/80">
          手机端可查看状态与切换项目，但评分项编辑和文档批注需要至少 768px
          宽度。
        </p>
        <div className="mt-3 flex gap-2">
          <NavigationButton
            label="上一项"
            item={neighbours.previous}
            onNavigate={navigateTo}
          />
          <NavigationButton
            label="下一项"
            item={neighbours.next}
            onNavigate={navigateTo}
          />
        </div>
      </div>

      <div className="mx-auto hidden min-h-[calc(100vh-73px)] max-w-[1600px] md:grid md:grid-cols-[16rem_minmax(0,1fr)_22rem]">
        <aside
          aria-label="学生与题目导航"
          className="border-r border-slate-800 bg-slate-950/60 p-4"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {initialMode === "student" ? "按学生队列" : "按题队列"}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <NavigationButton
              label="上一项"
              item={neighbours.previous}
              onNavigate={navigateTo}
            />
            <NavigationButton
              label="下一项"
              item={neighbours.next}
              onNavigate={navigateTo}
            />
          </div>
          <dl className="mt-5 space-y-3 border-y border-slate-800 py-4 text-sm">
            <div>
              <dt className="text-slate-500">学生</dt>
              <dd>{detail.studentName}</dd>
              <dd className="text-xs text-slate-500">
                {detail.studentNumber ?? "无学号"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">进度</dt>
              <dd>
                {Math.max(
                  1,
                  queue.findIndex((item) => item.key === currentKey) + 1,
                )}{" "}
                / {queue.length}
              </dd>
            </div>
          </dl>
          <nav aria-label="题目导航" className="mt-5 space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              题目
            </p>
            {detail.questions.map((question) => (
              <Link
                key={question.id}
                aria-current={
                  question.id === detail.questionId ? "page" : undefined
                }
                href={buildTeacherReviewHref(
                  assignmentId,
                  {
                    submissionId,
                    questionId: question.id,
                    reviewId: question.reviewId,
                    gradingRunId: question.gradingRunId,
                  },
                  initialMode,
                  initialStatus,
                )}
                className={`block rounded-lg border px-3 py-3 text-sm ${question.id === detail.questionId ? "border-cyan-500 bg-cyan-950/30 text-cyan-100" : "border-slate-800 text-slate-300 hover:border-slate-600"}`}
              >
                <span className="line-clamp-2">{question.title}</span>
                <span className="mt-2 block">
                  <StatusBadge status={question.status} />
                </span>
              </Link>
            ))}
          </nav>
        </aside>

        <section
          aria-label="作答证据"
          className="min-w-0 bg-slate-900/30 p-5 lg:p-6"
        >
          <div className="mb-4">
            <p className="text-xs text-cyan-300">当前题目</p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {detail.questionTitle}
            </h2>
            {detail.questionPrompt ? (
              <p className="mt-2 text-sm text-slate-400">
                {detail.questionPrompt}
              </p>
            ) : null}
          </div>
          {!detail.originalResponse ? (
            <StatePanel
              kind="empty"
              title="暂无原始作答"
              detail="当前封存提交中没有正文或附件。"
            />
          ) : (
            <OriginalResponsePanel response={detail.originalResponse} />
          )}
        </section>

        <aside
          aria-label="评分规则与批阅操作"
          className="border-l border-slate-800 bg-slate-950/70 p-4"
        >
          <div className="sticky top-4 space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  派生总分
                </p>
                <p
                  className="text-2xl font-semibold text-white"
                  data-derived-review-total
                >
                  {total}
                  <span className="text-sm font-normal text-slate-500">
                    {" "}
                    / {maxTotal}
                  </span>
                </p>
              </div>
              <span className="text-xs text-slate-500">仅由评分项求和</span>
            </div>
            {detail.incompleteEvidence && (
              <div className="rounded-lg border border-amber-500/70 bg-amber-500/10 p-3">
                <p className="text-sm font-medium text-amber-100">
                  部分附件未纳入本次建议，请结合原件核对
                </p>
                {detail.omittedEvidence.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-100">
                    {detail.omittedEvidence.map((item) => (
                      <li key={item.assetId}>{item.displayName}</li>
                    ))}
                  </ul>
                )}
                <label className="mt-3 flex min-h-10 items-center gap-2 text-sm text-amber-50">
                  <input
                    type="checkbox"
                    checked={incompleteEvidenceConfirmed}
                    onChange={(event) =>
                      setIncompleteEvidenceConfirmed(event.target.checked)
                    }
                    disabled={!reviewMutable}
                    className="h-4 w-4 rounded border-amber-400 bg-slate-900"
                  />
                  我已结合原件核对并确认当前评分
                </label>
              </div>
            )}
            {criteria.length === 0 ? (
              <StatePanel
                kind="empty"
                title="Rubric 尚不可用"
                detail="无法安全保存或批准此项目。"
              />
            ) : (
              <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                {criteria.map((criterion) => (
                  <CriterionEditor
                    key={criterion.id}
                    criterion={criterion}
                    evidenceAnchors={detail.aiAnnotations.filter(
                      (annotation) =>
                        annotation.criterionId === criterion.id &&
                        annotation.status === "ACTIVE" &&
                        annotation.origin === "AI_DRAFT",
                    )}
                    readOnly={!reviewMutable}
                    onChange={(next) => {
                      setCriteria((current) =>
                        current.map((item) =>
                          item.id === next.id ? next : item,
                        ),
                      );
                      setMutationState("idle");
                    }}
                  />
                ))}
              </div>
            )}
            <label className="block text-sm">
              <span className="text-slate-400">总体评语</span>
              <textarea
                disabled={!reviewMutable}
                value={overallComment}
                maxLength={4000}
                onChange={(event) => {
                  setOverallComment(event.target.value);
                  setMutationState("idle");
                }}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-400">退回原因</span>
              <textarea
                disabled={!reviewMutable}
                value={returnReason}
                maxLength={1000}
                onChange={(event) => setReturnReason(event.target.value)}
                rows={2}
                aria-describedby="return-reason-help"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"
              />
              <span
                id="return-reason-help"
                className="mt-1 block text-xs text-slate-500"
              >
                退回学生时至少填写 8 个字符，不会用于批准。
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-slate-400">
                允许重新作答类型
                <select
                  disabled={!reviewMutable}
                  value={returnResponseType}
                  onChange={(event) =>
                    setReturnResponseType(event.target.value)
                  }
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-sm text-white"
                >
                  <option value="SUBJECTIVE_TEXT">文本</option>
                  <option value="SUBJECTIVE_FILE">文档</option>
                </select>
              </label>
              <label className="block text-xs text-slate-400">
                重新提交截止时间
                <input
                  disabled={!reviewMutable}
                  type="datetime-local"
                  value={returnDeadline}
                  onChange={(event) => setReturnDeadline(event.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-sm text-white"
                />
              </label>
            </div>
            <MutationMessage
              state={mutationState}
              onReload={() => void load()}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!canEditReview}
                onClick={() => void save()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-600 text-slate-100 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                保存
              </button>
              <button
                type="button"
                disabled={!canEditReview || !canReturnReview}
                onClick={() => void act("return")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-500 text-amber-200 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                退回
              </button>
              <button
                type="button"
                disabled={!canEditReview || !canApproveReview}
                onClick={() => void act("approve")}
                className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 font-medium text-white disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                批准并前往下一项
              </button>
            </div>
            {detail.status === "APPROVED" && <div className="rounded-lg border border-slate-700 p-3">
              <p className="text-sm font-medium text-white">反馈发布</p>
              <p className="mt-1 text-xs text-slate-400">派生文件失败时可重试；仅在确认定位限制后发布结构化反馈。</p>
              <textarea value={fallbackAcknowledgement} onChange={(event) => setFallbackAcknowledgement(event.target.value)} maxLength={1000} rows={2} placeholder="说明并确认结构化反馈的限制（至少 8 个字符）" className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-white" />
              <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={mutationState === "acting"} onClick={() => void requestRelease("RETRY_DERIVATIVE")} className="min-h-10 rounded-lg border border-slate-600 text-sm text-slate-100 disabled:opacity-50">重试派生文件</button><button type="button" disabled={mutationState === "acting" || fallbackAcknowledgement.trim().length < 8} onClick={() => void requestRelease("STRUCTURED_ONLY")} className="min-h-10 rounded-lg border border-amber-500 text-sm text-amber-200 disabled:opacity-50">带限制发布</button></div>
            </div>}
          </div>
        </aside>
      </div>
    </main>
  );
}

export function OriginalResponsePanel({
  response,
  initialAccessUrls = {},
}: {
  response: TeacherOriginalResponse;
  initialAccessUrls?: Record<string, string>;
}) {
  const [accessUrls, setAccessUrls] =
    useState<Record<string, string>>(initialAccessUrls);
  const [accessErrors, setAccessErrors] =
    useState<Record<string, boolean>>({});
  const requestedAssetIds = useRef(new Set<string>());
  const previewAssets = useMemo(
    () => response.assets.filter(isPreviewableOriginalAsset),
    [response.assets],
  );

  const loadAssetAccess = useCallback(
    async (asset: TeacherOriginalResponseAsset) => {
      if (requestedAssetIds.current.has(asset.id)) return;
      requestedAssetIds.current.add(asset.id);
      setAccessErrors((current) => ({ ...current, [asset.id]: false }));
      try {
        const url = await requestOriginalAssetAccess(asset);
        if (url) {
          setAccessUrls((current) => ({ ...current, [asset.id]: url }));
        } else {
          setAccessErrors((current) => ({ ...current, [asset.id]: true }));
        }
      } catch {
        setAccessErrors((current) => ({ ...current, [asset.id]: true }));
      } finally {
        requestedAssetIds.current.delete(asset.id);
      }
    },
    [],
  );

  useEffect(() => {
    const missing = previewAssets.filter(
      (asset) =>
        !accessUrls[asset.id] &&
        !accessErrors[asset.id] &&
        !requestedAssetIds.current.has(asset.id),
    );
    if (missing.length === 0) return;
    missing.forEach((asset) => void loadAssetAccess(asset));
  }, [accessErrors, accessUrls, loadAssetAccess, previewAssets]);

  const assetByMarkdownReference = useMemo(
    () => new Map<string, TeacherOriginalResponseAsset>(
      response.assets.flatMap((asset) =>
        asset.role === "EMBEDDED_IMAGE" && asset.embeddedPosition
          ? [[`asset:${asset.embeddedPosition}`, asset] as const]
          : []),
    ),
    [response.assets],
  );
  const attachments = response.assets.filter(
    (asset) => asset.role === "ATTACHMENT",
  );
  const resolveMarkdownAsset = (src: string, title?: string) => {
    const titledReference = title?.startsWith("asset:md:") ? title : null;
    const directReference = src.startsWith("asset:md:") ? src : null;
    return assetByMarkdownReference.get(titledReference ?? directReference ?? "");
  };

  return (
    <div className="space-y-4" data-original-assignment-response>
      {response.textSnapshot ? (
        <article className="rounded-xl border border-slate-800 bg-white p-5 text-slate-900">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            urlTransform={(url, key) =>
              key === "src" && url.startsWith("asset:md:")
                ? url
                : key === "href"
                  ? "#"
                  : ""}
            components={{
              h1: ({ children }) => (
                <h3 className="mt-5 text-xl font-semibold">{children}</h3>
              ),
              h2: ({ children }) => (
                <h4 className="mt-4 text-lg font-semibold">{children}</h4>
              ),
              h3: ({ children }) => (
                <h5 className="mt-4 font-semibold">{children}</h5>
              ),
              h4: ({ children }) => <h6 className="mt-3 font-semibold">{children}</h6>,
              h5: ({ children }) => <h6 className="mt-3 font-semibold">{children}</h6>,
              h6: ({ children }) => <h6 className="mt-3 font-semibold">{children}</h6>,
              img: ({ src = "", alt = "", title }) => {
                const asset = resolveMarkdownAsset(
                  typeof src === "string" ? src : "",
                  typeof title === "string" ? title : undefined,
                );
                const resolved = asset ? accessUrls[asset.id] ?? "" : "";
                return resolved ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolved}
                    alt={alt}
                    className="my-4 max-h-[36rem] w-full rounded-lg border border-slate-200 object-contain"
                  />
                ) : asset && accessErrors[asset.id] ? (
                  <button
                    type="button"
                    onClick={() => void loadAssetAccess(asset)}
                    className="my-4 block w-full rounded-lg border border-dashed border-amber-400 p-4 text-sm text-amber-700"
                  >
                    嵌入图片载入失败，重试
                  </button>
                ) : (
                  <span
                    role="status"
                    className="my-4 block rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500"
                  >
                    正在载入嵌入图片
                  </span>
                );
              },
              a: ({ children }) => <span>{children}</span>,
              p: ({ children }) => (
                <p className="my-3 text-sm leading-7">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="my-3 ml-6 list-disc space-y-1">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-3 ml-6 list-decimal space-y-1">{children}</ol>
              ),
            }}
          >
            {response.textSnapshot}
          </ReactMarkdown>
        </article>
      ) : null}
      {attachments.length ? (
        <ol className="space-y-3" aria-label="原始附件">
          {attachments.map((asset, index) => (
            <li key={asset.id}>
              <OriginalAttachmentCard
                asset={asset}
                number={index + 1}
                previewUrl={accessUrls[asset.id] ?? null}
              />
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function OriginalAttachmentCard({
  asset,
  number,
  previewUrl,
}: {
  asset: TeacherOriginalResponseAsset;
  number: number;
  previewUrl: string | null;
}) {
  const image = isDirectImage(asset.mimeType);
  const pdf = asset.mimeType === "application/pdf";
  const [accessActionError, setAccessActionError] = useState<
    "popup-blocked" | "access-failed" | null
  >(null);
  const handleOpen = (download: boolean) => {
    setAccessActionError(null);
    void openOriginalAsset(asset, download).then((result) => {
      if (result !== "opened") setAccessActionError(result);
    });
  };
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm text-cyan-200">
            {number}
          </span>
          <FileText className="h-5 w-5 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium text-white">
              {asset.displayName}
            </h3>
            <p className="text-xs text-slate-500">
              {formatOriginalAssetKind(asset.mimeType)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleOpen(false)}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-700 px-3 text-sm text-slate-200"
          >
            <ExternalLink className="h-4 w-4" />
            打开
          </button>
          <button
            type="button"
            onClick={() => handleOpen(true)}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-700 px-3 text-sm text-slate-200"
          >
            <Download className="h-4 w-4" />
            下载
          </button>
        </div>
      </div>
      {accessActionError ? (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {originalAssetAccessErrorMessage(accessActionError)}
        </p>
      ) : null}
      {image && previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={asset.displayName}
          className="mt-4 max-h-[36rem] w-full rounded-lg bg-white object-contain"
        />
      ) : null}
      {pdf && previewUrl ? (
        <iframe
          title={`${asset.displayName} PDF 阅读器`}
          src={previewUrl}
          sandbox=""
          referrerPolicy="no-referrer"
          className="mt-4 h-[65vh] w-full rounded-lg bg-white"
        />
      ) : null}
    </section>
  );
}

export function originalAssetAccessErrorMessage(
  error: "popup-blocked" | "access-failed",
) {
  return error === "popup-blocked"
    ? "浏览器阻止了新窗口，请允许弹出窗口后重试。"
    : "原件授权暂时失败，请重试。";
}

async function requestOriginalAssetAccess(
  asset: TeacherOriginalResponseAsset,
) {
  const response = await fetch(asset.accessEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  if (!response.ok) return "";
  const payload = await response.json().catch(() => null);
  if (typeof payload?.access?.url !== "string") return "";
  const url = new URL(payload.access.url, window.location.origin);
  return url.origin === window.location.origin
    && url.pathname.startsWith("/api/teacher/assignments/")
    ? `${url.pathname}${url.search}`
    : "";
}

export async function openOriginalAsset(
  asset: TeacherOriginalResponseAsset,
  download: boolean,
  dependencies: {
    openWindow?: () => {
      opener: unknown;
      location: { href: string };
      close: () => void;
    } | null;
    requestAccess?: (
      asset: TeacherOriginalResponseAsset,
    ) => Promise<string>;
    origin?: string;
  } = {},
) {
  const pendingWindow = dependencies.openWindow
    ? dependencies.openWindow()
    : window.open("about:blank", "_blank");
  if (!pendingWindow) return "popup-blocked" as const;
  try {
    pendingWindow.opener = null;
    const accessUrl = await (
      dependencies.requestAccess ?? requestOriginalAssetAccess
    )(asset);
    if (!accessUrl) {
      pendingWindow.close();
      return "access-failed" as const;
    }
    const url = new URL(
      accessUrl,
      dependencies.origin ?? window.location.origin,
    );
    if (download) url.searchParams.set("download", "1");
    pendingWindow.location.href = `${url.pathname}${url.search}`;
    return "opened" as const;
  } catch {
    pendingWindow.close();
    return "access-failed" as const;
  }
}

function isUnavailableReviewStatus(status: number) {
  return status === 404 || status === 409 || status === 410;
}

function canSubmitReturn(
  reason: string,
  deadline: string,
  responseType: string,
) {
  return reason.trim().length >= 8 && Boolean(deadline) && Boolean(responseType);
}

function isPreviewableOriginalAsset(asset: TeacherOriginalResponseAsset) {
  return (
    asset.role === "EMBEDDED_IMAGE" ||
    isDirectImage(asset.mimeType) ||
    asset.mimeType === "application/pdf"
  );
}

function isDirectImage(mimeType: string) {
  return mimeType === "image/png" || mimeType === "image/jpeg";
}

function formatOriginalAssetKind(mimeType: string) {
  const labels: Record<string, string> = {
    "application/pdf": "PDF 原件",
    "application/msword": "DOC 原件",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "DOCX 原件",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "PPTX 原件",
    "image/png": "PNG 原图",
    "image/jpeg": "JPEG 原图",
    "text/markdown": "Markdown 原件",
    "text/plain": "纯文本原件",
  };
  return labels[mimeType] ?? "原始文件";
}

function CriterionEditor({
  criterion,
  evidenceAnchors,
  onChange,
  readOnly,
}: {
  criterion: TeacherReviewCriterion;
  evidenceAnchors: ReviewAnnotationValue[];
  onChange: (criterion: TeacherReviewCriterion) => void;
  readOnly: boolean;
}) {
  const scoreId = `criterion-${criterion.id}-score`;
  const selectedLevel = criterion.levels.find(
    (level) => level.id === criterion.levelId,
  );
  return (
    <fieldset className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <legend className="px-1 text-sm font-medium text-white">
        {criterion.label}
      </legend>
      <CriterionAiSuggestion
        criterion={criterion}
        evidenceAnchors={evidenceAnchors}
      />
      {criterion.levels.length ? (
        <label className="mb-2 block text-xs text-slate-400">
          Rubric 档位
          <select
            disabled={readOnly}
            value={criterion.levelId ?? ""}
            onChange={(event) => {
              const level = criterion.levels.find(
                (candidate) => candidate.id === event.target.value,
              );
              if (!level) return;
              onChange({
                ...criterion,
                levelId: level.id,
              });
            }}
            className="mt-1 min-h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-white"
          >
            {criterion.levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.label}（{level.minPoints}–{level.maxPoints}）
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label htmlFor={scoreId} className="text-xs text-slate-400">
        教师评分
        {selectedLevel
          ? `（当前档位 ${selectedLevel.minPoints}–${selectedLevel.maxPoints}）`
          : `（最高 ${criterion.maxPoints}）`}
      </label>
      <input
        disabled={readOnly}
        id={scoreId}
        type="number"
        min={0}
        max={criterion.maxPoints}
        step={criterion.scoreStep}
        value={criterion.score}
        onChange={(event) =>
          onChange({
            ...criterion,
            score: Math.min(
              criterion.maxPoints,
              Math.max(0, Number(event.target.value) || 0),
            ),
          })
        }
        className="mt-1 min-h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-white"
      />
      <label className="mt-2 block text-xs text-slate-400">
        评分说明
        <textarea
          disabled={readOnly}
          value={criterion.comment}
          maxLength={2000}
          onChange={(event) =>
            onChange({ ...criterion, comment: event.target.value })
          }
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-white"
        />
      </label>
    </fieldset>
  );
}

export function CriterionAiSuggestion({
  criterion,
  evidenceAnchors,
}: {
  criterion: TeacherReviewCriterion;
  evidenceAnchors: ReviewAnnotationValue[];
}) {
  if (criterion.aiScore === null && evidenceAnchors.length === 0) return null;
  return (
    <div
      className="mb-2 rounded bg-slate-950 p-2 text-xs text-slate-400"
      data-auto-criterion-suggestion
    >
      {criterion.aiScore !== null ? (
        <span>
          自动预评分：{criterion.aiScore} / {criterion.maxPoints}
        </span>
      ) : null}
      {criterion.aiComment ? (
        <p className="mt-1">{criterion.aiComment}</p>
      ) : null}
      {evidenceAnchors.length > 0 ? (
        <div className="mt-2 border-t border-slate-800 pt-2">
          <p className="font-medium text-slate-300">证据锚点</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {evidenceAnchors.map((annotation, index) => (
              <li key={annotation.id ?? `${annotation.criterionId}-${index}`}>
                {describeEvidenceAnchor(annotation)}
                {annotation.anchor.excerpt ? (
                  <blockquote className="mt-1 border-l border-slate-700 pl-2 text-slate-300">
                    {annotation.anchor.excerpt}
                  </blockquote>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function describeEvidenceAnchor(annotation: ReviewAnnotationValue) {
  const locations = [
    annotation.anchor.pageNumber
      ? `第 ${annotation.anchor.pageNumber} 页`
      : null,
    annotation.anchor.blockId || (annotation.anchor.spanStart !== undefined && annotation.anchor.spanEnd !== undefined)
      ? '作答片段'
      : null,
  ].filter(Boolean);
  return locations.join(" · ") || "已关联证据位置";
}

function NavigationButton({
  label,
  item,
  onNavigate,
}: {
  label: string;
  item: TeacherReviewQueueItem | null;
  onNavigate: (item: TeacherReviewQueueItem | null) => void;
}) {
  const previous = label.includes("上一");
  return (
    <button
      type="button"
      disabled={!item}
      onClick={() => onNavigate(item)}
      className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-slate-700 px-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
    >
      {previous ? <ChevronLeft className="h-4 w-4" /> : null}
      {label}
      {!previous ? <ChevronRight className="h-4 w-4" /> : null}
    </button>
  );
}
function MutationMessage({
  state,
  onReload,
}: {
  state: MutationState;
  onReload: () => void;
}) {
  if (state === "idle") return null;
  if (state === "conflict")
    return (
      <div
        role="alert"
        className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-100"
      >
        此批阅已被更新。
        <button type="button" onClick={onReload} className="ml-2 underline">
          重新加载最新版本
        </button>
      </div>
    );
  if (state === "confirmation-required")
    return (
      <div
        role="alert"
        className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-100"
      >
        请先确认已结合原件核对未纳入建议的附件，再重新批准。
      </div>
    );
  if (state === "error")
    return (
      <div
        role="alert"
        className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-100"
      >
        操作失败，当前编辑仍保留，请重试。
      </div>
    );
  return (
    <p role="status" aria-live="polite" className="text-sm text-slate-400">
      {state === "saving"
        ? "正在保存…"
        : state === "acting"
          ? "正在提交操作…"
          : "已保存"}
    </p>
  );
}
function ReviewShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="surface-page flex min-h-screen items-center justify-center px-4 py-10">
      {children}
    </main>
  );
}
function ReviewLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full max-w-5xl space-y-4"
    >
      <span className="sr-only">正在加载批阅工作台</span>
      <div className="h-16 animate-pulse rounded-xl bg-slate-800" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-96 animate-pulse rounded-xl bg-slate-800" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-800 md:col-span-2" />
      </div>
    </div>
  );
}
function StatePanel({
  kind,
  title,
  detail,
  action,
}: {
  kind: "empty" | "error";
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      role={kind === "error" ? "alert" : undefined}
      className={`w-full rounded-xl border p-6 ${kind === "error" ? "border-rose-500/40 bg-rose-950/30 text-rose-100" : "border-dashed border-slate-700 text-slate-200"}`}
    >
      {kind === "error" ? <AlertCircle className="mb-3 h-6 w-6" /> : null}
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm opacity-80">{detail}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

function defaultReturnDeadline() {
  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const local = new Date(
    deadline.getTime() - deadline.getTimezoneOffset() * 60_000,
  );
  return local.toISOString().slice(0, 16);
}

function createIdempotencyKey(
  action: "return" | "approve",
  detail: TeacherReviewDetail,
) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `teacher-review:${action}:${detail.submissionId}:${detail.questionId}:${detail.version}:${random}`;
}
