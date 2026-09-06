'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RuntimeMarkdownContent } from '@/components/shared/runtime-markdown';
import { AlertTriangle, ArrowLeft, Check, ChevronDown, ChevronUp, Eye, Library, Loader2, Plus, Save, Send, Sparkles, Trash2 } from 'lucide-react';

import { ASSIGNMENT_RUBRIC_GOAL_DIMENSIONS, assignmentDraftSchema, validatePublicationScores, type AssignmentDraftInput } from '@/lib/assignments/assignment-domain';
import { addDetailedRubricLevel, applyRubricLevelShortcut, createInitialDetailedLevel, deriveRubricLevelRanges, inferEditedRubricLevelIds, sortRubricLevels } from '@/lib/assignments/assignment-rubric-contract';
import { applyGeneratedRubricGuidelines, deriveAssignmentTotal, EMPTY_ASSIGNMENT_DRAFT, synchronizeAssignmentTotal, type AssignmentEditorDocument, type GovernedQuestionSummary } from './assignment-ui-contracts';
import { GovernedQuestionPicker } from './governed-question-picker';
import {
  AssignmentEmbeddedEditor,
  type AssignmentEmbeddedSaveState,
} from '@/features/teacher/preparation-document-editor/assignment-embedded-editor';
import type {
  ProtectedEditorAssetReference,
  ProtectedEditorImageUpload,
} from '@/features/teacher/preparation-document-editor/rich-markdown-editor';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';
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
/** 表单控件统一外观（发布抽屉、评分标准字段共用）。 */
const CONTROL_CLASS = 'mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950';
const TEXTAREA_CLASS = 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-3';

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
  const [saveFailure, setSaveFailure] = useState('');
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
  const blockerRef = useRef<HTMLDivElement>(null);
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
      const payload = (await response.json()) as { classes?: ManagedClassOption[] };
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
        const next = await fetch(
          `/api/teacher/assignments/${assignmentId}/next-draft`,
          { method: 'POST' },
        );
        if (!next.ok) throw new Error('next-draft');
        const nextPayload = (await next.json()) as {
          revision: Record<string, unknown>;
        };
        const loaded = fromApiAssignment({
          id: assignmentId,
          revisions: [nextPayload.revision],
        });
        documentRef.current = loaded;
        setDocument(loaded);
        setSaveState('saved');
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  }, [assignmentId]);

  // 统一的本地文档提交入口：绕过它的平行写入会让 dirty 判定与
  // documentRef 镜像失同步（#1792）。
  const commitDocument = useCallback((next: AssignmentEditorDocument) => {
    documentRef.current = next;
    setDocument(next);
    setSaveState('dirty');
  }, []);
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
      commitDocument(next);
    },
    [commitDocument, published],
  );
  const moveQuestion = (index: number, delta: number) => {
    updateDraft((current) => ({
      ...current,
      questions: moveItem(current.questions, index, delta),
    }));
    setActiveIndex(index + delta);
  };

  const save = useCallback((): Promise<{
    document: AssignmentEditorDocument;
    draftFingerprint: string;
  } | null> => {
    if (published) return Promise.resolve(null);
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const operation = saveQueueRef.current.then(async () => {
      const snapshot = documentRef.current;
      const draftFingerprint = canonicalFingerprint(snapshot.draft);
      setSaveState('saving');
      setSaveFailure('');
      try {
        const existing = hasSaveBaseline(snapshot);
        const response = await fetch(
          existing
            ? `/api/teacher/assignments/${snapshot.assignmentId}`
            : '/api/teacher/assignments',
          {
            method: existing ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              existing
                ? { revisionId: snapshot.revisionId, expectedVersion: snapshot.version, draft: snapshot.draft }
                : { draft: snapshot.draft },
            ),
          },
        );
        if (response.status === 409) {
          setSaveState('conflict');
          return null;
        }
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as {
            error?: string;
          };
          setSaveFailure(saveFailureMessage(payload.error));
          setSaveState('error');
          return null;
        }
        const payload = (await response.json()) as Record<string, unknown>;
        const saved = mergeSaveResponse(snapshot, payload);
        documentRef.current = mergeSaveResponse(documentRef.current, payload);
        setDocument((current) => mergeSaveResponse(current, payload));
        setSaveState(
          draftFingerprint === canonicalFingerprint(documentRef.current.draft)
            ? 'saved'
            : 'dirty',
        );
        return { document: saved, draftFingerprint };
      } catch {
        setSaveFailure('保存请求未完成，请检查网络后重试。');
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

  const uploadContentImage = useCallback<ProtectedEditorImageUpload>(
    async (file) => {
      const assignmentId = documentRef.current.assignmentId;
      if (!assignmentId) {
        throw new Error('请先等待草稿完成首次保存，再插入图片。');
      }
      if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('仅支持 PNG 或 JPEG 图片。');
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const checksum = `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
      const signedResponse = await fetch(
        `/api/teacher/assignments/${assignmentId}/content-assets/upload-sign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            checksum,
          }),
        },
      );
      if (!signedResponse.ok) throw new Error('图片上传授权失败。');
      const signed = await signedResponse.json() as { assetId: string; upload: { url: string; requiredHeaders: Record<string, string> } };
      const uploadResponse = await fetch(signed.upload.url, {
        method: 'PUT',
        headers: signed.upload.requiredHeaders,
        body: file,
      });
      if (!uploadResponse.ok) throw new Error('图片上传失败。');
      const completeResponse = await fetch(
        `/api/teacher/assignments/${assignmentId}/content-assets/${signed.assetId}/complete`,
        { method: 'POST' },
      );
      if (!completeResponse.ok) throw new Error('图片完整性校验失败。');
      const completed = await completeResponse.json() as ProtectedEditorAssetReference;
      return { ...completed, altText: file.name };
    },
    [],
  );

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

  // 发布状态文案：sr-only 与可见横幅共用同一表达式（#1792 去重）。
  const publicationStatusMessage = saveState === 'error' && saveFailure
    ? saveFailure : SAVE_STATE_PRESENTATION[saveState].recovery;
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
  const validationFieldRef = <T extends HTMLElement>(path: string) => registerValidationField(path) as React.Ref<T>;
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
    const path = validationPath(blocker)
      ?? semanticBlockerPath(blocker, documentRef.current.draft);
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

  const failPublication = (message: string) => {
    setPublishMessage(message);
    focusLater(() => publishMessageRef.current);
  };
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
      failPublication(SAVE_STATE_PRESENTATION[saveState].recovery);
      return;
    }
    const saved = documentRef.current;
    if (!hasSaveBaseline(saved) || !saved.contentDigest) {
      failPublication('保存基线不完整，请重新保存后再发布。');
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
        failPublication(publicationErrorMessage(payload.error, payload.details));
      }
    } catch {
      failPublication('发布请求失败，请检查网络后重试。');
    } finally {
      setPublishing(false);
    }
  };

  const selectQuestion = async (
    item: GovernedQuestionSummary,
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/teacher/assignments/question-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: item.sourceId }),
      });
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
      focusLater(() => promptRef.current);
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
    if (published) return { status: 'error', message: '已发布作业不能生成评分细则。' };
    const current = documentRef.current;
    const questionIndex = current.draft.questions.findIndex(
      (item) => item.stableQuestionId === input.question.stableQuestionId,
    );
    if (questionIndex < 0) return { status: 'error', message: '当前题目已变化，请重新选择。' };
    commitDocument({
      ...current,
      draft: {
        ...current.draft,
        questions: replaceAt(current.draft.questions, questionIndex, input.question),
      },
    });

    const saved = await save();
    if (!saved) {
      return { status: 'error', message: '生成前保存失败，请先解决保存错误或版本冲突。' };
    }
    const baseline = saved.document;
    if (!hasSaveBaseline(baseline)) {
      return { status: 'error', message: '保存基线不完整，无法生成评分细则。' };
    }
    const savedQuestion = baseline.draft.questions.find(
      (item) => item.stableQuestionId === input.question.stableQuestionId,
    );
    const savedCriterion = savedQuestion
      ? toScoringRubricV2(savedQuestion.rubric).criteria.find((item) => item.id === input.scoringItemId)
      : undefined;
    if (!savedQuestion || !savedCriterion || !savedCriterion.detailedRubricEnabled) {
      return { status: 'error', message: '评分项结构已变化，请重新发起生成。' };
    }
    const levelIds = savedCriterion.levels.map((level) => level.id);
    const requestedCriterionFingerprint = canonicalFingerprint(savedCriterion);
    if (rubricBasisMissing(savedCriterion)) {
      return { status: 'error', message: '请填写评分标准或评分项名称后再生成。', focus: 'scoring-item-name' };
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
    const latestCriterion = latestQuestion
      ? toScoringRubricV2(latestQuestion.rubric).criteria.find((item) => item.id === generated.scoringItemId)
      : undefined;
    const outdated =
      latest.version !== generated.revisionVersion
      || generated.revisionId !== latest.revisionId
      || !latestQuestion
      || !latestCriterion
      || canonicalFingerprint(latestCriterion) !== requestedCriterionFingerprint;
    const nextQuestion = outdated
      ? null
      : applyGeneratedRubricGuidelines(
          { ...latestQuestion, rubric: toScoringRubricV2(latestQuestion.rubric) },
          generated.scoringItemId,
          generated.levels,
        );
    if (!nextQuestion) {
      return { status: 'error', message: '生成期间评分细则已变化，结果未应用。' };
    }
    commitDocument({
      ...latest,
      draft: {
        ...latest.draft,
        questions: replaceAt(latest.draft.questions, latestQuestionIndex, nextQuestion),
      },
    });
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

  const scheduleInput = (
    label: string,
    path: string,
    value: string,
    onChange: (value: string) => void,
  ) => (
    <label className="block text-xs text-slate-400">
      {label}
      <input
        ref={validationFieldRef<HTMLInputElement>(path)}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${CONTROL_CLASS} px-3`}
      />
    </label>
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
        <Link href="/teacher/assignments" className="inline-flex items-center gap-1 text-sm text-cyan-300" >
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
              <dd className="text-slate-100">{SAVE_STATE_PRESENTATION[saveState].label}</dd>
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
            <Link href="/teacher/assignments" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-300" >
              <ArrowLeft className="h-4 w-4" />
              返回作业
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-white">编辑作业</h1>
            <p className="mt-1 text-xs text-slate-500">
              版本 v{document.version}·解答发布策略{' '}
              教师确认后发布
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
        <p role="status" aria-live="polite" className="mb-4 text-sm text-slate-400">
          自动保存：{SAVE_STATE_PRESENTATION[saveState].label}
        </p>
        <p id="assignment-publication-state" className="sr-only">
          {saveState === 'saved'
            ? '当前内容已保存，可以发布'
            : publicationStatusMessage}
        </p>
        {saveState !== 'saved' && (
          <p className="mb-4 text-sm text-amber-200">
            {publicationStatusMessage}
          </p>
        )}
        {saveState === 'conflict' && (
          <div role="alert" className="mb-4 rounded-xl border border-amber-500/50 bg-amber-950/30 p-4" >
            <h2 className="font-semibold text-amber-200">检测到新版本</h2>
            <p className="mt-1 text-sm text-amber-100">
              服务器上的草稿已变更。重新加载后再合并本地内容。
            </p>
            <button type="button" onClick={() => window.location.reload()} className="mt-3 min-h-11 rounded-lg border border-amber-400 px-4" >
              重新加载
            </button>
          </div>
        )}
        <div className="grid min-h-[62vh] grid-cols-[13rem_minmax(0,1fr)] gap-4">
          <aside aria-label="题目大纲" className="rounded-xl border border-slate-800 bg-slate-900/60 p-3" >
            <h2 className="px-2 text-sm font-semibold text-white">题目大纲</h2>
            <div className="mt-3 space-y-2">
              {document.draft.questions.map((entry, index) => {
                const focusQuestionButton = () =>
                  focusLater(() =>
                    questionButtonRefs.current.get(entry.stableQuestionId),
                  );
                const moveButton = (
                  delta: -1 | 1,
                  label: string,
                  Icon: typeof ChevronUp,
                ) => (
                  <button
                    type="button"
                    aria-label={label}
                    disabled={
                      delta < 0
                        ? index === 0
                        : index === document.draft.questions.length - 1
                    }
                    onClick={() => {
                      moveQuestion(index, delta);
                      focusQuestionButton();
                    }}
                    className="grid h-10 w-10 place-items-center disabled:opacity-30"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
                return (
                <div
                  key={entry.stableQuestionId}
                  className={`rounded-lg border p-2 ${index === activeIndex ? 'border-cyan-500 bg-cyan-950/30' : 'border-slate-700'}`}
                >
                  <button
                    ref={trackMapEntry(
                      questionButtonRefs.current,
                      entry.stableQuestionId,
                    )}
                    type="button"
                    data-question-id={entry.stableQuestionId}
                    aria-current={index === activeIndex ? 'true' : undefined}
                    onClick={() => {
                      setActiveIndex(index);
                      focusLater(() => promptRef.current);
                    }}
                    className="min-h-11 w-full text-left text-sm"
                  >
                    第 {index + 1} 题·{entry.points} 分
                  </button>
                  <div className="flex gap-1">
                    {moveButton(-1, `上移第 ${index + 1} 题`, ChevronUp)}
                    {moveButton(1, `下移第 ${index + 1} 题`, ChevronDown)}
                    <button
                      type="button"
                      aria-label={`删除第 ${index + 1} 题`}
                      onClick={() => {
                        const nextFocusId = document.draft.questions[index + 1]?.stableQuestionId ?? document.draft.questions[index - 1]?.stableQuestionId;
                        updateDraft((draft) => ({
                          ...draft,
                          questions: draft.questions.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        }));
                        setActiveIndex(Math.max(0, index - 1));
                        focusLater(() =>
                          nextFocusId
                            ? questionButtonRefs.current.get(nextFocusId)
                            : openerRef.current,
                        );
                      }}
                      className="grid h-10 w-10 place-items-center text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                );
              })}
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
                focusLater(() => promptRef.current);
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
          <section aria-label="作业题目编辑" className="space-y-4 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/60 p-5" >
            <label className="block text-xs text-slate-400">
              作业标题
              <input
                ref={validationFieldRef<HTMLInputElement>('title')}
                aria-describedby="assignment-validation-errors"
                placeholder="例如：第二章控制系统建模作业"
                value={document.draft.title}
                onChange={(event) => updateDraft((draft) => ({ ...draft, title: event.target.value, }))}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-lg font-semibold text-white"
              />
            </label>
            <label className="block text-xs text-slate-400">
              作业说明
              <textarea
                placeholder="说明完成要求、提交范围与注意事项"
                value={document.draft.instructions}
                onChange={(event) => updateDraft((draft) => ({ ...draft, instructions: event.target.value, }))}
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
                assignmentId={document.assignmentId}
                uploadImage={uploadContentImage}
                onSave={() => void save()}
                onGenerateGuidelines={generateRubricGuidelines}
                onChange={(next) => updateDraft((draft) => ({ ...draft, questions: replaceAt(draft.questions, activeIndex, next), }))}
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
            onToggle={(event) => setPublicationOpen(event.currentTarget.open)}
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
              <div role="alert" className="rounded-lg border border-rose-800 p-3 text-xs text-rose-200" >
                可管理班级加载失败。
                <button type="button" onClick={() => void loadManagedClasses()} className="ml-2 underline" >
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
                  ref={validationFieldRef<HTMLSelectElement>('publication.classId')}
                  value={classId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setClassId(value);
                  }}
                  className={`${CONTROL_CLASS} px-3`}
                >
                  <option value="">请选择可管理班级</option>
                  {managedClasses.map((item) => {
                    const terms = [item.year, item.semester].filter(Boolean).join(' ');
                    return (
                      <option key={item.id} value={item.id}>
                        {item.name}（{item.code}）{terms ? ` · ${terms}` : ''}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}
            {scheduleInput('开放时间', 'publication.availableAt', availableAt, setAvailableAt)}
            {scheduleInput('截止时间', 'publication.dueAt', dueAt, setDueAt)}
            <label className="block text-xs text-slate-400">
              迟交策略
              <select
                ref={validationFieldRef<HTMLSelectElement>('latePolicy.mode')}
                aria-describedby="assignment-validation-errors"
                value={document.draft.latePolicy.mode}
                onChange={(event) => updateDraft((draft) => ({ ...draft, latePolicy: event.target.value === 'CLOSED' ? { version: 1, mode: 'CLOSED' } : { version: 1, mode: 'ALLOW', penaltyPercentPerDay: 0 } }))}
                className={`${CONTROL_CLASS} px-3`}
              >
                <option value="CLOSED">截止后关闭</option>
                <option value="ALLOW">允许迟交</option>
              </select>
            </label>
            {document.draft.latePolicy.mode === 'ALLOW' && (
              <label className="block text-xs text-slate-400">
                每日扣分百分比
                <input
                  ref={validationFieldRef<HTMLInputElement>('latePolicy.penaltyPercentPerDay')}
                  aria-describedby="assignment-validation-errors"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={document.draft.latePolicy.penaltyPercentPerDay}
                  onChange={(event) => updateDraft((draft) => ({ ...draft, latePolicy: { version: 1, mode: 'ALLOW', penaltyPercentPerDay: Number(event.target.value), }, }))}
                />
              </label>
            )}
            <div className="rounded-lg border border-slate-700 p-3 text-xs text-slate-400">
              学生可在每题同时提交 Markdown 正文、图片和附件。历史作答类型仅保留在发布快照中供审计。
            </div>
            <label className="block text-xs text-slate-400">
              最多提交次数
              <input
                ref={validationFieldRef<HTMLInputElement>(
                  'resubmissionPolicy.maxAttempts',
                )}
                aria-describedby="assignment-validation-errors"
                type="number"
                step="1"
                min="1"
                max="20"
                value={document.draft.resubmissionPolicy.maxAttempts}
                onChange={(event) => updateDraft((draft) => ({ ...draft, resubmissionPolicy: { ...draft.resubmissionPolicy, maxAttempts: Number(event.target.value), }, }))}
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={document.draft.resubmissionPolicy.untilDueAt}
                onChange={(event) => updateDraft((draft) => ({ ...draft, resubmissionPolicy: { ...draft.resubmissionPolicy, untilDueAt: event.target.checked, }, }))}
              />
              仅截止前允许重交
            </label>
            <div className="rounded-lg border border-slate-700 p-3 text-xs text-slate-400">
              截止后可选择 AI 或人工批改。教师确认并逐份发布结果时，学生将同时看到分数、批注、参考答案和评分标准。
            </div>
            <div id="assignment-validation-errors" ref={blockerRef} tabIndex={-1} className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3" >
              <h3 className="flex items-center gap-2 text-sm font-medium text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                发布阻断项
              </h3>
              {blockers.length ? (
                <ul className="mt-2 space-y-1 text-xs text-amber-100">
                  {blockers.map((entry) => (
                    <li key={entry}>
                      <button type="button" onClick={() => focusBlocker(entry)} className="text-left underline" >
                        {blockerLabel(entry, document.draft)}
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
              <p ref={publishMessageRef} tabIndex={-1} role="alert" className="text-sm text-amber-200" >
                {publishMessage}
              </p>
            )}
            </div>
          </details>
          </section>
        </div>
        {previewOpen && (
          <section aria-label="作业预览" className="mt-4 rounded-xl border border-cyan-700 bg-slate-900 p-5" >
            <h2 className="text-lg font-semibold text-white">学生视图预览</h2>
            <p className="mt-2 text-slate-300">
              {document.draft.instructions || '暂无作业说明'}
            </p>
            <ol className="mt-4 list-decimal space-y-3 pl-5">
              {document.draft.questions.map((entry) => (
                <li key={entry.stableQuestionId}>
                  <RuntimeMarkdownContent markdown={entry.prompt} resolveAssetHref={(href) => href} />
                  <span className="text-sm text-slate-400">（{entry.points} 分）</span>
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
          focusLater(() => openerRef.current);
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
  assignmentId,
  uploadImage,
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
  assignmentId?: string;
  uploadImage: ProtectedEditorImageUpload;
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
    | { mode: 'missing-standard'; criterionIndex: number; standardDraft: string }
    | { mode: 'overwrite'; criterionIndex: number }
    | null
  >(null);
  const [generatingCriterionId, setGeneratingCriterionId] = useState<string | null>(null);
  const [rubricGenerationMessage, setRubricGenerationMessage] = useState('');
  const [expandedCriterionIds, setExpandedCriterionIds] = useState(
    () => new Set(editableQuestion.rubric.criteria.map((item) => item.id)),
  );
  const validationFieldRef = <T extends HTMLElement>(path: string) => registerValidationField(path) as React.Ref<T>;
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
      setCriterionExpanded(focusRequest.criterionId, true);
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
    if (rubricDialog) focusLater(() => dialogPrimaryRef.current);
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
  const withCriterion = (
    index: number,
    update: (criterion: ScoringCriterionV2) => ScoringCriterionV2,
  ): EditableQuestionV2 => ({
    ...editableQuestion,
    rubric: {
      ...editableQuestion.rubric,
      criteria: replaceAt(
        editableQuestion.rubric.criteria,
        index,
        update(editableQuestion.rubric.criteria[index]),
      ),
    },
  });
  const updateCriterion = (
    index: number,
    update: (criterion: ScoringCriterionV2) => ScoringCriterionV2,
  ) => onChange(withCriterion(index, update));
  const updateLevels = (index: number, levels: ScoringCriterionV2['levels']) =>
    updateCriterion(index, (item) => ({ ...item, levels }));
  // 题面与参考答案共用同一嵌入编辑器宿主配置；仅 field/ariaLabel/值接线不同。
  const embeddedEditorSharedProps = {
    hostRole: 'teacher' as const,
    saveState: SAVE_STATE_PRESENTATION[saveState].embedded,
    readOnly,
    continuousEditing: true,
    showSaveAction: false,
    onEdit: () => undefined,
    onSave,
    uploadImage,
    validateAssetReference: (asset: ProtectedEditorAssetReference) =>
      validateTeacherAuthoringAssetReference(asset, assignmentId),
    resolveAssetHref: (href: string) => href,
    canonicalizeAssetHref: (href: string) => href,
  };
  const updateCriteria = (criteria: ScoringRubricV2['criteria']) =>
    onChange({
      ...editableQuestion,
      rubric: { ...editableQuestion.rubric, criteria },
    });
  const setCriterionExpanded = (id: string, expanded: boolean) =>
    setExpandedCriterionIds((current) => {
      const next = new Set(current);
      if (expanded) next.add(id);
      else next.delete(id);
      return next;
    });
  // 级别三胞胎（label/maxPoints/guideline）仅字段不同；maxPoints 变化后
  // 需要保持级别有序（#1792）。
  const updateLevel = (
    criterionIndex: number,
    levelIndex: number,
    update: (level: ScoringCriterionV2['levels'][number]) => ScoringCriterionV2['levels'][number],
    resort = false,
  ) =>
    updateCriterion(criterionIndex, (item) => ({
      ...item,
      levels: resort
        ? sortRubricLevels(
            replaceAt(item.levels, levelIndex, update(item.levels[levelIndex])),
            item.maxPoints,
          )
        : replaceAt(item.levels, levelIndex, update(item.levels[levelIndex])),
    }));
  const focusGenerationBasis = (
    index: number,
    focus: 'scoring-item-name' | 'scoring-standard',
  ) =>
    focusLater(() =>
      focus === 'scoring-standard'
        ? scoringStandardRefs.current.get(index)
        : criterionNameRefs.current.get(index),
    );
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
    if (rubricBasisMissing(criterion)) {
      setRubricGenerationMessage('请先填写评分标准或评分项名称。');
      focusGenerationBasis(index, 'scoring-item-name');
      return;
    }
    const standard = criterion.scoringStandard.trim();
    if (!standard) {
      setRubricDialog({
        mode: 'missing-standard',
        criterionIndex: index,
        standardDraft: '',
      });
      return;
    }
    if (criterion.levels.some((level) => level.guideline.trim())) {
      setRubricDialog({ mode: 'overwrite', criterionIndex: index });
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
          {...embeddedEditorSharedProps}
          containerRef={promptRef}
          field="question-prompt"
          ariaLabel="题面"
          value={editableQuestion.prompt}
          savedValue={editableQuestion.prompt}
          onChange={(value) => onChange({ ...editableQuestion, prompt: value })}
        />
      </section>
      <section aria-labelledby="answer-title">
        <h2 id="answer-title" className="text-lg font-semibold text-white">
          参考答案
        </h2>
        <AssignmentEmbeddedEditor
          {...embeddedEditorSharedProps}
          field="reference-answer"
          ariaLabel="参考答案"
          value={editableQuestion.referenceAnswer}
          savedValue={editableQuestion.referenceAnswer}
          onChange={(value) => onChange({ ...editableQuestion, referenceAnswer: value })}
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
              setCriterionExpanded(criterion.id, true);
              updateCriteria([...editableQuestion.rubric.criteria, criterion]);
              focusLater(() => criterionToggleRefs.current.get(criterion.id));
            }}
            className="min-h-11 rounded-lg border border-slate-700 px-3"
          >
            添加评分项
          </button>
        </div>
        <label className="mt-2 block text-xs text-slate-400">
          题目分值
          <input
            ref={validationFieldRef<HTMLInputElement>(
              `questions.${questionIndex}.points`,
            )}
            type="number"
            aria-describedby="assignment-validation-errors"
            step="0.1"
            min="1"
            max="10000"
            value={editableQuestion.points}
            onChange={(event) => onChange({ ...editableQuestion, points: Number(event.target.value) })}
            className={`${CONTROL_CLASS} px-3`}
          />
        </label>
        {editableQuestion.rubric.criteria.map((criterion, index) => {
          const expanded = expandedCriterionIds.has(criterion.id);
          const ranges = deriveRubricLevelRanges(criterion.levels, criterion.maxPoints);
          const editedLevelIds = editedLevelIdsRef.current.get(criterion.id) ?? new Set<string>();
          const focusCriterionToggle = (id: string = criterion.id) => focusLater(() => criterionToggleRefs.current.get(id));
          const basePath = `questions.${questionIndex}.rubric.criteria.${index}`;
          const criteriaFieldRef = <T extends HTMLElement>(suffix: string, track: (element: T | null) => void) =>
            (element: T | null) => {
              registerValidationField(`${basePath}.${suffix}`)(element);
              track(element);
            };
          const applyShortcut = (targetCount: 2 | 5) => {
            const attempt = (confirmTrailingDeletion = false) =>
              applyRubricLevelShortcut({
                criterionId: criterion.id,
                criterionMaxPoints: criterion.maxPoints,
                levels: criterion.levels,
                targetCount,
                editedLevelIds,
                confirmTrailingDeletion,
              });
            let result = attempt();
            if (result.status === 'confirmation-required') {
              const deletionSummary = result.trailingLevels
                .map((level) => `${level.label}（${level.maxPoints} 分；${level.guideline}）`)
                .join('、');
              if (!window.confirm(`将删除末尾级别：${deletionSummary}。是否继续？`)) {
                return;
              }
              result = attempt(true);
            }
            if (result.status === 'applied') updateLevels(index, result.levels);
          };
          const criteriaMoveButton = (delta: -1 | 1) => (
            <button
              type="button"
              aria-label={`${delta < 0 ? '上移' : '下移'}评分项 ${index + 1}`}
              disabled={
                delta < 0
                  ? index === 0
                  : index === editableQuestion.rubric.criteria.length - 1
              }
              onClick={() => {
                updateCriteria(
                  moveItem(editableQuestion.rubric.criteria, index, delta),
                );
                focusCriterionToggle();
              }}
            >
              {delta < 0 ? '↑' : '↓'}
            </button>
          );
          return (
          <article key={criterion.id} className="mt-3 rounded-xl border border-slate-700 p-3" >
            <div className="flex gap-2">
              <button
                ref={trackMapEntry(criterionToggleRefs.current, criterion.id)}
                type="button"
                aria-expanded={expanded}
                aria-controls={`criterion-fields-${criterion.id}`}
                aria-label={`${expanded ? '折叠' : '展开'}评分项 ${index + 1}`}
                onClick={() => setCriterionExpanded(criterion.id, !expanded)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-700"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
              <input
                ref={criteriaFieldRef('label', trackMapEntry(criterionNameRefs.current, index))}
                aria-label={`评分项 ${index + 1} 名称`}
                aria-describedby="assignment-validation-errors"
                value={criterion.label}
                onChange={(event) => updateCriterion(index, (item) => ({ ...item, label: event.target.value, }))}
                className="min-h-11 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3"
              />
              <span className="inline-flex min-h-11 items-center whitespace-nowrap text-sm text-slate-300">
                {criterion.maxPoints} 分
              </span>
              {criteriaMoveButton(-1)}
              {criteriaMoveButton(1)}
              <button
                type="button"
                aria-label={`删除评分项 ${index + 1}`}
                disabled={editableQuestion.rubric.criteria.length === 1}
                onClick={() => {
                  const nextFocusId =
                    editableQuestion.rubric.criteria[index + 1]?.id
                    ?? editableQuestion.rubric.criteria[index - 1]?.id;
                  updateCriteria(
                    editableQuestion.rubric.criteria.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  );
                  setCriterionExpanded(criterion.id, false);
                  if (nextFocusId) focusCriterionToggle(nextFocusId);
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
                  ref={validationFieldRef<HTMLInputElement>(
                    `${basePath}.maxPoints`,
                  )}
                  type="number"
                  aria-describedby="assignment-validation-errors"
                  step="0.1"
                  min="1"
                  max="10000"
                  value={criterion.maxPoints}
                  onChange={(event) =>
                    updateCriterion(index, (item) => {
                      const maxPoints = Number(event.target.value);
                      return { ...item, maxPoints, levels: sortRubricLevels(item.levels, maxPoints) };
                    })
                  }
                  className={`${CONTROL_CLASS} px-3`}
                />
              </label>
              <label className="text-xs text-slate-400">
                学生可见指导
                <input
                  value={criterion.studentVisibleGuidance ?? ''}
                  onChange={(event) => updateCriterion(index, (item) => ({ ...item, studentVisibleGuidance: event.target.value, }))}
                  className={`${CONTROL_CLASS} px-3`}
                />
              </label>
              <label className="text-xs text-slate-400">
                能力维度
                <select
                  aria-label={`评分项 ${index + 1} 能力维度`}
                  value={criterion.goalDimension ?? 'engineeringDecision'}
                  onChange={(event) => updateCriterion(index, (item) => ({ ...item, goalDimension: event.target.value as ScoringCriterionV2['goalDimension'], }))}
                  className={`${CONTROL_CLASS} px-3`}
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
                ref={criteriaFieldRef('scoringStandard', trackMapEntry(scoringStandardRefs.current, index))}
                value={criterion.scoringStandard}
                aria-label={`评分项 ${index + 1} 评分标准`}
                aria-describedby="assignment-validation-errors"
                onChange={(event) => updateCriterion(index, (item) => ({ ...item, scoringStandard: event.target.value, }))}
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
                    if (!window.confirm(`将删除全部评价级别：${deletionSummary}。是否继续？`)) return;
                  }
                  updateCriterion(index, (item) => ({
                    ...item,
                    detailedRubricEnabled: enabled,
                    levels: enabled
                      ? (item.levels.length > 0 ? item.levels : [createInitialDetailedLevel(item.id, item.maxPoints)])
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
                    if (result.status === 'applied') updateLevels(index, result.levels);
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
                const pristineProps = (field: 'label' | 'maxPoints' | 'guideline') =>
                  pristineLevelFieldProps(editedLevelFieldKeysRef.current, fieldKey(field));
                const markFieldEdited = (field: 'label' | 'maxPoints' | 'guideline') => {
                  editedLevelFieldKeysRef.current.add(fieldKey(field));
                  editedLevelIds.add(level.id);
                  editedLevelIdsRef.current.set(criterion.id, editedLevelIds);
                };
                const levelMoveButton = (delta: -1 | 1) => (
                  <button
                    type="button"
                    aria-label={`${delta < 0 ? '上移' : '下移'}档位 ${levelIndex + 1}`}
                    disabled={
                      delta < 0
                        ? levelIndex === 0
                        : levelIndex === criterion.levels.length - 1
                    }
                    onClick={() => updateLevels(index, moveItem(criterion.levels, levelIndex, delta))}
                  >
                    {delta < 0 ? '↑' : '↓'}
                  </button>
                );
              return (
              <div key={level.id} className="mt-2 grid gap-2 rounded-lg bg-slate-950/60 p-2 md:grid-cols-3" >
                <input
                  ref={validationFieldRef<HTMLInputElement>(
                    `${basePath}.levels.${levelIndex}.label`,
                  )}
                  aria-label={`评分项 ${index + 1} 档位 ${levelIndex + 1} 名称`}
                  aria-describedby="assignment-validation-errors"
                  value={level.label}
                  {...pristineProps('label')}
                  onChange={(event) => {
                    markFieldEdited('label');
                    updateLevel(index, levelIndex, (entry) => ({
                      ...entry,
                      label: event.target.value,
                    }));
                  }}
                />
                <label className="text-xs text-slate-400">
                  {isHighestLevel ? '最高级别上限（同步满分）' : `区间 ${range?.minPoints ?? 0}–${range?.maxInclusivePoints ?? 0}`}
                  <input
                    ref={validationFieldRef<HTMLInputElement>(
                      `${basePath}.levels.${levelIndex}.maxPoints`,
                    )}
                    aria-label={`评分项 ${index + 1} 级别 ${levelIndex + 1} 分值边界`}
                    aria-describedby="assignment-validation-errors"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max={criterion.maxPoints}
                    disabled={isHighestLevel}
                    value={level.maxPoints}
                    {...pristineProps('maxPoints')}
                    onChange={(event) => {
                      markFieldEdited('maxPoints');
                      updateLevel(
                        index,
                        levelIndex,
                        (entry) => ({ ...entry, maxPoints: Number(event.target.value) }),
                        true,
                      );
                    }}
                  />
                </label>
                <div>
                  <input
                    ref={validationFieldRef<HTMLInputElement>(
                      `${basePath}.levels.${levelIndex}.guideline`,
                    )}
                    aria-label={`评分项 ${index + 1} 级别 ${levelIndex + 1} 评分准则`}
                    aria-describedby="assignment-validation-errors"
                    value={level.guideline}
                    {...pristineProps('guideline')}
                    onChange={(event) => {
                      markFieldEdited('guideline');
                      updateLevel(index, levelIndex, (entry) => ({
                        ...entry,
                        guideline: event.target.value,
                      }));
                    }}
                  />
                  <div className="flex gap-2">
                    {levelMoveButton(-1)}
                    {levelMoveButton(1)}
                    <button
                      type="button"
                      aria-label={`删除档位 ${levelIndex + 1}`}
                      disabled={criterion.levels.length === 1}
                      onClick={() =>
                        updateLevels(
                          index,
                          criterion.levels.filter((_, itemIndex) => itemIndex !== levelIndex),
                        )
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
        const dialogCancelButton = (
          <button type="button" onClick={() => setRubricDialog(null)} className="min-h-10 rounded-lg border border-slate-600 px-4 text-sm" >
            取消
          </button>
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
                    {dialogCancelButton}
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
                        const preparedQuestion = withCriterion(
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
                    {dialogCancelButton}
                    <button
                      ref={dialogPrimaryRef as React.Ref<HTMLButtonElement>}
                      type="button"
                      onClick={() => {
                        void runRubricGeneration(
                          rubricDialog.criterionIndex,
                          'scoring-standard',
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
          id: 'criterion-1', label: '完成质量', goalDimension: 'engineeringDecision', maxPoints: 10,
          scoringStandard: '根据作答证据的正确性、完整性和可复核程度评分。', detailedRubricEnabled: false, levels: [],
        },
      ],
    },
    source: { family: 'MANUAL', authoringMarker: 'assignment-authoring' },
  };
}
function newCriterion(): ScoringCriterionV2 {
  return {
    id: `criterion-${Date.now()}`,
    label: '新评分项', goalDimension: 'engineeringDecision', maxPoints: 1,
    scoringStandard: '依据作答证据评分。', detailedRubricEnabled: false, levels: [],
  };
}

function toScoringRubricV2(rubric: EditableQuestion['rubric']): ScoringRubricV2 {
  if (rubric.schemaVersion === 'assignment-scoring-rubric.v2') return rubric;
  const round = (points: number) => Math.ceil(points * 10) / 10;
  return {
    schemaVersion: 'assignment-scoring-rubric.v2',
    criteria: rubric.criteria.map((criterion) => ({
      id: criterion.id,
      label: criterion.label,
      goalDimension: criterion.goalDimension ?? 'engineeringDecision',
      maxPoints: round(criterion.maxPoints),
      scoringStandard: criterion.evidenceDescription,
      detailedRubricEnabled: true,
      evidenceDescription: criterion.evidenceDescription,
      feedbackGuidance: criterion.feedbackGuidance,
      studentVisibleGuidance: criterion.studentVisibleGuidance,
      levels: criterion.levels.map((level, index) => ({
        id: level.id,
        label: level.label,
        maxPoints: index === 0 ? round(criterion.maxPoints) : round(criterion.levels[index - 1].minPoints),
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
/** 未手工编辑过的级别字段保持“聚焦全选、鼠标释放不改选区”的初始编辑体验。 */
function pristineLevelFieldProps(
  editedFieldKeys: ReadonlySet<string>,
  fieldKey: string,
) {
  const pristine = () => !editedFieldKeys.has(fieldKey);
  return {
    onFocus: (event: React.FocusEvent<HTMLInputElement>) => {
      if (pristine()) event.currentTarget.select();
    },
    onMouseUp: (event: React.MouseEvent<HTMLInputElement>) => {
      if (pristine()) event.preventDefault();
    },
  };
}
function replaceAt<T>(items: readonly T[], index: number, next: T): T[] {
  return items.map((item, itemIndex) => (itemIndex === index ? next : item));
}
/** ref 回调统一登记/注销到 Map；与逐个手写的 set/delete 等价。 */
function trackMapEntry<K, V extends HTMLElement>(map: Map<K, V>, key: K) {
  return (element: V | null) => {
    if (element) map.set(key, element);
    else map.delete(key);
  };
}
/** 焦点恢复统一走宏任务延迟；与 window.setTimeout(() => ref?.focus(), 0) 等价。 */
function focusLater(target: () => HTMLElement | null | undefined) {
  window.setTimeout(() => target()?.focus(), 0);
}
/** 评分生成依据缺失：评分标准与评分项名称都为空（服务端 basis-missing 同语义）。 */
function rubricBasisMissing(criterion: { scoringStandard: string; label: string }): boolean {
  return criterion.scoringStandard.trim() === '' && criterion.label.trim() === '';
}
/** CAS 保存基线：已有 assignmentId+revisionId 才能走 PATCH/发布/生成。 */
function hasSaveBaseline<T extends { assignmentId?: string; revisionId?: string }>(
  document: T,
): document is T & { assignmentId: string; revisionId: string } {
  return Boolean(document.assignmentId && document.revisionId);
}
/** 保存状态的三套展示口径共用一张表：可见标签、发布恢复提示、嵌入编辑器状态。 */
const SAVE_STATE_PRESENTATION: Record<
  SaveState,
  { label: string; recovery: string; embedded: AssignmentEmbeddedSaveState }
> = {
  idle: { label: '尚未修改', recovery: '请先保存当前作业，再执行发布。', embedded: 'editing' },
  dirty: { label: '待保存', recovery: '当前修改尚未保存，请先保存后再发布。', embedded: 'editing' },
  saving: { label: '正在保存', recovery: '正在保存，请等待“已保存”后再发布。', embedded: 'saving' },
  saved: { label: '已保存', recovery: '请先保存当前作业，再执行发布。', embedded: 'saved' },
  error: { label: '保存失败', recovery: '保存失败，请重试保存后再发布。', embedded: 'failed' },
  conflict: { label: '存在冲突', recovery: '存在版本冲突，请重新加载并解决冲突后再发布。', embedded: 'conflict' },
};

const VALIDATION_BLOCKER_LABELS: Record<string, string> = {
  'title': '补全作业标题',
  'responsePolicy.allowedResponseTypes': '题目作答类型必须包含在作业允许类型中',
  'resubmissionPolicy.maxAttempts': '提交次数必须在 1 至 20 次之间',
  'latePolicy.penaltyPercentPerDay': '迟交扣分比例必须在 0% 至 100% 之间',
};

function blockerLabel(value: string, draft: AssignmentDraftInput) {
  if (value.startsWith('validation:')) {
    const path = validationPath(value) ?? '';
    const message = value.slice(value.lastIndexOf(':') + 1);
    if (VALIDATION_BLOCKER_LABELS[path]) return VALIDATION_BLOCKER_LABELS[path];
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
  if (semanticBlockerPath(value, draft)?.endsWith('.scoringStandard'))
    return '补全评分标准';
  if (value.startsWith('level-guideline-required:'))
    return '补全评价级别评分准则';
  if (value.startsWith('invalid-detailed-rubric:'))
    return '修正评价级别分值区间';
  if (value === 'assignment-has-no-questions') return '至少添加一道题';
  return '补全班级与开放、截止时间';
}

function semanticBlockerPath(
  blocker: string,
  draft: AssignmentDraftInput,
): string | null {
  for (const [questionIndex, question] of draft.questions.entries()) {
    const criterionTotal = question.rubric.criteria.reduce(
      (total, criterion) => total + criterion.maxPoints,
      0,
    );
    if (
      blocker
      === `question-rubric-total-mismatch:${question.stableQuestionId}:${question.points}:${criterionTotal}`
    ) {
      return `questions.${questionIndex}.points`;
    }
    if (question.rubric.schemaVersion !== 'assignment-scoring-rubric.v2') continue;
    for (const [criterionIndex, criterion] of question.rubric.criteria.entries()) {
      const prefix = `${question.stableQuestionId}:${criterion.id}`;
      const criterionPath = `questions.${questionIndex}.rubric.criteria.${criterionIndex}`;
      if (blocker === `scoring-standard-required:${prefix}`) {
        return `${criterionPath}.scoringStandard`;
      }
      if (blocker === `level-guideline-required:${prefix}`) {
        const levelIndex = criterion.levels.findIndex((level) => !level.guideline.trim());
        return `${criterionPath}.levels.${Math.max(levelIndex, 0)}.guideline`;
      }
      if (blocker.startsWith(`invalid-detailed-rubric:${prefix}:`)) {
        return `${criterionPath}.maxPoints`;
      }
    }
  }
  return null;
}
function validationPath(value: string): string | null {
  if (!value.startsWith('validation:')) return null;
  const withoutPrefix = value.slice('validation:'.length);
  return withoutPrefix.slice(0, withoutPrefix.indexOf(':'));
}
function validateTeacherAuthoringAssetReference(
  asset: ProtectedEditorAssetReference,
  assignmentId?: string,
) {
  return Boolean(
    assignmentId
    && asset.href
      === `/api/assignments/${encodeURIComponent(assignmentId)}/content-assets/${encodeURIComponent(asset.assetId)}`,
  );
}
function mergeSaveResponse(
  current: AssignmentEditorDocument,
  payload: Record<string, unknown>,
): AssignmentEditorDocument {
  const assignment = payload.assignment as Record<string, unknown> | undefined;
  const revision = payload.revision as Record<string, unknown> | undefined;
  if (assignment) {
    const created = (assignment.revisions as Array<Record<string, unknown>>)[0];
    return {
      ...current,
      assignmentId: String(assignment.id),
      revisionId: String(created.id),
      contentDigest: typeof created.contentHash === 'string' ? created.contentHash : undefined,
      version: Number(created.version),
    };
  }
  return revision
    ? {
        ...current,
        contentDigest: typeof revision.contentHash === 'string' ? revision.contentHash : undefined,
        version: Number(revision.version),
      }
    : current;
}
function fromApiAssignment(
  assignment: Record<string, unknown>,
): AssignmentEditorDocument {
  const revisions = assignment.revisions as Array<Record<string, unknown>>;
  const revision = revisions.find((entry) => entry.state === 'DRAFT') ?? revisions[0];
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
    assignmentId: String(assignment.id), revisionId: String(revision.id),
    contentDigest: typeof revision.contentHash === 'string' ? revision.contentHash : undefined,
    version: Number(revision.version),
    draft: {
      title: String(revision.title), instructions: String(revision.instructions),
      totalPoints: Number(revision.totalPoints), questions,
      latePolicy: revision.latePolicy as AssignmentDraftInput['latePolicy'],
      responsePolicy: revision.responsePolicy as AssignmentDraftInput['responsePolicy'],
      resubmissionPolicy: revision.resubmissionPolicy as AssignmentDraftInput['resubmissionPolicy'],
      solutionReleasePolicy: revision.solutionReleasePolicy as AssignmentDraftInput['solutionReleasePolicy'],
    },
  };
}
function questionSourceFromRow(
  row: Record<string, unknown>,
): EditableQuestion['source'] {
  const lineage = row.sourceLineage as Record<string, unknown>;
  if (row.sourceFamily === 'ADAPTIVE_ASSESSMENT_CATALOG')
    return {
      family: 'ADAPTIVE_ASSESSMENT_CATALOG', sourceId: String(row.sourceId),
      sourceVersion: String(row.sourceVersion), sourceHash: String(row.sourceHash),
      reviewState: row.sourceReviewState === 'approved' ? 'approved' : 'reviewed',
      lineage: lineage as Record<string, string | number | boolean | null>,
    };
  if (row.sourceFamily === 'ASSIGNMENT_DERIVATIVE')
    return {
      family: 'ASSIGNMENT_DERIVATIVE',
      parentSourceId: String(lineage.parentSourceId), parentSourceVersion: String(lineage.parentSourceVersion),
      parentSourceHash: String(lineage.parentSourceHash), catalogItemId: String(row.sourceCatalogItemId),
      originalSourceFamily: String(row.sourceOriginalFamily), reviewState: String(row.sourceReviewState),
      eligibilityState: String(lineage.eligibilityState),
      allowedStages: Array.isArray(lineage.allowedStages) ? lineage.allowedStages.map(String) : [],
      limitations: Array.isArray(lineage.limitations) ? lineage.limitations.map(String) : [],
      selectionProof: String(row.sourceSelectionProof), contentHash: String(row.sourceHash),
      authoringMarker: 'assignment-authoring',
    };
  return { family: 'MANUAL', authoringMarker: 'assignment-authoring' };
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
const SAVE_FAILURE_MESSAGES: Record<string, string> = {
  'invalid-origin': '当前页面的保存来源未获确认。请刷新页面后重试。',
  'invalid-payload': '作业内容未通过保存校验，请检查题目和评分标准后重试。',
  'payload-too-large': '作业内容过长，请精简后重试保存。',
  '请求过于频繁': '保存请求过于频繁，请稍后重试。',
};

function saveFailureMessage(error: string | undefined): string {
  return (error && SAVE_FAILURE_MESSAGES[error])
    || '保存服务暂时不可用，请稍后重试。';
}

const PUBLICATION_ERROR_MESSAGES: Record<string, string> = {
  'version-conflict': '保存基线已过期，请重新加载并确认最新内容后再发布。',
  'publication-content-digest-mismatch': '保存基线已过期，请重新加载并确认最新内容后再发布。',
  'publication-baseline-already-published': '该保存基线已经发布，请返回作业列表查看结果。',
  'publication-conflict-retryable': '发布并发冲突，请保持当前已保存内容并重试。',
};

function publicationErrorMessage(error: string | undefined, details: string[] | undefined): string {
  return (error && PUBLICATION_ERROR_MESSAGES[error])
    ?? details?.join('；')
    ?? '发布失败，请核对发布计划。';
}
