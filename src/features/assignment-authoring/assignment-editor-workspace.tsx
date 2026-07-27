'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Library,
  Loader2,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';

import {
  ASSIGNMENT_RUBRIC_GOAL_DIMENSIONS,
  assignmentDraftSchema,
  validatePublicationScores,
  type AssignmentDraftInput,
} from '@/lib/assignments/assignment-domain';
import {
  addDetailedRubricLevel,
  applyRubricLevelShortcut,
  createInitialDetailedLevel,
  deriveRubricLevelRanges,
  inferEditedRubricLevelIds,
  sortRubricLevels,
} from '@/lib/assignments/assignment-rubric-contract';
import {
  applyGeneratedRubricGuidelines,
  deriveAssignmentTotal,
  EMPTY_ASSIGNMENT_DRAFT,
  synchronizeAssignmentTotal,
  type AssignmentEditorDocument,
  type GovernedQuestionSummary,
} from './assignment-ui-contracts';
import { GovernedQuestionPicker } from './governed-question-picker';
import {
  AssignmentEmbeddedEditor,
  type AssignmentEmbeddedSaveState,
} from '@/features/teacher/preparation-document-editor/assignment-embedded-editor';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';
type SaveResult = {
  document: AssignmentEditorDocument;
  draftFingerprint: string;
};
type ManagedClassOption = {
  id: string;
  name: string;
  code: string;
  year: string | null;
  semester: string | null;
};
type RubricGenerationBasis = 'scoring-standard' | 'scoring-item-name';
type RubricGenerationResult =
  | { status: 'applied' }
  | {
      status: 'error';
      message: string;
      focus?: 'scoring-item-name' | 'scoring-standard';
    };
type ValidationFocusRequest = {
  token: number;
  path: string;
  questionIndex?: number;
  criterionId?: string;
  publicationSection: boolean;
};
const RUBRIC_GOAL_DIMENSION_LABELS: Record<
  (typeof ASSIGNMENT_RUBRIC_GOAL_DIMENSIONS)[number],
  string
> = {
  controlModeling: '控制建模',
  parameterDesign: '参数设计',
  crossDomainTransfer: '跨域迁移',
  engineeringDecision: '工程决策',
  inquiryReflection: '探究反思',
  selfDirectedLearning: '自主学习',
};

export function AssignmentEditorWorkspace({
  assignmentId,
}: {
  assignmentId?: string;
}) {
  const router = useRouter();
  const [document, setDocument] = useState<AssignmentEditorDocument>({
    assignmentId,
    version: 1,
    draft: structuredClone(EMPTY_ASSIGNMENT_DRAFT),
  });
  const [loadState, setLoadState] = useState(
    assignmentId ? 'loading' : 'ready',
  );
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [activeIndex, setActiveIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [classId, setClassId] = useState('');
  const [managedClasses, setManagedClasses] = useState<ManagedClassOption[]>(
    [],
  );
  const [managedClassesState, setManagedClassesState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [availableAt, setAvailableAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [publishMessage, setPublishMessage] = useState('');
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publicationOpen, setPublicationOpen] = useState(false);
  const [validationFocusRequest, setValidationFocusRequest] =
    useState<ValidationFocusRequest | null>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const promptRef = useRef<HTMLElement>(null);
  const questionButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const conflictRef = useRef<HTMLDivElement>(null);
  const blockerRef = useRef<HTMLDivElement>(null);
  const saveStatusRef = useRef<HTMLParagraphElement>(null);
  const publishMessageRef = useRef<HTMLParagraphElement>(null);
  const documentRef = useRef(document);
  const debounceRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const validationFieldRefs = useRef(new Map<string, HTMLElement>());
  const validationFocusTokenRef = useRef(0);

  const loadManagedClasses = useCallback(async () => {
    setManagedClassesState('loading');
    try {
      const response = await fetch('/api/teacher/assignments/managed-classes', {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('managed-classes');
      const payload = (await response.json()) as {
        classes?: ManagedClassOption[];
      };
      if (!Array.isArray(payload.classes)) throw new Error('managed-classes');
      setManagedClasses(payload.classes);
      setManagedClassesState('ready');
    } catch {
      setManagedClassesState('error');
    }
  }, []);

  useEffect(() => {
    void loadManagedClasses();
  }, [loadManagedClasses]);

  useEffect(() => {
    if (!assignmentId) return;
    void fetch(`/api/teacher/assignments/${assignmentId}`, {
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('load');
        await response.json();
        const next = await fetch(
          `/api/teacher/assignments/${assignmentId}/next-draft`,
          { method: 'POST' },
        );
        if (!next.ok) throw new Error('next-draft');
        const nextPayload = (await next.json()) as {
          revision: Record<string, unknown>;
        };
        const loaded = fromApiRevision(assignmentId, nextPayload.revision);
        documentRef.current = loaded;
        setDocument(loaded);
        setSaveState('saved');
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [assignmentId]);

  const updateDraft = useCallback(
    (updater: (draft: AssignmentDraftInput) => AssignmentDraftInput) => {
      if (published) return;
      const current = documentRef.current;
      const next = {
        ...current,
        draft: synchronizeAssignmentTotal(updater(current.draft)),
      };
      if (
        canonicalFingerprint(next.draft)
        === canonicalFingerprint(current.draft)
      ) {
        return;
      }
      documentRef.current = next;
      setDocument(next);
      setSaveState('dirty');
    },
    [published],
  );

  const save = useCallback((): Promise<SaveResult | null> => {
    if (published) return Promise.resolve(null);
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const operation = saveQueueRef.current.then(async () => {
      const snapshot = documentRef.current;
      const draftFingerprint = canonicalFingerprint(snapshot.draft);
      setSaveState('saving');
      try {
        const existing = snapshot.assignmentId && snapshot.revisionId;
        const response = await fetch(
          existing
            ? `/api/teacher/assignments/${snapshot.assignmentId}`
            : '/api/teacher/assignments',
          {
            method: existing ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              existing
                ? {
                    revisionId: snapshot.revisionId,
                    expectedVersion: snapshot.version,
                    draft: snapshot.draft,
                  }
                : { draft: snapshot.draft },
            ),
          },
        );
        if (response.status === 409) {
          setSaveState('conflict');
          return null;
        }
        if (!response.ok) {
          setSaveState('error');
          return null;
        }
        const payload = (await response.json()) as Record<string, unknown>;
        const saved = mergeSaveResponse(snapshot, payload);
        documentRef.current = mergeSaveResponse(documentRef.current, payload);
        setDocument((current) => {
          const next = mergeSaveResponse(current, payload);
          return next;
        });
        setSaveState(
          draftFingerprint === canonicalFingerprint(documentRef.current.draft)
            ? 'saved'
            : 'dirty',
        );
        return { document: saved, draftFingerprint };
      } catch {
        setSaveState('error');
        return null;
      }
    });
    saveQueueRef.current = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }, [published]);

  useEffect(() => {
    if (published || saveState !== 'dirty') return;
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void save();
    }, 1200);
    return () => {
      if (debounceRef.current !== null)
        window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    };
  }, [published, save, saveState]);

  useEffect(() => {
    if (publishMessage) publishMessageRef.current?.focus();
  }, [publishMessage]);

  const blockers = useMemo(() => {
    const parsed = assignmentDraftSchema.safeParse(document.draft);
    const issues = parsed.success
      ? validatePublicationScores(parsed.data)
      : parsed.error.issues.map(
          (issue) => `validation:${issue.path.join('.')}:${issue.message}`,
        );
    if (!document.draft.questions.length)
      issues.push('assignment-has-no-questions');
    if (!classId || !availableAt || !dueAt)
      issues.push('publication-schedule-incomplete');
    return issues;
  }, [availableAt, classId, document.draft, dueAt]);

  const registerValidationField =
    (path: string) => (element: HTMLElement | null) => {
      if (element) validationFieldRefs.current.set(path, element);
      else validationFieldRefs.current.delete(path);
    };
  const focusValidationField = useCallback((path: string) => {
    const exact = validationFieldRefs.current.get(path);
    const nested = [...validationFieldRefs.current.entries()].find(([key]) =>
      key.startsWith(`${path}.`),
    )?.[1];
    const target = exact ?? nested;
    target?.focus();
    return Boolean(target);
  }, []);
  const focusBlocker = (blocker: string) => {
    const path = validationPath(blocker);
    const questionIndex = path?.match(/^questions\.(\d+)\./)?.[1];
    const resolvedQuestionIndex =
      questionIndex === undefined ? undefined : Number(questionIndex);
    const criterionIndex = path?.match(
      /^questions\.\d+\.rubric\.criteria\.(\d+)\./,
    )?.[1];
    const targetQuestion =
      resolvedQuestionIndex === undefined
        ? undefined
        : documentRef.current.draft.questions[resolvedQuestionIndex];
    const criterionId =
      !targetQuestion || criterionIndex === undefined
        ? undefined
        : toScoringRubricV2(targetQuestion.rubric)
            .criteria[Number(criterionIndex)]?.id;
    const publicationSection =
      blocker === 'publication-schedule-incomplete'
      || Boolean(
        path?.startsWith('latePolicy.')
        || path?.startsWith('resubmissionPolicy.')
        || path?.startsWith('solutionReleasePolicy.'),
      );
    if (resolvedQuestionIndex !== undefined) {
      setActiveIndex(resolvedQuestionIndex);
    }
    if (publicationSection) setPublicationOpen(true);
    const targetPath =
      blocker === 'publication-schedule-incomplete'
        ? 'publication.classId'
        : path;
    if (!targetPath) {
      blockerRef.current?.focus();
      return;
    }
    setValidationFocusRequest({
      token: ++validationFocusTokenRef.current,
      path: targetPath,
      questionIndex: resolvedQuestionIndex,
      criterionId,
      publicationSection,
    });
  };

  useEffect(() => {
    if (!validationFocusRequest || validationFocusRequest.criterionId) return;
    if (
      validationFocusRequest.questionIndex !== undefined
      && validationFocusRequest.questionIndex !== activeIndex
    ) return;
    if (
      validationFocusRequest.publicationSection
      && !publicationOpen
    ) return;
    if (!focusValidationField(validationFocusRequest.path)) {
      blockerRef.current?.focus();
    }
  }, [
    activeIndex,
    focusValidationField,
    publicationOpen,
    validationFocusRequest,
  ]);

  const publish = async () => {
    if (published || publishing) return;
    setPublishMessage('');
    if (
      !assignmentDraftSchema.safeParse(documentRef.current.draft).success ||
      blockers.length
    ) {
      setPublishMessage('发布前请解决所有阻断项。');
      focusBlocker(blockers[0]);
      return;
    }
    if (saveState !== 'saved') {
      setPublishMessage(publicationRecoveryMessage(saveState));
      window.setTimeout(() => publishMessageRef.current?.focus(), 0);
      return;
    }
    const saved = documentRef.current;
    if (!saved.assignmentId || !saved.revisionId || !saved.contentDigest) {
      setPublishMessage('保存基线不完整，请重新保存后再发布。');
      window.setTimeout(() => publishMessageRef.current?.focus(), 0);
      return;
    }
    setPublishing(true);
    try {
      const response = await fetch(
        `/api/teacher/assignments/${saved.assignmentId}/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            revisionId: saved.revisionId,
            expectedVersion: saved.version,
            contentDigest: saved.contentDigest,
            idempotencyKey: `assignment-ui:${saved.assignmentId}:${saved.revisionId}:${saved.version}`,
            audiences: [
              {
                classId,
                availableAt: new Date(availableAt).toISOString(),
                dueAt: new Date(dueAt).toISOString(),
              },
            ],
          }),
        },
      );
      if (response.ok) {
        const payload = (await response.json()) as {
          publication: { assignmentId: string };
        };
        setPublished(true);
        setPublishMessage('作业已发布，正在返回作业列表。');
        router.push(
          `/teacher/assignments?highlight=${encodeURIComponent(payload.publication.assignmentId)}`,
        );
      } else {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          details?: string[];
        };
        setPublishMessage(
          publicationErrorMessage(payload.error, payload.details),
        );
        window.setTimeout(() => publishMessageRef.current?.focus(), 0);
      }
    } catch {
      setPublishMessage('发布请求失败，请检查网络后重试。');
      window.setTimeout(() => publishMessageRef.current?.focus(), 0);
    } finally {
      setPublishing(false);
    }
  };

  const selectQuestion = async (
    item: GovernedQuestionSummary,
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        '/api/teacher/assignments/question-catalog',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId: item.sourceId }),
        },
      );
      if (!response.ok) return false;
      const payload = (await response.json()) as {
        question?: EditableQuestion;
      };
      if (!payload.question) return false;
      const nextIndex = documentRef.current.draft.questions.length;
      updateDraft((draft) => ({
        ...draft,
        questions: [...draft.questions, payload.question!],
      }));
      setActiveIndex(nextIndex);
      window.setTimeout(() => promptRef.current?.focus(), 0);
      return true;
    } catch {
      return false;
    }
  };

  const generateRubricGuidelines = async (input: {
    question: EditableQuestionV2;
    scoringItemId: string;
    basis: RubricGenerationBasis;
  }): Promise<RubricGenerationResult> => {
    if (published) {
      return { status: 'error', message: '已发布作业不能生成评分细则。' };
    }
    const current = documentRef.current;
    const questionIndex = current.draft.questions.findIndex(
      (item) => item.stableQuestionId === input.question.stableQuestionId,
    );
    if (questionIndex < 0) {
      return { status: 'error', message: '当前题目已变化，请重新选择。' };
    }
    const preparedDraft = {
      ...current.draft,
      questions: current.draft.questions.map((item, index) =>
        index === questionIndex ? input.question : item,
      ),
    };
    const prepared = { ...current, draft: preparedDraft };
    documentRef.current = prepared;
    setDocument(prepared);
    setSaveState('dirty');

    const saved = await save();
    if (!saved) {
      return {
        status: 'error',
        message: '生成前保存失败，请先解决保存错误或版本冲突。',
      };
    }
    const baseline = saved.document;
    if (!baseline.assignmentId || !baseline.revisionId) {
      return { status: 'error', message: '保存基线不完整，无法生成评分细则。' };
    }
    const savedQuestion = baseline.draft.questions.find(
      (item) => item.stableQuestionId === input.question.stableQuestionId,
    );
    const savedRubric = savedQuestion
      ? toScoringRubricV2(savedQuestion.rubric)
      : null;
    const savedCriterion = savedRubric?.criteria.find(
      (item) => item.id === input.scoringItemId,
    );
    if (!savedQuestion || !savedCriterion || !savedCriterion.detailedRubricEnabled) {
      return { status: 'error', message: '评分项结构已变化，请重新发起生成。' };
    }
    const levelIds = savedCriterion.levels.map((level) => level.id);
    const requestedCriterionFingerprint = canonicalFingerprint(savedCriterion);
    if (!savedCriterion.scoringStandard.trim() && !savedCriterion.label.trim()) {
      return {
        status: 'error',
        message: '请填写评分标准或评分项名称后再生成。',
        focus: 'scoring-item-name',
      };
    }

    let response: Response;
    try {
      response = await fetch(
        `/api/teacher/assignments/${encodeURIComponent(baseline.assignmentId)}/rubric-guidelines/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            revisionId: baseline.revisionId,
            expectedVersion: baseline.version,
            questionId: savedQuestion.stableQuestionId,
            scoringItemId: savedCriterion.id,
            levelIds,
            basis: input.basis,
          }),
        },
      );
    } catch {
      return { status: 'error', message: 'AI 评分细则服务暂时无法连接。' };
    }
    const payload = await response.json().catch(() => ({})) as {
      error?: string;
      generated?: {
        revisionId: string;
        revisionVersion: number;
        questionId: string;
        scoringItemId: string;
        levels: Array<{ levelId: string; guideline: string }>;
      };
    };
    if (!response.ok || !payload.generated) {
      const message = {
        'rubric-generation-rate-limited': '生成请求过于频繁，请稍后再试。',
        'rubric-generation-revision-stale': '草稿版本已变化，未应用生成结果。',
        'rubric-generation-output-invalid': 'AI 返回的级别集合不完整，未改写现有内容。',
        'rubric-generation-basis-missing': '请填写评分标准或评分项名称后再生成。',
        'rubric-generation-basis-mismatch': '评分标准已存在，应以评分标准作为生成依据。',
        'rubric-generation-unavailable': 'AI 评分细则服务暂时不可用。',
      }[payload.error ?? ''] ?? '评分细则生成失败，现有内容未改变。';
      return {
        status: 'error',
        message,
        ...(payload.error === 'rubric-generation-basis-missing'
          ? { focus: 'scoring-item-name' as const }
          : {}),
      };
    }

    const generated = payload.generated;
    const latest = documentRef.current;
    const latestQuestionIndex = latest.draft.questions.findIndex(
      (item) => item.stableQuestionId === generated.questionId,
    );
    const latestQuestion = latest.draft.questions[latestQuestionIndex];
    const latestRubric = latestQuestion
      ? toScoringRubricV2(latestQuestion.rubric)
      : null;
    const latestCriterion = latestRubric?.criteria.find(
      (item) => item.id === generated.scoringItemId,
    );
    if (latest.version !== generated.revisionVersion
      || generated.revisionId !== latest.revisionId
      || !latestQuestion
      || !latestCriterion
      || canonicalFingerprint(latestCriterion) !== requestedCriterionFingerprint) {
      return { status: 'error', message: '生成期间评分细则已变化，结果未应用。' };
    }
    const nextQuestion = applyGeneratedRubricGuidelines(
      {
        ...latestQuestion,
        rubric: latestRubric!,
      },
      generated.scoringItemId,
      generated.levels,
    );
    if (!nextQuestion) {
      return { status: 'error', message: '生成期间评分细则已变化，结果未应用。' };
    }
    const nextDocument = {
      ...latest,
      draft: {
        ...latest.draft,
        questions: latest.draft.questions.map((item, index) =>
          index === latestQuestionIndex ? nextQuestion : item,
        ),
      },
    };
    documentRef.current = nextDocument;
    setDocument(nextDocument);
    setSaveState('dirty');
    return { status: 'applied' };
  };

  if (loadState === 'loading')
    return (
      <main className="p-8" data-operations-status-semantics="loading">
        <p role="status">正在加载作业编辑器……</p>
      </main>
    );
  if (loadState === 'error')
    return (
      <main className="p-8" data-operations-status-semantics="error">
        <p role="alert">作业暂时无法加载。</p>
        <Link href="/teacher/assignments">返回作业列表</Link>
      </main>
    );

  const question = document.draft.questions[activeIndex];
  return (
    <main
      className="surface-page min-h-screen px-4 py-6 md:px-6"
      data-commercial-operations-workspace="teacher-operations"
      data-commercial-workspace-zone="instrument-area"
      data-operations-status-semantics={
        published
          ? 'published-frozen'
          : saveState === 'conflict'
            ? 'conflict'
            : 'draft'
      }
      aria-readonly={published}
    >
      <section className="md:hidden" aria-label="移动端作业状态">
        <Link
          href="/teacher/assignments"
          className="inline-flex items-center gap-1 text-sm text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          返回作业
        </Link>
        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <p className="text-xs text-cyan-300">版本 v{document.version}</p>
          <h1 className="mt-2 break-words text-2xl font-semibold text-white">
            {document.draft.title}
          </h1>
          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">保存状态</dt>
              <dd className="text-slate-100">{saveLabel(saveState)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">发布阻断</dt>
              <dd className="break-words text-slate-100">
                {blockers.length ? `${blockers.length} 项待处理` : '无'}
              </dd>
            </div>
          </dl>
          <p className="mt-6 rounded-lg bg-amber-950/40 p-4 text-sm text-amber-200">
            请在平板或桌面端继续编辑。
          </p>
        </div>
      </section>

      <section className="hidden md:block">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <Link
              href="/teacher/assignments"
              className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-300"
            >
              <ArrowLeft className="h-4 w-4" />
              返回作业
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-white">编辑作业</h1>
            <p className="mt-1 text-xs text-slate-500">
              版本 v{document.version}·解答发布策略{' '}
              {document.draft.solutionReleasePolicy.mode === 'PRIVATE'
                ? '仅教师可见'
                : '按时发布'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen((value) => !value)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-4"
            >
              <Eye className="h-4 w-4" />
              预览
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={published}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-4 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              保存
            </button>
            <button
              type="button"
              onClick={() => void publish()}
              disabled={published || publishing || saveState !== 'saved'}
              aria-describedby="assignment-publication-state"
              aria-busy={publishing}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-cyan-600 px-4 font-medium text-white disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              发布
            </button>
          </div>
        </header>
        <p
          ref={saveStatusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="mb-4 text-sm text-slate-400"
        >
          自动保存：{saveLabel(saveState)}
        </p>
        <p id="assignment-publication-state" className="sr-only">
          {saveState === 'saved'
            ? '当前内容已保存，可以发布'
            : publicationRecoveryMessage(saveState)}
        </p>
        {saveState !== 'saved' && (
          <p className="mb-4 text-sm text-amber-200">
            {publicationRecoveryMessage(saveState)}
          </p>
        )}
        {saveState === 'conflict' && (
          <div
            ref={conflictRef}
            tabIndex={-1}
            role="alert"
            className="mb-4 rounded-xl border border-amber-500/50 bg-amber-950/30 p-4"
          >
            <h2 className="font-semibold text-amber-200">检测到新版本</h2>
            <p className="mt-1 text-sm text-amber-100">
              服务器上的草稿已变更。重新加载后再合并本地内容。
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 min-h-11 rounded-lg border border-amber-400 px-4"
            >
              重新加载
            </button>
          </div>
        )}
        <div className="grid min-h-[62vh] grid-cols-[13rem_minmax(0,1fr)] gap-4">
          <aside
            aria-label="题目大纲"
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
          >
            <h2 className="px-2 text-sm font-semibold text-white">题目大纲</h2>
            <div className="mt-3 space-y-2">
              {document.draft.questions.map((entry, index) => (
                <div
                  key={entry.stableQuestionId}
                  className={`rounded-lg border p-2 ${index === activeIndex ? 'border-cyan-500 bg-cyan-950/30' : 'border-slate-700'}`}
                >
                  <button
                    ref={(element) => {
                      if (element) {
                        questionButtonRefs.current.set(
                          entry.stableQuestionId,
                          element,
                        );
                      } else {
                        questionButtonRefs.current.delete(
                          entry.stableQuestionId,
                        );
                      }
                    }}
                    type="button"
                    data-question-id={entry.stableQuestionId}
                    aria-current={index === activeIndex ? 'true' : undefined}
                    onClick={() => {
                      setActiveIndex(index);
                      window.setTimeout(() => promptRef.current?.focus(), 0);
                    }}
                    className="min-h-11 w-full text-left text-sm"
                  >
                    第 {index + 1} 题·{entry.points} 分
                  </button>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label={`上移第 ${index + 1} 题`}
                      disabled={index === 0}
                      onClick={() => {
                        moveQuestion(
                          index,
                          -1,
                          document.draft,
                          updateDraft,
                          setActiveIndex,
                        );
                        window.setTimeout(
                          () =>
                            questionButtonRefs.current
                              .get(entry.stableQuestionId)
                              ?.focus(),
                          0,
                        );
                      }}
                      className="grid h-10 w-10 place-items-center disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`下移第 ${index + 1} 题`}
                      disabled={index === document.draft.questions.length - 1}
                      onClick={() => {
                        moveQuestion(
                          index,
                          1,
                          document.draft,
                          updateDraft,
                          setActiveIndex,
                        );
                        window.setTimeout(
                          () =>
                            questionButtonRefs.current
                              .get(entry.stableQuestionId)
                              ?.focus(),
                          0,
                        );
                      }}
                      className="grid h-10 w-10 place-items-center disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`删除第 ${index + 1} 题`}
                      onClick={() => {
                        const nextFocusId =
                          document.draft.questions[index + 1]
                            ?.stableQuestionId
                          ?? document.draft.questions[index - 1]
                            ?.stableQuestionId;
                        updateDraft((draft) => ({
                          ...draft,
                          questions: draft.questions.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        }));
                        setActiveIndex(Math.max(0, index - 1));
                        if (nextFocusId) {
                          window.setTimeout(
                            () =>
                              questionButtonRefs.current
                                .get(nextFocusId)
                                ?.focus(),
                            0,
                          );
                        } else {
                          window.setTimeout(
                            () => openerRef.current?.focus(),
                            0,
                          );
                        }
                      }}
                      className="grid h-10 w-10 place-items-center text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                updateDraft((draft) => ({
                  ...draft,
                  questions: [
                    ...draft.questions,
                    manualQuestion(draft.questions.length),
                  ],
                }));
                setActiveIndex(document.draft.questions.length);
                window.setTimeout(() => promptRef.current?.focus(), 0);
              }}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-700"
            >
              <Plus className="h-4 w-4" />
              新建题目
            </button>
            <button
              ref={openerRef}
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-cyan-700 text-cyan-200"
            >
              <Library className="h-4 w-4" />
              从题库选择
            </button>
          </aside>
          <section
            aria-label="作业题目编辑"
            className="space-y-4 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/60 p-5"
          >
            <label className="block text-xs text-slate-400">
              作业标题
              <input
                ref={
                  registerValidationField(
                    'title',
                  ) as React.Ref<HTMLInputElement>
                }
                aria-label="作业标题"
                aria-describedby="assignment-validation-errors"
                placeholder="例如：第二章控制系统建模作业"
                value={document.draft.title}
                onChange={(event) =>
                  updateDraft((draft) => ({
                    ...draft,
                    title: event.target.value,
                  }))
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-lg font-semibold text-white"
              />
            </label>
            <label className="block text-xs text-slate-400">
              作业说明
              <textarea
                aria-label="作业说明"
                placeholder="说明完成要求、提交范围与注意事项"
                value={document.draft.instructions}
                onChange={(event) =>
                  updateDraft((draft) => ({
                    ...draft,
                    instructions: event.target.value,
                  }))
                }
                className="mt-1 min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
              />
            </label>
            {question ? (
              <QuestionEditor
                key={question.stableQuestionId}
                question={question}
                questionIndex={activeIndex}
                registerValidationField={registerValidationField}
                focusRequest={validationFocusRequest}
                focusValidationField={focusValidationField}
                promptRef={promptRef}
                saveState={saveState}
                readOnly={published}
                onSave={() => void save()}
                onGenerateGuidelines={generateRubricGuidelines}
                onChange={(next) =>
                  updateDraft((draft) => ({
                    ...draft,
                    questions: draft.questions.map((item, index) =>
                      index === activeIndex ? next : item,
                    ),
                  }))
                }
              />
            ) : (
              <div className="grid min-h-80 place-items-center text-center">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    尚未添加题目
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    新建题目或从受治理题库中选择。
                  </p>
                </div>
              </div>
            )}
          <details
            open={publicationOpen}
            onToggle={(event) =>
              setPublicationOpen(event.currentTarget.open)
            }
            aria-label="发布设置"
            className="rounded-xl border border-slate-800 bg-slate-950/40"
          >
            <summary className="cursor-pointer list-none p-4">
              <span className="font-semibold text-white">发布设置</span>
              <span className="mt-1 block text-xs text-slate-400">
                {managedClasses.find((item) => item.id === classId)?.name
                  ?? '未选择班级'}
                {' · '}
                {availableAt
                  ? `开放 ${new Date(availableAt).toLocaleString('zh-CN')}`
                  : '未设置开放时间'}
                {' · '}
                {dueAt
                  ? `截止 ${new Date(dueAt).toLocaleString('zh-CN')}`
                  : '未设置截止时间'}
              </span>
            </summary>
            <div className="space-y-4 border-t border-slate-800 p-4">
            <p className="text-sm text-slate-300">
              作业总分：
              <output aria-label="作业总分">
                {deriveAssignmentTotal(document.draft.questions).toFixed(1)}
              </output>
              {' '}分（由题目分值自动汇总）
            </p>
            {managedClassesState === 'loading' && (
              <p role="status" className="text-xs text-slate-400">
                正在加载可管理班级……
              </p>
            )}
            {managedClassesState === 'error' && (
              <div
                role="alert"
                className="rounded-lg border border-rose-800 p-3 text-xs text-rose-200"
              >
                可管理班级加载失败。
                <button
                  type="button"
                  onClick={() => void loadManagedClasses()}
                  className="ml-2 underline"
                >
                  重试
                </button>
              </div>
            )}
            {managedClassesState === 'ready' && managedClasses.length === 0 && (
              <p className="rounded-lg border border-slate-700 p-3 text-xs text-slate-400">
                暂无可发布的活跃班级，请先创建或启用班级。
              </p>
            )}
            {managedClassesState === 'ready' && managedClasses.length > 0 && (
              <label className="block text-xs text-slate-400">
                发布班级
                <select
                  ref={
                    registerValidationField(
                      'publication.classId',
                    ) as React.Ref<HTMLSelectElement>
                  }
                  aria-label="发布班级"
                  value={classId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setClassId(value);
                    updateDraft((draft) =>
                      draft.solutionReleasePolicy.mode === 'AT_TIME'
                        ? {
                            ...draft,
                            solutionReleasePolicy: {
                              ...draft.solutionReleasePolicy,
                              audienceClassIds: value ? [value] : [],
                            },
                          }
                        : draft,
                    );
                  }}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3"
                >
                  <option value="">请选择可管理班级</option>
                  {managedClasses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}（{item.code}）
                      {[item.year, item.semester].filter(Boolean).length
                        ? ` · ${[item.year, item.semester].filter(Boolean).join(' ')}`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-xs text-slate-400">
              开放时间
              <input
                ref={
                  registerValidationField(
                    'publication.availableAt',
                  ) as React.Ref<HTMLInputElement>
                }
                aria-label="开放时间"
                type="datetime-local"
                value={availableAt}
                onChange={(event) => setAvailableAt(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3"
              />
            </label>
            <label className="block text-xs text-slate-400">
              截止时间
              <input
                ref={
                  registerValidationField(
                    'publication.dueAt',
                  ) as React.Ref<HTMLInputElement>
                }
                aria-label="截止时间"
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3"
              />
            </label>
            <label className="block text-xs text-slate-400">
              迟交策略
              <select
                ref={
                  registerValidationField(
                    'latePolicy.mode',
                  ) as React.Ref<HTMLSelectElement>
                }
                aria-label="迟交策略"
                aria-describedby="assignment-validation-errors"
                value={document.draft.latePolicy.mode}
                onChange={(event) =>
                  updateDraft((draft) => ({
                    ...draft,
                    latePolicy:
                      event.target.value === 'CLOSED'
                        ? { version: 1, mode: 'CLOSED' }
                        : {
                            version: 1,
                            mode: 'ALLOW',
                            penaltyPercentPerDay: 0,
                          },
                  }))
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3"
              >
                <option value="CLOSED">截止后关闭</option>
                <option value="ALLOW">允许迟交</option>
              </select>
            </label>
            {document.draft.latePolicy.mode === 'ALLOW' && (
              <label className="block text-xs text-slate-400">
                每日扣分百分比
                <input
                  ref={
                    registerValidationField(
                      'latePolicy.penaltyPercentPerDay',
                    ) as React.Ref<HTMLInputElement>
                  }
                  aria-label="每日扣分百分比"
                  aria-describedby="assignment-validation-errors"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={document.draft.latePolicy.penaltyPercentPerDay}
                  onChange={(event) =>
                    updateDraft((draft) => ({
                      ...draft,
                      latePolicy: {
                        version: 1,
                        mode: 'ALLOW',
                        penaltyPercentPerDay: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
            )}
            <div className="rounded-lg border border-slate-700 p-3 text-xs text-slate-400">
              学生可在每题同时提交 Markdown 正文、图片和附件。历史作答类型仅保留在发布快照中供审计。
            </div>
            <label className="block text-xs text-slate-400">
              最多提交次数
              <input
                ref={
                  registerValidationField(
                    'resubmissionPolicy.maxAttempts',
                  ) as React.Ref<HTMLInputElement>
                }
                aria-label="最多提交次数"
                aria-describedby="assignment-validation-errors"
                type="number"
                step="1"
                min="1"
                max="20"
                value={document.draft.resubmissionPolicy.maxAttempts}
                onChange={(event) =>
                  updateDraft((draft) => ({
                    ...draft,
                    resubmissionPolicy: {
                      ...draft.resubmissionPolicy,
                      maxAttempts: Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                aria-label="仅截止前允许重交"
                type="checkbox"
                checked={document.draft.resubmissionPolicy.untilDueAt}
                onChange={(event) =>
                  updateDraft((draft) => ({
                    ...draft,
                    resubmissionPolicy: {
                      ...draft.resubmissionPolicy,
                      untilDueAt: event.target.checked,
                    },
                  }))
                }
              />
              仅截止前允许重交
            </label>
            <label className="block text-xs text-slate-400">
              参考答案发布
              <select
                value={document.draft.solutionReleasePolicy.mode}
                onChange={(event) =>
                  updateDraft((draft) => ({
                    ...draft,
                    solutionReleasePolicy:
                      event.target.value === 'PRIVATE'
                        ? { version: 1, mode: 'PRIVATE' }
                        : {
                            version: 1,
                            mode: 'AT_TIME',
                            releaseAt: new Date(
                              Date.now() + 86_400_000,
                            ).toISOString(),
                            audienceClassIds: classId ? [classId] : [],
                            includeReferenceAnswer: true,
                            includeStudentVisibleGuidance: true,
                          },
                  }))
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3"
              >
                <option value="PRIVATE">仅教师可见</option>
                <option value="AT_TIME">按时发布</option>
              </select>
            </label>
            {document.draft.solutionReleasePolicy.mode === 'AT_TIME' && (
              <>
                <label className="block text-xs text-slate-400">
                  解答发布时间
                  <input
                    aria-label="解答发布时间"
                    type="datetime-local"
                    value={toLocalDateTime(
                      document.draft.solutionReleasePolicy.releaseAt,
                    )}
                    onChange={(event) =>
                      updateDraft((draft) =>
                        draft.solutionReleasePolicy.mode === 'AT_TIME'
                          ? {
                              ...draft,
                              solutionReleasePolicy: {
                                ...draft.solutionReleasePolicy,
                                releaseAt: new Date(
                                  event.target.value,
                                ).toISOString(),
                              },
                            }
                          : draft,
                      )
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    aria-label="发布参考答案"
                    type="checkbox"
                    checked={
                      document.draft.solutionReleasePolicy
                        .includeReferenceAnswer
                    }
                    onChange={(event) =>
                      updateDraft((draft) =>
                        draft.solutionReleasePolicy.mode === 'AT_TIME'
                          ? {
                              ...draft,
                              solutionReleasePolicy: {
                                ...draft.solutionReleasePolicy,
                                includeReferenceAnswer: event.target.checked,
                              },
                            }
                          : draft,
                      )
                    }
                  />
                  发布参考答案
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    aria-label="发布学生指导"
                    type="checkbox"
                    checked={
                      document.draft.solutionReleasePolicy
                        .includeStudentVisibleGuidance
                    }
                    onChange={(event) =>
                      updateDraft((draft) =>
                        draft.solutionReleasePolicy.mode === 'AT_TIME'
                          ? {
                              ...draft,
                              solutionReleasePolicy: {
                                ...draft.solutionReleasePolicy,
                                includeStudentVisibleGuidance:
                                  event.target.checked,
                              },
                            }
                          : draft,
                      )
                    }
                  />
                  发布学生指导
                </label>
              </>
            )}
            <div
              id="assignment-validation-errors"
              ref={blockerRef}
              tabIndex={-1}
              className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3"
            >
              <h3 className="flex items-center gap-2 text-sm font-medium text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                发布阻断项
              </h3>
              {blockers.length ? (
                <ul className="mt-2 space-y-1 text-xs text-amber-100">
                  {blockers.map((entry) => (
                    <li key={entry}>
                      <button
                        type="button"
                        onClick={() => focusBlocker(entry)}
                        className="text-left underline"
                      >
                        {blockerLabel(entry)}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 flex items-center gap-1 text-xs text-emerald-300">
                  <Check className="h-4 w-4" />
                  已通过本地检查
                </p>
              )}
            </div>
            {publishMessage && (
              <p
                ref={publishMessageRef}
                tabIndex={-1}
                role="alert"
                className="text-sm text-amber-200"
              >
                {publishMessage}
              </p>
            )}
            </div>
          </details>
          </section>
        </div>
        {previewOpen && (
          <section
            aria-label="作业预览"
            className="mt-4 rounded-xl border border-cyan-700 bg-slate-900 p-5"
          >
            <h2 className="text-lg font-semibold text-white">学生视图预览</h2>
            <p className="mt-2 text-slate-300">
              {document.draft.instructions || '暂无作业说明'}
            </p>
            <ol className="mt-4 list-decimal space-y-3 pl-5">
              {document.draft.questions.map((entry) => (
                <li key={entry.stableQuestionId}>
                  {entry.prompt}（{entry.points} 分）
                </li>
              ))}
            </ol>
          </section>
        )}
      </section>
      <GovernedQuestionPicker
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          window.setTimeout(() => openerRef.current?.focus(), 0);
        }}
        onSelect={selectQuestion}
      />
    </main>
  );
}

type EditableQuestion = AssignmentDraftInput['questions'][number];
type ScoringRubricV2 = Extract<
  EditableQuestion['rubric'],
  { schemaVersion: 'assignment-scoring-rubric.v2' }
>;
type EditableQuestionV2 = Omit<EditableQuestion, 'rubric'> & {
  rubric: ScoringRubricV2;
};
type ScoringCriterionV2 = ScoringRubricV2['criteria'][number];

function QuestionEditor({
  question,
  questionIndex,
  registerValidationField,
  focusRequest,
  focusValidationField,
  promptRef,
  saveState,
  readOnly,
  onSave,
  onGenerateGuidelines,
  onChange,
}: {
  question: EditableQuestion;
  questionIndex: number;
  registerValidationField: (
    path: string,
  ) => (element: HTMLElement | null) => void;
  focusRequest: ValidationFocusRequest | null;
  focusValidationField: (path: string) => boolean;
  promptRef: React.RefObject<HTMLElement | null>;
  saveState: SaveState;
  readOnly: boolean;
  onSave: () => void;
  onGenerateGuidelines: (input: {
    question: EditableQuestionV2;
    scoringItemId: string;
    basis: RubricGenerationBasis;
  }) => Promise<RubricGenerationResult>;
  onChange: (question: EditableQuestion) => void;
}) {
  const editableQuestion: EditableQuestionV2 = {
    ...question,
    rubric: toScoringRubricV2(question.rubric),
  };
  const [rubricDialog, setRubricDialog] = useState<
    | {
        mode: 'missing-standard';
        criterionIndex: number;
        standardDraft: string;
      }
    | {
        mode: 'overwrite';
        criterionIndex: number;
        basis: RubricGenerationBasis;
      }
    | null
  >(null);
  const [generatingCriterionId, setGeneratingCriterionId] = useState<string | null>(null);
  const [rubricGenerationMessage, setRubricGenerationMessage] = useState('');
  const [expandedCriterionIds, setExpandedCriterionIds] = useState(
    () => new Set(editableQuestion.rubric.criteria.map((item) => item.id)),
  );
  const dialogPrimaryRef = useRef<HTMLTextAreaElement | HTMLButtonElement>(null);
  const criterionToggleRefs = useRef(new Map<string, HTMLButtonElement>());
  const criterionNameRefs = useRef(new Map<number, HTMLInputElement>());
  const scoringStandardRefs = useRef(new Map<number, HTMLTextAreaElement>());
  const handledValidationFocusTokenRef = useRef(0);
  useEffect(() => {
    if (
      !focusRequest
      || !focusRequest.criterionId
      || focusRequest.questionIndex !== questionIndex
      || handledValidationFocusTokenRef.current === focusRequest.token
    ) return;
    const criterionIndex = editableQuestion.rubric.criteria.findIndex(
      (criterion) => criterion.id === focusRequest.criterionId,
    );
    if (criterionIndex < 0) return;
    if (!expandedCriterionIds.has(focusRequest.criterionId)) {
      setExpandedCriterionIds((current) => {
        const next = new Set(current);
        next.add(focusRequest.criterionId!);
        return next;
      });
      return;
    }
    const stablePath = focusRequest.path.replace(
      /(\.rubric\.criteria\.)\d+/,
      `$1${criterionIndex}`,
    );
    if (focusValidationField(stablePath)) {
      handledValidationFocusTokenRef.current = focusRequest.token;
    }
  }, [
    editableQuestion.rubric.criteria,
    expandedCriterionIds,
    focusRequest,
    focusValidationField,
    questionIndex,
  ]);
  useEffect(() => {
    if (rubricDialog) window.setTimeout(() => dialogPrimaryRef.current?.focus(), 0);
  }, [rubricDialog]);
  const editedLevelIdsRef = useRef(new Map(
    editableQuestion.rubric.criteria.map((criterion) => [
      criterion.id,
      inferEditedRubricLevelIds({
        criterionId: criterion.id,
        criterionMaxPoints: criterion.maxPoints,
        levels: criterion.levels,
      }),
    ]),
  ));
  const editedLevelFieldKeysRef = useRef(new Set(
    editableQuestion.rubric.criteria.flatMap((criterion) => {
      const editedIds = editedLevelIdsRef.current.get(criterion.id) ?? new Set<string>();
      return criterion.levels.flatMap((level) => editedIds.has(level.id)
        ? ['label', 'maxPoints', 'guideline'].map((field) => `${criterion.id}:${level.id}:${field}`)
        : []);
    }),
  ));
  const updateCriterion = (
    index: number,
    update: (criterion: ScoringCriterionV2) => ScoringCriterionV2,
  ) =>
    onChange({
      ...editableQuestion,
      rubric: {
        ...editableQuestion.rubric,
        criteria: editableQuestion.rubric.criteria.map((criterion, itemIndex) =>
          itemIndex === index ? update(criterion) : criterion,
        ),
      },
    });
  const questionWithCriterion = (
    index: number,
    update: (criterion: ScoringCriterionV2) => ScoringCriterionV2,
  ): EditableQuestionV2 => ({
    ...editableQuestion,
    rubric: {
      ...editableQuestion.rubric,
      criteria: editableQuestion.rubric.criteria.map((criterion, itemIndex) =>
        itemIndex === index ? update(criterion) : criterion,
      ),
    },
  });
  const focusGenerationBasis = (
    index: number,
    focus: 'scoring-item-name' | 'scoring-standard',
  ) => {
    window.setTimeout(() => {
      if (focus === 'scoring-standard') scoringStandardRefs.current.get(index)?.focus();
      else criterionNameRefs.current.get(index)?.focus();
    }, 0);
  };
  const runRubricGeneration = async (
    index: number,
    basis: RubricGenerationBasis,
    preparedQuestion = editableQuestion,
  ) => {
    const criterion = preparedQuestion.rubric.criteria[index];
    if (!criterion) return;
    setRubricDialog(null);
    setGeneratingCriterionId(criterion.id);
    setRubricGenerationMessage('正在生成整组评分准则……');
    const result = await onGenerateGuidelines({
      question: preparedQuestion,
      scoringItemId: criterion.id,
      basis,
    });
    setGeneratingCriterionId(null);
    if (result.status === 'applied') {
      setRubricGenerationMessage('已填写全部评价级别；结果仍是可编辑草稿。');
      return;
    }
    setRubricGenerationMessage(result.message);
    if (result.focus) focusGenerationBasis(index, result.focus);
  };
  const requestRubricGeneration = (index: number) => {
    const criterion = editableQuestion.rubric.criteria[index];
    if (!criterion) return;
    const standard = criterion.scoringStandard.trim();
    const name = criterion.label.trim();
    if (!standard && !name) {
      setRubricGenerationMessage('请先填写评分标准或评分项名称。');
      focusGenerationBasis(index, 'scoring-item-name');
      return;
    }
    if (!standard) {
      setRubricDialog({
        mode: 'missing-standard',
        criterionIndex: index,
        standardDraft: '',
      });
      return;
    }
    if (criterion.levels.some((level) => level.guideline.trim())) {
      setRubricDialog({
        mode: 'overwrite',
        criterionIndex: index,
        basis: 'scoring-standard',
      });
      return;
    }
    void runRubricGeneration(index, 'scoring-standard');
  };
  return (
    <>
      <section aria-labelledby="prompt-title">
        <h2 id="prompt-title" className="text-lg font-semibold text-white">
          题面
        </h2>
        <p className="mt-2 text-xs text-slate-400">
          统一作答：学生可提交 Markdown 正文、图片、附件或其组合。
        </p>
        <AssignmentEmbeddedEditor
          containerRef={promptRef}
          hostRole="teacher"
          field="question-prompt"
          ariaLabel="题面"
          value={editableQuestion.prompt}
          savedValue={editableQuestion.prompt}
          saveState={embeddedSaveState(saveState)}
          readOnly={readOnly}
          continuousEditing
          showSaveAction={false}
          onChange={(value) =>
            onChange({ ...editableQuestion, prompt: value })
          }
          onEdit={() => undefined}
          onSave={onSave}
          validateAssetReference={rejectTeacherAuthoringAssetReference}
          resolveAssetHref={(href) => href}
        />
      </section>
      <section aria-labelledby="answer-title">
        <h2 id="answer-title" className="text-lg font-semibold text-white">
          参考答案
        </h2>
        <AssignmentEmbeddedEditor
          hostRole="teacher"
          field="reference-answer"
          ariaLabel="参考答案"
          value={editableQuestion.referenceAnswer}
          savedValue={editableQuestion.referenceAnswer}
          saveState={embeddedSaveState(saveState)}
          readOnly={readOnly}
          continuousEditing
          showSaveAction={false}
          onChange={(value) =>
            onChange({ ...editableQuestion, referenceAnswer: value })
          }
          onEdit={() => undefined}
          onSave={onSave}
          validateAssetReference={rejectTeacherAuthoringAssetReference}
          resolveAssetHref={(href) => href}
        />
      </section>
      <section aria-labelledby="rubric-title">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="rubric-title" className="text-lg font-semibold text-white">
              评分标准
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              所有分值保留一位小数；评分标准为默认依据，评分细则按需启用。
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const criterion = newCriterion();
              setExpandedCriterionIds((current) => {
                const next = new Set(current);
                next.add(criterion.id);
                return next;
              });
              onChange({
                ...editableQuestion,
                rubric: {
                  ...editableQuestion.rubric,
                  criteria: [...editableQuestion.rubric.criteria, criterion],
                },
              });
              window.setTimeout(
                () => criterionToggleRefs.current.get(criterion.id)?.focus(),
                0,
              );
            }}
            className="min-h-11 rounded-lg border border-slate-700 px-3"
          >
            添加评分项
          </button>
        </div>
        <label className="mt-2 block text-xs text-slate-400">
          题目分值
          <input
            type="number"
            step="0.1"
            min="1"
            max="10000"
            value={editableQuestion.points}
            onChange={(event) =>
              onChange({ ...editableQuestion, points: Number(event.target.value) })
            }
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3"
          />
        </label>
        {editableQuestion.rubric.criteria.map((criterion, index) => {
          const expanded = expandedCriterionIds.has(criterion.id);
          const ranges = deriveRubricLevelRanges(criterion.levels, criterion.maxPoints);
          const editedLevelIds = editedLevelIdsRef.current.get(criterion.id) ?? new Set<string>();
          const applyShortcut = (targetCount: 2 | 5) => {
            let result = applyRubricLevelShortcut({
              criterionId: criterion.id,
              criterionMaxPoints: criterion.maxPoints,
              levels: criterion.levels,
              targetCount,
              editedLevelIds,
            });
            if (result.status === 'confirmation-required') {
              const deletionSummary = result.trailingLevels
                .map((level) => `${level.label}（${level.maxPoints} 分；${level.guideline}）`)
                .join('、');
              const confirmed = window.confirm(
                `将删除末尾级别：${deletionSummary}。是否继续？`,
              );
              if (!confirmed) return;
              result = applyRubricLevelShortcut({
                criterionId: criterion.id,
                criterionMaxPoints: criterion.maxPoints,
                levels: criterion.levels,
                targetCount,
                editedLevelIds,
                confirmTrailingDeletion: true,
              });
            }
            if (result.status === 'applied') {
              updateCriterion(index, (item) => ({ ...item, levels: result.levels }));
            }
          };
          return (
          <article
            key={criterion.id}
            className="mt-3 rounded-xl border border-slate-700 p-3"
          >
            <div className="flex gap-2">
              <button
                ref={(element) => {
                  if (element) criterionToggleRefs.current.set(criterion.id, element);
                  else criterionToggleRefs.current.delete(criterion.id);
                }}
                type="button"
                aria-expanded={expanded}
                aria-controls={`criterion-fields-${criterion.id}`}
                aria-label={`${expanded ? '折叠' : '展开'}评分项 ${index + 1}`}
                onClick={() =>
                  setExpandedCriterionIds((current) => {
                    const next = new Set(current);
                    if (next.has(criterion.id)) next.delete(criterion.id);
                    else next.add(criterion.id);
                    return next;
                  })
                }
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-700"
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </button>
              <input
                ref={(element) => {
                  registerValidationField(
                    `questions.${questionIndex}.rubric.criteria.${index}.label`,
                  )(element);
                  if (element) criterionNameRefs.current.set(index, element);
                  else criterionNameRefs.current.delete(index);
                }}
                aria-label={`评分项 ${index + 1} 名称`}
                aria-describedby="assignment-validation-errors"
                value={criterion.label}
                onChange={(event) =>
                  updateCriterion(index, (item) => ({
                    ...item,
                    label: event.target.value,
                  }))
                }
                className="min-h-11 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3"
              />
              <span className="inline-flex min-h-11 items-center whitespace-nowrap text-sm text-slate-300">
                {criterion.maxPoints} 分
              </span>
              <button
                type="button"
                aria-label={`上移评分项 ${index + 1}`}
                disabled={index === 0}
                onClick={() => {
                  onChange({
                    ...editableQuestion,
                    rubric: {
                      ...editableQuestion.rubric,
                      criteria: moveItem(editableQuestion.rubric.criteria, index, -1),
                    },
                  });
                  window.setTimeout(
                    () => criterionToggleRefs.current.get(criterion.id)?.focus(),
                    0,
                  );
                }}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`下移评分项 ${index + 1}`}
                disabled={index === editableQuestion.rubric.criteria.length - 1}
                onClick={() => {
                  onChange({
                    ...editableQuestion,
                    rubric: {
                      ...editableQuestion.rubric,
                      criteria: moveItem(editableQuestion.rubric.criteria, index, 1),
                    },
                  });
                  window.setTimeout(
                    () => criterionToggleRefs.current.get(criterion.id)?.focus(),
                    0,
                  );
                }}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`删除评分项 ${index + 1}`}
                disabled={editableQuestion.rubric.criteria.length === 1}
                onClick={() => {
                  const nextFocusId =
                    editableQuestion.rubric.criteria[index + 1]?.id
                    ?? editableQuestion.rubric.criteria[index - 1]?.id;
                  onChange({
                    ...editableQuestion,
                    rubric: {
                      ...editableQuestion.rubric,
                      criteria: editableQuestion.rubric.criteria.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    },
                  });
                  setExpandedCriterionIds((current) => {
                    const next = new Set(current);
                    next.delete(criterion.id);
                    return next;
                  });
                  if (nextFocusId) {
                    window.setTimeout(
                      () => criterionToggleRefs.current.get(nextFocusId)?.focus(),
                      0,
                    );
                  }
                }}
              >
                删除
              </button>
            </div>
            {expanded && (
            <div id={`criterion-fields-${criterion.id}`}>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="text-xs text-slate-400">
                最高分
                <input
                  ref={
                    registerValidationField(
                      `questions.${questionIndex}.rubric.criteria.${index}.maxPoints`,
                    ) as React.Ref<HTMLInputElement>
                  }
                  type="number"
                  aria-describedby="assignment-validation-errors"
                  step="0.1"
                  min="1"
                  max="10000"
                  value={criterion.maxPoints}
                  onChange={(event) =>
                    updateCriterion(index, (item) => {
                      const maxPoints = Number(event.target.value);
                      return {
                        ...item,
                        maxPoints,
                        levels: sortRubricLevels(item.levels, maxPoints),
                      };
                    })
                  }
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3"
                />
              </label>
              <label className="text-xs text-slate-400">
                学生可见指导
                <input
                  value={criterion.studentVisibleGuidance ?? ''}
                  onChange={(event) =>
                    updateCriterion(index, (item) => ({
                      ...item,
                      studentVisibleGuidance: event.target.value,
                    }))
                  }
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3"
                />
              </label>
              <label className="text-xs text-slate-400">
                能力维度
                <select
                  aria-label={`评分项 ${index + 1} 能力维度`}
                  value={criterion.goalDimension ?? 'engineeringDecision'}
                  onChange={(event) =>
                    updateCriterion(index, (item) => ({
                      ...item,
                      goalDimension: event.target.value as ScoringCriterionV2['goalDimension'],
                    }))
                  }
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3"
                >
                  {ASSIGNMENT_RUBRIC_GOAL_DIMENSIONS.map((dimension) => (
                    <option key={dimension} value={dimension}>
                      {RUBRIC_GOAL_DIMENSION_LABELS[dimension]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-2 block text-xs text-slate-400">
              评分标准
              <textarea
                ref={(element) => {
                  if (element) scoringStandardRefs.current.set(index, element);
                  else scoringStandardRefs.current.delete(index);
                }}
                value={criterion.scoringStandard}
                onChange={(event) =>
                  updateCriterion(index, (item) => ({
                    ...item,
                    scoringStandard: event.target.value,
                  }))
                }
                className="mt-1 min-h-20 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
              />
            </label>
            <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={criterion.detailedRubricEnabled}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  if (!enabled && criterion.levels.length > 0) {
                    const deletionSummary = criterion.levels
                      .map((level) => `${level.label}（${level.maxPoints} 分；${level.guideline}）`)
                      .join('、');
                    if (!window.confirm(`将删除全部评价级别：${deletionSummary}。是否继续？`)) {
                      return;
                    }
                  }
                  updateCriterion(index, (item) => ({
                    ...item,
                    detailedRubricEnabled: enabled,
                    levels: enabled
                      ? item.levels.length > 0
                        ? item.levels
                        : [createInitialDetailedLevel(item.id, item.maxPoints)]
                      : [],
                  }));
                }}
              />
              启用详细评分细则
            </label>
            {criterion.detailedRubricEnabled && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => requestRubricGeneration(index)}
                  disabled={generatingCriterionId !== null}
                  aria-describedby="rubric-generation-status"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-violet-600 px-3 text-xs font-medium text-white disabled:opacity-60"
                >
                  {generatingCriterionId === criterion.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Sparkles className="h-4 w-4" />}
                  AI 填写全部准则
                </button>
                <button type="button" onClick={() => applyShortcut(5)} className="min-h-10 rounded-lg border border-slate-700 px-3 text-xs">
                  五级制
                </button>
                <button type="button" onClick={() => applyShortcut(2)} className="min-h-10 rounded-lg border border-slate-700 px-3 text-xs">
                  两级制
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const result = addDetailedRubricLevel({
                      criterionId: criterion.id,
                      criterionMaxPoints: criterion.maxPoints,
                      levels: criterion.levels,
                    });
                    if (result.status === 'applied') {
                      updateCriterion(index, (item) => ({ ...item, levels: result.levels }));
                    }
                  }}
                  className="min-h-10 rounded-lg border border-slate-700 px-3 text-xs"
                >
                  添加评价级别
                </button>
              </div>
            )}
            {criterion.detailedRubricEnabled && criterion.levels.map((level, levelIndex) => {
                const range = ranges.find((candidate) => candidate.id === level.id);
                const isHighestLevel = range?.upperBoundaryInclusive === true;
                const fieldKey = (field: 'label' | 'maxPoints' | 'guideline') =>
                  `${criterion.id}:${level.id}:${field}`;
                const preservePristineSelection = (
                  event: React.MouseEvent<HTMLInputElement>,
                  field: 'label' | 'maxPoints' | 'guideline',
                ) => {
                  if (!editedLevelFieldKeysRef.current.has(fieldKey(field))) {
                    event.preventDefault();
                  }
                };
                const selectPristineValue = (
                  event: React.FocusEvent<HTMLInputElement>,
                  field: 'label' | 'maxPoints' | 'guideline',
                ) => {
                  if (!editedLevelFieldKeysRef.current.has(fieldKey(field))) {
                    event.currentTarget.select();
                  }
                };
                const markFieldEdited = (field: 'label' | 'maxPoints' | 'guideline') => {
                  editedLevelFieldKeysRef.current.add(fieldKey(field));
                  editedLevelIds.add(level.id);
                  editedLevelIdsRef.current.set(criterion.id, editedLevelIds);
                };
              return (
              <div
                key={level.id}
                className="mt-2 grid gap-2 rounded-lg bg-slate-950/60 p-2 md:grid-cols-3"
              >
                <input
                  ref={
                    registerValidationField(
                      `questions.${questionIndex}.rubric.criteria.${index}.levels.${levelIndex}.label`,
                    ) as React.Ref<HTMLInputElement>
                  }
                  aria-label={`评分项 ${index + 1} 档位 ${levelIndex + 1} 名称`}
                  aria-describedby="assignment-validation-errors"
                  value={level.label}
                  onFocus={(event) => selectPristineValue(event, 'label')}
                  onMouseUp={(event) => preservePristineSelection(event, 'label')}
                  onChange={(event) =>
                    {
                      markFieldEdited('label');
                      updateCriterion(index, (item) => ({
                        ...item,
                        levels: item.levels.map((entry, itemIndex) =>
                          itemIndex === levelIndex
                            ? { ...entry, label: event.target.value }
                            : entry,
                        ),
                      }));
                    }
                  }
                />
                <label className="text-xs text-slate-400">
                  {isHighestLevel ? '最高级别上限（同步满分）' : `区间 ${range?.minPoints ?? 0}–${range?.maxInclusivePoints ?? 0}`}
                  <input
                    ref={registerValidationField(
                      `questions.${questionIndex}.rubric.criteria.${index}.levels.${levelIndex}.maxPoints`,
                    ) as React.Ref<HTMLInputElement>}
                    aria-label={`评分项 ${index + 1} 级别 ${levelIndex + 1} 分值边界`}
                    aria-describedby="assignment-validation-errors"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max={criterion.maxPoints}
                    disabled={isHighestLevel}
                    value={level.maxPoints}
                    onFocus={(event) => selectPristineValue(event, 'maxPoints')}
                    onMouseUp={(event) => preservePristineSelection(event, 'maxPoints')}
                    onChange={(event) =>
                      {
                        markFieldEdited('maxPoints');
                        updateCriterion(index, (item) => ({
                          ...item,
                          levels: sortRubricLevels(
                            item.levels.map((entry, itemIndex) =>
                              itemIndex === levelIndex
                                ? { ...entry, maxPoints: Number(event.target.value) }
                                : entry,
                            ),
                            item.maxPoints,
                          ),
                        }));
                      }
                    }
                  />
                </label>
                <div>
                  <input
                    aria-label={`评分项 ${index + 1} 级别 ${levelIndex + 1} 评分准则`}
                    value={level.guideline}
                    onFocus={(event) => selectPristineValue(event, 'guideline')}
                    onMouseUp={(event) => preservePristineSelection(event, 'guideline')}
                    onChange={(event) =>
                      {
                        markFieldEdited('guideline');
                        updateCriterion(index, (item) => ({
                          ...item,
                          levels: item.levels.map((entry, itemIndex) =>
                            itemIndex === levelIndex
                              ? { ...entry, guideline: event.target.value }
                              : entry,
                          ),
                        }));
                      }
                    }
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      aria-label={`上移档位 ${levelIndex + 1}`}
                      disabled={levelIndex === 0}
                      onClick={() =>
                        updateCriterion(index, (item) => ({
                          ...item,
                          levels: moveItem(item.levels, levelIndex, -1),
                        }))
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`下移档位 ${levelIndex + 1}`}
                      disabled={levelIndex === criterion.levels.length - 1}
                      onClick={() =>
                        updateCriterion(index, (item) => ({
                          ...item,
                          levels: moveItem(item.levels, levelIndex, 1),
                        }))
                      }
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`删除档位 ${levelIndex + 1}`}
                      disabled={criterion.levels.length === 1}
                      onClick={() =>
                        updateCriterion(index, (item) => ({
                          ...item,
                          levels: item.levels.filter(
                            (_, itemIndex) => itemIndex !== levelIndex,
                          ),
                        }))
                      }
                    >
                      删除
                    </button>
                  </div>
                  </div>
                </div>
              );
            })}
            </div>
            )}
          </article>
          );
        })}
      </section>
      {rubricGenerationMessage && (
        <p
          id="rubric-generation-status"
          role="status"
          aria-live="polite"
          className="mt-3 rounded-lg border border-violet-400/30 bg-violet-400/10 px-3 py-2 text-sm text-violet-100"
        >
          {rubricGenerationMessage}
        </p>
      )}
      {rubricDialog && (() => {
        const criterion = editableQuestion.rubric.criteria[rubricDialog.criterionIndex];
        if (!criterion) return null;
        const hasExistingGuidelines = criterion.levels.some(
          (level) => level.guideline.trim(),
        );
        const isMissingStandard = rubricDialog.mode === 'missing-standard';
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setRubricDialog(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="rubric-ai-dialog-title"
              className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            >
              <h3 id="rubric-ai-dialog-title" className="text-lg font-semibold text-white">
                {isMissingStandard ? '补充评分标准' : '覆盖全部评分准则？'}
              </h3>
              {isMissingStandard ? (
                <>
                  <p className="mt-2 text-sm text-slate-300">
                    AI 优先依据评分标准生成。可以先保存评分标准，也可以明确忽略并使用评分项名称“{criterion.label}”。
                  </p>
                  {hasExistingGuidelines && (
                    <p className="mt-2 text-sm font-medium text-amber-300">
                      当前已有评分准则；继续生成会一次性替换全部级别的现有准则。
                    </p>
                  )}
                  <label className="mt-4 block text-sm text-slate-200">
                    评分标准
                    <textarea
                      ref={dialogPrimaryRef as React.Ref<HTMLTextAreaElement>}
                      value={rubricDialog.standardDraft}
                      onChange={(event) => {
                        const standardDraft = event.target.value;
                        setRubricDialog((current) =>
                          current?.mode === 'missing-standard'
                            ? { ...current, standardDraft }
                            : current,
                        );
                      }}
                      rows={4}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white"
                    />
                  </label>
                  {!criterion.label.trim() && (
                    <p className="mt-2 text-sm text-amber-300">
                      评分项名称为空，不能忽略评分标准。
                    </p>
                  )}
                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRubricDialog(null)}
                      className="min-h-10 rounded-lg border border-slate-600 px-4 text-sm"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      disabled={!criterion.label.trim()}
                      onClick={() => {
                        void runRubricGeneration(
                          rubricDialog.criterionIndex,
                          'scoring-item-name',
                        );
                      }}
                      className="min-h-10 rounded-lg border border-violet-400 px-4 text-sm text-violet-100 disabled:opacity-50"
                    >
                      {hasExistingGuidelines
                        ? '忽略评分标准并覆盖生成'
                        : '忽略评分标准，使用评分项名称'}
                    </button>
                    <button
                      type="button"
                      disabled={!rubricDialog.standardDraft.trim()}
                      onClick={() => {
                        const preparedQuestion = questionWithCriterion(
                          rubricDialog.criterionIndex,
                          (item) => ({
                            ...item,
                            scoringStandard: rubricDialog.standardDraft,
                          }),
                        );
                        void runRubricGeneration(
                          rubricDialog.criterionIndex,
                          'scoring-standard',
                          preparedQuestion,
                        );
                      }}
                      className="min-h-10 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {hasExistingGuidelines ? '保存并覆盖生成' : '保存并生成'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-slate-300">
                    当前评分项已有内容。继续后将一次性替换全部评价级别的评分准则；级别名称、分值、数量和顺序不会改变。
                  </p>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRubricDialog(null)}
                      className="min-h-10 rounded-lg border border-slate-600 px-4 text-sm"
                    >
                      取消
                    </button>
                    <button
                      ref={dialogPrimaryRef as React.Ref<HTMLButtonElement>}
                      type="button"
                      onClick={() => {
                        void runRubricGeneration(
                          rubricDialog.criterionIndex,
                          rubricDialog.basis,
                        );
                      }}
                      className="min-h-10 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white"
                    >
                      覆盖全部评分准则
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}

function manualQuestion(index: number): EditableQuestion {
  return {
    stableQuestionId: `manual-${Date.now()}-${index}`,
    responseType: 'SUBJECTIVE_TEXT',
    points: 10,
    prompt: '',
    referenceAnswer: '',
    rubric: {
      schemaVersion: 'assignment-scoring-rubric.v2',
      criteria: [
        {
          id: 'criterion-1',
          label: '完成质量',
          goalDimension: 'engineeringDecision',
          maxPoints: 10,
          scoringStandard: '根据作答证据的正确性、完整性和可复核程度评分。',
          detailedRubricEnabled: false,
          levels: [],
        },
      ],
    },
    source: { family: 'MANUAL', authoringMarker: 'assignment-authoring' },
  };
}
function newCriterion(): ScoringCriterionV2 {
  const id = `criterion-${Date.now()}`;
  return {
    id,
    label: '新评分项',
    goalDimension: 'engineeringDecision',
    maxPoints: 1,
    scoringStandard: '依据作答证据评分。',
    detailedRubricEnabled: false,
    levels: [],
  };
}

function toScoringRubricV2(rubric: EditableQuestion['rubric']): ScoringRubricV2 {
  if (rubric.schemaVersion === 'assignment-scoring-rubric.v2') return rubric;
  return {
    schemaVersion: 'assignment-scoring-rubric.v2',
    criteria: rubric.criteria.map((criterion) => ({
      id: criterion.id,
      label: criterion.label,
      goalDimension: criterion.goalDimension ?? 'engineeringDecision',
      maxPoints: Math.ceil(criterion.maxPoints * 10) / 10,
      scoringStandard: criterion.evidenceDescription,
      detailedRubricEnabled: true,
      evidenceDescription: criterion.evidenceDescription,
      feedbackGuidance: criterion.feedbackGuidance,
      studentVisibleGuidance: criterion.studentVisibleGuidance,
      levels: criterion.levels.map((level, index) => ({
        id: level.id,
        label: level.label,
        maxPoints: index === 0
          ? Math.ceil(criterion.maxPoints * 10) / 10
          : Math.ceil(criterion.levels[index - 1].minPoints * 10) / 10,
        guideline: level.description,
      })),
    })),
  };
}
function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const next = [...items];
  const target = index + delta;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
function moveQuestion(
  index: number,
  delta: number,
  draft: AssignmentDraftInput,
  update: (
    updater: (draft: AssignmentDraftInput) => AssignmentDraftInput,
  ) => void,
  setActive: (index: number) => void,
) {
  const nextIndex = index + delta;
  const questions = [...draft.questions];
  [questions[index], questions[nextIndex]] = [
    questions[nextIndex],
    questions[index],
  ];
  update((current) => ({ ...current, questions }));
  setActive(nextIndex);
}
function saveLabel(state: SaveState) {
  return (
    {
      idle: '尚未修改',
      dirty: '待保存',
      saving: '正在保存',
      saved: '已保存',
      error: '保存失败',
      conflict: '存在冲突',
    } as const
  )[state];
}

function embeddedSaveState(state: SaveState): AssignmentEmbeddedSaveState {
  if (state === 'saving') return 'saving';
  if (state === 'saved') return 'saved';
  if (state === 'error') return 'failed';
  if (state === 'conflict') return 'conflict';
  return 'editing';
}
function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function blockerLabel(value: string) {
  if (value.startsWith('validation:')) {
    const path = validationPath(value) ?? '';
    const message = value.slice(value.lastIndexOf(':') + 1);
    if (path === 'title') return '补全作业标题';
    if (path === 'responsePolicy.allowedResponseTypes')
      return '题目作答类型必须包含在作业允许类型中';
    if (path === 'resubmissionPolicy.maxAttempts')
      return '提交次数必须在 1 至 20 次之间';
    if (path === 'latePolicy.penaltyPercentPerDay')
      return '迟交扣分比例必须在 0% 至 100% 之间';
    if (path.includes('.rubric.criteria.') && path.includes('.levels.'))
      return message.includes('0.1') || message.includes('level-maximum')
        ? '评价级别须使用一位小数并形成有效降序区间'
        : '补全评价级别字段';
    if (path.includes('.rubric.criteria.'))
      return '补全评分项名称、分值与评分标准';
    return `修正字段：${path || '作业草稿'}`;
  }
  if (value.startsWith('assignment-total-mismatch'))
    return '作业总分与题目合计不一致';
  if (value.startsWith('question-rubric-total-mismatch'))
    return '题目分值与评分标准合计不一致';
  if (value === 'assignment-has-no-questions') return '至少添加一道题';
  return '补全班级与开放、截止时间';
}
function validationPath(value: string): string | null {
  if (!value.startsWith('validation:')) return null;
  const withoutPrefix = value.slice('validation:'.length);
  return withoutPrefix.slice(0, withoutPrefix.indexOf(':'));
}
function rejectTeacherAuthoringAssetReference() {
  return false;
}
function mergeSaveResponse(
  current: AssignmentEditorDocument,
  payload: Record<string, unknown>,
): AssignmentEditorDocument {
  const assignment = payload.assignment as Record<string, unknown> | undefined;
  const revision = payload.revision as Record<string, unknown> | undefined;
  if (assignment) {
    const revisions = assignment.revisions as Array<Record<string, unknown>>;
    const created = revisions[0];
    return {
      ...current,
      assignmentId: String(assignment.id),
      revisionId: String(created.id),
      contentDigest:
        typeof created.contentHash === 'string' ? created.contentHash : undefined,
      version: Number(created.version),
    };
  }
  return revision
    ? {
        ...current,
        contentDigest:
          typeof revision.contentHash === 'string'
            ? revision.contentHash
            : undefined,
        version: Number(revision.version),
      }
    : current;
}
function fromApiAssignment(
  assignment: Record<string, unknown>,
): AssignmentEditorDocument {
  const revisions = assignment.revisions as Array<Record<string, unknown>>;
  const revision =
    revisions.find((entry) => entry.state === 'DRAFT') ?? revisions[0];
  const questions = (revision.questions as Array<Record<string, unknown>>).map(
    (row) => {
      const prompt = row.promptSnapshot as { text: string };
      const answer = row.answerSnapshot as { text: string };
      return {
        stableQuestionId: String(row.stableQuestionId),
        responseType: row.responseType as 'SUBJECTIVE_TEXT' | 'SUBJECTIVE_FILE',
        points: Number(row.points),
        prompt: prompt.text,
        referenceAnswer: answer.text,
        rubric: row.rubricSnapshot,
        source: questionSourceFromRow(row),
      } as EditableQuestion;
    },
  );
  return {
    assignmentId: String(assignment.id),
    revisionId: String(revision.id),
    contentDigest:
      typeof revision.contentHash === 'string'
        ? revision.contentHash
        : undefined,
    version: Number(revision.version),
    draft: {
      title: String(revision.title),
      instructions: String(revision.instructions),
      totalPoints: Number(revision.totalPoints),
      questions,
      latePolicy: revision.latePolicy as AssignmentDraftInput['latePolicy'],
      responsePolicy:
        revision.responsePolicy as AssignmentDraftInput['responsePolicy'],
      resubmissionPolicy:
        revision.resubmissionPolicy as AssignmentDraftInput['resubmissionPolicy'],
      solutionReleasePolicy:
        revision.solutionReleasePolicy as AssignmentDraftInput['solutionReleasePolicy'],
    },
  };
}
function questionSourceFromRow(
  row: Record<string, unknown>,
): EditableQuestion['source'] {
  const lineage = row.sourceLineage as Record<string, unknown>;
  if (row.sourceFamily === 'ADAPTIVE_ASSESSMENT_CATALOG')
    return {
      family: 'ADAPTIVE_ASSESSMENT_CATALOG',
      sourceId: String(row.sourceId),
      sourceVersion: String(row.sourceVersion),
      sourceHash: String(row.sourceHash),
      reviewState:
        row.sourceReviewState === 'approved' ? 'approved' : 'reviewed',
      lineage: lineage as Record<string, string | number | boolean | null>,
    };
  if (row.sourceFamily === 'ASSIGNMENT_DERIVATIVE')
    return {
      family: 'ASSIGNMENT_DERIVATIVE',
      parentSourceId: String(lineage.parentSourceId),
      parentSourceVersion: String(lineage.parentSourceVersion),
      parentSourceHash: String(lineage.parentSourceHash),
      catalogItemId: String(row.sourceCatalogItemId),
      originalSourceFamily: String(row.sourceOriginalFamily),
      reviewState: String(row.sourceReviewState),
      eligibilityState: String(lineage.eligibilityState),
      allowedStages: Array.isArray(lineage.allowedStages)
        ? lineage.allowedStages.map(String)
        : [],
      limitations: Array.isArray(lineage.limitations)
        ? lineage.limitations.map(String)
        : [],
      selectionProof: String(row.sourceSelectionProof),
      contentHash: String(row.sourceHash),
      authoringMarker: 'assignment-authoring',
    };
  return { family: 'MANUAL', authoringMarker: 'assignment-authoring' };
}
function fromApiRevision(
  assignmentId: string,
  revision: Record<string, unknown>,
): AssignmentEditorDocument {
  return fromApiAssignment({ id: assignmentId, revisions: [revision] });
}

function canonicalFingerprint(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(canonicalFingerprint).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, item]) => `${JSON.stringify(key)}:${canonicalFingerprint(item)}`,
      )
      .join(',')}}`;
  return JSON.stringify(value);
}

function publicationRecoveryMessage(state: SaveState): string {
  if (state === 'saving') return '正在保存，请等待“已保存”后再发布。';
  if (state === 'error') return '保存失败，请重试保存后再发布。';
  if (state === 'conflict') return '存在版本冲突，请重新加载并解决冲突后再发布。';
  if (state === 'dirty') return '当前修改尚未保存，请先保存后再发布。';
  return '请先保存当前作业，再执行发布。';
}

function publicationErrorMessage(error: string | undefined, details: string[] | undefined): string {
  if (error === 'version-conflict' || error === 'publication-content-digest-mismatch') {
    return '保存基线已过期，请重新加载并确认最新内容后再发布。';
  }
  if (error === 'publication-baseline-already-published') {
    return '该保存基线已经发布，请返回作业列表查看结果。';
  }
  if (error === 'publication-conflict-retryable') {
    return '发布并发冲突，请保持当前已保存内容并重试。';
  }
  return details?.join('；') ?? '发布失败，请核对发布计划。';
}
