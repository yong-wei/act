'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Clock3,
  FileUp,
  GripVertical,
  History,
  Loader2,
  Paperclip,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { AppShell } from '@/components/platform/app-shell';
import { RuntimeMarkdownContent } from '@/components/shared/runtime-markdown';
import {
  normalizeAssignmentAssetMimeType,
  SUBMISSION_LIMITS,
} from '@/lib/assignments/submission-domain';
import {
  AssignmentEmbeddedEditor,
  type AssignmentEmbeddedSaveState,
} from '@/features/teacher/preparation-document-editor/assignment-embedded-editor';
import type {
  ProtectedEditorAssetReference,
} from '@/features/teacher/preparation-document-editor/rich-markdown-editor';
import {
  assignmentStateLabels,
  formatAssignmentDeadline,
  questionStateLabels,
  type StudentAnswerAttempt,
  type StudentAssignmentDetail,
  type StudentAssignmentQuestion,
} from './student-assignment-types';
import {
  embeddedAssetReferences,
  independentAssets,
  localizedStudentSubmissionError,
  moveIndependentAssetIds,
  preflightAssignmentFiles,
  STUDENT_ASSIGNMENT_ALLOWED_FORMATS,
  type StudentUploadErrorPayload,
} from './student-response-editor-contracts';

type Notice = { kind: 'success' | 'error'; message: string; controlId?: string } | null;
export type PendingUpload = {
  clientId: string;
  intentId?: string;
  fileName: string;
  file: File;
  role: 'ATTACHMENT' | 'EMBEDDED_IMAGE';
  embeddedPosition?: string;
  idempotencyKey?: string;
  uploadUrl?: string;
  requiredHeaders?: Record<string, string>;
  uploaded?: boolean;
  retryable?: boolean;
  status: 'WAITING' | 'UPLOADING' | 'SCANNING' | 'RETRYING' | 'FAILED';
  message: string;
};

export function StudentAssignmentWorkspace({ assignmentId, revisionId }: { assignmentId: string; revisionId?: string }) {
  const session = useSession();
  const [assignment, setAssignment] = useState<StudentAssignmentDetail | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [historyQuestionId, setHistoryQuestionId] = useState<string | null>(null);
  const [history, setHistory] = useState<StudentAnswerAttempt[]>([]);
  const [pendingUploads, setPendingUploads] = useState<Record<string, PendingUpload[]>>({});
  const [bodySaveStates, setBodySaveStates] = useState<Record<string, AssignmentEmbeddedSaveState>>({});
  const [assetPreviewUrls, setAssetPreviewUrls] = useState<Record<string, string>>({});
  const [nextQuestionId, setNextQuestionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const editorHeadingRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const historyHeadingRef = useRef<HTMLHeadingElement>(null);
  const historyTriggerRef = useRef<HTMLButtonElement>(null);
  const uploadStatusRef = useRef<HTMLDivElement>(null);
  const previewAuthorizationRef = useRef(new Set<string>());
  const assetPreviewUrlsRef = useRef<Record<string, string>>({});

  const answerPath = useCallback(
    (questionId: string) =>
      `/api/student/assignments/${encodeURIComponent(assignmentId)}/answers/${encodeURIComponent(questionId)}`,
    [assignmentId],
  );
  const assetReadPath = useCallback(
    (questionId: string, assetId: string) =>
      `${answerPath(questionId)}/assets/${encodeURIComponent(assetId)}/read`,
    [answerPath],
  );
  const authorizeAssetPreview = useCallback(async (
    questionId: string,
    assetId: string,
  ) => {
    const stablePath = assetReadPath(questionId, assetId);
    const response = await fetch(stablePath, { method: 'POST' });
    const payload = await response.json().catch(() => ({})) as {
      access?: { url: string };
    };
    if (!response.ok || !payload.access?.url) return null;
    const url = new URL(payload.access.url, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const previewUrl = `${url.pathname}${url.search}`;
    assetPreviewUrlsRef.current[stablePath] = previewUrl;
    setAssetPreviewUrls((current) => ({
      ...current,
      [stablePath]: previewUrl,
    }));
    return previewUrl;
  }, [assetReadPath]);
  const canonicalizeAssetPreviewHref = useCallback((href: string) => {
    const entry = Object.entries(assetPreviewUrlsRef.current)
      .find(([, previewUrl]) => previewUrl === href);
    return entry?.[0] ?? href;
  }, []);
  const refreshQuestionAssetPreviews = useCallback(async (
    question: StudentAssignmentQuestion,
    markdown: string,
  ) => {
    const references = embeddedAssetReferences(
      markdown,
      question.assets ?? [],
    ) ?? [];
    await Promise.all(references.map((reference) =>
      authorizeAssetPreview(question.id, reference.assetId)));
  }, [authorizeAssetPreview]);

  const loadAssignment = useCallback(async (options?: {
    preserveLocalDrafts?: boolean;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const revisionQuery = revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : '';
      const response = await fetch(`/api/student/assignments/${encodeURIComponent(assignmentId)}${revisionQuery}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { assignment?: StudentAssignmentDetail; error?: string };
      if (!response.ok || !payload.assignment) throw new Error(payload.error || '作业暂时无法加载');
      setAssignment(payload.assignment);
      setSelectedQuestionId((current) => current ?? payload.assignment?.questions[0]?.id ?? null);
      const serverDrafts = Object.fromEntries(
        payload.assignment.questions.map((question) => [
          question.id,
          question.textDraft ?? '',
        ]),
      );
      const serverSaveStates = Object.fromEntries(
        payload.assignment.questions.map((question) => [
          question.id,
          question.textDraft ? 'saved' : 'editing',
        ]),
      ) as Record<string, AssignmentEmbeddedSaveState>;
      setDrafts((current) =>
        options?.preserveLocalDrafts
          ? { ...serverDrafts, ...current }
          : serverDrafts);
      setBodySaveStates((current) =>
        options?.preserveLocalDrafts
          ? { ...serverSaveStates, ...current }
          : serverSaveStates);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '作业暂时无法加载');
    } finally {
      setLoading(false);
    }
  }, [assignmentId, revisionId]);

  useEffect(() => {
    if (session.status === 'authenticated') void loadAssignment();
    if (session.status === 'unauthenticated') setLoading(false);
  }, [loadAssignment, session.status]);

  const selectedQuestion = useMemo(
    () => assignment?.questions.find((question) => question.id === selectedQuestionId) ?? null,
    [assignment, selectedQuestionId],
  );

  useEffect(() => {
    if (!assignment) return;
    for (const question of assignment.questions) {
      for (const asset of question.assets ?? []) {
        if (asset.role !== 'EMBEDDED_IMAGE') continue;
        const stablePath = assetReadPath(question.id, asset.id);
        if (assetPreviewUrls[stablePath]
          || previewAuthorizationRef.current.has(stablePath)) continue;
        previewAuthorizationRef.current.add(stablePath);
        void authorizeAssetPreview(question.id, asset.id).finally(() => {
          previewAuthorizationRef.current.delete(stablePath);
        });
      }
    }
  }, [
    assignment,
    assetPreviewUrls,
    assetReadPath,
    authorizeAssetPreview,
  ]);

  function selectQuestion(questionId: string) {
    const question = assignment?.questions.find(
      (candidate) => candidate.id === questionId,
    );
    if (question) {
      void refreshQuestionAssetPreviews(
        question,
        drafts[question.id] ?? '',
      );
    }
    setSelectedQuestionId(questionId);
    setHistoryQuestionId(null);
    setNotice(null);
    setNextQuestionId(null);
    requestAnimationFrame(() => editorHeadingRef.current?.focus());
  }

  function updateQuestion(questionId: string, patch: Partial<StudentAssignmentQuestion>) {
    setAssignment((current) => current ? {
      ...current,
      questions: current.questions.map((question) => question.id === questionId ? { ...question, ...patch } : question),
    } : current);
  }

  async function saveDraft(question: StudentAssignmentQuestion) {
    setBusyAction(`save:${question.id}`);
    setNotice(null);
    setBodySaveStates((current) => ({ ...current, [question.id]: 'saving' }));
    try {
      const currentDraft = drafts[question.id] ?? '';
      await persistQuestionDraft(question, currentDraft);
      await refreshQuestionAssetPreviews(question, currentDraft);
      setBodySaveStates((current) => ({ ...current, [question.id]: 'saved' }));
      setNotice({ kind: 'success', message: '本题草稿已保存。' });
    } catch (cause) {
      const conflict = cause instanceof StudentResponseMutationError
        && cause.code === 'answer-version-conflict';
      setBodySaveStates((current) => ({
        ...current,
        [question.id]: conflict ? 'conflict' : 'failed',
      }));
      if (conflict) await loadAssignment({ preserveLocalDrafts: true });
      setNotice({
        kind: 'error',
        message: cause instanceof Error ? cause.message : '草稿保存失败，请重试。',
        controlId: `answer-${question.id}`,
      });
    } finally {
      setBusyAction(null);
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  async function persistQuestionDraft(
    question: StudentAssignmentQuestion,
    text: string,
  ) {
    let version = question.version;
    let assets = [...(question.assets ?? [])];
    const initialReferences = embeddedAssetReferences(text, assets);
    if (!initialReferences) {
      throw new StudentResponseMutationError(
        'invalid-embedded-asset-reference',
        '正文图片引用已变化，请重新载入后再保存。',
      );
    }
    const referencedIds = new Set(initialReferences.map((item) => item.assetId));
    for (const asset of assets) {
      if (asset.role !== 'EMBEDDED_IMAGE' || referencedIds.has(asset.id)) continue;
      const response = await fetch(
        `${answerPath(question.id)}/assets/${encodeURIComponent(asset.id)}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answerVersion: version }),
        },
      );
      const payload = await response.json().catch(() => ({})) as StudentUploadErrorPayload & {
        answer?: { version: number; state: StudentAssignmentQuestion['state'] };
      };
      if (!response.ok || !payload.answer) {
        throw mutationError(payload, '正文图片移除失败，请重试。');
      }
      version = payload.answer.version;
      assets = assets.filter((item) => item.id !== asset.id);
    }
    const references = embeddedAssetReferences(text, assets);
    if (!references) {
      throw new StudentResponseMutationError(
        'invalid-embedded-asset-reference',
        '正文图片引用已变化，请重新载入后再保存。',
      );
    }
    const response = await fetch(answerPath(question.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version,
        text,
        embeddedAssets: references,
      }),
    });
    const payload = await response.json().catch(() => ({})) as StudentUploadErrorPayload & {
      answer?: {
        version: number;
        state: StudentAssignmentQuestion['state'];
        textDraft?: string;
      };
    };
    if (!response.ok || !payload.answer) {
      throw mutationError(payload, '草稿保存失败，请重试。');
    }
    updateQuestion(question.id, {
      version: payload.answer.version,
      state: payload.answer.state,
      textDraft: payload.answer.textDraft,
      assets,
    });
    return payload.answer;
  }

  function queueAttachments(
    question: StudentAssignmentQuestion,
    selectedFiles: File[],
  ) {
    const activeJobs = (pendingUploads[question.id] ?? []).filter(
      (item) => item.status !== 'FAILED',
    );
    const preflight = preflightAssignmentFiles(
      selectedFiles,
      (question.assets?.length ?? 0) + activeJobs.length,
    );
    if (preflight.errors.length > 0) {
      setNotice({
        kind: 'error',
        message: preflight.errors.map((item) => item.message).join('；'),
        controlId: `file-${question.id}`,
      });
    }
    const jobs = preflight.accepted.map((file) => ({
      clientId: crypto.randomUUID(),
      file: file as File,
      fileName: file.name,
      role: 'ATTACHMENT' as const,
      status: 'WAITING' as const,
      message: '等待上传。',
    }));
    if (jobs.length === 0) return;
    setPendingUploads((current) => ({
      ...current,
      [question.id]: [...(current[question.id] ?? []), ...jobs],
    }));
    for (const job of jobs) {
      void uploadResponseAsset(question, job).catch(() => undefined);
    }
  }

  async function uploadEmbeddedImage(
    question: StudentAssignmentQuestion,
    file: File,
  ): Promise<ProtectedEditorAssetReference> {
    const activeJobs = (pendingUploads[question.id] ?? []).filter(
      (item) => item.status !== 'FAILED',
    );
    const preflight = preflightAssignmentFiles(
      [file],
      (question.assets?.length ?? 0) + activeJobs.length,
    );
    const accepted = preflight.accepted[0] as File | undefined;
    if (!accepted || !['image/png', 'image/jpeg'].includes(assignmentMimeType(file))) {
      throw new Error(
        preflight.errors[0]?.message
        ?? '正文只支持 PNG 或 JPEG 图片。',
      );
    }
    const embeddedPosition = `md:${crypto.randomUUID().replaceAll('-', '')}`;
    const job: PendingUpload = {
      clientId: crypto.randomUUID(),
      file,
      fileName: file.name,
      role: 'EMBEDDED_IMAGE',
      embeddedPosition,
      status: 'WAITING',
      message: '正文图片等待上传。',
    };
    setPendingUploads((current) => ({
      ...current,
      [question.id]: [...(current[question.id] ?? []), job],
    }));
    const result = await uploadResponseAsset(question, job);
    const stablePath = assetReadPath(question.id, result.asset.id);
    const previewUrl = await authorizeAssetPreview(
      question.id,
      result.asset.id,
    );
    return {
      assetId: embeddedPosition,
      href: previewUrl ?? stablePath,
      altText: file.name,
    };
  }

  async function uploadResponseAsset(
    question: StudentAssignmentQuestion,
    job: PendingUpload,
  ) {
    updateUploadJob(question.id, job.clientId, {
      status: job.status === 'FAILED' ? 'RETRYING' : 'UPLOADING',
      message: job.status === 'FAILED' ? '正在重试上传。' : '正在上传。',
    });
    setNotice(null);
    let prepared = job;
    let uploaded = job.uploaded ?? false;
    try {
      if (job.status === 'FAILED' && uploaded && job.intentId && job.idempotencyKey) {
        return await confirmUploadedAsset(question, {
          ...job,
          intentId: job.intentId,
          idempotencyKey: job.idempotencyKey,
        });
      }
      const refreshFailedUpload = job.status === 'FAILED';
      if (refreshFailedUpload && job.intentId) {
        await revokeUploadIntent(question, job.intentId).catch(() => undefined);
      }
      if (refreshFailedUpload || !job.intentId || !job.uploadUrl || !job.idempotencyKey) {
        const checksum = await checksumFile(job.file);
        const signResponse = await fetch(`${answerPath(question.id)}/upload-sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: job.file.name,
            mimeType: assignmentMimeType(job.file),
            sizeBytes: job.file.size,
            checksum,
            assetRole: job.role,
            ...(job.embeddedPosition
              ? { embeddedPosition: job.embeddedPosition }
              : {}),
          }),
        });
        const signPayload = await signResponse.json().catch(() => ({})) as StudentUploadErrorPayload & {
          upload?: {
            intentId: string;
            url: string;
            requiredHeaders?: Record<string, string>;
          };
        };
        if (!signResponse.ok || !signPayload.upload) {
          throw mutationError(signPayload, '无法准备附件上传，请重试。');
        }
        prepared = {
          ...job,
          intentId: signPayload.upload.intentId,
          idempotencyKey: crypto.randomUUID(),
          uploadUrl: signPayload.upload.url,
          requiredHeaders: signPayload.upload.requiredHeaders,
          uploaded: false,
          status: 'UPLOADING',
          message: '正在上传。',
        };
        updateUploadJob(question.id, job.clientId, prepared);
      }
      const uploadResponse = await fetch(prepared.uploadUrl!, {
        method: 'PUT',
        headers: prepared.requiredHeaders,
        body: job.file,
      });
      if (!uploadResponse.ok) {
        throw new StudentResponseMutationError(
          'upload-failed',
          '附件上传失败，请检查网络后重试。',
        );
      }
      const pending: PendingUpload & {
        intentId: string;
        idempotencyKey: string;
      } = {
        ...prepared,
        intentId: prepared.intentId!,
        idempotencyKey: prepared.idempotencyKey!,
        uploaded: true,
        status: 'SCANNING' as const,
        message: '附件已上传，正在进行安全扫描。',
      };
      uploaded = true;
      updateUploadJob(question.id, job.clientId, pending);
      requestAnimationFrame(() => uploadStatusRef.current?.focus());
      return await confirmUploadedAsset(question, pending);
    } catch (cause) {
      const message = cause instanceof Error
        ? cause.message
        : '附件上传失败，请重试。';
      if (job.role === 'EMBEDDED_IMAGE') {
        if (prepared.intentId) {
          await revokeUploadIntent(
            question,
            prepared.intentId,
          ).catch(() => undefined);
        }
        removeUploadJob(question.id, job.clientId);
      } else {
        const retryable = !(cause instanceof StudentResponseMutationError)
          || !['UNSAFE', 'EXPIRED', 'FAILED', 'asset-not-ready'].includes(cause.code);
        updateUploadJob(question.id, job.clientId, {
          status: 'FAILED',
          message,
          retryable,
          uploaded,
        });
      }
      setNotice({
        kind: 'error',
        message,
        controlId: job.role === 'EMBEDDED_IMAGE'
          ? `answer-${question.id}`
          : `upload-${job.clientId}`,
      });
      requestAnimationFrame(() => noticeRef.current?.focus());
      throw cause;
    }
  }

  async function confirmUploadedAsset(
    question: StudentAssignmentQuestion,
    pending: Pick<PendingUpload, 'clientId' | 'fileName' | 'role'> & {
      intentId: string;
      idempotencyKey: string;
    },
  ) {
    type FinalizeResult = StudentUploadErrorPayload & {
      status?: 'SCANNING' | 'CLEAN' | 'READY' | 'UNSAFE' | 'EXPIRED' | 'FAILED';
      answerVersion?: number;
      asset?: NonNullable<StudentAssignmentQuestion['assets']>[number];
    };
    const finalize = async () => {
      const response = await fetch(`${answerPath(question.id)}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: pending.intentId,
          idempotencyKey: pending.idempotencyKey,
        }),
      });
      const result = await response.json().catch(() => ({})) as FinalizeResult;
      if (![200, 202, 410, 422].includes(response.status)) {
        throw mutationError(result, '附件确认失败，请重试。');
      }
      return result;
    };
    let result = await finalize();
    for (let attempt = 0; result.status === 'SCANNING'; attempt += 1) {
      if (attempt >= 180) {
        throw new StudentResponseMutationError(
          'scan-timeout',
          '安全扫描仍在进行，请稍后重试。',
        );
      }
      await wait(500);
      const response = await fetch(
        `${answerPath(question.id)}/finalize?intentId=${encodeURIComponent(pending.intentId)}`,
        { cache: 'no-store' },
      );
      result = await response.json().catch(() => ({})) as FinalizeResult;
      if (!response.ok && ![410, 422].includes(response.status)) {
        throw mutationError(result, '扫描状态查询失败，请重试。');
      }
    }
    if (result.status === 'CLEAN') result = await finalize();
    if (result.status !== 'READY' || !result.asset) {
      throw new StudentResponseMutationError(
        result.status ?? result.error ?? 'asset-not-ready',
        result.status === 'UNSAFE'
          ? '附件未通过安全扫描，请更换文件。'
          : '上传确认已过期，请重新选择文件。',
      );
    }
    const finalizedAsset = {
      ...result.asset,
      displayName: result.asset.displayName || pending.fileName,
    };
    setAssignment((current) => current ? {
      ...current,
      questions: current.questions.map((candidate) => {
        if (candidate.id !== question.id) return candidate;
        const assets = candidate.assets ?? [];
        return {
          ...candidate,
          state: 'READY',
          version: Math.max(
            candidate.version,
            result.answerVersion ?? candidate.version,
          ),
          assets: assets.some((asset) => asset.id === finalizedAsset.id)
            ? assets.map((asset) =>
                asset.id === finalizedAsset.id ? finalizedAsset : asset)
            : [...assets, finalizedAsset],
        };
      }),
    } : current);
    removeUploadJob(question.id, pending.clientId);
    setNotice({
      kind: 'success',
      message: `${pending.role === 'EMBEDDED_IMAGE' ? '正文图片' : '附件'}“${pending.fileName}”已上传完成。`,
    });
    requestAnimationFrame(() => noticeRef.current?.focus());
    return {
      asset: finalizedAsset,
      answerVersion: result.answerVersion,
    };
  }

  async function removeAttachment(question: StudentAssignmentQuestion, assetId: string) {
    setBusyAction(`remove:${question.id}:${assetId}`);
    setNotice(null);
    try {
      const response = await fetch(`${answerPath(question.id)}/assets/${encodeURIComponent(assetId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerVersion: question.version }),
      });
      const payload = await response.json().catch(() => ({})) as {
        removedAssetId?: string;
        answer?: { version: number; state: StudentAssignmentQuestion['state'] };
        error?: string;
        message?: string;
        metadata?: StudentUploadErrorPayload['metadata'];
      };
      if (!response.ok || !payload.answer || payload.removedAssetId !== assetId) {
        throw mutationError(payload, '附件移除失败，请重试。');
      }
      updateQuestion(question.id, {
        version: payload.answer.version,
        state: payload.answer.state,
        assets: (question.assets ?? []).filter((asset) => asset.id !== assetId),
      });
      setNotice({ kind: 'success', message: '附件已从本题草稿中移除。' });
    } catch (cause) {
      if (cause instanceof StudentResponseMutationError
        && cause.code === 'answer-version-conflict') {
        await loadAssignment({ preserveLocalDrafts: true });
      }
      setNotice({
        kind: 'error',
        message: cause instanceof Error ? cause.message : '附件移除失败，请重试。',
        controlId: `remove-${assetId}`,
      });
    } finally {
      setBusyAction(null);
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  async function reorderAttachments(
    question: StudentAssignmentQuestion,
    assetId: string,
    targetIndex: number,
  ) {
    const attachments = independentAssets(question.assets ?? []);
    const nextIds = moveIndependentAssetIds(
      attachments.map((asset) => asset.id),
      assetId,
      targetIndex,
    );
    if (nextIds.every((id, index) => id === attachments[index]?.id)) return;
    setBusyAction(`reorder:${question.id}`);
    setNotice(null);
    try {
      const response = await fetch(`${answerPath(question.id)}/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answerVersion: question.version,
          assetIds: nextIds,
        }),
      });
      const payload = await response.json().catch(() => ({})) as StudentUploadErrorPayload & {
        answer?: { version: number; attachmentOrderProvenance?: string };
      };
      if (!response.ok || !payload.answer) {
        throw mutationError(payload, '附件排序失败，请重试。');
      }
      const orderById = new Map(nextIds.map((id, index) => [id, index]));
      updateQuestion(question.id, {
        version: payload.answer.version,
        assets: (question.assets ?? []).map((asset) =>
          orderById.has(asset.id)
            ? { ...asset, orderIndex: orderById.get(asset.id)! }
            : asset),
      });
      setNotice({ kind: 'success', message: '附件顺序已保存。' });
    } catch (cause) {
      if (cause instanceof StudentResponseMutationError
        && ['answer-version-conflict', 'asset-order-set-mismatch'].includes(cause.code)) {
        await loadAssignment({ preserveLocalDrafts: true });
      }
      setNotice({
        kind: 'error',
        message: cause instanceof Error ? cause.message : '附件排序失败，请重试。',
        controlId: `asset-${assetId}`,
      });
    } finally {
      setBusyAction(null);
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  function retryUpload(question: StudentAssignmentQuestion, job: PendingUpload) {
    if (job.intentId && job.idempotencyKey && job.uploaded) {
      updateUploadJob(question.id, job.clientId, {
        status: 'RETRYING',
        message: '正在重新确认上传结果。',
      });
      setNotice(null);
      void confirmUploadedAsset(question, {
        ...job,
        intentId: job.intentId,
        idempotencyKey: job.idempotencyKey,
      }).catch(async (cause) => {
        if (shouldRenewUploadIntentAfterConfirmationError(cause)) {
          await revokeUploadIntent(question, job.intentId!).catch(() => undefined);
          void uploadResponseAsset(question, {
            ...job,
            intentId: undefined,
            uploadUrl: undefined,
            idempotencyKey: undefined,
            uploaded: false,
            status: 'WAITING',
            message: '正在重新准备上传。',
          }).catch(() => undefined);
          return;
        }
        const message = cause instanceof Error
          ? cause.message
          : '附件确认失败，请重试。';
        updateUploadJob(question.id, job.clientId, {
          status: 'FAILED',
          message,
        });
        setNotice({
          kind: 'error',
          message,
          controlId: `upload-${job.clientId}`,
        });
        requestAnimationFrame(() => noticeRef.current?.focus());
      });
      return;
    }
    void uploadResponseAsset(question, job).catch(() => undefined);
  }

  async function resumeQuarantinedAsset(
    question: StudentAssignmentQuestion,
    asset: NonNullable<StudentAssignmentQuestion['assets']>[number],
  ) {
    setBusyAction(`confirm:${question.id}:${asset.id}`);
    setNotice(null);
    try {
      await confirmUploadedAsset(question, {
        clientId: `confirm-${asset.id}`,
        fileName: asset.displayName,
        role: asset.role === 'EMBEDDED_IMAGE' ? 'EMBEDDED_IMAGE' : 'ATTACHMENT',
        intentId: asset.id,
        idempotencyKey: crypto.randomUUID(),
      });
    } catch (cause) {
      setNotice({
        kind: 'error',
        message: cause instanceof Error ? cause.message : '附件确认失败，请重试。',
        controlId: `asset-${asset.id}`,
      });
    } finally {
      setBusyAction(null);
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  async function discardUpload(
    question: StudentAssignmentQuestion,
    job: PendingUpload,
  ) {
    if (!job.intentId) {
      removeUploadJob(question.id, job.clientId);
      return;
    }
    setBusyAction(`discard:${question.id}:${job.clientId}`);
    setNotice(null);
    try {
      await revokeUploadIntent(question, job.intentId);
      removeUploadJob(question.id, job.clientId);
      setNotice({ kind: 'success', message: '失败上传已移除。' });
    } catch (cause) {
      if (cause instanceof StudentResponseMutationError
        && cause.code === 'answer-version-conflict') {
        await loadAssignment({ preserveLocalDrafts: true });
      }
      setNotice({
        kind: 'error',
        message: cause instanceof Error
          ? cause.message
          : '失败上传移除失败，请重试。',
        controlId: `upload-${job.clientId}`,
      });
    } finally {
      setBusyAction(null);
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  async function revokeUploadIntent(
    question: StudentAssignmentQuestion,
    intentId: string,
  ) {
    const response = await fetch(
      `${answerPath(question.id)}/assets/${encodeURIComponent(intentId)}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerVersion: question.version }),
      },
    );
    const payload = await response.json().catch(() => ({})) as StudentUploadErrorPayload & {
      removedAssetId?: string;
      answer?: {
        version: number;
        state: StudentAssignmentQuestion['state'];
      };
    };
    if (response.status === 404
      && payload.error === 'answer-asset-not-found') return;
    if (!response.ok
      || payload.removedAssetId !== intentId
      || !payload.answer) {
      throw mutationError(payload, '失败上传移除失败，请重试。');
    }
    updateQuestion(question.id, {
      version: payload.answer.version,
      state: payload.answer.state,
    });
  }

  async function submitQuestion(question: StudentAssignmentQuestion) {
    setBusyAction(`submit:${question.id}`);
    setNotice(null);
    try {
      const currentDraft = drafts[question.id] ?? '';
      const activeUploads = (pendingUploads[question.id] ?? []).filter(
        (item) => item.status !== 'FAILED',
      );
      const failedUpload = (pendingUploads[question.id] ?? []).find(
        (item) => item.status === 'FAILED',
      );
      if (activeUploads.length > 0) {
        throw new StudentResponseMutationError(
          'upload-incomplete',
          '仍有附件正在上传，请等待完成后再提交。',
          `upload-${activeUploads[0].clientId}`,
        );
      }
      if (failedUpload) {
        throw new StudentResponseMutationError(
          'upload-failed',
          '存在上传失败的附件，请重试或移除后再提交。',
          `upload-${failedUpload.clientId}`,
        );
      }
      let persisted;
      try {
        persisted = await persistQuestionDraft(question, currentDraft);
      } catch (cause) {
        throw new StudentResponseMutationError(
          cause instanceof StudentResponseMutationError
            ? cause.code
            : 'draft-save-before-submit-failed',
          `提交前保存正文失败：${cause instanceof Error ? cause.message : '请重试。'}`,
          `answer-${question.id}`,
        );
      }
      setBodySaveStates((current) => ({ ...current, [question.id]: 'saved' }));
      const response = await fetch(`${answerPath(question.id)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answerVersion: persisted.version,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        attempt?: { attemptNumber?: number };
        assignmentState?: StudentAssignmentDetail['state'];
        submittedRequiredCount?: number;
        error?: string;
        message?: string;
        metadata?: StudentUploadErrorPayload['metadata'];
      };
      if (!response.ok || !payload.attempt) {
        throw mutationError(payload, '本题提交失败，请重试。');
      }
      updateQuestion(question.id, { state: 'SUBMITTED', currentAttemptNumber: payload.attempt.attemptNumber ?? 1 });
      const nextQuestion = assignment?.questions.find((candidate) => candidate.id !== question.id && candidate.state !== 'SUBMITTED');
      setNextQuestionId(nextQuestion?.id ?? null);
      setAssignment((current) => current ? {
        ...current,
        state: payload.assignmentState ?? current.state,
        submittedRequiredCount: payload.submittedRequiredCount ?? current.submittedRequiredCount,
      } : current);
      setNotice({ kind: 'success', message: '本题已正式提交，其他题目的草稿未受影响。' });
    } catch (cause) {
      if (cause instanceof StudentResponseMutationError
        && cause.code === 'answer-version-conflict') {
        await loadAssignment({ preserveLocalDrafts: true });
      }
      setNotice({
        kind: 'error',
        message: cause instanceof Error ? cause.message : '本题提交失败，请重试。',
        controlId: cause instanceof StudentResponseMutationError
          ? cause.controlId ?? `submit-${question.id}`
          : `submit-${question.id}`,
      });
    } finally {
      setBusyAction(null);
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  async function openHistory(question: StudentAssignmentQuestion) {
    historyTriggerRef.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    setBusyAction(`history:${question.id}`);
    setNotice(null);
    try {
      const revisionQuery = revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : '';
      const response = await fetch(`${answerPath(question.id)}/history${revisionQuery}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { attempts?: StudentAnswerAttempt[]; error?: string };
      if (!response.ok) throw new Error(payload.error || '提交历史加载失败');
      setHistory(payload.attempts ?? []);
      setHistoryQuestionId(question.id);
      requestAnimationFrame(() => historyHeadingRef.current?.focus());
    } catch (cause) {
      setNotice({ kind: 'error', message: cause instanceof Error ? cause.message : '提交历史加载失败', controlId: `history-${question.id}` });
      requestAnimationFrame(() => noticeRef.current?.focus());
    } finally {
      setBusyAction(null);
    }
  }

  function closeHistory() {
    setHistoryQuestionId(null);
    requestAnimationFrame(() => historyTriggerRef.current?.focus());
  }

  async function downloadHistoryAsset(questionId: string, asset: NonNullable<StudentAnswerAttempt['assets']>[number]) {
    setBusyAction(`download:${asset.id}`);
    setNotice(null);
    try {
      const response = await fetch(`${answerPath(questionId)}/assets/${encodeURIComponent(asset.id)}/read`, { method: 'POST' });
      const payload = await response.json().catch(() => ({})) as { access?: { url: string; expiresAt: string }; error?: string };
      if (!response.ok || !payload.access) throw new Error(payload.error || '附件下载授权失败');
      const accessUrl = new URL(payload.access.url, window.location.origin);
      if (accessUrl.origin !== window.location.origin) throw new Error('附件下载地址无效');
      const fileResponse = await fetch(accessUrl, { cache: 'no-store' });
      if (!fileResponse.ok) throw new Error('附件下载失败，请重试');
      const objectUrl = URL.createObjectURL(await fileResponse.blob());
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = asset.displayName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      setNotice({ kind: 'success', message: `附件“${asset.displayName}”已开始下载。` });
    } catch (cause) {
      setNotice({ kind: 'error', message: cause instanceof Error ? cause.message : '附件下载失败', controlId: `download-${asset.id}` });
    } finally {
      setBusyAction(null);
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  function updateUploadJob(
    questionId: string,
    clientId: string,
    patch: Partial<PendingUpload>,
  ) {
    setPendingUploads((current) => ({
      ...current,
      [questionId]: (current[questionId] ?? []).map((item) =>
        item.clientId === clientId ? { ...item, ...patch } : item),
    }));
  }

  function removeUploadJob(questionId: string, clientId: string) {
    setPendingUploads((current) => ({
      ...current,
      [questionId]: (current[questionId] ?? []).filter(
        (item) => item.clientId !== clientId,
      ),
    }));
  }

  return (
    <AppShell viewerRole="student" activeHref="/missions" title={assignment?.title || '主线作业'} subtitle="逐题保存与提交，已提交的题目保留独立历史。" breadcrumbs={[{ label: '首页', href: '/' }, { label: '任务中心', href: '/missions' }, { label: assignment?.title || '作业详情' }]}>
      {loading || session.status === 'loading' ? <WorkspaceLoading /> : session.status === 'unauthenticated' ? (
        <WorkspaceMessage title="请先登录" description="登录后可继续这份作业。" action={<Link href="/login" className="cta-primary rounded-lg px-5 py-2.5 text-sm">前往登录</Link>} />
      ) : error || !assignment ? (
        <WorkspaceMessage title="作业无法打开" description={error || '缺少作业上下文'} alert action={<button type="button" onClick={() => void loadAssignment()} className="btn-ghost-themed rounded-lg px-5 py-2.5 text-sm">重试</button>} />
      ) : assignment.contextStatus === 'STALE' ? (
        <WorkspaceMessage title="作业上下文已失效" description={assignment.policyReason || '当前班级或发布上下文已变化，请返回任务中心刷新。'} alert action={<Link href="/missions" className="btn-ghost-themed rounded-lg px-5 py-2.5 text-sm">返回任务中心</Link>} />
      ) : (
        <div data-assignment-workspace={assignment.id}>
          <Link href="/missions" className="mb-5 inline-flex items-center gap-2 text-sm text-subtle hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回任务中心</Link>
          {assignment.contextStatus === 'HISTORICAL' && (
            <div className="mb-5 rounded-xl border border-slate-500/25 bg-slate-500/5 p-4 text-sm text-subtle" role="status">
              这是你的历史提交记录。当前发布已结束，仅可查看已提交内容与历史，不会显示参考答案或未发布批阅信息。
            </div>
          )}
          <header className="surface-card mb-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div><span className="text-xs font-medium text-primary">{studentAssignmentDisplayState(assignment)}</span><h1 className="mt-2 text-2xl font-bold text-foreground">{assignment.title}</h1><p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-subtle">{assignment.instructions}</p></div>
              <div className="shrink-0 rounded-xl bg-accent/60 px-4 py-3 text-sm text-subtle"><Clock3 className="mr-2 inline h-4 w-4" />截止 {formatAssignmentDeadline(assignment.dueAt)}</div>
            </div>
          </header>

          {(assignment.feedbackStatus === 'PUBLISHING' || assignment.feedbackStatus === 'BLOCKED') && <div role="status" className={assignment.feedbackStatus === 'BLOCKED' ? 'mb-5 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 text-sm text-amber-800 dark:text-amber-200' : 'mb-5 rounded-xl border border-blue-500/25 bg-blue-500/8 p-4 text-sm text-blue-800 dark:text-blue-200'}>{assignment.policyReason}</div>}

          {assignment.resultPackage ? <><StudentPublishedResult assignment={assignment} onSelectQuestion={selectQuestion} />{assignment.feedback && assignment.feedback.length > 0 ? <StudentApprovedFeedback assignment={assignment} onSelectQuestion={selectQuestion} /> : null}</> : assignment.feedback && assignment.feedback.length > 0 ? <StudentApprovedFeedback assignment={assignment} onSelectQuestion={selectQuestion} /> : null}

          <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)_16rem]">
            <nav className="surface-card h-fit p-3" aria-label="作业题目">
              <p className="px-2 pb-2 text-xs font-medium text-subtle">题目导航</p>
              {assignment.questions.map((question, index) => (
                <button key={question.id} type="button" onClick={() => selectQuestion(question.id)} aria-current={selectedQuestionId === question.id ? 'step' : undefined} className={selectedQuestionId === question.id ? 'mb-1 flex w-full items-center justify-between rounded-lg bg-primary/12 px-3 py-3 text-left text-sm font-medium text-foreground' : 'mb-1 flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm text-subtle hover:bg-accent hover:text-foreground'}>
                  <span>第 {index + 1} 题</span><span className="text-xs">{questionStateLabels[question.state]}</span>
                </button>
              ))}
            </nav>

            <main className="min-w-0">
              {selectedQuestion?.resubmission && <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 text-sm text-amber-800 dark:text-amber-200" role="status"><p className="font-medium">本题已由教师退回，请修改后重新提交</p><p className="mt-1">{selectedQuestion.resubmission.reason}</p><p className="mt-1 text-xs">重交截止 {new Date(selectedQuestion.resubmission.deadlineAt).toLocaleString('zh-CN')}</p></div>}
              {selectedQuestion && (
                <QuestionEditor
                  question={selectedQuestion}
                  index={assignment.questions.indexOf(selectedQuestion)}
                  draft={drafts[selectedQuestion.id] ?? ''}
                  onDraftChange={(value) => {
                    setDrafts((current) => ({
                      ...current,
                      [selectedQuestion.id]: value,
                    }));
                    setBodySaveStates((current) => ({
                      ...current,
                      [selectedQuestion.id]: 'editing',
                    }));
                  }}
                  bodySaveState={bodySaveStates[selectedQuestion.id] ?? 'editing'}
                  onEditBody={() => {
                    void refreshQuestionAssetPreviews(
                      selectedQuestion,
                      drafts[selectedQuestion.id] ?? '',
                    ).finally(() => {
                      setBodySaveStates((current) => ({
                        ...current,
                        [selectedQuestion.id]: 'editing',
                      }));
                    });
                  }}
                  onSave={() => void saveDraft(selectedQuestion)}
                  uploadImage={(file) =>
                    uploadEmbeddedImage(selectedQuestion, file)}
                  validateAssetReference={(asset) => {
                    const matched = (selectedQuestion.assets ?? []).find(
                      (item) =>
                        item.role === 'EMBEDDED_IMAGE'
                        && item.embeddedPosition === asset.assetId,
                    );
                    return Boolean(
                      matched
                      && asset.href === assetReadPath(
                        selectedQuestion.id,
                        matched.id,
                      ),
                    );
                  }}
                  resolveAssetHref={(href) => assetPreviewUrls[href] ?? href}
                  canonicalizeAssetHref={canonicalizeAssetPreviewHref}
                  onUploadFiles={(files) => queueAttachments(selectedQuestion, files)}
                  onRetryUpload={(job) => retryUpload(selectedQuestion, job)}
                  onDiscardUpload={(job) =>
                    void discardUpload(selectedQuestion, job)}
                  onConfirmQuarantinedAsset={(asset) =>
                    void resumeQuarantinedAsset(selectedQuestion, asset)}
                  onRemove={(assetId) =>
                    void removeAttachment(selectedQuestion, assetId)}
                  onReorder={(assetId, targetIndex) =>
                    void reorderAttachments(
                      selectedQuestion,
                      assetId,
                      targetIndex,
                    )}
                  onSubmit={() => void submitQuestion(selectedQuestion)}
                  onHistory={() => void openHistory(selectedQuestion)}
                  busyAction={busyAction}
                  readOnly={
                    assignment.canMutate === false
                    || assignment.historicalOnly
                    || assignment.contextStatus === 'HISTORICAL'
                  }
                  headingRef={editorHeadingRef}
                  pendingUploads={pendingUploads[selectedQuestion.id] ?? []}
                  uploadStatusRef={uploadStatusRef}
                />
              )}
              {notice && <div ref={noticeRef} tabIndex={-1} role={notice.kind === 'error' ? 'alert' : 'status'} className={notice.kind === 'success' ? 'mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-4 text-sm text-emerald-700 outline-none dark:text-emerald-300' : 'mt-4 rounded-xl border border-red-500/25 bg-red-500/8 p-4 text-sm text-red-700 outline-none dark:text-red-300'}>
                <p>{notice.message}</p>
                {notice.kind === 'error' && notice.controlId && (
                  <a href={`#${notice.controlId}`} onClick={(event) => { event.preventDefault(); document.getElementById(notice.controlId!)?.focus(); }} className="mt-2 inline-block font-medium underline underline-offset-2">
                    前往受影响的控件
                  </a>
                )}
                {notice.kind === 'success' && nextQuestionId && (
                  <button type="button" onClick={() => selectQuestion(nextQuestionId)} className="btn-ghost-themed mt-3 rounded-lg px-4 py-2 text-sm">
                    前往下一未提交题
                  </button>
                )}
              </div>}
              {historyQuestionId && <HistoryPanel attempts={history} headingRef={historyHeadingRef} onClose={closeHistory} onDownload={(asset) => void downloadHistoryAsset(historyQuestionId, asset)} busyAction={busyAction} />}
            </main>

            <aside className="surface-card h-fit p-4 lg:sticky lg:top-20" aria-label="作业提交概览">
              <p className="text-sm font-semibold text-foreground">必答进度</p><p className="mt-3 text-3xl font-bold text-foreground">{assignment.submittedRequiredCount}<span className="text-base font-normal text-subtle"> / {assignment.requiredQuestionCount}</span></p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-accent" role="progressbar" aria-valuenow={assignment.submittedRequiredCount} aria-valuemin={0} aria-valuemax={assignment.requiredQuestionCount}><div className="h-full rounded-full bg-primary" style={{ width: `${assignment.requiredQuestionCount ? assignment.submittedRequiredCount / assignment.requiredQuestionCount * 100 : 0}%` }} /></div>
              <p className="mt-4 text-sm text-subtle">每题独立正式提交。所有必答题提交后，系统自动更新整份作业状态，无需再次封卷。</p>
              {assignment.policyReason && <p className="mt-3 rounded-lg bg-accent/60 p-3 text-xs text-subtle">{assignment.policyReason}</p>}
            </aside>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StudentApprovedFeedback({ assignment, onSelectQuestion }: { assignment: StudentAssignmentDetail; onSelectQuestion: (questionId: string) => void }) {
  const feedback = assignment.feedback ?? [];
  return <section className="surface-card mb-5 p-5 sm:p-6" aria-labelledby="approved-feedback-heading" data-student-assignment-feedback="approved">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-emerald-600 dark:text-emerald-300">教师已批准反馈</p><h2 id="approved-feedback-heading" className="mt-1 text-xl font-semibold text-foreground">批阅结果</h2></div>{assignment.approvedTotal != null && <p className="rounded-xl bg-emerald-500/10 px-4 py-2 text-lg font-semibold text-emerald-700 dark:text-emerald-300">总分 {assignment.approvedTotal}</p>}</div>
    <div className="mt-5 space-y-4">{feedback.map((item) => <article key={item.snapshotId} id={`feedback-question-${item.questionId}`} className="rounded-xl border border-border/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => onSelectQuestion(item.questionId)} className="text-left font-semibold text-foreground underline-offset-4 hover:underline">{item.questionTitle}</button><span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">{item.questionTotal} 分</span></div>
      {item.criteria.length > 0 && <dl className="mt-4 grid gap-3 sm:grid-cols-2">{item.criteria.map((criterion, index) => <div key={`${criterion.criterionId ?? 'criterion'}-${index}`} className="rounded-lg bg-accent/50 p-3"><dt className="text-xs font-medium text-subtle">评分项 {index + 1}</dt><dd className="mt-1 text-sm text-foreground">{criterion.score ?? 0} 分{criterion.comment ? ` · ${criterion.comment}` : ''}</dd></div>)}</dl>}
      {item.overallComment && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-subtle">{item.overallComment}</p>}
      {item.annotations.filter((annotation) => annotation.status !== 'SUPPRESSED').length > 0 && <ul className="mt-4 space-y-2" aria-label="教师批注">{item.annotations.filter((annotation) => annotation.status !== 'SUPPRESSED').map((annotation, index) => <li key={annotation.id ?? index} className="rounded-lg border-l-2 border-primary bg-accent/40 px-3 py-2 text-sm text-subtle"><span className="font-medium text-foreground">{studentAnchorPrecisionLabel(annotation.anchor?.precision)}定位：</span>{annotation.comment || '教师批注'}</li>)}</ul>}
      {item.reviewedAssets.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{item.reviewedAssets.map((asset, index) => asset.href ? <a key={asset.id ?? index} href={asset.href} className="btn-ghost-themed rounded-lg px-3 py-2 text-xs">{asset.label ?? '查看批阅文档'}{asset.precision ? ` · ${studentAnchorPrecisionLabel(asset.precision)}` : ''}</a> : null)}</div>}
      {item.limitations.length > 0 && <div className="mt-4 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">{item.limitations.join('；')}</div>}
      {item.resubmission && <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-sm text-amber-800 dark:text-amber-200"><p className="font-medium">本题需要重新提交</p><p className="mt-1">{item.resubmission.reason}</p><p className="mt-1 text-xs">截止 {new Date(item.resubmission.deadlineAt).toLocaleString('zh-CN')}</p><button type="button" onClick={() => onSelectQuestion(item.questionId)} className="btn-ghost-themed mt-3 rounded-lg px-3 py-2 text-xs">前往修改本题</button></div>}
    </article>)}</div>
  </section>;
}

function StudentPublishedResult({ assignment, onSelectQuestion }: { assignment: StudentAssignmentDetail; onSelectQuestion: (questionId: string) => void }) {
  const result = assignment.resultPackage;
  if (!result) return null;
  const titles = new Map(assignment.questions.map((question, index) => [question.id, `第 ${index + 1} 题`]));
  return <section className="surface-card mb-5 p-5 sm:p-6" aria-labelledby="published-result-heading" data-student-assignment-result="published">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-emerald-600 dark:text-emerald-300">教师已确认并发布</p><h2 id="published-result-heading" className="mt-1 text-xl font-semibold text-foreground">作业结果</h2><p className="mt-2 text-xs text-subtle">发布于 {new Date(result.releasedAt).toLocaleString('zh-CN')}</p></div><p className="rounded-xl bg-emerald-500/10 px-4 py-2 text-lg font-semibold text-emerald-700 dark:text-emerald-300">总分 {result.totalScore}</p></div>
    <div className="mt-5 space-y-4">{result.questions.map((question) => <article key={question.questionId} className="rounded-xl border border-border/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => onSelectQuestion(question.questionId)} className="text-left font-semibold text-foreground underline-offset-4 hover:underline">{titles.get(question.questionId) ?? '题目结果'}</button><span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">{question.score} 分</span></div>{question.comment ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-subtle">{question.comment}</p> : null}{question.criteria.length ? <dl className="mt-4 grid gap-3 sm:grid-cols-2">{question.criteria.map((criterion, index) => <div key={`${criterion.criterionId ?? 'criterion'}-${index}`} className="rounded-lg bg-accent/50 p-3"><dt className="text-xs font-medium text-subtle">评分项 {index + 1}</dt><dd className="mt-1 text-sm text-foreground">{criterion.score ?? 0} 分{criterion.comment ? ` · ${criterion.comment}` : ''}</dd></div>)}</dl> : null}<ResultReference label="参考答案" value={question.referenceAnswer} /><ResultReference label="评分标准" value={question.scoringStandard} /></article>)}</div>
  </section>;
}

function studentAssignmentDisplayState(assignment: StudentAssignmentDetail) {
  if (assignment.state === 'SUBMITTED' && assignment.dueAt && new Date(assignment.dueAt).getTime() > Date.now()) return '未到截止（已提交）';
  if (assignment.state === 'AWAITING_REVIEW' && assignment.questions.some((question) => (question.currentAttemptNumber ?? 0) > 1)) return '补交待批改';
  return assignmentStateLabels[assignment.state];
}

function ResultReference({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return <details className="mt-4 rounded-lg bg-accent/50 p-3"><summary className="cursor-pointer text-sm font-medium text-foreground">{label}</summary><pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-subtle">{text}</pre></details>;
}

function studentAnchorPrecisionLabel(value: unknown) {
  return ({ BLOCK: '作答片段', SPAN: '作答片段', PAGE: '页面', DOCUMENT: '作答文档' } as Record<string, string>)[String(value ?? '')] ?? '相关位置';
}

export function QuestionEditor({
  question,
  index,
  draft,
  onDraftChange,
  bodySaveState,
  onEditBody,
  onSave,
  uploadImage,
  validateAssetReference,
  resolveAssetHref,
  canonicalizeAssetHref,
  onUploadFiles,
  onRetryUpload,
  onDiscardUpload,
  onConfirmQuarantinedAsset,
  onRemove,
  onReorder,
  onSubmit,
  onHistory,
  busyAction,
  readOnly,
  headingRef,
  pendingUploads,
  uploadStatusRef,
}: {
  question: StudentAssignmentQuestion;
  index: number;
  draft: string;
  onDraftChange: (value: string) => void;
  bodySaveState: AssignmentEmbeddedSaveState;
  onEditBody: () => void;
  onSave: () => void;
  uploadImage: (file: File) => Promise<ProtectedEditorAssetReference>;
  validateAssetReference: (asset: ProtectedEditorAssetReference) => boolean;
  resolveAssetHref: (href: string) => string;
  canonicalizeAssetHref: (href: string) => string;
  onUploadFiles: (files: File[]) => void;
  onRetryUpload: (pending: PendingUpload) => void;
  onDiscardUpload: (pending: PendingUpload) => void;
  onConfirmQuarantinedAsset: (asset: NonNullable<StudentAssignmentQuestion['assets']>[number]) => void;
  onRemove: (assetId: string) => void;
  onReorder: (assetId: string, targetIndex: number) => void;
  onSubmit: () => void;
  onHistory: () => void;
  busyAction: string | null;
  readOnly: boolean;
  headingRef: React.RefObject<HTMLDivElement | null>;
  pendingUploads: PendingUpload[];
  uploadStatusRef: React.RefObject<HTMLDivElement | null>;
}) {
  const submitted = question.state === 'SUBMITTED';
  const busy = busyAction?.endsWith(`:${question.id}`)
    || busyAction?.startsWith(`remove:${question.id}:`)
    || busyAction?.startsWith(`discard:${question.id}:`)
    || busyAction?.startsWith(`confirm:${question.id}:`)
    || false;
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const attachments = independentAssets(question.assets ?? []);
  const embeddedCount = (question.assets ?? []).filter(
    (asset) => asset.role === 'EMBEDDED_IMAGE',
  ).length;
  const attachmentUploads = pendingUploads.filter(
    (item) => item.role === 'ATTACHMENT',
  );
  const activeUploads = pendingUploads.filter(
    (item) => item.status !== 'FAILED',
  );
  const failedUploads = pendingUploads.filter(
    (item) => item.status === 'FAILED',
  );
  const attachmentMutationBusy = busy || activeUploads.length > 0;
  const combinedCount = (question.assets?.length ?? 0) + activeUploads.length;
  const responseStatus = submitted
    ? '已提交'
    : busyAction === `submit:${question.id}`
      ? '提交中'
      : busyAction?.startsWith(`confirm:${question.id}:`)
        ? '正在确认附件'
      : failedUploads.length > 0
        ? '存在上传失败'
        : activeUploads.length > 0
          ? '附件上传中'
          : bodySaveState === 'saving'
            ? '草稿保存中'
            : bodySaveState === 'failed' || bodySaveState === 'conflict'
              ? '草稿保存失败'
              : draft.trim() || attachments.length > 0 || embeddedCount > 0
                ? '可提交'
                : '未作答';
  const uploadDisabled = busy
    || submitted
    || readOnly
    || combinedCount >= SUBMISSION_LIMITS.assets;

  return (
    <article className="surface-card min-w-0 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-primary">
            第 {index + 1} 题 · {question.points} 分
          </p>
          <div
            ref={headingRef}
            tabIndex={-1}
            role="heading"
            aria-level={2}
            className="mt-2 break-words text-lg font-semibold text-foreground outline-none"
          >
            <RuntimeMarkdownContent
              markdown={question.promptText}
              resolveAssetHref={(href) => href}
            />
          </div>
        </div>
        <span
          role="status"
          aria-live="polite"
          className="rounded-full bg-accent px-3 py-1 text-xs text-subtle"
        >
          {responseStatus}
        </span>
      </div>

      <div
        id={`answer-${question.id}`}
        tabIndex={-1}
        className="mt-6 scroll-mt-24 outline-none"
      >
        <AssignmentEmbeddedEditor
          hostRole="student"
          field="student-response"
          ariaLabel={`第 ${index + 1} 题答案正文`}
          value={draft}
          savedValue={question.textDraft ?? ''}
          saveState={bodySaveState}
          readOnly={submitted || readOnly}
          onChange={onDraftChange}
          onEdit={onEditBody}
          onSave={onSave}
          uploadImage={uploadImage}
          validateAssetReference={validateAssetReference}
          resolveAssetHref={resolveAssetHref}
          canonicalizeAssetHref={canonicalizeAssetHref}
        />
      </div>

      <section
        className={`mt-5 rounded-xl border border-dashed p-4 ${
          dropActive ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        aria-labelledby={`attachments-${question.id}`}
        onDragEnter={(event) => {
          if (uploadDisabled) return;
          event.preventDefault();
          setDropActive(true);
        }}
        onDragOver={(event) => {
          if (uploadDisabled) return;
          event.preventDefault();
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDropActive(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDropActive(false);
          if (uploadDisabled) return;
          onUploadFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <h3 id={`attachments-${question.id}`} className="text-sm font-medium text-foreground">
          独立附件
        </h3>
        <p className="mt-1 text-xs leading-5 text-subtle">
          Markdown 正文可插入 PNG/JPEG 图片；正文图片与独立附件合计最多 10 个。
        </p>
        <p className="mt-1 text-xs leading-5 text-subtle">
          自动评分按下列顺序读取独立附件，请按重要程度排列。正文图片 {embeddedCount} 个，独立附件 {attachments.length} 个，合计 {combinedCount} / {SUBMISSION_LIMITS.assets}。
        </p>
        <p className="mt-1 text-xs leading-5 text-subtle">
          允许格式：{STUDENT_ASSIGNMENT_ALLOWED_FORMATS}；单文件不超过 {SUBMISSION_LIMITS.file / 1024 / 1024} MB。
        </p>

        <ol className="mt-4 space-y-2" aria-label="按评分读取顺序排列的附件">
          {attachments.map((asset, assetIndex) => {
            const removing = busyAction === `remove:${question.id}:${asset.id}`;
            const assetStatus = asset.state === 'QUARANTINED'
              ? '等待安全扫描'
              : '已上传完成';
            return (
              <li
                id={`asset-${asset.id}`}
                key={asset.id}
                draggable={!attachmentMutationBusy && !submitted && !readOnly}
                onDragStart={() => setDraggedAssetId(asset.id)}
                onDragEnd={() => setDraggedAssetId(null)}
                onDragOver={(event) => {
                  if (draggedAssetId) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedAssetId) onReorder(draggedAssetId, assetIndex);
                  setDraggedAssetId(null);
                }}
                className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/70 bg-background p-3 sm:flex-row sm:items-center"
              >
                <span className="inline-flex min-w-0 flex-1 items-center gap-2 text-sm text-foreground">
                  <GripVertical className="hidden h-4 w-4 shrink-0 text-subtle sm:block" aria-hidden="true" />
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold">
                    {assetIndex + 1}
                  </span>
                  <Paperclip className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-all">{asset.displayName}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-subtle">
                    {removing ? '移除中' : assetStatus}
                  </span>
                </span>
                {!submitted && !readOnly && (
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label={`上移附件 ${assetIndex + 1}`}
                      disabled={attachmentMutationBusy || assetIndex === 0}
                      onClick={() => onReorder(asset.id, assetIndex - 1)}
                      className="btn-ghost-themed min-h-10 min-w-10 rounded-lg p-2"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`下移附件 ${assetIndex + 1}`}
                      disabled={attachmentMutationBusy || assetIndex === attachments.length - 1}
                      onClick={() => onReorder(asset.id, assetIndex + 1)}
                      className="btn-ghost-themed min-h-10 min-w-10 rounded-lg p-2"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    {asset.state === 'QUARANTINED' && <button
                      type="button"
                      disabled={attachmentMutationBusy}
                      onClick={() => onConfirmQuarantinedAsset(asset)}
                      className="btn-ghost-themed inline-flex min-h-10 items-center gap-1 rounded-lg px-3 py-2 text-xs"
                    >
                      继续确认
                    </button>}
                    <button
                      id={`remove-${asset.id}`}
                      type="button"
                      aria-label={`移除附件 ${assetIndex + 1}`}
                      disabled={attachmentMutationBusy}
                      onClick={() => onRemove(asset.id)}
                      className="btn-ghost-themed inline-flex min-h-10 items-center gap-1 rounded-lg px-3 py-2 text-xs"
                    >
                      {removing
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                      <span>移除</span>
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {attachmentUploads.length > 0 && (
          <div
            ref={uploadStatusRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            className="mt-3 space-y-2 outline-none"
          >
            {attachmentUploads.map((pending) => (
              <div
                id={`upload-${pending.clientId}`}
                key={pending.clientId}
                tabIndex={-1}
                className={`rounded-lg border p-3 text-sm ${
                  pending.status === 'FAILED'
                    ? 'border-red-500/30 bg-red-500/8 text-red-700 dark:text-red-300'
                    : 'border-blue-500/25 bg-blue-500/8 text-blue-700 dark:text-blue-300'
                }`}
              >
                <p className="break-all font-medium">{pending.fileName}</p>
                <p className="mt-1 text-xs">{uploadStatusLabel(pending.status)}：{pending.message}</p>
                {pending.status === 'FAILED' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pending.retryable !== false && (
                      <button
                        type="button"
                        onClick={() => onRetryUpload(pending)}
                        className="btn-ghost-themed inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-xs"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        重试
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDiscardUpload(pending)}
                      className="btn-ghost-themed min-h-10 rounded-lg px-3 text-xs"
                    >
                      {busyAction === `discard:${question.id}:${pending.clientId}`
                        ? '移除中…'
                        : '移除失败项'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!submitted && !readOnly && (
          <label
            aria-disabled={uploadDisabled}
            className="btn-ghost-themed mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
          >
            <FileUp className="h-4 w-4" />
            选择附件
            <input
              id={`file-${question.id}`}
              type="file"
              multiple
              disabled={uploadDisabled}
              accept=".pdf,.doc,.docx,.pptx,.png,.jpg,.jpeg,.md,.markdown,.txt"
              className="sr-only"
              onChange={(event) => {
                onUploadFiles(Array.from(event.currentTarget.files ?? []));
                event.currentTarget.value = '';
              }}
            />
          </label>
        )}
      </section>

      <div className="mt-6 flex flex-wrap gap-3 border-t border-border/70 pt-5">
        {!submitted && !readOnly && (
          <button
            id={`submit-${question.id}`}
            type="button"
            disabled={busy}
            onClick={onSubmit}
            className="cta-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 text-sm"
          >
            {busyAction === `submit:${question.id}`
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <CheckCircle2 className="h-4 w-4" />}
            {busyAction === `submit:${question.id}` ? '提交中…' : '提交本题'}
          </button>
        )}
        <button
          id={`history-${question.id}`}
          type="button"
          disabled={busy}
          onClick={onHistory}
          className="btn-ghost-themed inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 text-sm"
        >
          <History className="h-4 w-4" />
          提交历史
        </button>
      </div>
    </article>
  );
}

function HistoryPanel({ attempts, headingRef, onClose, onDownload, busyAction }: { attempts: StudentAnswerAttempt[]; headingRef: React.RefObject<HTMLHeadingElement | null>; onClose: () => void; onDownload: (asset: NonNullable<StudentAnswerAttempt['assets']>[number]) => void; busyAction: string | null }) {
  return <section className="surface-card mt-4 p-5" aria-labelledby="answer-history-heading"><div className="flex items-start justify-between gap-4"><div><h2 id="answer-history-heading" ref={headingRef} tabIndex={-1} className="font-semibold text-foreground outline-none">本题提交历史</h2><p className="mt-1 text-xs text-subtle">历史尝试只读，不会覆盖当前草稿。</p></div><button type="button" onClick={onClose} className="btn-ghost-themed rounded-lg px-3 py-2 text-sm">返回本题</button></div>{attempts.length === 0 ? <p className="mt-5 text-sm text-subtle">尚无正式提交记录。</p> : <ol className="mt-5 space-y-3">{attempts.map((attempt) => <li key={attempt.id} className="rounded-xl border border-border/70 p-4"><p className="text-sm font-medium text-foreground">第 {attempt.attemptNumber} 次提交</p><p className="mt-1 text-xs text-subtle">{new Date(attempt.submittedAt).toLocaleString('zh-CN')}</p>{attempt.textSnapshot && <p className="mt-3 whitespace-pre-wrap text-sm text-subtle">{attempt.textSnapshot}</p>}{attempt.assets?.map((asset) => <button id={`download-${asset.id}`} key={asset.id} type="button" disabled={busyAction === `download:${asset.id}` || !asset.canDownload} onClick={() => onDownload(asset)} className="btn-ghost-themed mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs"><Paperclip className="h-3.5 w-3.5" />下载附件：{asset.displayName}</button>)}</li>)}</ol>}</section>;
}

function WorkspaceLoading() { return <div className="space-y-4" aria-busy="true" aria-label="正在加载作业"><div className="surface-card h-40 animate-pulse" /><div className="grid gap-4 lg:grid-cols-[14rem_1fr_16rem]"><div className="surface-card h-72 animate-pulse" /><div className="surface-card h-[32rem] animate-pulse" /><div className="surface-card h-52 animate-pulse" /></div></div>; }
function WorkspaceMessage({ title, description, action, alert = false }: { title: string; description: string; action: React.ReactNode; alert?: boolean }) { return <div className="surface-card px-6 py-16 text-center" role={alert ? 'alert' : undefined}><AlertCircle className="mx-auto h-9 w-9 text-subtle" /><h1 className="mt-4 text-xl font-semibold text-foreground">{title}</h1><p className="mx-auto mt-2 max-w-xl text-sm text-subtle">{description}</p><div className="mt-6">{action}</div></div>; }

async function checksumFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function assignmentMimeType(file: File): string {
  return normalizeAssignmentAssetMimeType(file.name, file.type);
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function uploadStatusLabel(status: PendingUpload['status']) {
  return {
    WAITING: '等待上传',
    UPLOADING: '上传中',
    SCANNING: '安全扫描中',
    RETRYING: '重试中',
    FAILED: '上传失败',
  }[status];
}

class StudentResponseMutationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly controlId?: string,
  ) {
    super(message);
    this.name = 'StudentResponseMutationError';
  }
}

function shouldRenewUploadIntentAfterConfirmationError(cause: unknown) {
  return cause instanceof StudentResponseMutationError
    && ['EXPIRED', 'FAILED', 'upload-intent-not-found', 'asset-not-ready', 'asset-finalization-verification-failed'].includes(cause.code);
}

function mutationError(
  payload: StudentUploadErrorPayload,
  fallback: string,
) {
  return new StudentResponseMutationError(
    payload.error ?? 'submission-operation-failed',
    localizedStudentSubmissionError(payload, fallback),
  );
}
