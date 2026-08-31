"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Users,
  WandSparkles,
} from "lucide-react";

import {
  buildDeterministicReviewQueue,
  buildTeacherAssignmentGradingHref,
  buildTeacherReviewHref,
  buildTeacherSubmissionQueueUrl,
  filterTeacherReviewQueue,
  firstReviewableQueueItem,
  normalizeTeacherSubmissionQueue,
  type TeacherReviewQueueMode,
  type TeacherReviewSubmissionItem,
} from "./teacher-review-contracts";

type LoadState = "loading" | "ready" | "error";

export function TeacherReviewQueue({ assignmentId }: { assignmentId: string }) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [assignmentTitle, setAssignmentTitle] = useState("作业提交");
  const [submissions, setSubmissions] = useState<TeacherReviewSubmissionItem[]>(
    [],
  );
  const [mode, setMode] = useState<TeacherReviewQueueMode>("student");
  const [status, setStatus] = useState("ALL");
  const [questionId, setQuestionId] = useState("");

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const response = await fetch(
        buildTeacherSubmissionQueueUrl(assignmentId, {
          mode,
          status,
          questionId: mode === "question" ? questionId || undefined : undefined,
        }),
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error(`teacher-submission-queue:${response.status}`);
      const normalized = normalizeTeacherSubmissionQueue(await response.json());
      setAssignmentTitle(normalized.assignmentTitle);
      setSubmissions(normalized.submissions);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [assignmentId, mode, questionId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const questionOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const submission of submissions) {
      for (const question of submission.questions)
        byId.set(question.id, question.title);
    }
    return Array.from(byId, ([id, title]) => ({ id, title }));
  }, [submissions]);

  useEffect(() => {
    if (mode === "question" && !questionId && questionOptions[0])
      setQuestionId(questionOptions[0].id);
  }, [mode, questionId, questionOptions]);

  const fullQueue = useMemo(
    () =>
      buildDeterministicReviewQueue(
        submissions,
        mode,
        mode === "question" ? questionId : undefined,
        status,
      ),
    [mode, questionId, status, submissions],
  );
  const queue = useMemo(
    () => filterTeacherReviewQueue(fullQueue, status),
    [fullQueue, status],
  );
  const firstReviewable = firstReviewableQueueItem(queue);
  const semantics =
    loadState === "loading"
      ? "loading"
      : loadState === "error"
        ? "error"
        : submissions.length === 0
          ? "empty"
          : queue.length === 0
            ? "filtered-empty"
            : "ready";

  return (
    <main
      className="surface-page min-h-screen px-4 py-6 md:px-8"
      data-teacher-review-queue={mode}
      data-operations-status-semantics={semantics}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/teacher/assignments"
              className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-300"
            >
              <ArrowLeft className="h-4 w-4" />
              返回作业
            </Link>
            <h1 className="text-2xl font-semibold text-white">
              {assignmentTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-400">提交与批阅队列</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildTeacherAssignmentGradingHref(assignmentId)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cyan-500/60 px-4 font-medium text-cyan-100 hover:border-cyan-300 hover:text-white"
            >
              <WandSparkles className="h-4 w-4" />
              进入截止后批改
            </Link>
            {firstReviewable ? (
            <Link
              href={buildTeacherReviewHref(
                assignmentId,
                firstReviewable,
                mode,
                status,
              )}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 font-medium text-white hover:bg-cyan-500"
            >
              进入批阅
              <ChevronRight className="h-4 w-4" />
            </Link>
            ) : null}
          </div>
        </header>

        <section
          aria-label="队列视图与筛选"
          className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-[auto_1fr_1fr]"
        >
          <div
            className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-1"
            role="group"
            aria-label="批阅队列模式"
          >
            <ModeButton
              active={mode === "student"}
              onClick={() => setMode("student")}
            >
              <Users className="h-4 w-4" />
              按学生
            </ModeButton>
            <ModeButton
              active={mode === "question"}
              onClick={() => setMode("question")}
            >
              <FileText className="h-4 w-4" />
              按题
            </ModeButton>
          </div>
          <label>
            <span className="sr-only">按批阅状态筛选</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white"
            >
              <option value="ALL">全部状态</option>
              <option value="PENDING">待批阅</option>
              <option value="PROCESSING">处理中</option>
              <option value="APPROVED">已批准</option>
              <option value="RETURNED">已退回</option>
              <option value="BLOCKED">受阻</option>
            </select>
          </label>
          <label>
            <span className="sr-only">选择题目</span>
            <select
              value={questionId}
              disabled={mode !== "question"}
              onChange={(event) => setQuestionId(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">选择题目</option>
              {questionOptions.map((question) => (
                <option key={question.id} value={question.id}>
                  {question.title}
                </option>
              ))}
            </select>
          </label>
        </section>

        {loadState === "loading" ? <QueueLoading /> : null}
        {loadState === "error" ? (
          <QueueError onRetry={() => void load()} />
        ) : null}
        {loadState === "ready" && submissions.length === 0 ? (
          <QueueEmpty title="暂无提交" detail="学生提交后会出现在这里。" />
        ) : null}
        {loadState === "ready" &&
        submissions.length > 0 &&
        queue.length === 0 ? (
          <QueueEmpty
            title="当前筛选下没有项目"
            detail="调整状态或题目筛选后再试。"
          >
            <button
              type="button"
              onClick={() => {
                setStatus("ALL");
                setQuestionId(questionOptions[0]?.id ?? "");
              }}
              className="mt-4 min-h-11 rounded-lg border border-slate-600 px-4 text-slate-100"
            >
              清除筛选
            </button>
          </QueueEmpty>
        ) : null}
        {loadState === "ready" && queue.length > 0 ? (
          <section
            aria-label="提交队列"
            className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60"
          >
            <div
              className="border-b border-slate-800 px-4 py-3 text-sm text-slate-400"
              role="status"
            >
              当前 {queue.length} 个批阅项目
            </div>
            <ul className="divide-y divide-slate-800">
              {queue.map((item) => (
                <li key={item.key}>
                  <Link
                    href={buildTeacherReviewHref(
                      assignmentId,
                      item,
                      mode,
                      status,
                    )}
                    className="grid min-h-20 gap-2 px-4 py-4 hover:bg-slate-800/60 md:grid-cols-[minmax(10rem,1fr)_minmax(12rem,2fr)_8rem_auto] md:items-center"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {item.studentName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.studentNumber ?? "无学号"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-200">
                        {item.questionTitle}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.responseKind === "DOCUMENT"
                          ? "文档作答"
                          : item.responseKind === "TEXT"
                            ? "文本作答"
                            : "等待作答证据"}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                    <ChevronRight className="hidden h-4 w-4 text-slate-500 md:block" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm ${active ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"}`}
    >
      {children}
    </button>
  );
}

function QueueLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">正在加载提交队列</span>
      {[1, 2, 3, 4].map((id) => (
        <div key={id} className="h-20 animate-pulse rounded-xl bg-slate-800" />
      ))}
    </div>
  );
}
function QueueError({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      role="alert"
      className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-6 text-rose-100"
    >
      <AlertCircle className="mb-3 h-6 w-6" />
      <h2 className="font-semibold">提交队列暂时无法加载</h2>
      <p className="mt-1 text-sm text-rose-200">
        没有执行任何批阅操作，可安全重试。
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-400 px-4"
      >
        <RefreshCw className="h-4 w-4" />
        重试
      </button>
    </section>
  );
}
function QueueEmpty({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
      <h2 className="font-medium text-white">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">{detail}</p>
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const label =
    (
      {
        READY: "待批阅",
        IN_REVIEW: "批阅中",
        PROCESSING: "处理中",
        RETURNED: "已退回",
        APPROVED: "已批准",
        BLOCKED: "受阻",
        NOT_SUBMITTED: "未提交",
      } as Record<string, string>
    )[status] ?? status;
  const tone =
    status === "APPROVED"
      ? "bg-emerald-950 text-emerald-300"
      : status === "BLOCKED"
        ? "bg-rose-950 text-rose-300"
        : status === "PROCESSING"
          ? "bg-amber-950 text-amber-300"
          : "bg-slate-800 text-slate-300";
  return (
    <span className={`w-fit rounded-full px-2.5 py-1 text-xs ${tone}`}>
      {label}
    </span>
  );
}
