'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface TeacherLaunchClassOption {
  id: string;
  name: string;
  code: string;
}

interface TeacherLaunchOptionsResponse {
  classes: TeacherLaunchClassOption[];
  defaultClassId: string | null;
  error?: string;
}

interface TeacherLaunchSessionResponse {
  id?: string;
  error?: string;
  existingSessionId?: string;
  requiresExplicitChoice?: boolean;
}

export interface TeacherLaunchLessonOption {
  id: string;
  title: string;
}

export interface TeacherClassroomLaunchRequest {
  planId?: string;
  lessonOptions?: TeacherLaunchLessonOption[];
  currentClassId?: string | null;
  sourcePresetKey?: string;
  preparePlanId?: () => Promise<string>;
  onSessionReady: (sessionId: string) => void;
}

export function chooseTeacherLaunchClassId(input: {
  classes: TeacherLaunchClassOption[];
  currentClassId?: string | null;
  defaultClassId?: string | null;
  previousClassId?: string | null;
}) {
  const available = new Set(input.classes.map((classItem) => classItem.id));
  if (input.previousClassId && available.has(input.previousClassId)) return input.previousClassId;
  if (input.currentClassId && available.has(input.currentClassId)) return input.currentClassId;
  if (input.defaultClassId && available.has(input.defaultClassId)) return input.defaultClassId;
  return '';
}

export function isTeacherLaunchDuplicateConflict(
  status: number,
  payload: TeacherLaunchSessionResponse,
) {
  return status === 409
    && Boolean(payload.existingSessionId)
    && payload.requiresExplicitChoice === true;
}

export function shouldRefreshTeacherLaunchOptions(
  status: number,
  payload: TeacherLaunchSessionResponse,
) {
  return status === 409 && !isTeacherLaunchDuplicateConflict(status, payload);
}

export function useTeacherClassroomLauncher() {
  const [request, setRequest] = useState<TeacherClassroomLaunchRequest | null>(null);
  const launchElementRef = useRef<HTMLElement | null>(null);

  const launch = useCallback((
    nextRequest: TeacherClassroomLaunchRequest,
    launchElement: HTMLElement,
  ) => {
    launchElementRef.current = launchElement;
    setRequest(nextRequest);
  }, []);

  useEffect(() => {
    if (request || !launchElementRef.current) return;
    launchElementRef.current.focus();
  }, [request]);

  return {
    launch,
    dialog: (
      <TeacherClassroomLaunchDialog
        request={request}
        onClose={() => setRequest(null)}
      />
    ),
  };
}

export function TeacherClassroomLaunchDialog({
  request,
  onClose,
}: {
  request: TeacherClassroomLaunchRequest | null;
  onClose: () => void;
}) {
  const [classes, setClasses] = useState<TeacherLaunchClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [preparedPlanId, setPreparedPlanId] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsFailed, setOptionsFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState<TeacherLaunchSessionResponse | null>(null);
  const classSelectRef = useRef<HTMLSelectElement>(null);
  const recoveryRef = useRef<HTMLAnchorElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);

  const loadOptions = useCallback(async (previousClassId?: string) => {
    if (!request) return;
    setLoadingOptions(true);
    setOptionsFailed(false);
    setMessage('正在加载可开课班级。');
    try {
      const response = await fetch('/api/teacher/classes/launch-options', {
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<TeacherLaunchOptionsResponse>;
      if (!response.ok || !Array.isArray(payload.classes)) {
        throw new Error(payload.error || '无法加载可开课班级');
      }
      const nextClasses = payload.classes;
      setClasses(nextClasses);
      setSelectedClassId(chooseTeacherLaunchClassId({
        classes: nextClasses,
        currentClassId: request.currentClassId,
        defaultClassId: payload.defaultClassId,
        previousClassId,
      }));
      setMessage(nextClasses.length === 0 ? '当前没有已启用的班级。' : '请选择本次课堂使用的班级。');
    } catch (error) {
      setClasses([]);
      setSelectedClassId('');
      setOptionsFailed(true);
      setMessage(error instanceof Error ? error.message : '无法加载可开课班级');
    } finally {
      setLoadingOptions(false);
    }
  }, [request]);

  useEffect(() => {
    if (!request) return;
    setClasses([]);
    setSelectedClassId('');
    setSelectedPlanId(request.planId ?? '');
    setPreparedPlanId('');
    setConflict(null);
    void loadOptions();
  }, [loadOptions, request]);

  useEffect(() => {
    if (!request || loadingOptions) return;
    window.requestAnimationFrame(() => {
      if (optionsFailed) retryRef.current?.focus();
      else if (classes.length === 0) recoveryRef.current?.focus();
      else classSelectRef.current?.focus();
    });
  }, [classes.length, loadingOptions, optionsFailed, request]);

  const close = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [onClose, submitting]);

  const submit = async (duplicateAction?: 'new-session') => {
    if (!request || !selectedClassId) return;
    setSubmitting(true);
    setConflict(null);
    setMessage('正在创建课堂。');
    try {
      let planId = preparedPlanId || selectedPlanId || request.planId || '';
      if (!planId && request.preparePlanId && request.sourcePresetKey && !duplicateAction) {
        const preflightResponse = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classId: selectedClassId,
            launchContext: 'class-bound',
            sourcePresetKey: request.sourcePresetKey,
          }),
        });
        const preflightPayload = (await preflightResponse.json().catch(() => ({}))) as TeacherLaunchSessionResponse;
        if (isTeacherLaunchDuplicateConflict(preflightResponse.status, preflightPayload)) {
          setConflict(preflightPayload);
          setMessage(preflightPayload.error || '该班级已有进行中的课堂。');
          return;
        }
        if (!preflightResponse.ok && preflightResponse.status !== 400) {
          if (shouldRefreshTeacherLaunchOptions(preflightResponse.status, preflightPayload)) {
            await loadOptions(selectedClassId);
          }
          throw new Error(preflightPayload.error || '课堂查重失败');
        }
      }
      if (!planId && request.preparePlanId) {
        planId = await request.preparePlanId();
        setPreparedPlanId(planId);
      }
      if (!planId) {
        throw new Error('请选择教案后再开始上课。');
      }

      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          classId: selectedClassId,
          launchContext: 'class-bound',
          ...(request.sourcePresetKey ? { sourcePresetKey: request.sourcePresetKey } : {}),
          ...(duplicateAction ? { duplicateAction } : {}),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as TeacherLaunchSessionResponse;
      if (isTeacherLaunchDuplicateConflict(response.status, payload)) {
        setConflict(payload);
        setMessage(payload.error || '该班级和教案已有进行中的课堂。');
        return;
      }
      if (!response.ok || !payload.id) {
        if (shouldRefreshTeacherLaunchOptions(response.status, payload)) {
          await loadOptions(selectedClassId);
        }
        throw new Error(payload.error || '课堂创建失败');
      }

      onClose();
      request.onSessionReady(payload.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '课堂创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const reuseExistingSession = () => {
    if (!request || !conflict?.existingSessionId) return;
    onClose();
    request.onSessionReady(conflict.existingSessionId);
  };

  const lessonOptions = request?.lessonOptions ?? [];
  const hasPlan = Boolean(preparedPlanId || selectedPlanId || request?.planId || request?.preparePlanId);
  const noClasses = !loadingOptions && !optionsFailed && classes.length === 0;

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => {
      if (!open) close();
    }}>
      <DialogContent
        className="max-w-md"
        data-teacher-classroom-launch-dialog
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          window.requestAnimationFrame(() => {
            if (optionsFailed) retryRef.current?.focus();
            else if (noClasses) recoveryRef.current?.focus();
            else classSelectRef.current?.focus();
          });
        }}
      >
        <DialogHeader>
          <DialogTitle>选择班级并开始上课</DialogTitle>
          <DialogDescription>
            本次选择只用于当前课堂，不会修改默认班级。
          </DialogDescription>
        </DialogHeader>

        {lessonOptions.length > 0 ? (
          <label className="grid gap-2 text-sm font-medium text-platform-fg-primary">
            教案
            <select
              value={selectedPlanId}
              onChange={(event) => {
                setSelectedPlanId(event.target.value);
                setMessage('');
              }}
              className="w-full rounded-lg border border-platform-border bg-platform-canvas px-3 py-2.5 text-platform-fg-primary focus:border-platform-action-primary focus:outline-none"
            >
              <option value="">请选择教案</option>
              {lessonOptions.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
              ))}
            </select>
          </label>
        ) : null}

        {loadingOptions ? (
          <div className="flex items-center gap-2 rounded-lg border border-platform-border bg-platform-canvas/60 px-3 py-4 text-sm text-platform-fg-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载班级
          </div>
        ) : optionsFailed ? (
          <div className="rounded-lg border border-platform-evidence-unsupported/40 bg-platform-evidence-unsupported/10 p-4 text-sm text-platform-fg-primary">
            <p>可开课班级加载失败，请重试。</p>
            <button
              ref={retryRef}
              type="button"
              onClick={() => void loadOptions(selectedClassId)}
              className="mt-3 rounded-lg border border-platform-evidence-unsupported/50 px-3 py-2 font-medium hover:bg-platform-evidence-unsupported/10"
            >
              重新加载班级
            </button>
          </div>
        ) : noClasses ? (
          <div className="rounded-lg border border-platform-evidence-context/40 bg-platform-evidence-context/10 p-4 text-sm text-platform-fg-primary">
            <p>当前没有可用于开课的已启用班级。</p>
            <Link
              ref={recoveryRef}
              href="/teacher/classes"
              className="mt-3 inline-flex rounded-lg border border-platform-evidence-context/50 px-3 py-2 font-medium hover:bg-platform-evidence-context/10"
            >
              前往班级管理
            </Link>
          </div>
        ) : (
          <label className="grid gap-2 text-sm font-medium text-platform-fg-primary">
            本次课堂班级
            <select
              ref={classSelectRef}
              value={selectedClassId}
              onChange={(event) => {
                setSelectedClassId(event.target.value);
                setConflict(null);
                setMessage('已更新本次课堂班级。');
              }}
              className="w-full rounded-lg border border-platform-border bg-platform-canvas px-3 py-2.5 text-platform-fg-primary focus:border-platform-action-primary focus:outline-none"
            >
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}（{classItem.code}）
                </option>
              ))}
            </select>
          </label>
        )}

        <p
          className="min-h-5 text-sm text-platform-fg-secondary"
          role={conflict ? 'alert' : 'status'}
          aria-live={conflict ? 'assertive' : 'polite'}
        >
          {message}
        </p>

        {conflict ? (
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={reuseExistingSession}
              className="rounded-lg border border-platform-border px-3 py-2 text-sm text-platform-fg-primary hover:bg-platform-surface-raised"
            >
              进入已有课堂
            </button>
            <button
              type="button"
              onClick={() => void submit('new-session')}
              disabled={submitting}
              className="rounded-lg bg-platform-action-primary px-3 py-2 text-sm font-medium text-platform-fg-inverse hover:bg-platform-action-hover disabled:opacity-60"
            >
              仍然新开
            </button>
          </div>
        ) : (
          <DialogFooter>
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              className="rounded-lg border border-platform-border px-4 py-2 text-sm text-platform-fg-primary hover:bg-platform-surface-raised disabled:opacity-60"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={loadingOptions || optionsFailed || noClasses || !selectedClassId || !hasPlan || submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-platform-action-primary px-4 py-2 text-sm font-medium text-platform-fg-inverse hover:bg-platform-action-hover disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              开始上课
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
