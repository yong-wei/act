'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

import {
  PreparationDocumentEditorShell,
  type PreparationEditorSaveState,
  type PreparationEditorSuggestion,
} from './editor-shell';
import { PreparationConflictComparison } from './conflict-comparison';
import {
  BOPPPS_STAGES as STAGES,
  lessonDocumentStage,
  outlineDocumentSteps,
  preparationDocumentValidationErrors,
  preparationRecord,
  replaceLessonStageSteps,
  replaceOutlineStageSteps,
  type LessonEditorDocumentKind as LessonEditorKind,
  type PreparationRecord as RecordValue,
} from './lesson-document-model';
import { returnToPreparationEditorOrigin } from './return-state';
import { usePreparationSaveCoordinator } from './use-save-coordinator';

export function LessonDocumentEditor({
  kind,
  documentId,
  returnTaskId,
}: {
  kind: LessonEditorKind;
  documentId: string;
  returnTaskId?: string;
}) {
  const [document, setDocument] = useState<RecordValue | null>(null);
  const [baseRevision, setBaseRevision] = useState<string | number>('');
  const [task, setTask] = useState<{ id: string; topic: string; durationMinutes: number } | null>(null);
  const [suggestions, setSuggestions] = useState<PreparationEditorSuggestion[]>([]);
  const [saveState, setSaveState] = useState<PreparationEditorSaveState>('saved');
  const [message, setMessage] = useState('');
  const documentRef = useRef<RecordValue | null>(null);
  const [serverComparison, setServerComparison] = useState<{ content: RecordValue; revision: string | number } | null>(null);
  const saveCoordinator = usePreparationSaveCoordinator();
  const storageKey = `preparation-editor:${kind}:${documentId}`;
  const validationErrors = useMemo(
    () => preparationDocumentValidationErrors(kind, document, task?.durationMinutes ?? 0),
    [document, kind, task?.durationMinutes],
  );

  const load = useCallback(async (preferServer = false) => {
    try {
      const response = await fetch(endpoint(kind, documentId), { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(errorText(payload));
        return;
      }
      const serverDocument = kind === 'outline' ? payload.outline.output : payload.draft.content;
      const serverRevision = kind === 'outline' ? payload.outline.outputHash : payload.draft.version;
      const local = !preferServer ? readLocalDraft(storageKey) : null;
      if (preferServer) {
        setServerComparison({ content: serverDocument, revision: serverRevision });
        setTask(kind === 'outline' ? payload.job.task : payload.task);
        setMessage('已加载服务器修订供比较；本地修改仍完整保留。');
        setSaveState('conflict');
        return;
      }
      const nextDocument = local?.content
        ? kind === 'draft'
          ? restoreLockedLessonFields(local.content, serverDocument)
          : local.content
        : serverDocument;
      const nextRevision = local ? local.baseRevision : serverRevision;
      setDocument(nextDocument);
      documentRef.current = nextDocument;
      setBaseRevision(nextRevision ?? '');
      setTask(kind === 'outline' ? payload.job.task : payload.task);
      const suggestionKey = `${storageKey}:suggestions`;
      const currentReview = payload.draft?.reviews?.find?.((review: RecordValue) => review.contentHash === payload.draft.contentHash);
      setSuggestions(kind === 'draft'
        ? advisorySuggestions(currentReview?.report, payload.draft.contentHash)
            .map((item) => ({ ...item, status: readSuggestionStates(suggestionKey)[item.id] ?? item.status }))
        : []);
      setSaveState(local ? local.baseRevision === null ? 'conflict' : 'dirty' : 'saved');
      saveCoordinator.restore(Boolean(local));
      setMessage(local
        ? local.baseRevision === null
          ? '已恢复旧版本地修改，但缺少原始修订基线；请复制内容后重新加载服务器修订。'
          : '已恢复上次未完成的本地修改。'
        : '');
    } catch {
      setMessage('文档加载失败，本地修改仍保留，请重试。');
    }
  }, [documentId, kind, saveCoordinator, storageKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = useCallback((next: RecordValue) => {
    const saving = saveCoordinator.markEdited();
    setDocument(next);
    documentRef.current = next;
    setSaveState(baseRevision === '' ? 'conflict' : saving ? 'saving' : 'dirty');
    writeLocalDraft(storageKey, next, baseRevision === '' ? null : baseRevision);
  }, [baseRevision, saveCoordinator, storageKey]);

  const save = useCallback(async () => {
    if (!document) return;
    if (baseRevision === '') {
      setSaveState('conflict');
      setMessage('本地修改缺少原始修订基线；请复制内容后重新加载服务器修订。');
      return;
    }
    if (validationErrors.length > 0) {
      setSaveState('failed');
      setMessage('请先修正文档中的结构或时长问题。');
      return;
    }
    const saveGeneration = saveCoordinator.beginSave();
    if (saveGeneration === null) return;
    setSaveState('saving');
    try {
      const response = await fetch(endpoint(kind, documentId), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(kind === 'outline'
          ? { expectedOutputHash: baseRevision, output: document }
          : { expectedVersion: baseRevision, content: document }),
      });
      const payload = await response.json();
      if (!response.ok) {
        saveCoordinator.finishSave(saveGeneration);
        const conflict = response.status === 409;
        setSaveState(conflict ? 'conflict' : 'failed');
        setMessage(conflict ? '服务器已有较新修订。本地内容仍保留，可复制后重新加载比较。' : errorText(payload));
        return;
      }
      const nextRevision = kind === 'outline' ? payload.stage.outputHash : payload.draft.version;
      setBaseRevision(nextRevision);
      if (saveCoordinator.finishSave(saveGeneration)) {
        setSaveState('saved');
        setMessage('修改已可靠保存。');
        window.localStorage.removeItem(storageKey);
      } else {
        if (documentRef.current) writeLocalDraft(storageKey, documentRef.current, nextRevision);
        setSaveState('dirty');
        setMessage('较早修改已保存，正在继续保存新的修改。');
      }
    } catch {
      saveCoordinator.finishSave(saveGeneration);
      setSaveState('failed');
      setMessage('保存请求失败，本地修改仍保留，请重试。');
    }
  }, [baseRevision, document, documentId, kind, saveCoordinator, storageKey, validationErrors]);

  useEffect(() => {
    if (saveState !== 'dirty') return;
    const timer = window.setTimeout(() => void save(), 1000);
    return () => window.clearTimeout(timer);
  }, [save, saveState]);

  const sections = useMemo(() => kind === 'outline'
    ? STAGES.map(([id, title]) => ({
        id,
        title,
        complete: outlineDocumentSteps(document).some((step) => step.bopppsStage === id && String(step.title ?? '').trim()),
      }))
    : STAGES.map(([id, title]) => ({
        id,
        title,
        complete: lessonDocumentStage(document, id).steps.length > 0,
      })), [document, kind]);

  if (!document || !task) {
    return <main className="grid min-h-screen place-items-center bg-background"><div className="text-center"><p role="status">{message || '正在加载文档…'}</p>{message ? <button type="button" onClick={() => void load()} className="mt-3 rounded border border-border px-3 py-1.5">重试加载</button> : null}</div></main>;
  }

  const exit = () => {
    const target = returnTaskId || task.id;
    returnToPreparationEditorOrigin(`/teacher/smart-prep?taskId=${encodeURIComponent(target)}#smart-prep-stage-lesson-generation`);
  };

  return (
    <PreparationDocumentEditorShell
      title={kind === 'outline' ? `${task.topic} · 教学提纲` : `${task.topic} · BOPPPS 教案`}
      subtitle={`${task.durationMinutes} 分钟 · ${kind === 'outline' ? '六阶段提纲' : '结构化教案'}`}
      sections={sections}
      saveState={saveState}
      onSave={save}
      onExit={exit}
      suggestions={suggestions}
      onSelectSection={(id) => window.document.getElementById(`document-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      onAcceptSuggestion={(suggestion) => {
        const nextDocument = applySuggestion(document, suggestion);
        if (!nextDocument) return;
        change(nextDocument);
        setSuggestions((current) => {
          const next = current.map((item) => item.id === suggestion.id ? { ...item, status: 'accepted' as const } : item);
          writeSuggestionStates(`${storageKey}:suggestions`, next);
          return next;
        });
      }}
      onIgnoreSuggestion={(suggestion) => {
        setSuggestions((current) => {
          const next = current.map((item) => item.id === suggestion.id ? { ...item, status: 'ignored' as const } : item);
          writeSuggestionStates(`${storageKey}:suggestions`, next);
          return next;
        });
      }}
    >
      {serverComparison ? <PreparationConflictComparison
        local={document}
        server={serverComparison.content}
        onKeepLocal={() => {
          const local = kind === 'draft'
            ? restoreLockedLessonFields(document, serverComparison.content)
            : document;
          setDocument(local);
          documentRef.current = local;
          setBaseRevision(serverComparison.revision);
          writeLocalDraft(storageKey, local, serverComparison.revision);
          setServerComparison(null);
          setSaveState('dirty');
          setMessage('已保留本地内容，并改用当前服务器修订作为保存基线。');
        }}
        onUseServer={() => {
          setDocument(serverComparison.content);
          documentRef.current = serverComparison.content;
          setBaseRevision(serverComparison.revision);
          window.localStorage.removeItem(storageKey);
          saveCoordinator.restore(false);
          setServerComparison(null);
          setSaveState('saved');
          setMessage('已采用服务器修订，本地修改已明确丢弃。');
        }}
      /> : null}
      {message ? <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm" role="status"><span>{message}</span>{saveState === 'conflict' ? <button type="button" onClick={() => void load(true)} className="rounded border border-border px-3 py-1.5">重新加载服务器修订</button> : null}</div> : null}
      {validationErrors.length > 0 ? <section className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3" aria-label="文档校验错误">
        <h2 className="text-sm font-medium text-destructive">文档尚不能保存或批准</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>
      </section> : null}
      {kind === 'outline'
        ? <OutlineForm value={document} onChange={change} />
        : <LessonForm value={document} onChange={change} />}
    </PreparationDocumentEditorShell>
  );
}

function OutlineForm({ value, onChange }: { value: RecordValue; onChange: (value: RecordValue) => void }) {
  const steps = outlineDocumentSteps(value);
  return <div className="mx-auto max-w-4xl space-y-6">
    <LineList label="重点内容" values={stringArray(value.keyContent)} onChange={(keyContent) => onChange({ ...value, keyContent })} />
    <LineList label="难点内容" values={stringArray(value.difficultContent)} onChange={(difficultContent) => onChange({ ...value, difficultContent })} />
    {STAGES.map(([stageId, title]) => <section key={stageId} id={`document-section-${stageId}`} className="scroll-mt-20 rounded-xl border border-border p-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-3">{steps.filter((step) => step.bopppsStage === stageId).map((step, index, stageSteps) => <div key={`${stageId}:${index}`} className="grid gap-2 rounded-lg bg-muted/30 p-3 sm:grid-cols-[1fr_8rem_auto]">
        <input aria-label={`${title}步骤标题`} value={String(step.title ?? '')} onChange={(event) => onChange(replaceOutlineStageSteps(value, stageId, updateAt(stageSteps, index, { ...step, title: event.target.value })))} className="rounded border border-border bg-background px-3 py-2" />
        <input aria-label={`${title}步骤时长`} type="number" min={1} max={120} value={Number(step.minutes ?? 1)} onChange={(event) => onChange(replaceOutlineStageSteps(value, stageId, updateAt(stageSteps, index, { ...step, minutes: Number(event.target.value) })))} className="rounded border border-border bg-background px-3 py-2" />
        <div className="flex gap-1">
          <IconButton label={`上移${title}步骤`} onClick={() => onChange(replaceOutlineStageSteps(value, stageId, moved(stageSteps, index, -1)))}><ArrowUp /></IconButton>
          <IconButton label={`下移${title}步骤`} onClick={() => onChange(replaceOutlineStageSteps(value, stageId, moved(stageSteps, index, 1)))}><ArrowDown /></IconButton>
          <button type="button" disabled={stageSteps.length <= 1} onClick={() => onChange(replaceOutlineStageSteps(value, stageId, stageSteps.filter((_, itemIndex) => itemIndex !== index)))} className="grid h-10 w-10 place-items-center rounded border border-border disabled:opacity-40" aria-label={`删除${title}步骤`}><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>)}</div>
      <button type="button" onClick={() => onChange(replaceOutlineStageSteps(value, stageId, [...steps.filter((step) => step.bopppsStage === stageId), { title: '新教学步骤', bopppsStage: stageId, minutes: 5 }]))} className="mt-3 inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm"><Plus className="h-4 w-4" />添加步骤</button>
    </section>)}
    <LineList label="教学限制与待补信息" values={stringArray(value.limitations)} onChange={(limitations) => onChange({ ...value, limitations })} />
  </div>;
}

function LessonForm({ value, onChange }: { value: RecordValue; onChange: (value: RecordValue) => void }) {
  const goals = recordArray(value.goals);
  const knowledgePoints = recordArray(value.knowledgePoints);
  return <div className="mx-auto max-w-5xl space-y-6">
    <section className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
      <ReadOnlyField label="课程" value={String(value.course ?? '')} />
      <ReadOnlyField label="主题" value={String(value.topic ?? '')} />
      <ReadOnlyField label="授课对象" value={String(value.audience ?? '')} />
      <ReadOnlyField label="先修要求" value={String(value.prerequisites ?? '')} />
    </section>
    <section className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-2">
      <LineList label="重点内容" values={stringArray(value.keyContent)} onChange={(keyContent) => onChange({ ...value, keyContent })} />
      <LineList label="难点内容" values={stringArray(value.difficultContent)} onChange={(difficultContent) => onChange({ ...value, difficultContent })} />
    </section>
    <section className="space-y-3 rounded-xl border border-border p-4">
      <h2 className="font-semibold">学习目标</h2>
      {goals.map((goal, index) => <article key={String(goal.id ?? index)} className="space-y-3 rounded-lg bg-muted/30 p-3">
        <TextArea label={`目标 ${index + 1}`} value={String(goal.content ?? '')} onChange={(content) => onChange({ ...value, goals: updateAt(goals, index, { ...goal, content }) })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadOnlyField label="目标标识" value={String(goal.id ?? '—')} />
          <ReadOnlyField label="来源状态" value={String(goal.sourceState ?? '—')} />
        </div>
        <ReadOnlyStructure label="目标来源绑定" value={goal.sourceBindings} />
        <ReadOnlyStructure label="课程标准映射" value={goal.standardsMappings} />
      </article>)}
    </section>
    <section className="space-y-3 rounded-xl border border-border p-4">
      <h2 className="font-semibold">知识点</h2>
      {knowledgePoints.map((knowledgePoint, index) => <article key={String(knowledgePoint.id ?? index)} className="space-y-3 rounded-lg bg-muted/30 p-3">
        <TextField label={`知识点 ${index + 1}`} value={String(knowledgePoint.title ?? '')} onChange={(title) => onChange({ ...value, knowledgePoints: updateAt(knowledgePoints, index, { ...knowledgePoint, title }) })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadOnlyField label="知识点标识" value={String(knowledgePoint.id ?? '—')} />
          <ReadOnlyField label="来源状态" value={String(knowledgePoint.sourceState ?? '—')} />
        </div>
        <ReadOnlyStructure label="知识点来源绑定" value={knowledgePoint.sourceBindings} />
      </article>)}
    </section>
    <section className="grid gap-4 rounded-xl border border-border p-4 lg:grid-cols-2">
      <ReadOnlyStructure label="教案来源" value={value.sources} />
      <ReadOnlyStructure label="班级适配" value={value.classAdaptation} />
    </section>
    {STAGES.map(([stageId, title]) => {
      const stage = lessonDocumentStage(value, stageId);
      return <section key={stageId} id={`document-section-${stageId}`} className="scroll-mt-20 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{title}</h2><span className="text-sm text-muted-foreground">{stage.steps.reduce((total, step) => total + Number(step.minutes ?? 0), 0)} 分钟</span></div>
        <div className="mt-4 space-y-4">{stage.steps.map((step, index) => <article key={`${stageId}:${index}`} className="rounded-lg bg-muted/30 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto]">
            <TextField label="步骤标题" value={String(step.title ?? '')} onChange={(title) => updateLessonStep(value, stageId, index, { ...step, title }, onChange)} />
            <NumberField label="分钟" value={Number(step.minutes ?? 1)} onChange={(minutes) => updateLessonStep(value, stageId, index, { ...step, minutes }, onChange)} />
            <div className="flex items-end gap-1">
              <IconButton label="上移" onClick={() => moveLessonStep(value, stageId, index, -1, onChange)}><ArrowUp /></IconButton>
              <IconButton label="下移" onClick={() => moveLessonStep(value, stageId, index, 1, onChange)}><ArrowDown /></IconButton>
              <IconButton label="删除" onClick={() => deleteLessonStep(value, stageId, index, onChange)}><Trash2 /></IconButton>
            </div>
          </div>
          <div className="mt-3 grid gap-3">
            <TextArea label="教师活动" value={String(step.teacherActivity ?? '')} onChange={(teacherActivity) => updateLessonStep(value, stageId, index, { ...step, teacherActivity }, onChange)} />
            <TextArea label="学生活动" value={String(step.studentActivity ?? '')} onChange={(studentActivity) => updateLessonStep(value, stageId, index, { ...step, studentActivity }, onChange)} />
            <TextArea label="评价方式" value={String(step.assessment ?? '')} onChange={(assessment) => updateLessonStep(value, stageId, index, { ...step, assessment }, onChange)} />
          </div>
        </article>)}</div>
        <button type="button" onClick={() => addLessonStep(value, stageId, onChange)} className="mt-3 inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-sm"><Plus className="h-4 w-4" />添加内部步骤</button>
      </section>;
    })}
    <LineList label="教学限制与待补信息" values={stringArray(value.limitations)} onChange={(limitations) => onChange({ ...value, limitations })} />
  </div>;
}

function updateLessonStep(value: RecordValue, stageId: string, index: number, step: RecordValue, onChange: (value: RecordValue) => void) {
  const stage = lessonDocumentStage(value, stageId);
  writeLessonStage(value, stageId, updateAt(stage.steps, index, step), onChange);
}

function addLessonStep(value: RecordValue, stageId: string, onChange: (value: RecordValue) => void) {
  const stage = lessonDocumentStage(value, stageId);
  writeLessonStage(value, stageId, [...stage.steps, { title: '新教学步骤', minutes: 5, teacherActivity: '待完善', studentActivity: '待完善', assessment: '待完善', sourceBindings: [] }], onChange);
}

function deleteLessonStep(value: RecordValue, stageId: string, index: number, onChange: (value: RecordValue) => void) {
  const stage = lessonDocumentStage(value, stageId);
  if (stage.steps.length <= 1) return;
  writeLessonStage(value, stageId, stage.steps.filter((_, itemIndex) => itemIndex !== index), onChange);
}

function moveLessonStep(value: RecordValue, stageId: string, index: number, offset: -1 | 1, onChange: (value: RecordValue) => void) {
  const stage = lessonDocumentStage(value, stageId);
  const target = index + offset;
  if (target < 0 || target >= stage.steps.length) return;
  const steps = [...stage.steps];
  [steps[index], steps[target]] = [steps[target], steps[index]];
  writeLessonStage(value, stageId, steps, onChange);
}

function writeLessonStage(value: RecordValue, stageId: string, steps: RecordValue[], onChange: (value: RecordValue) => void) {
  onChange(replaceLessonStageSteps(value, stageId, steps));
}

function advisorySuggestions(value: unknown, revision: unknown): PreparationEditorSuggestion[] {
  const report = preparationRecord(value);
  const findings = Array.isArray(report.findings) ? report.findings.map(preparationRecord) : [];
  const suggestions = stringArray(report.suggestions);
  return [
    ...findings.map((finding, index) => {
      const anchor = typeof finding.path === 'string' ? finding.path : '';
      const replacement = typeof finding.proposedReplacement === 'string'
        && isEditableSuggestionPath(anchor.split('.').filter(Boolean))
        ? finding.proposedReplacement
        : null;
      return {
        id: `${revision}:finding:${index}`,
        message: String(finding.message ?? ''),
        anchor: anchor || '教案',
        replacement,
        status: 'open' as const,
      };
    }),
    ...suggestions.map((message, index) => ({
      id: `${revision}:suggestion:${index}`,
      message,
      anchor: '教学限制与待补信息',
      replacement: null,
      status: 'open' as const,
    })),
  ].filter((item) => item.message);
}

function applySuggestion(document: RecordValue, suggestion: PreparationEditorSuggestion): RecordValue | null {
  if (!suggestion.replacement || !suggestion.anchor) return null;
  const path = suggestion.anchor.split('.').filter(Boolean);
  if (!isEditableSuggestionPath(path)) return null;
  const replaced = replaceStringAtPath(document, path, suggestion.replacement);
  if (!replaced) return null;
  if (path.length === 5 && path[0] === 'boppps' && path[2] === 'steps') {
    return replaceLessonStageSteps(replaced, path[1], lessonDocumentStage(replaced, path[1]).steps);
  }
  return replaced;
}

function isEditableSuggestionPath(path: string[]) {
  if (path.length === 2 && path[0] === 'limitations') return validArrayIndex(path[1]);
  if (path.length === 3 && path[0] === 'coursewareStepOutline') {
    return validArrayIndex(path[1]) && path[2] === 'title';
  }
  return path.length === 5
    && path[0] === 'boppps'
    && STAGES.some(([stageId]) => stageId === path[1])
    && path[2] === 'steps'
    && validArrayIndex(path[3])
    && ['title', 'teacherActivity', 'studentActivity', 'assessment'].includes(path[4]);
}

function validArrayIndex(value: string) {
  return /^(0|[1-9]\d*)$/.test(value);
}

function replaceStringAtPath(value: RecordValue, path: string[], replacement: string): RecordValue | null {
  const [head, ...tail] = path;
  const current = value[head];
  if (tail.length === 0) return typeof current === 'string' ? { ...value, [head]: replacement } : null;
  if (Array.isArray(current)) {
    const index = Number(tail[0]);
    if (!Number.isInteger(index) || index < 0 || index >= current.length) return null;
    const child = current[index];
    if (tail.length === 1) {
      return typeof child === 'string' ? { ...value, [head]: updateAt(current, index, replacement) } : null;
    }
    if (!child || typeof child !== 'object' || Array.isArray(child)) return null;
    const next = replaceStringAtPath(child as RecordValue, tail.slice(1), replacement);
    return next ? { ...value, [head]: updateAt(current, index, next) } : null;
  }
  if (!current || typeof current !== 'object') return null;
  const next = replaceStringAtPath(current as RecordValue, tail, replacement);
  return next ? { ...value, [head]: next } : null;
}

function LineList({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return <label className="grid gap-2"><span className="text-sm font-medium">{label}</span><textarea rows={4} value={values.join('\n')} onChange={(event) => onChange(event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} className="rounded-lg border border-border bg-background px-3 py-2" /></label>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-sm"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="rounded border border-border bg-background px-3 py-2" /></label>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 text-sm"><span>{label}</span><p className="min-h-10 rounded border border-border bg-muted/40 px-3 py-2">{value}</p></div>;
}

function ReadOnlyStructure({ label, value }: { label: string; value: unknown }) {
  return <div className="space-y-2 text-sm">
    <h3 className="font-medium">{label}</h3>
    <div className="space-y-2 rounded border border-border bg-muted/40 p-3">
      <ReadableValue value={value} />
    </div>
  </div>;
}

function ReadableValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <p className="text-muted-foreground">未提供</p>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="text-muted-foreground">无</p>;
    return <div className="space-y-2">{value.map((item, index) => <div key={index} className="rounded bg-background/70 p-2"><ReadableValue value={item} /></div>)}</div>;
  }
  if (typeof value === 'object') {
    return <dl className="grid gap-2">{Object.entries(value as Record<string, unknown>).map(([key, item]) => <div key={key} className="grid gap-1 sm:grid-cols-[8rem_1fr]">
      <dt className="text-muted-foreground">{readableFieldLabel(key)}</dt>
      <dd className="break-words"><ReadableValue value={item} /></dd>
    </div>)}</dl>;
  }
  return <p className="whitespace-pre-wrap break-words">{String(value)}</p>;
}

function readableFieldLabel(key: string) {
  return ({
    id: '标识',
    citationId: '引用标识',
    sourceVersionId: '来源版本',
    anchor: '来源位置',
    contentHash: '内容摘要',
    gapIdentity: '待补证据标识',
  } as Record<string, string>)[key] ?? key;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="grid gap-1 text-sm"><span>{label}</span><input type="number" min={1} max={120} value={value} onChange={(event) => onChange(Number(event.target.value))} className="rounded border border-border bg-background px-3 py-2" /></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-sm"><span>{label}</span><textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} className="rounded border border-border bg-background px-3 py-2" /></label>;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={label} className="grid h-10 w-10 place-items-center rounded border border-border [&>svg]:h-4 [&>svg]:w-4">{children}</button>;
}

function endpoint(kind: LessonEditorKind, id: string) {
  return kind === 'outline'
    ? `/api/teacher/smart-lesson-tasks/jobs/${encodeURIComponent(id)}/outline`
    : `/api/teacher/smart-lesson-tasks/drafts/${encodeURIComponent(id)}`;
}

function restoreLockedLessonFields(local: RecordValue, server: RecordValue) {
  return {
    ...local,
    course: server.course,
    topic: server.topic,
    audience: server.audience,
    prerequisites: server.prerequisites,
  };
}

function updateAt<T>(values: T[], index: number, value: T) {
  return values.map((item, itemIndex) => itemIndex === index ? value : item);
}

function moved<T>(values: T[], index: number, offset: -1 | 1) {
  const target = index + offset;
  if (target < 0 || target >= values.length) return values;
  const next = [...values];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function recordArray(value: unknown) {
  return Array.isArray(value) ? value.map(preparationRecord) : [];
}

function writeLocalDraft(key: string, content: RecordValue, baseRevision: string | number | null) {
  window.localStorage.setItem(key, JSON.stringify({ content, baseRevision, savedAt: new Date().toISOString() }));
}

function readLocalDraft(key: string): { content: RecordValue; baseRevision: string | number | null } | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    if (!value?.content || typeof value.content !== 'object') return null;
    return {
      content: value.content,
      baseRevision: typeof value.baseRevision === 'string' || typeof value.baseRevision === 'number'
        ? value.baseRevision
        : null,
    };
  } catch {
    return null;
  }
}

function readSuggestionStates(key: string): Record<string, 'accepted' | 'ignored'> {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? '{}');
  } catch {
    return {};
  }
}

function writeSuggestionStates(key: string, suggestions: PreparationEditorSuggestion[]) {
  window.localStorage.setItem(key, JSON.stringify(Object.fromEntries(
    suggestions.flatMap((item) => item.status && item.status !== 'open' ? [[item.id, item.status]] : []),
  )));
}

function errorText(payload: unknown) {
  const code = String(preparationRecord(preparationRecord(payload).error).code ?? preparationRecord(payload).error ?? '操作失败');
  return ({
    'draft-version-conflict': '教案已有较新修订。',
    'paused-outline-conflict': '提纲已有较新修订。',
    'invalid-input': '文档结构或时长不符合要求，请检查标记项。',
  } as Record<string, string>)[code] ?? code;
}
