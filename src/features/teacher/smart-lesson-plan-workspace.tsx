'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Bot, CheckCircle2, LoaderCircle, Plus } from 'lucide-react';
import { KonlingEntryPointButton } from '@/components/ai/konling-entry-point-button';

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
  topic: string;
  audience: string;
  prerequisites?: string;
  durationMinutes: number;
  outlineConfirmationRequired?: boolean;
  aggregateClassContextRef?: string | null;
  sources?: Array<{ sourceVersionId: string; state: string }>;
  knowledgePoints?: Array<{ id: string; lineageId: string; title: string; origin: 'SUGGESTED' | 'TEACHER_CREATED'; sourceState: 'verified' | 'ai_generated_source_pending' | 'teacher_created_source_pending'; sourceBindings: SourceOption['binding'][]; supersedesIds?: string[]; state: string }>;
  goals?: Array<{ id: string; lineageId: string; content: string; sourceState: 'verified' | 'ai_generated_source_pending' | 'teacher_created_source_pending'; sourceBindings: SourceOption['binding'][]; standardsMappings?: Array<{ standardId: string; label: string }>; state: string }>;
  drafts?: Array<{
    id: string; state: string; version: number; content?: unknown;
    jobs?: Array<{ id: string; state: string; firstIncompleteStage?: string; failureCode?: string | null; supersededAt?: string | null; stages?: Array<{ kind: string; state: string; output?: unknown; outputTruncated?: boolean }> }>;
    reviews?: Array<{ id: string; advisoryOnly: boolean; state?: string; report?: unknown; failureCode?: string | null }>;
  }>;
  revisions?: Array<{ id: string; displayName: string; revisionNumber: number }>;
};

type ClassDiagnosisOption = { classId: string; className: string; diagnosisRef: string; generatedAt: string };
type KonlingSuggestion = { id: string; agentSessionId: string; expectedRevision?: number; turnId: string; proposedTask?: unknown; clarification?: { question: string; alternatives: string[] }; confirmedTaskId?: string; createdAt: string };
type PublicSourceState = 'verified' | 'ai_generated_source_pending' | 'teacher_created_source_pending';

export function SmartLessonPlanWorkspace({ courseBases, classDiagnosisOptions, initialTasks }: { courseBases: any[]; classDiagnosisOptions: ClassDiagnosisOption[]; initialTasks: Record<string, unknown>[] }) {
  const [tasks, setTasks] = useState(initialTasks as Task[]);
  const [selectedSource, setSelectedSource] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, KonlingSuggestion[]>>({});
  const [bootstrapSuggestions, setBootstrapSuggestions] = useState<KonlingSuggestion[]>([]);
  const sourceOptions = useMemo<SourceOption[]>(() => courseBases.flatMap((basis) => basis.documents.flatMap((document: any) =>
    document.versions.flatMap((version: any) => {
      const segment = version.segments?.[0];
      if (version.reviewState !== 'CONFIRMED' || version.retiredAt || !segment) return [];
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
  )), [courseBases]);
  const selected = sourceOptions.find((option) => option.versionId === selectedSource) ?? sourceOptions[0];

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
    const current = {
      ...taskUpdateInput(task),
      aggregateClassContextRef: classDiagnosisOptions.find((option) => option.diagnosisRef === task.aggregateClassContextRef)
        ? { classId: classDiagnosisOptions.find((option) => option.diagnosisRef === task.aggregateClassContextRef)!.classId, diagnosisRef: task.aggregateClassContextRef }
        : null,
    };
    const edited = window.prompt('编辑任务 JSON；可改名知识点，删除条目，或用 supersedesIds 记录合并来源', JSON.stringify(current, null, 2));
    if (!edited) return;
    let next: unknown;
    try { next = JSON.parse(edited); } catch { return setMessage('任务 JSON 格式无效。'); }
    const response = await fetch(`/api/teacher/smart-lesson-tasks/${task.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...(next as object), expectedRevision: task.revision, confirmingTurnId: `structured:${crypto.randomUUID()}` }),
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

  async function editPausedOutline(task: Task) {
    const job = task.drafts?.[0]?.jobs?.[0];
    const outline = job?.stages?.find((stage) => stage.kind === 'OUTLINE')?.output;
    if (!job || job.state !== 'PAUSED' || !outline) return;
    const edited = window.prompt('编辑提纲 JSON；保存后仍保持暂停，需再次明确确认', JSON.stringify(outline, null, 2));
    if (!edited) return;
    let output: unknown;
    try { output = JSON.parse(edited); } catch { return setMessage('提纲 JSON 格式无效。'); }
    const response = await fetch(`/api/teacher/smart-lesson-tasks/jobs/${job.id}/outline`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ output }),
    });
    const payload = await response.json();
    setMessage(response.ok ? '提纲已保存；请检查后确认继续。' : errorText(payload));
    await refreshTask(task.id);
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

  async function editDraft(task: Task) {
    const draft = task.drafts?.[0];
    if (!draft?.content) return;
    const edited = window.prompt('编辑完整教案 JSON', JSON.stringify(draft.content, null, 2));
    if (!edited) return;
    let content: unknown;
    try { content = JSON.parse(edited); } catch { return setMessage('教案 JSON 格式无效。'); }
    const response = await fetch(`/api/teacher/smart-lesson-tasks/drafts/${draft.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedVersion: draft.version, content }),
    });
    const payload = await response.json();
    setMessage(response.ok ? '教案草稿已更新并重新执行确定性检查。' : errorText(payload));
    await refreshTask(task.id);
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
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <KonlingEntryPointButton entryPoint={{ mode: 'prep-coauthor', promptContext: 'smart-task:bootstrap', serverContext: { smartPrepBootstrap: 'true' } }} label="用自然语言创建任务" />
        <button type="button" onClick={() => void loadBootstrapSuggestions()} className="rounded border border-border px-3 py-1.5 text-sm">查看待确认创建建议</button>
      </div>
      {bootstrapSuggestions.length ? <div className="space-y-2">{bootstrapSuggestions.map((suggestion) => <div key={suggestion.id} className="rounded bg-muted/50 p-3 text-xs">{suggestion.clarification ? <div><p>{suggestion.clarification.question}</p><p>{suggestion.clarification.alternatives.join(' / ')}</p></div> : <pre className="max-h-52 overflow-auto whitespace-pre-wrap">{JSON.stringify(suggestion.proposedTask, null, 2)}</pre>}{suggestion.proposedTask && !suggestion.confirmedTaskId ? <button type="button" onClick={() => void confirmBootstrapSuggestion(suggestion)} className="mt-2 rounded border border-primary px-2 py-1 text-primary">确认并创建任务</button> : null}</div>)}</div> : null}
    </div>
    <form action={createTask} className="grid gap-3 md:grid-cols-2">
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
    <div className="grid gap-3">{tasks.map((task) => {
      const draft = task.drafts?.[0];
      const job = draft?.jobs?.[0];
      const hasBlockingJob = Boolean(job && !job.supersededAt && !['COMPLETED', 'CANCELLED'].includes(job.state));
      const outline = job?.stages?.find((stage) => stage.kind === 'OUTLINE');
      return <article key={task.id} className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-medium">{task.topic}</h3><p className="text-sm text-subtle">修订 {task.revision} · {task.audience} · {task.durationMinutes} 分钟 · 草稿 {draft?.state ?? '未创建'}{job ? ` · 任务 ${job.state}` : ''}</p></div>
          <div className="flex flex-wrap gap-2">
            <KonlingEntryPointButton entryPoint={{ mode: 'prep-coauthor', promptContext: `smart-task:${task.id}`, serverContext: { smartTaskId: task.id, smartTaskRevision: String(task.revision) } }} label="与孔灵共创" />
            <button onClick={() => void loadKonlingSuggestions(task.id)} className="rounded border border-border px-3 py-1.5 text-sm">查看孔灵建议</button>
            <button onClick={() => void editTask(task)} disabled={Boolean(job && !job.supersededAt && ['QUEUED', 'RUNNING', 'PAUSED', 'RETRYABLE'].includes(job.state))} className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50">修订任务</button>
            <button onClick={() => void refreshTask(task.id)} className="rounded border border-border px-3 py-1.5 text-sm">刷新进度</button>
            <button onClick={() => void startGeneration(task)} disabled={!draft || hasBlockingJob || draft.state === 'APPROVED'} className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50"><LoaderCircle className="h-4 w-4" />开始生成</button>
            {job?.state === 'PAUSED' && !job.supersededAt ? <button onClick={() => void editPausedOutline(task)} className="rounded border border-border px-3 py-1.5 text-sm">编辑提纲</button> : null}
            {job && !job.supersededAt && ['PAUSED', 'RETRYABLE', 'FAILED', 'CANCELLED'].includes(job.state) ? <button onClick={() => void runJobAction(task, job.state === 'RETRYABLE' || job.state === 'FAILED' ? 'retry' : 'resume')} className="rounded border border-border px-3 py-1.5 text-sm">{job.state === 'PAUSED' ? '确认当前提纲并继续' : '恢复/重试'}</button> : null}
            {job && !job.supersededAt && ['QUEUED', 'RUNNING', 'PAUSED', 'RETRYABLE'].includes(job.state) ? <button onClick={() => void runJobAction(task, 'cancel')} className="rounded border border-border px-3 py-1.5 text-sm">取消</button> : null}
            <button onClick={() => void editDraft(task)} disabled={!draft?.content || draft.state === 'GENERATING' || draft.state === 'APPROVED'} className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50">编辑教案</button>
            <button onClick={() => void requestAdvisoryReview(task)} disabled={!draft?.content || draft.state !== 'READY'} className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50">AI 建议</button>
            <button onClick={() => void approve(task)} disabled={!draft || draft.state !== 'READY'} className="inline-flex items-center gap-1 rounded border border-primary px-3 py-1.5 text-sm text-primary disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />批准版本</button>
            {task.revisions?.[0] ? <button onClick={() => void deriveDraft(task, task.revisions![0].id)} className="rounded border border-border px-3 py-1.5 text-sm">基于{task.revisions[0].displayName}继续修订</button> : null}
            {task.revisions?.[0] ? <Link href={`/teacher/smart-prep/courseware/new?planRevisionId=${encodeURIComponent(task.revisions[0].id)}`} className="rounded border border-primary px-3 py-1.5 text-sm text-primary">生成互动课件</Link> : null}
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div><h4 className="text-sm font-medium">知识点与来源</h4>{task.knowledgePoints?.filter((item) => item.state !== 'REMOVED').map((item) => <p key={item.id} className="text-sm">{item.title} · <SourceStateLabel state={item.sourceState} /></p>)}</div>
          <div><h4 className="text-sm font-medium">教学目标与来源</h4>{task.goals?.filter((item) => item.state !== 'REMOVED').map((item) => <p key={item.id} className="text-sm">{item.content} · <SourceStateLabel state={item.sourceState} /></p>)}</div>
        </div>
        <label className="grid max-w-md gap-1 text-sm">班级学情（仅使用治理后的聚合诊断）<select value={task.aggregateClassContextRef ?? ''} onChange={(event) => void updateClassDiagnosis(task, event.target.value)} disabled={Boolean(job && ['QUEUED', 'RUNNING', 'PAUSED', 'RETRYABLE'].includes(job.state))} className="rounded border border-border bg-background px-3 py-2 disabled:opacity-50"><option value="">不使用班级学情</option>{classDiagnosisOptions.map((option) => <option key={option.diagnosisRef} value={option.diagnosisRef}>{option.className} · {new Date(option.generatedAt).toLocaleDateString()}</option>)}</select></label>
        {suggestions[task.id]?.length ? <div className="space-y-2 rounded bg-muted/50 p-3"><h4 className="text-sm font-medium">待确认的孔灵建议</h4>{suggestions[task.id].map((suggestion) => <div key={suggestion.id} className="rounded border border-border bg-background p-2 text-xs">{suggestion.clarification ? <div><p>{suggestion.clarification.question}</p><p>{suggestion.clarification.alternatives.join(' / ')}</p></div> : <pre className="max-h-52 overflow-auto whitespace-pre-wrap">{JSON.stringify(suggestion.proposedTask, null, 2)}</pre>}{suggestion.proposedTask ? <button onClick={() => void confirmKonlingSuggestion(task, suggestion)} disabled={suggestion.expectedRevision !== task.revision} className="mt-2 rounded border border-primary px-2 py-1 text-primary disabled:opacity-50">确认并应用</button> : null}</div>)}</div> : null}
        {job?.stages?.length ? <div className="space-y-2">{job.stages.map((stage) => <div key={stage.kind} className="rounded bg-muted px-3 py-2 text-xs"><strong>{stage.kind}: {stage.state}</strong>{stage.output ? <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap">{JSON.stringify(stage.output, null, 2)}</pre> : null}{stage.outputTruncated ? <p>阶段输出过大，请在完整草稿中查看。</p> : null}</div>)}</div> : null}
        {job?.state === 'PAUSED' && outline?.output ? <p className="text-sm">提纲已持久化。可先编辑，或明确确认当前提纲后继续生成。</p> : null}
        {job?.failureCode ? <p className="text-sm text-destructive">{job.failureCode}</p> : null}
        {draft?.content ? <details><summary className="cursor-pointer text-sm font-medium">查看完整教案</summary><pre className="mt-2 max-h-[36rem] overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">{JSON.stringify(draft.content, null, 2)}</pre></details> : null}
        {draft?.reviews?.length ? <div className="space-y-2"><h4 className="text-sm font-medium">AI 审核报告（仅建议）</h4>{draft.reviews.map((review) => <pre key={review.id} className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">{JSON.stringify(review.report ?? { state: review.state, failureCode: review.failureCode }, null, 2)}</pre>)}</div> : null}
        {task.revisions?.length ? <p className="text-xs text-subtle">最新：{task.revisions[0].displayName}</p> : null}
      </article>;
    })}</div>
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
  return <span className={pending ? 'rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'text-emerald-700 dark:text-emerald-300'}>{label}</span>;
}

function errorText(payload: any) {
  return payload?.error?.code ?? payload?.error ?? '操作失败';
}
