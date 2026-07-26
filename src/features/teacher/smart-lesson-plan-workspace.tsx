'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Archive, Bot, CheckCircle2, LoaderCircle, Menu, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { KonlingEntryPointButton } from '@/components/ai/konling-entry-point-button';
import { capturePreparationEditorReturnState } from './preparation-document-editor/return-state';
import type { PreparationEditorReturnState } from './preparation-document-editor/return-state';

type SourceOption = {
  courseBasisId: string;
  courseBasisTitle: string;
  versionId: string;
  label: string;
  binding: { sourceVersionId: string; anchor: string; contentHash: string; citationId: string };
};

type Task = {
  id: string;
  courseBasisId: string;
  revision: number;
  archivedAt?: string | null;
  updatedAt?: string;
  currentStage?: string;
  currentStageTitle?: string;
  statusLabel?: string;
  topic: string;
  audience: string;
  prerequisites?: string;
  durationMinutes: number;
  outlineConfirmationRequired?: boolean;
  aggregateClassContextRef?: string | null;
  sources?: Array<{ sourceVersionId: string; state: string; sourceValid?: boolean }>;
  knowledgePoints?: Array<{ id: string; lineageId: string; title: string; origin: 'SUGGESTED' | 'TEACHER_CREATED'; sourceState: 'verified' | 'ai_generated_source_pending' | 'teacher_created_source_pending'; sourceBindings: SourceOption['binding'][]; supersedesIds?: string[]; state: string }>;
  goals?: Array<{ id: string; lineageId: string; content: string; sourceState: 'verified' | 'ai_generated_source_pending' | 'teacher_created_source_pending'; sourceBindings: SourceOption['binding'][]; standardsMappings?: Array<{ standardId: string; label: string }>; state: string }>;
  drafts?: Array<{
    id: string; state: string; version: number; content?: unknown; contentHash?: string | null;
    jobs?: Array<{
      id: string; state: string; firstIncompleteStage?: string; failureCode?: string | null; failureMessage?: string; supersededAt?: string | null;
      stages?: Array<{ kind: string; title?: string; state: string; actionState?: string; actionLabel?: string; output?: unknown; outputTruncated?: boolean }>;
    }>;
    reviews?: Array<{ id: string; advisoryOnly: boolean; state?: string; report?: unknown; failureCode?: string | null }>;
  }>;
  revisions?: Array<{ id: string; displayName: string; revisionNumber: number; taskRevision: number; coursewareDrafts?: Array<{ state: string }> }>;
  workspace?: {
    currentStage: string;
    statusLabel: string;
    resumable: boolean;
    unsupportedPayload: boolean;
    stages: Array<{ id: string; title: string; state: string; statusLabel: string; complete: boolean; blockingReason?: string | null; nextAction?: string | null }>;
  };
};

type ClassDiagnosisOption = { classId: string; className: string; diagnosisRef: string; generatedAt: string };
type KonlingSuggestion = { id: string; agentSessionId: string; expectedRevision?: number; turnId: string; proposedTask?: unknown; clarification?: { question: string; alternatives: string[] }; confirmedTaskId?: string; createdAt: string };
type PublicSourceState = 'verified' | 'ai_generated_source_pending' | 'teacher_created_source_pending';

export function SmartLessonPlanWorkspace({
  courseBases,
  classDiagnosisOptions,
  initialTasks,
  initialSelectedTaskId,
  preparationReturnState,
  onPreparationReturnStateRestored,
}: {
  courseBases: any[];
  classDiagnosisOptions: ClassDiagnosisOption[];
  initialTasks: Record<string, unknown>[];
  initialSelectedTaskId?: string;
  preparationReturnState?: PreparationEditorReturnState | null;
  onPreparationReturnStateRestored?: () => void;
}) {
  const [tasks, setTasks] = useState(initialTasks as Task[]);
  const [availableCourseBases, setAvailableCourseBases] = useState(courseBases);
  const [selectedTaskId, setSelectedTaskId] = useState(initialSelectedTaskId ?? (initialTasks[0] as Task | undefined)?.id ?? '');
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [taskIndexOpen, setTaskIndexOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, KonlingSuggestion[]>>({});
  const [bootstrapSuggestions, setBootstrapSuggestions] = useState<KonlingSuggestion[]>([]);
  const coursewareCreationInFlight = useRef(false);
  const sourceOptions = useMemo<SourceOption[]>(() => availableCourseBases.flatMap((basis: any) => basis.documents.flatMap((document: any) =>
    document.versions.flatMap((version: any) => {
      const segment = version.segments?.[0];
      if (
        version.extractionState !== 'EXTRACTED'
        || version.reviewState === 'REJECTED'
        || version.retiredAt
        || !segment
      ) return [];
      return [{
        courseBasisId: basis.id,
        courseBasisTitle: basis.title,
        versionId: version.id,
        label: `${basis.title} · ${document.title} v${version.versionNumber}`,
        binding: {
          sourceVersionId: version.id,
          anchor: segment.stableAnchor,
          contentHash: segment.contentHash,
          citationId: `course-basis:${version.id}:${segment.stableAnchor}`,
        },
      }];
    }),
  )), [availableCourseBases]);
  const selected = sourceOptions.find((option) => option.versionId === selectedSource) ?? sourceOptions[0];
  const visibleTasks = tasks;
  const activeTask = visibleTasks.find((task) => task.id === selectedTaskId) ?? visibleTasks[0] ?? null;
  const detailedActiveTask = activeTask?.workspace?.stages.length === 5 ? activeTask : null;
  const activeTaskId = activeTask?.id;
  const detailedActiveTaskId = detailedActiveTask?.id;
  const activeJobState = detailedActiveTask?.drafts?.[0]?.jobs?.[0]?.state;

  useEffect(() => {
    const refreshCourseBases = async () => {
      const [basisResponse, taskResponse] = await Promise.all([
        fetch('/api/teacher/course-bases', { cache: 'no-store' }),
        selectedTaskId
          ? fetch(`/api/teacher/smart-lesson-tasks/${selectedTaskId}`, { cache: 'no-store' })
          : Promise.resolve(null),
      ]);
      const basisPayload = await basisResponse.json();
      if (basisResponse.ok) setAvailableCourseBases(basisPayload.courseBases);
      if (taskResponse) {
        const taskPayload = await taskResponse.json();
        if (taskResponse.ok) {
          setTasks((current) => current.map((task) => task.id === selectedTaskId ? taskPayload.task : task));
        }
      }
    };
    window.addEventListener('course-basis:changed', refreshCourseBases);
    return () => window.removeEventListener('course-basis:changed', refreshCourseBases);
  }, [selectedTaskId]);

  useEffect(() => {
    if (activeTaskId && !detailedActiveTaskId) void refreshTask(activeTaskId);
  }, [activeTaskId, detailedActiveTaskId]);

  useEffect(() => {
    if (!preparationReturnState || !detailedActiveTaskId) return;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: preparationReturnState.scrollY });
      onPreparationReturnStateRestored?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detailedActiveTaskId, onPreparationReturnStateRestored, preparationReturnState]);

  useEffect(() => {
    if (!detailedActiveTaskId || !activeJobState || !['QUEUED', 'RUNNING'].includes(activeJobState)) return;
    const timer = window.setInterval(() => void refreshTask(detailedActiveTaskId), 2500);
    return () => window.clearInterval(timer);
  }, [detailedActiveTaskId, activeJobState]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          view: 'summary',
          archived: String(showArchived),
        });
        if (query.trim()) params.set('query', query.trim());
        const response = await fetch(`/api/teacher/smart-lesson-tasks?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) return setMessage(errorText(payload));
        setTasks(payload.tasks);
        setSelectedTaskId((current) => (
          payload.tasks.some((task: Task) => task.id === current) ? current : payload.tasks[0]?.id ?? ''
        ));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setMessage('任务索引加载失败，请稍后重试。');
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, showArchived]);

  function createCourseware(planRevisionId: string, taskId: string) {
    if (coursewareCreationInFlight.current) return;
    coursewareCreationInFlight.current = true;
    capturePreparationEditorReturnState(`/teacher/smart-prep?taskId=${encodeURIComponent(taskId)}#smart-prep-stage-courseware-generation`);
    const query = new URLSearchParams({ planRevisionId, creationIntentId: crypto.randomUUID() });
    window.location.assign(`/teacher/smart-prep/courseware/new?${query.toString()}`);
  }

  async function createTask(formData: FormData) {
    if (!selected) return setMessage('请先在上方确认至少一个可检索的课程依据版本。');
    setBusy(true);
    setMessage('');
    try {
      const topic = String(formData.get('topic') ?? '').trim();
      const knowledgePoint = String(formData.get('knowledgePoint') ?? '').trim();
      const goal = String(formData.get('goal') ?? '').trim();
      const response = await fetch('/api/teacher/smart-lesson-tasks', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          courseBasisId: selected.courseBasisId,
          topic,
          audience: formData.get('audience'),
          prerequisites: formData.get('prerequisites') || undefined,
          durationMinutes: Number(formData.get('durationMinutes')),
          outlineConfirmationRequired: formData.get('outlineConfirmationRequired') === 'on',
          sourceVersionIds: [selected.versionId],
          knowledgePoints: [{ title: knowledgePoint, content: knowledgePoint, origin: 'TEACHER_CREATED', sourceState: 'teacher_created_source_pending', sourceBindings: [] }],
          goals: [{ content: goal, sourceState: 'teacher_created_source_pending', sourceBindings: [], standardsMappings: [] }],
          aggregateClassContextRef: formData.get('classDiagnosis') ? JSON.parse(String(formData.get('classDiagnosis'))) : undefined,
          confirmScope: true,
          confirmGoals: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) return setMessage(errorText(payload));
      setTasks((current) => [payload.task, ...current]);
      setSelectedTaskId(payload.task.id);
      setMessage('单课任务已确认，可以启动分阶段生成。');
    } finally {
      setBusy(false);
    }
  }

  async function startGeneration(task: Task) {
    const draft = task.drafts?.[0];
    if (!draft) return;
    const response = await fetch(`/api/teacher/smart-lesson-tasks/drafts/${draft.id}/generation`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: `smart-prep:${draft.id}:start:${crypto.randomUUID()}` }),
    });
    const payload = await response.json();
    setMessage(response.ok ? `生成任务已进入队列：${payload.job.id}` : errorText(payload));
    if (response.ok) await refreshTask(task.id);
  }

  async function refreshTask(taskId: string) {
    const response = await fetch(`/api/teacher/smart-lesson-tasks/${taskId}`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) return setMessage(errorText(payload));
    setTasks((current) => current.map((task) => task.id === taskId ? payload.task : task));
  }

  function loadTaskCollection(archived: boolean) {
    setShowArchived(archived);
  }

  async function changeTaskLifecycle(task: Task, action: 'archive' | 'restore' | 'delete') {
    if (action === 'delete' && !window.confirm(`永久删除“${task.topic}”及其未发布内容？此操作不可撤销。`)) return;
    const response = await fetch(`/api/teacher/smart-lesson-tasks/${task.id}`, {
      method: action === 'delete' ? 'DELETE' : 'PUT',
      headers: { 'content-type': 'application/json' },
      ...(action === 'delete' ? {} : { body: JSON.stringify({ action }) }),
    });
    const payload = await response.json();
    if (!response.ok) {
      const blockers = payload?.error?.blockers as Array<{ category: string; count: number }> | undefined;
      setMessage(blockers?.length
        ? `无法永久删除：${blockers.map((item) => `${item.category === 'classroom' ? '课堂引用' : '正式发布'} ${item.count} 项`).join('、')}。请改为归档。`
        : errorText(payload));
      return;
    }
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setSelectedTaskId((current) => current === task.id ? '' : current);
    setMessage(action === 'archive' ? '任务已归档。' : action === 'restore' ? '任务已恢复到进行中列表。' : '任务及未发布内容已永久删除。');
  }

  async function runJobAction(task: Task, action: 'resume' | 'retry' | 'cancel') {
    const job = task.drafts?.[0]?.jobs?.[0];
    if (!job) return;
    const response = await fetch(`/api/teacher/smart-lesson-tasks/jobs/${job.id}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, idempotencyKey: `smart-prep:${job.id}:${action}:${Date.now()}` }),
    });
    const payload = await response.json();
    setMessage(response.ok ? `生成任务已${action === 'cancel' ? '取消' : action === 'retry' ? '重试' : '恢复'}。` : errorText(payload));
    await refreshTask(task.id);
  }

  async function editTask(task: Task) {
    const topic = window.prompt('单课主题', task.topic);
    if (topic === null) return;
    const audience = window.prompt('授课对象', task.audience);
    if (audience === null) return;
    const prerequisites = window.prompt('先修要求', task.prerequisites ?? '');
    if (prerequisites === null) return;
    const durationInput = window.prompt('课时长度（分钟）', String(task.durationMinutes));
    if (durationInput === null) return;
    const durationMinutes = Number(durationInput);
    if (!topic.trim() || !audience.trim() || !Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 120) {
      return setMessage('请填写主题、授课对象和 30 至 120 分钟的整数课时。');
    }
    const next = {
      ...taskUpdateInput(task),
      topic: topic.trim(),
      audience: audience.trim(),
      prerequisites: prerequisites.trim(),
      durationMinutes,
      aggregateClassContextRef: classDiagnosisOptions.find((option) => option.diagnosisRef === task.aggregateClassContextRef)
        ? { classId: classDiagnosisOptions.find((option) => option.diagnosisRef === task.aggregateClassContextRef)!.classId, diagnosisRef: task.aggregateClassContextRef }
        : null,
    };
    const response = await fetch(`/api/teacher/smart-lesson-tasks/${task.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...next, expectedRevision: task.revision, confirmingTurnId: `structured:${crypto.randomUUID()}` }),
    });
    const payload = await response.json();
    setMessage(response.ok ? `任务约束已确认，当前修订 ${payload.task.revision}。` : errorText(payload));
    if (response.ok) setTasks((currentTasks) => currentTasks.map((item) => item.id === task.id ? payload.task : item));
  }

  async function updateClassDiagnosis(task: Task, diagnosisRef: string) {
    const option = classDiagnosisOptions.find((item) => item.diagnosisRef === diagnosisRef);
    const response = await fetch(`/api/teacher/smart-lesson-tasks/${task.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...taskUpdateInput(task),
        aggregateClassContextRef: option ? { classId: option.classId, diagnosisRef: option.diagnosisRef } : null,
        expectedRevision: task.revision,
        confirmingTurnId: `structured:${crypto.randomUUID()}`,
      }),
    });
    const payload = await response.json();
    setMessage(response.ok ? '班级学情引用已更新。' : errorText(payload));
    if (response.ok) setTasks((current) => current.map((item) => item.id === task.id ? payload.task : item));
  }

  async function loadKonlingSuggestions(taskId: string) {
    const response = await fetch(`/api/teacher/smart-lesson-tasks/${taskId}/konling-suggestions`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) return setMessage(errorText(payload));
    setSuggestions((current) => ({ ...current, [taskId]: payload.suggestions }));
  }

  async function loadBootstrapSuggestions() {
    const response = await fetch('/api/teacher/smart-lesson-tasks/konling-suggestions', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) return setMessage(errorText(payload));
    setBootstrapSuggestions(payload.suggestions);
  }

  async function confirmBootstrapSuggestion(suggestion: KonlingSuggestion) {
    const response = await fetch(`/api/teacher/smart-lesson-tasks/konling-suggestions/${suggestion.id}/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentSessionId: suggestion.agentSessionId, turnId: suggestion.turnId }),
    });
    const payload = await response.json();
    setMessage(response.ok ? '孔灵已创建单课任务，可在同一会话中继续修订。' : errorText(payload));
    if (response.ok) {
      setTasks((current) => current.some((item) => item.id === payload.task.id) ? current : [payload.task, ...current]);
      window.dispatchEvent(new CustomEvent('konling:smart-task-confirmed', {
        detail: { taskId: payload.task.id, taskRevision: payload.task.revision, agentSessionId: payload.agentSessionId },
      }));
      await loadBootstrapSuggestions();
    }
  }

  async function confirmKonlingSuggestion(task: Task, suggestion: KonlingSuggestion) {
    const response = await fetch(`/api/teacher/smart-lesson-tasks/${task.id}/konling-suggestions/${suggestion.id}/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentSessionId: suggestion.agentSessionId, turnId: suggestion.turnId }),
    });
    const payload = await response.json();
    setMessage(response.ok ? `孔灵建议已确认，当前任务修订 ${payload.task.revision}。` : errorText(payload));
    if (response.ok) {
      setTasks((current) => current.map((item) => item.id === task.id ? payload.task : item));
      window.dispatchEvent(new CustomEvent('konling:smart-task-confirmed', {
        detail: { taskId: task.id, taskRevision: payload.task.revision, agentSessionId: payload.agentSessionId },
      }));
      await loadKonlingSuggestions(task.id);
    }
  }

  function editPausedOutline(task: Task) {
    const job = task.drafts?.[0]?.jobs?.[0];
    if (!job || job.state !== 'PAUSED') return;
    capturePreparationEditorReturnState(`/teacher/smart-prep?taskId=${encodeURIComponent(task.id)}#smart-prep-stage-lesson-generation`);
    window.location.assign(`/teacher/smart-prep/editor/lesson/${encodeURIComponent(job.id)}?kind=outline&taskId=${encodeURIComponent(task.id)}`);
  }

  async function deriveDraft(task: Task, revisionId: string) {
    const response = await fetch(`/api/teacher/smart-lesson-tasks/revisions/${revisionId}/drafts`, { method: 'POST' });
    const payload = await response.json();
    setMessage(response.ok ? '已从批准版本建立新的可编辑草稿。' : errorText(payload));
    await refreshTask(task.id);
  }

  async function requestAdvisoryReview(task: Task) {
    const draft = task.drafts?.[0];
    if (!draft) return;
    const response = await fetch(`/api/teacher/smart-lesson-tasks/drafts/${draft.id}/advisory-reviews`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: `smart-prep:${draft.id}:review:${crypto.randomUUID()}` }),
    });
    const payload = await response.json();
    setMessage(response.ok ? 'AI 建议已生成；它不会批准或改写教案。' : errorText(payload));
    await refreshTask(task.id);
  }

  function editDraft(task: Task) {
    const draft = task.drafts?.[0];
    if (!draft?.contentHash) return;
    capturePreparationEditorReturnState(`/teacher/smart-prep?taskId=${encodeURIComponent(task.id)}#smart-prep-stage-lesson-generation`);
    window.location.assign(`/teacher/smart-prep/editor/lesson/${encodeURIComponent(draft.id)}?kind=draft&taskId=${encodeURIComponent(task.id)}`);
  }

  async function approve(task: Task) {
    const draft = task.drafts?.[0];
    if (!draft) return;
    const response = await fetch(`/api/teacher/smart-lesson-tasks/drafts/${draft.id}/approve`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: `smart-prep:${draft.id}:approve:${draft.version}` }),
    });
    const payload = await response.json();
    setMessage(response.ok ? `${payload.revision.displayName} 已冻结。` : errorText(payload));
    if (response.ok) await refreshTask(task.id);
  }

  return <section className="space-y-6 rounded-xl border border-border p-5" data-smart-lesson-plan-workspace>
    <header className="flex items-start gap-3"><Bot className="mt-1 h-5 w-5 text-primary" /><div><h2 className="text-xl font-semibold">智能教案共创</h2><p className="text-sm text-subtle">确认单课范围与目标后，生成可恢复的 BOPPPS 文本教案；AI 审核仅提供建议。</p></div></header>
    {message ? <p role="status" className="rounded-lg bg-muted/40 px-4 py-3 text-sm">{message}</p> : null}
    <button type="button" onClick={() => setTaskIndexOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm lg:hidden"><Menu className="h-4 w-4" />选择备课任务</button>
    <div className="grid min-w-0 gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className={`${taskIndexOpen ? 'fixed inset-x-4 bottom-4 top-20 z-50 block overflow-auto bg-background shadow-2xl' : 'hidden'} rounded-xl border border-border p-3 lg:static lg:block lg:shadow-none`} aria-label="备课任务列表">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium">{showArchived ? '已归档任务' : '进行中任务'}</h3>
          <button type="button" onClick={() => setTaskIndexOpen(false)} className="text-xs text-muted-foreground lg:hidden">关闭</button>
        </div>
        <a href="#smart-preparation-new-task" onClick={() => setTaskIndexOpen(false)} className="mb-3 block rounded-lg bg-primary px-3 py-2 text-center text-sm text-primary-foreground">新建备课任务</a>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务主题" className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm" />
        </label>
        <div className="my-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void loadTaskCollection(false)} className={`rounded-lg px-2 py-1.5 text-xs ${!showArchived ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>进行中</button>
          <button type="button" onClick={() => void loadTaskCollection(true)} className={`rounded-lg px-2 py-1.5 text-xs ${showArchived ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>已归档</button>
        </div>
        <div className="space-y-2">
          {visibleTasks.map((task) => <button key={task.id} type="button" onClick={() => { setSelectedTaskId(task.id); setTaskIndexOpen(false); }} className={`w-full rounded-lg border p-3 text-left ${activeTask?.id === task.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <span className="block truncate text-sm font-medium">{task.topic}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{task.workspace?.stages.find((stage) => stage.id === task.workspace?.currentStage)?.title ?? task.currentStageTitle ?? '课程依据'} · {task.workspace?.statusLabel ?? task.statusLabel ?? '尚未开始'} · {task.durationMinutes} 分钟</span>
            <span className="mt-1 block text-xs text-muted-foreground">更新于 {task.updatedAt ? new Date(task.updatedAt as unknown as string).toLocaleDateString() : '未知'}</span>
          </button>)}
          {!visibleTasks.length ? <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">没有符合条件的任务。</p> : null}
        </div>
      </aside>
      <div className="min-w-0 space-y-6">
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <KonlingEntryPointButton entryPoint={{ mode: 'prep-coauthor', promptContext: 'smart-task:bootstrap', serverContext: { smartPrepBootstrap: 'true' } }} label="用自然语言创建任务" />
        <button type="button" onClick={() => void loadBootstrapSuggestions()} className="rounded border border-border px-3 py-1.5 text-sm">查看待确认创建建议</button>
      </div>
      {bootstrapSuggestions.length ? <div className="space-y-2">{bootstrapSuggestions.map((suggestion) => <div key={suggestion.id} className="rounded bg-muted/50 p-3 text-xs">{suggestion.clarification ? <div><p>{suggestion.clarification.question}</p><p>{suggestion.clarification.alternatives.join(' / ')}</p></div> : <SuggestionSummary value={suggestion.proposedTask} />}{suggestion.proposedTask && !suggestion.confirmedTaskId ? <button type="button" onClick={() => void confirmBootstrapSuggestion(suggestion)} className="mt-2 rounded border border-primary px-2 py-1 text-primary">确认并创建任务</button> : null}</div>)}</div> : null}
    </div>
    <form id="smart-preparation-new-task" action={createTask} className="grid scroll-mt-24 gap-3 md:grid-cols-2">
      <select value={selected?.versionId ?? ''} onChange={(event) => setSelectedSource(event.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 md:col-span-2">
        {sourceOptions.length ? sourceOptions.map((option) => <option key={option.versionId} value={option.versionId}>{option.label}</option>) : <option value="">暂无已确认来源版本</option>}
      </select>
      <input name="topic" required placeholder="单课主题" className="rounded-lg border border-border bg-background px-3 py-2" />
      <input name="audience" required placeholder="授课对象" className="rounded-lg border border-border bg-background px-3 py-2" />
      <input name="knowledgePoint" required placeholder="确认知识点" className="rounded-lg border border-border bg-background px-3 py-2" />
      <input name="goal" required placeholder="确认教学目标" className="rounded-lg border border-border bg-background px-3 py-2" />
      <input name="prerequisites" placeholder="先修要求（可选）" className="rounded-lg border border-border bg-background px-3 py-2" />
      <select name="classDiagnosis" defaultValue="" className="rounded-lg border border-border bg-background px-3 py-2">
        <option value="">不使用班级学情</option>
        {classDiagnosisOptions.map((option) => <option key={option.diagnosisRef} value={JSON.stringify({ classId: option.classId, diagnosisRef: option.diagnosisRef })}>{option.className} · {new Date(option.generatedAt).toLocaleDateString()}</option>)}
      </select>
      <select name="durationMinutes" defaultValue="45" className="rounded-lg border border-border bg-background px-3 py-2"><option value="45">45 分钟</option><option value="90">90 分钟</option>{Array.from({ length: 19 }, (_, index) => 30 + index * 5).filter((value) => value !== 45 && value !== 90).map((value) => <option key={value} value={value}>{value} 分钟</option>)}</select>
      <label className="flex items-center gap-2 text-sm"><input name="outlineConfirmationRequired" type="checkbox" />生成提纲后暂停确认</label>
      <button disabled={busy || !selected} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"><Plus className="h-4 w-4" />{busy ? '创建中…' : '确认并创建单课任务'}</button>
    </form>
    {!detailedActiveTask && activeTask ? <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">正在载入任务详情…</p> : null}
    <div className="grid min-w-0 gap-3">{(detailedActiveTask ? [detailedActiveTask] : []).map((task) => {
      const draft = task.drafts?.[0];
      const job = draft?.jobs?.[0];
      const currentRevision = task.revisions?.find((revision) => revision.taskRevision === task.revision);
      const hasBlockingJob = Boolean(job && !job.supersededAt && !['COMPLETED', 'CANCELLED'].includes(job.state));
      const outline = job?.stages?.find((stage) => stage.kind === 'OUTLINE');
      const stageDetails = (id: string, children: ReactNode) => {
        const stage = task.workspace?.stages.find((item) => item.id === id);
        if (!stage) return null;
        return <PreparationStageDetails
          key={stage.id}
          stage={stage}
          index={task.workspace!.stages.indexOf(stage)}
          initiallyOpen={preparationReturnState
            ? preparationReturnState.expandedStageIds.includes(`smart-prep-stage-${stage.id}`)
            : stage.id === task.workspace?.currentStage}
          restoredOpen={preparationReturnState
            ? preparationReturnState.expandedStageIds.includes(`smart-prep-stage-${stage.id}`)
            : undefined}
        >
          {children}
        </PreparationStageDetails>;
      };
      return <article key={task.id} className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-medium">{task.topic}</h3><p className="text-sm text-subtle">修订 {task.revision} · {task.audience} · {task.durationMinutes} 分钟 · 草稿 {draftStateLabel(draft?.state)}{job ? ` · 生成 ${generationStateLabel(job.state)}` : ''}</p></div>
          <div className="flex flex-wrap gap-2">
            {showArchived
              ? <button type="button" onClick={() => void changeTaskLifecycle(task, 'restore')} className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm"><RotateCcw className="h-4 w-4" />恢复</button>
              : <button type="button" onClick={() => void changeTaskLifecycle(task, 'archive')} className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm"><Archive className="h-4 w-4" />归档</button>}
            {!showArchived ? <button type="button" onClick={() => void changeTaskLifecycle(task, 'delete')} className="inline-flex items-center gap-1 rounded border border-destructive/40 px-3 py-1.5 text-sm text-destructive"><Trash2 className="h-4 w-4" />永久删除</button> : null}
          </div>
        </div>
        <div className="grid gap-2" aria-label="五阶段备课进度">
          {stageDetails('course-basis', <div className="space-y-2">
            <p>已选择 {task.sources?.filter((source) => source.state === 'SELECTED').length ?? 0} 个课程依据版本。</p>
            <p className="text-muted-foreground">可在上方“课程依据”视图管理文档，返回后本阶段会读取最新持久化状态。</p>
          </div>)}
          {stageDetails('topic-goals', <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <KonlingEntryPointButton entryPoint={{ mode: 'prep-coauthor', promptContext: `smart-task:${task.id}`, serverContext: { smartTaskId: task.id, smartTaskRevision: String(task.revision) } }} label="与孔灵共创" />
              <button onClick={() => void loadKonlingSuggestions(task.id)} className="rounded border border-border px-3 py-1.5 text-sm">查看孔灵建议</button>
              <button onClick={() => void editTask(task)} disabled={Boolean(job && !job.supersededAt && ['QUEUED', 'RUNNING', 'PAUSED', 'RETRYABLE'].includes(job.state))} className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50">修订任务</button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div><h4 className="text-sm font-medium">知识点与来源</h4>{task.knowledgePoints?.filter((item) => item.state !== 'REMOVED').map((item) => <p key={item.id} className="text-sm">{item.title} · <SourceStateLabel state={item.sourceState} /></p>)}</div>
              <div><h4 className="text-sm font-medium">教学目标与来源</h4>{task.goals?.filter((item) => item.state !== 'REMOVED').map((item) => <p key={item.id} className="text-sm">{item.content} · <SourceStateLabel state={item.sourceState} /></p>)}</div>
            </div>
            {suggestions[task.id]?.length ? <div className="space-y-2 rounded bg-muted/50 p-3"><h4 className="text-sm font-medium">待确认的孔灵建议</h4>{suggestions[task.id].map((suggestion) => <div key={suggestion.id} className="rounded border border-border bg-background p-2 text-xs">{suggestion.clarification ? <div><p>{suggestion.clarification.question}</p><p>{suggestion.clarification.alternatives.join(' / ')}</p></div> : <SuggestionSummary value={suggestion.proposedTask} />}{suggestion.proposedTask ? <button onClick={() => void confirmKonlingSuggestion(task, suggestion)} disabled={suggestion.expectedRevision !== task.revision} className="mt-2 rounded border border-primary px-2 py-1 text-primary disabled:opacity-50">确认并应用</button> : null}</div>)}</div> : null}
          </div>)}
          {stageDetails('class-attainment', <label className="grid max-w-md gap-1 text-sm">班级学情（仅使用治理后的累计聚合诊断）<select value={task.aggregateClassContextRef ?? ''} onChange={(event) => void updateClassDiagnosis(task, event.target.value)} disabled={Boolean(job && ['QUEUED', 'RUNNING', 'PAUSED', 'RETRYABLE'].includes(job.state))} className="rounded border border-border bg-background px-3 py-2 disabled:opacity-50"><option value="">不使用班级学情</option>{classDiagnosisOptions.map((option) => <option key={option.diagnosisRef} value={option.diagnosisRef}>{option.className} · {new Date(option.generatedAt).toLocaleDateString()}</option>)}</select></label>)}
          {stageDetails('lesson-generation', <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void refreshTask(task.id)} className="rounded border border-border px-3 py-1.5 text-sm">刷新进度</button>
              <button onClick={() => void startGeneration(task)} disabled={!draft || hasBlockingJob || draft.state === 'APPROVED'} className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50"><LoaderCircle className="h-4 w-4" />开始生成</button>
              {job?.state === 'PAUSED' && !job.supersededAt ? <button onClick={() => editPausedOutline(task)} className="rounded border border-border px-3 py-1.5 text-sm">编辑提纲</button> : null}
              {job && !job.supersededAt && ['PAUSED', 'RETRYABLE', 'FAILED', 'CANCELLED'].includes(job.state) ? <button onClick={() => void runJobAction(task, job.state === 'RETRYABLE' || job.state === 'FAILED' ? 'retry' : 'resume')} className="rounded border border-border px-3 py-1.5 text-sm">{job.state === 'PAUSED' ? '确认当前提纲并继续' : '恢复/重试'}</button> : null}
              {job && !job.supersededAt && ['QUEUED', 'RUNNING', 'PAUSED', 'RETRYABLE'].includes(job.state) ? <button onClick={() => void runJobAction(task, 'cancel')} className="rounded border border-border px-3 py-1.5 text-sm">取消</button> : null}
              <button onClick={() => editDraft(task)} disabled={!draft?.contentHash || task.workspace?.unsupportedPayload || draft.state === 'GENERATING' || draft.state === 'APPROVED'} className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50">编辑教案</button>
              <button onClick={() => void requestAdvisoryReview(task)} disabled={!draft?.content || draft.state !== 'READY'} className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50">AI 建议</button>
              <button onClick={() => void approve(task)} disabled={!draft || draft.state !== 'READY'} className="inline-flex items-center gap-1 rounded border border-primary px-3 py-1.5 text-sm text-primary disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />批准版本</button>
              {task.revisions?.[0] ? <button onClick={() => void deriveDraft(task, task.revisions![0].id)} className="rounded border border-border px-3 py-1.5 text-sm">基于{task.revisions[0].displayName}继续修订</button> : null}
            </div>
            {job?.stages?.length ? <div className="space-y-2">{job.stages.map((stage) => {
              const active = ['PREPARING_EVIDENCE', 'GENERATING', 'VALIDATING', 'AUTO_FIXING'].includes(stage.actionState ?? '');
              return <div key={stage.kind} className="rounded bg-muted px-3 py-2 text-xs" data-generation-stage={stage.kind} data-generation-action={stage.actionState}>
                <strong className="inline-flex items-center gap-1.5">
                  {active ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : null}
                  {stage.title ?? generationStageLabel(stage.kind)}：{stage.actionLabel ?? generationStateLabel(stage.state)}
                </strong>
                {stage.output ? <GeneratedStageContent title={stage.title ?? generationStageLabel(stage.kind)} value={stage.output} /> : null}
                {stage.outputTruncated ? <p>阶段输出较大，请在完整教案中查看。</p> : null}
              </div>;
            })}</div> : null}
            {job?.state === 'PAUSED' && outline?.output ? <p className="text-sm">提纲已持久化。可先编辑，或明确确认当前提纲后继续生成。</p> : null}
            {job?.failureMessage ? <p className="text-sm text-destructive">{job.failureMessage}</p> : null}
            {draft?.content ? <details><summary className="cursor-pointer text-sm font-medium">查看完整教案</summary><TeachingDocument value={draft.content} unsupported={task.workspace?.unsupportedPayload} /></details> : null}
            {draft?.reviews?.length ? <div className="space-y-2"><h4 className="text-sm font-medium">AI 审核报告（仅建议）</h4>{draft.reviews.map((review) => <div key={review.id} className="rounded bg-muted p-3 text-sm"><p>{review.state === 'COMPLETED' ? '审核建议已生成' : review.failureCode ? '审核未完成，请稍后重试。' : '审核处理中'}</p>{review.state === 'COMPLETED' ? <AdvisoryReviewSummary value={review.report} /> : null}</div>)}</div> : null}
            {task.revisions?.length ? <p className="text-xs text-subtle">最新：{task.revisions[0].displayName}</p> : null}
          </div>)}
          {stageDetails('courseware-generation', <div className="space-y-2">
            {currentRevision
              ? <button type="button" onClick={() => createCourseware(currentRevision.id, task.id)} className="rounded border border-primary px-3 py-1.5 text-sm text-primary">生成互动课件</button>
              : <p className="text-muted-foreground">批准教案版本后可生成互动课件。</p>}
          </div>)}
        </div>
      </article>;
    })}</div>
      </div>
    </div>
  </section>;
}

function taskUpdateInput(task: Task) {
  return {
    courseBasisId: task.courseBasisId,
    topic: task.topic,
    audience: task.audience,
    prerequisites: task.prerequisites ?? '',
    durationMinutes: task.durationMinutes,
    outlineConfirmationRequired: Boolean(task.outlineConfirmationRequired),
    sourceVersionIds: task.sources?.filter((source) => source.state === 'SELECTED').map((source) => source.sourceVersionId) ?? [],
    knowledgePoints: task.knowledgePoints?.filter((item) => item.state !== 'REMOVED').map((item) => ({
      id: item.id, lineageId: item.lineageId, title: item.title, content: item.title, origin: item.origin,
      sourceState: item.sourceState, sourceBindings: item.sourceBindings, supersedesIds: item.supersedesIds ?? [],
    })) ?? [],
    goals: task.goals?.filter((item) => item.state !== 'REMOVED').map((item) => ({
      id: item.id, lineageId: item.lineageId, content: item.content, sourceState: item.sourceState,
      sourceBindings: item.sourceBindings, standardsMappings: item.standardsMappings ?? [],
    })) ?? [],
    confirmScope: true,
    confirmGoals: true,
  };
}

function SourceStateLabel({ state }: { state: PublicSourceState }) {
  const pending = state !== 'verified';
  const label = state === 'verified' ? '来源已验证' : state === 'ai_generated_source_pending' ? 'AI 生成，来源待补' : '教师创建，来源待补';
  return <span className={pending ? 'rounded bg-muted px-1.5 py-0.5 text-foreground' : 'text-primary'}>{label}</span>;
}

function PreparationStageDetails({
  stage,
  index,
  initiallyOpen,
  restoredOpen,
  children,
}: {
  stage: NonNullable<Task['workspace']>['stages'][number];
  index: number;
  initiallyOpen: boolean;
  restoredOpen?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  useEffect(() => {
    if (restoredOpen !== undefined) setOpen(restoredOpen);
  }, [restoredOpen]);
  return <details
    id={`smart-prep-stage-${stage.id}`}
    open={open}
    onToggle={(event) => setOpen(event.currentTarget.open)}
    className="group rounded-lg border border-border bg-card"
  >
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
      <span className="flex items-center gap-2">
        <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${stage.complete ? 'bg-primary text-primary-foreground' : stage.state === 'blocked' ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'}`}>
          {stage.complete ? '✓' : index + 1}
        </span>
        <strong className="text-sm">{stage.title}</strong>
      </span>
      <span className="text-xs text-muted-foreground">{stage.statusLabel}</span>
    </summary>
    <div className="border-t border-border px-4 py-3 text-sm">
      {stage.blockingReason ? <p className="text-destructive">{stage.blockingReason}</p> : null}
      {stage.nextAction ? <p className="text-muted-foreground">下一步：{stage.nextAction}</p> : <p className="text-primary">该阶段的持久化数据有效。</p>}
      <div className="mt-3 min-w-0">{children}</div>
    </div>
  </details>;
}

function TeachingDocument({ value, unsupported }: { value: unknown; unsupported?: boolean }) {
  if (unsupported || !value || typeof value !== 'object' || Array.isArray(value)) {
    return <div className="mt-2 rounded-lg border border-border bg-muted p-4 text-sm text-foreground">
      该历史内容无法按当前教案结构显示。请基于最近批准版本继续修订，或重新生成首个未完成阶段。
    </div>;
  }
  const document = value as Record<string, unknown>;
  const boppps = document.boppps && typeof document.boppps === 'object' && !Array.isArray(document.boppps)
    ? document.boppps as Record<string, unknown>
    : null;
  const sections = Array.isArray(document.stages)
    ? document.stages
    : Array.isArray(document.sections)
      ? document.sections
      : boppps
        ? Object.entries(boppps).map(([stage, content]) => ({ stage, ...(content && typeof content === 'object' && !Array.isArray(content) ? content : {}) }))
        : [];
  return <div className="mt-2 max-h-[36rem] space-y-4 overflow-auto rounded-lg bg-muted/60 p-4">
    {typeof document.title === 'string' || typeof document.topic === 'string' ? <h4 className="font-semibold">{String(document.title ?? document.topic)}</h4> : null}
    {sections.map((section, index) => {
      const item = section && typeof section === 'object' ? section as Record<string, unknown> : {};
      const body = typeof item.content === 'string'
        ? item.content
        : typeof item.description === 'string'
          ? item.description
          : typeof item.summary === 'string'
            ? item.summary
            : [item.teacherActivity, item.studentActivity, item.assessment].filter((text): text is string => typeof text === 'string').join('；') || null;
      return <section key={String(item.id ?? item.stage ?? index)} className="rounded-lg border border-border bg-background p-3">
        <h5 className="text-sm font-medium">{String(item.title ?? bopppsStageLabel(String(item.stage ?? '')) ?? `教学环节 ${index + 1}`)}</h5>
        {body ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{body}</p> : <p className="mt-1 text-xs text-muted-foreground">结构化内容已保存，可进入统一编辑器继续查看和编辑。</p>}
      </section>;
    })}
    {!sections.length && typeof document.title !== 'string' ? <p className="text-sm text-muted-foreground">结构化教案已保存，可进入统一编辑器继续查看。</p> : null}
  </div>;
}

export function GeneratedStageContent({ title, value }: { title: string; value: unknown }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const output = value as Record<string, unknown>;
  const isOutline = Array.isArray(output.coursewareStepOutline);
  const rawSections = Array.isArray(output.coursewareStepOutline)
    ? output.coursewareStepOutline
    : Array.isArray(output.steps)
      ? output.steps
      : [];
  return <div className="mt-2 space-y-2 border-t border-border/60 pt-2 text-sm">
    {!isOutline && typeof output.minutes === 'number' ? <p className="text-xs text-subtle">阶段总时长：{output.minutes} 分钟</p> : null}
    {!isOutline ? <TeachingActivityDetails value={output} /> : null}
    {rawSections.map((section, index) => {
      const item = section && typeof section === 'object' && !Array.isArray(section)
        ? section as Record<string, unknown>
        : {};
      return <section key={String(item.title ?? index)} className="rounded border border-border bg-background p-2">
        <h5 className="font-medium">{String(item.title ?? `${title} ${index + 1}`)}</h5>
        {typeof item.bopppsStage === 'string' ? <p className="mt-1 text-xs text-subtle">BOPPPS 阶段：{bopppsStageLabel(item.bopppsStage)}</p> : null}
        {typeof item.minutes === 'number' ? <p className="mt-1 text-xs text-subtle">{item.minutes} 分钟</p> : null}
        <TeachingActivityDetails value={item} />
        {citationIds(item.sourceBindings).length ? <p className="mt-1 text-xs text-subtle">依据：{citationIds(item.sourceBindings).join('、')}</p> : null}
      </section>;
    })}
    {stringList(output.keyContent).length ? <p><span className="font-medium">核心内容：</span>{stringList(output.keyContent).join('、')}</p> : null}
    {stringList(output.difficultContent).length ? <p><span className="font-medium">难点：</span>{stringList(output.difficultContent).join('、')}</p> : null}
    {stringList(output.limitations).length ? <p><span className="font-medium">限制与待补信息：</span>{stringList(output.limitations).join('、')}</p> : null}
    {classAdaptationEmphasis(output.classAdaptation).length ? <p><span className="font-medium">班级学情侧重：</span>{classAdaptationEmphasis(output.classAdaptation).join('、')}</p> : null}
  </div>;
}

function TeachingActivityDetails({ value }: { value: Record<string, unknown> }) {
  const fields = [
    ['教师活动', value.teacherActivity],
    ['学生活动', value.studentActivity],
    ['评价方式', value.assessment],
  ] as const;
  return <div className="mt-1 space-y-1 text-muted-foreground">
    {fields.map(([label, content]) => (
      typeof content === 'string' && content.trim()
        ? <p key={label} className="whitespace-pre-wrap"><span className="font-medium text-foreground">{label}：</span>{content}</p>
        : null
    ))}
  </div>;
}

function classAdaptationEmphasis(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return stringList((value as Record<string, unknown>).emphasis);
}

function citationIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((binding) => {
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return [];
    const citationId = (binding as Record<string, unknown>).citationId;
    return typeof citationId === 'string' && citationId.trim() ? [citationId] : [];
  });
}

function AdvisoryReviewSummary({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const review = value as Record<string, unknown>;
  const summaries = [review.goalCoverage, review.sourceConsistency, review.bopppsStructure]
    .filter((item): item is string => typeof item === 'string');
  const suggestions = Array.isArray(review.suggestions)
    ? review.suggestions.filter((item): item is string => typeof item === 'string')
    : [];
  return <div className="mt-2 space-y-1 text-muted-foreground">
    {summaries.map((item) => <p key={item}>{item}</p>)}
    {suggestions.map((item) => <p key={item}>建议：{item}</p>)}
  </div>;
}

function SuggestionSummary({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return <p className="text-muted-foreground">建议内容暂不可显示。</p>;
  }
  const suggestion = value as Record<string, unknown>;
  const topic = typeof suggestion.topic === 'string' ? suggestion.topic : null;
  const audience = typeof suggestion.audience === 'string' ? suggestion.audience : null;
  const duration = typeof suggestion.durationMinutes === 'number' ? suggestion.durationMinutes : null;
  return <div className="space-y-1">
    <p className="font-medium">{topic ?? '备课任务调整建议'}</p>
    {audience ? <p>授课对象：{audience}</p> : null}
    {duration ? <p>课时长度：{duration} 分钟</p> : null}
    <p className="text-muted-foreground">确认后将按建议更新已保存的任务字段。</p>
  </div>;
}

function bopppsStageLabel(value: string) {
  return ({
    bridgeIn: '导入',
    objectives: '学习目标',
    preAssessment: '前测',
    participatoryLearning: '参与式学习',
    postAssessment: '后测',
    summary: '总结',
  } as Record<string, string>)[value];
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function generationStageLabel(value: string) {
  return ({
    OUTLINE: '提纲',
    BRIDGE_IN: '导入',
    OBJECTIVES: '学习目标',
    PRE_ASSESSMENT: '前测',
    PARTICIPATORY_LEARNING: '参与式学习',
    POST_ASSESSMENT: '后测',
    SUMMARY: '总结',
  } as Record<string, string>)[value] ?? '未知阶段';
}

function draftStateLabel(value: string | null | undefined) {
  return ({
    EDITABLE: '可编辑',
    GENERATING: '生成中',
    READY: '待审核',
    APPROVED: '已批准',
  } as Record<string, string>)[value ?? ''] ?? '未创建';
}

function generationStateLabel(value: string) {
  return ({
    PENDING: '等待处理',
    RUNNING: '正在生成',
    PAUSED: '等待确认',
    RETRYABLE: '可以重试',
    FAILED: '生成失败',
    CANCELLED: '已取消',
    COMPLETED: '已完成',
  } as Record<string, string>)[value] ?? '状态不可用';
}

function errorText(payload: any) {
  return payload?.error?.code ?? payload?.error ?? '操作失败';
}
