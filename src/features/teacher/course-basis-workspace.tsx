'use client';

import { useRef, useState } from 'react';
import { BookOpen, FileUp, Plus, RefreshCw } from 'lucide-react';

import { capturePreparationEditorReturnState } from './preparation-document-editor/return-state';

type Version = {
  id: string;
  versionNumber: number;
  sourceName: string;
  extractionState: string;
  reviewState: string;
  failureReason: string | null;
  retiredAt: Date | string | null;
  segments?: Array<{ stableAnchor: string; headingPath: string[]; pageNumber: number | null; text: string }>;
};

type Pagination = { offset: number; limit: number; total: number; hasMore: boolean };
type Document = { id: string; title: string; kind: string; versions: Version[]; versionPagination: Pagination };
type CourseBasis = {
  id: string;
  courseIdentity: string;
  title: string;
  description: string | null;
  documents: Document[];
  documentPagination: Pagination;
};

export function CourseBasisWorkspace({
  initialCourseBases,
  initialSelectedId,
  onChanged,
}: {
  initialCourseBases: CourseBasis[];
  initialSelectedId?: string;
  onChanged?: () => void;
}) {
  const [courseBases, setCourseBases] = useState(initialCourseBases);
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? initialCourseBases[0]?.id ?? '');
  const [hasMoreBases, setHasMoreBases] = useState(initialCourseBases.length === 50);
  const [message, setMessage] = useState('');
  const inFlightPages = useRef(new Set<string>());
  const selected = courseBases.find((item) => item.id === selectedId) ?? null;

  async function refresh(preferredId = selectedId) {
    const targetId = preferredId || selectedId;
    const response = await fetch(targetId
      ? `/api/teacher/course-bases?courseBasisId=${encodeURIComponent(targetId)}`
      : '/api/teacher/course-bases', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? '加载失败');
    if (targetId && payload.courseBases[0]) {
      setCourseBases((current) => {
        const existing = current.find((item) => item.id === targetId);
        const refreshed = existing ? mergeRefreshedBasis(existing, payload.courseBases[0]) : payload.courseBases[0];
        return existing
          ? current.map((item) => item.id === targetId ? refreshed : item)
          : [refreshed, ...current];
      });
    } else {
      setCourseBases(payload.courseBases);
      setHasMoreBases(payload.pagination?.hasMore ?? false);
    }
    setSelectedId(targetId || payload.courseBases[0]?.id || '');
    onChanged?.();
  }

  async function loadMoreBases() {
    const key = 'course-bases';
    if (inFlightPages.current.has(key)) return;
    inFlightPages.current.add(key);
    try {
      const response = await fetch(`/api/teacher/course-bases?offset=${courseBases.length}&limit=50`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) return setMessage(errorText(payload.error));
      setCourseBases((current) => appendUnique(current, payload.courseBases));
      setHasMoreBases(payload.pagination?.hasMore ?? false);
    } finally {
      inFlightPages.current.delete(key);
    }
  }

  async function selectBasis(courseBasisId: string) {
    setSelectedId(courseBasisId);
    const response = await fetch(`/api/teacher/course-bases?courseBasisId=${encodeURIComponent(courseBasisId)}`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload.courseBases[0]) return setMessage(errorText(payload.error));
    setCourseBases((current) => current.map((item) => item.id === courseBasisId
      ? mergeRefreshedBasis(item, payload.courseBases[0])
      : item));
  }

  async function loadMoreDocuments() {
    if (!selected) return;
    const key = `documents:${selected.id}`;
    if (inFlightPages.current.has(key)) return;
    inFlightPages.current.add(key);
    try {
      const response = await fetch(`/api/teacher/course-bases?courseBasisId=${encodeURIComponent(selected.id)}&documentOffset=${selected.documents.length}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.courseBases[0]) return setMessage(errorText(payload.error));
      const next = payload.courseBases[0] as CourseBasis;
      setCourseBases((current) => current.map((basis) => basis.id === selected.id
        ? { ...basis, documents: appendUnique(basis.documents, next.documents), documentPagination: next.documentPagination }
        : basis));
    } finally {
      inFlightPages.current.delete(key);
    }
  }

  async function loadMoreVersions(document: Document) {
    if (!selected) return;
    const key = `versions:${document.id}`;
    if (inFlightPages.current.has(key)) return;
    inFlightPages.current.add(key);
    try {
      const response = await fetch(`/api/teacher/course-bases?courseBasisId=${encodeURIComponent(selected.id)}&documentId=${encodeURIComponent(document.id)}&versionOffset=${document.versions.length}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.courseBases[0]?.documents[0]) return setMessage(errorText(payload.error));
      const next = payload.courseBases[0].documents[0] as Document;
      setCourseBases((current) => current.map((basis) => basis.id === selected.id
        ? { ...basis, documents: basis.documents.map((item) => item.id === document.id
          ? { ...item, versions: appendUnique(item.versions, next.versions), versionPagination: next.versionPagination }
          : item) }
        : basis));
    } finally {
      inFlightPages.current.delete(key);
    }
  }

  async function createBasis(formData: FormData) {
    setMessage('');
    const response = await fetch('/api/teacher/course-bases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        courseIdentity: formData.get('courseIdentity'),
        title: formData.get('title'),
        description: formData.get('description'),
      }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(errorText(payload.error));
    await refresh(payload.courseBasis.id);
    setMessage('课程依据已创建。');
  }

  async function createDocument(formData: FormData) {
    if (!selected) return;
    const response = await fetch(`/api/teacher/course-bases/${selected.id}/documents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: formData.get('title'), kind: formData.get('kind') }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(errorText(payload.error));
    await refresh();
    setMessage('文档已创建，可以导入首个版本。');
  }

  async function importVersion(documentId: string, formData: FormData) {
    const file = formData.get('file');
    const pasted = String(formData.get('content') ?? '').trim();
    let body: BodyInit;
    let headers: HeadersInit | undefined;
    if (file instanceof File && file.size > 0) {
      const upload = new FormData();
      upload.set('file', file);
      body = upload;
    } else {
      headers = { 'content-type': 'application/json' };
      body = JSON.stringify({
        sourceType: formData.get('sourceType'),
        sourceName: formData.get('sourceName') || '粘贴内容',
        mimeType: formData.get('sourceType') === 'MARKDOWN' ? 'text/markdown' : 'text/plain',
        content: pasted,
      });
    }
    const response = await fetch(`/api/teacher/course-bases/documents/${documentId}/versions`, { method: 'POST', headers, body });
    const payload = await response.json();
    if (!response.ok) return setMessage(errorText(payload.error));
    await refresh();
    setMessage(payload.version.extractionState === 'EXTRACTED' ? '版本已提取，请预览后确认。' : errorText(payload.version.failureReason));
  }

  async function runVersionAction(versionId: string, action: 'confirm' | 'reject' | 'retry' | 'retire') {
    const response = await fetch(`/api/teacher/course-bases/versions/${versionId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(errorText(payload.error));
    setCourseBases((current) => current.map((basis) => ({
      ...basis,
      documents: basis.documents.map((document) => ({
        ...document,
        versions: document.id === payload.version.documentId
          ? upsertVersion(document.versions, payload.version)
          : document.versions,
      })),
    })));
    await refresh();
    setMessage('版本状态已更新。');
  }

  async function buildLessonDesignSourcePack(version: Version) {
    const response = await fetch('/api/teacher/course-bases/lesson-design-source-pack', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        selectedVersionIds: [version.id],
        query: `${selected?.courseIdentity ?? ''} ${selected?.title ?? ''} ${version.sourceName}`.trim(),
      }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(errorText(payload.error));
    const itemCount = payload.sourcePack?.itemCount ?? 0;
    setMessage(`备课 Source Pack 已生成，包含 ${itemCount} 条受治理依据。`);
  }

  return (
    <main
      className="space-y-6"
      data-course-basis-workspace
      onClickCapture={(event) => {
        const editorLink = (event.target as HTMLElement).closest<HTMLAnchorElement>(
          'a[href^="/teacher/smart-prep/editor/course-basis/"]',
        );
        if (editorLink && selected) {
          capturePreparationEditorReturnState(
            `/teacher/smart-prep?view=basis&courseBasisId=${encodeURIComponent(selected.id)}`,
          );
        }
      }}
    >
      <header>
        <p className="text-sm font-medium text-primary">智能备课 · 私有课程依据</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Course Basis</h1>
        <p className="mt-2 max-w-3xl text-sm text-subtle">导入课程标准、教材或参考资料。只有经教师确认的指定版本才会进入备课检索；扫描版 PDF 不执行 OCR。</p>
      </header>

      {message ? <p role="status" className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">{message}</p> : null}

      <section className="grid gap-4 rounded-xl border border-border p-4 lg:grid-cols-[1fr_auto]">
        <form action={createBasis} className="grid gap-3 md:grid-cols-3">
          <input name="courseIdentity" required placeholder="课程标识，如 AUTO-101" className="rounded-lg border border-border bg-background px-3 py-2" />
          <input name="title" required placeholder="课程依据名称" className="rounded-lg border border-border bg-background px-3 py-2" />
          <input name="description" placeholder="说明（可选）" className="rounded-lg border border-border bg-background px-3 py-2" />
          <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground md:col-span-3 md:justify-self-start"><Plus className="h-4 w-4" />新建课程依据</button>
        </form>
        <button onClick={() => void refresh()} className="inline-flex items-center gap-2 self-start rounded-lg border border-border px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" />刷新</button>
      </section>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-2">
          {courseBases.length === 0 ? <p className="rounded-xl border border-dashed border-border p-5 text-sm text-subtle">尚无课程依据。</p> : courseBases.map((basis) => (
            <button key={basis.id} onClick={() => void selectBasis(basis.id)} className={`w-full rounded-xl border p-4 text-left ${basis.id === selectedId ? 'border-primary bg-primary/10' : 'border-border'}`}>
              <span className="block text-xs text-subtle">{basis.courseIdentity}</span>
              <span className="mt-1 block font-medium">{basis.title}</span>
            </button>
          ))}
          {hasMoreBases ? <button type="button" onClick={() => void loadMoreBases()} className="w-full rounded-lg border border-border px-3 py-2 text-sm text-primary">加载更多课程依据</button> : null}
        </aside>

        {selected ? <section className="space-y-5">
          <div className="rounded-xl border border-border p-5">
            <div className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">{selected.title}</h2><p className="text-sm text-subtle">{selected.description || '暂无说明'}</p></div></div>
            <form action={createDocument} className="mt-5 flex flex-wrap gap-3">
              <input name="title" required placeholder="文档名称" className="min-w-56 flex-1 rounded-lg border border-border bg-background px-3 py-2" />
              <select name="kind" className="rounded-lg border border-border bg-background px-3 py-2"><option value="STANDARD">课程标准</option><option value="TEXTBOOK">教材</option><option value="OTHER">其他资料</option></select>
              <button className="rounded-lg border border-primary px-4 py-2 text-primary">添加文档</button>
            </form>
          </div>

          {selected.documents.map((document) => <article key={document.id} className="rounded-xl border border-border p-5">
            <h3 className="font-semibold">{document.title} <span className="ml-2 text-xs font-normal text-subtle">{document.kind}</span></h3>
            <form action={(data) => importVersion(document.id, data)} className="mt-4 grid gap-3 rounded-lg bg-muted/30 p-4">
              <div className="flex flex-wrap gap-3"><select name="sourceType" className="rounded-lg border border-border bg-background px-3 py-2"><option value="PASTED_TEXT">粘贴文本</option><option value="MARKDOWN">Markdown</option><option value="PLAIN_TEXT">纯文本</option></select><input name="sourceName" placeholder="来源名称" className="flex-1 rounded-lg border border-border bg-background px-3 py-2" /><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><FileUp className="h-4 w-4" />上传 MD、TXT 或可搜索 PDF<input name="file" type="file" accept=".md,.markdown,.txt,text/plain,text/markdown,application/pdf" className="sr-only" /></label></div>
              <textarea name="content" rows={5} placeholder="粘贴文本或 Markdown；上传 PDF 时可留空" className="rounded-lg border border-border bg-background px-3 py-2" />
              <button className="justify-self-start rounded-lg bg-primary px-4 py-2 text-primary-foreground">导入新版本</button>
            </form>
            <div className="mt-4 space-y-2">{document.versions.map((version) => <div key={version.id} className="rounded-lg border border-border px-4 py-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong>v{version.versionNumber}</strong> · {version.sourceName}<span className="ml-2 text-subtle">{version.extractionState} / {version.reviewState}{version.retiredAt ? ' / RETIRED' : ''}</span>{version.failureReason ? <p className="mt-1 text-destructive">{errorText(version.failureReason)}</p> : null}</div><div className="flex flex-wrap gap-2">{!version.retiredAt && version.extractionState === 'EXTRACTED' ? <a href={`/teacher/smart-prep/editor/course-basis/${encodeURIComponent(version.id)}`} className="rounded border border-primary px-2 py-1 text-primary">可视编辑</a> : null}{!version.retiredAt && version.reviewState === 'CONFIRMED' ? <button onClick={() => void buildLessonDesignSourcePack(version)} className="rounded border border-primary px-2 py-1 text-primary">生成备课 Source Pack</button> : null}{!version.retiredAt && version.reviewState === 'PENDING' && version.extractionState === 'EXTRACTED' ? <button onClick={() => void runVersionAction(version.id, 'reject')} className="rounded border border-border px-2 py-1">拒绝</button> : null}{!version.retiredAt && version.extractionState === 'FAILED' ? <button onClick={() => void runVersionAction(version.id, 'retry')} className="rounded border border-border px-2 py-1">重试为新版本</button> : null}{!version.retiredAt ? <button onClick={() => void runVersionAction(version.id, 'retire')} className="rounded border border-border px-2 py-1">停用</button> : null}</div></div>{!version.retiredAt && version.extractionState === 'EXTRACTED' ? <VersionPreview version={version} onConfirm={() => runVersionAction(version.id, 'confirm')} /> : null}</div>)}{document.versionPagination.hasMore ? <button type="button" onClick={() => void loadMoreVersions(document)} className="rounded border border-border px-3 py-2 text-primary">加载更多版本</button> : null}</div>
          </article>)}
          {selected.documentPagination.hasMore ? <button type="button" onClick={() => void loadMoreDocuments()} className="rounded-lg border border-border px-3 py-2 text-primary">加载更多文档</button> : null}
        </section> : null}
      </div>
    </main>
  );
}

function appendUnique<T extends { id: string }>(current: T[], next: T[]) {
  const ids = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !ids.has(item.id))];
}

function upsertVersion(current: Version[], updated: Version) {
  return current.some((version) => version.id === updated.id)
    ? current.map((version) => version.id === updated.id ? { ...version, ...updated } : version)
    : [updated, ...current];
}

function mergeRefreshedBasis(existing: CourseBasis, refreshed: CourseBasis): CourseBasis {
  const existingDocuments = new Map(existing.documents.map((document) => [document.id, document]));
  const refreshedDocuments = refreshed.documents.map((document) => {
    const previous = existingDocuments.get(document.id);
    if (!previous) return document;
    const versions = appendUnique(document.versions, previous.versions);
    return {
      ...document,
      versions,
      versionPagination: {
        ...document.versionPagination,
        hasMore: versions.length < document.versionPagination.total,
      },
    };
  });
  const documents = appendUnique(refreshedDocuments, existing.documents);
  return {
    ...refreshed,
    documents,
    documentPagination: {
      ...refreshed.documentPagination,
      hasMore: documents.length < refreshed.documentPagination.total,
    },
  };
}

type PreviewPayload = {
  page: number;
  pageCount: number;
  total: number;
  segments: Array<{ stableAnchor: string; headingPath: string[]; pageNumber: number | null; paragraphNumber: number; text: string }>;
};

function VersionPreview({ version, onConfirm }: { version: Version; onConfirm: () => Promise<void> }) {
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(page: number) {
    setLoading(true);
    try {
      const response = await fetch(`/api/teacher/course-bases/versions/${version.id}?page=${page}&pageSize=20`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '预览加载失败');
      setPreview(payload.preview);
    } finally {
      setLoading(false);
    }
  }

  if (!preview) return <button type="button" onClick={() => void load(1)} className="mt-3 rounded border border-primary px-3 py-1.5 text-primary">{loading ? '加载中…' : '打开完整提取预览'}</button>;
  return <section className="mt-3 rounded-lg bg-muted/30 p-3" aria-label="完整提取预览">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong>完整提取预览 · 第 {preview.page}/{preview.pageCount || 1} 页 · 共 {preview.total} 段</strong><div className="flex gap-2"><button type="button" disabled={preview.page <= 1 || loading} onClick={() => void load(preview.page - 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">上一页</button><button type="button" disabled={preview.page >= preview.pageCount || loading} onClick={() => void load(preview.page + 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">下一页</button></div></div>
    <ol className="mt-2 max-h-96 space-y-2 overflow-y-auto">{preview.segments.map((segment) => <li key={segment.stableAnchor} className="rounded bg-background p-3"><p className="text-xs text-subtle">{segment.pageNumber ? `第 ${segment.pageNumber} 页 · ` : ''}{segment.headingPath.join(' / ') || '正文'} · 第 {segment.paragraphNumber} 段 · {segment.stableAnchor}</p><p className="mt-1 whitespace-pre-wrap">{segment.text}</p></li>)}</ol>
    {version.reviewState === 'PENDING' ? <button type="button" onClick={() => void onConfirm()} className="mt-3 rounded bg-primary px-3 py-1.5 text-primary-foreground">已复核预览，确认此版本</button> : null}
  </section>;
}

function errorText(code: unknown) {
  const messages: Record<string, string> = {
    'scan-or-empty-text-layer': 'PDF 没有可搜索文本，可能是扫描件；当前不提供 OCR。',
    'source-too-large': '文件超过 10 MiB 限制。',
    'unsupported-source-type': '文件类型不受支持。',
    'pdf-extraction-failed': 'PDF 已损坏或无法读取。',
  };
  return messages[String(code)] ?? String(code || '操作失败');
}
