'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PreparationDocumentEditorShell, type PreparationEditorSaveState } from './editor-shell';
import { RichMarkdownEditor } from './rich-markdown-editor';

type EditableCourseBasisDocument = {
  id: string;
  documentId: string;
  documentTitle: string;
  courseBasisId: string;
  versionNumber: number;
  sourceName: string;
  contentHash: string;
  markdown: string;
  frozen: boolean;
};

export function CourseBasisDocumentEditor({ versionId }: { versionId: string }) {
  const [document, setDocument] = useState<EditableCourseBasisDocument | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [saveState, setSaveState] = useState<PreparationEditorSaveState>('saved');
  const [message, setMessage] = useState('');
  const editGenerationRef = useRef(0);
  const markdownRef = useRef('');
  const storageKey = `preparation-editor:course-basis:${versionId}`;

  const load = useCallback(async (preferServer = false) => {
    const response = await fetch(`/api/teacher/course-bases/versions/${encodeURIComponent(versionId)}?mode=editor`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) return setMessage(errorText(payload));
    const next = payload.document as EditableCourseBasisDocument;
    const local = !preferServer ? window.localStorage.getItem(storageKey) : null;
    setDocument(next);
    setMarkdown(local ?? next.markdown);
    markdownRef.current = local ?? next.markdown;
    editGenerationRef.current = local ? 1 : 0;
    setSaveState(local ? 'dirty' : 'saved');
    setMessage(local ? '已恢复上次未完成的本地修改。' : next.frozen ? '当前版本已被引用；保存时会建立新的可编辑版本。' : '');
  }, [storageKey, versionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = useCallback((next: string) => {
    editGenerationRef.current += 1;
    markdownRef.current = next;
    setMarkdown(next);
    setSaveState('dirty');
    window.localStorage.setItem(storageKey, next);
  }, [storageKey]);

  const save = useCallback(async () => {
    if (!document || saveState === 'saving') return;
    const saveGeneration = editGenerationRef.current;
    setSaveState('saving');
    const response = await fetch(`/api/teacher/course-bases/versions/${encodeURIComponent(document.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedContentHash: document.contentHash, markdown }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setSaveState(response.status === 409 ? 'conflict' : 'failed');
      setMessage(response.status === 409 ? '服务器版本已变化。本地文档仍保留，可重新加载后比较。' : errorText(payload));
      return;
    }
    if (payload.createdSuccessor) {
      window.localStorage.removeItem(storageKey);
      if (editGenerationRef.current !== saveGeneration) {
        window.localStorage.setItem(`preparation-editor:course-basis:${payload.version.id}`, markdownRef.current);
      }
      setMessage(`原版本保持不变，已建立 v${payload.version.versionNumber} 可编辑版本。`);
      window.location.replace(`/teacher/smart-prep/editor/course-basis/${encodeURIComponent(payload.version.id)}`);
      return;
    }
    setDocument((current) => current ? { ...current, contentHash: payload.version.contentHash, frozen: false } : current);
    if (editGenerationRef.current === saveGeneration) {
      window.localStorage.removeItem(storageKey);
      setSaveState('saved');
      setMessage('修改已可靠保存。');
    } else {
      setSaveState('dirty');
      setMessage('较早修改已保存，正在继续保存新的修改。');
    }
  }, [document, markdown, saveState, storageKey]);

  useEffect(() => {
    if (saveState !== 'dirty') return;
    const timer = window.setTimeout(() => void save(), 1200);
    return () => window.clearTimeout(timer);
  }, [save, saveState]);

  const sections = useMemo(() => markdownSections(markdown), [markdown]);
  if (!document) {
    return <main className="grid min-h-screen place-items-center bg-background"><p role="status">{message || '正在加载文档…'}</p></main>;
  }

  return (
    <PreparationDocumentEditorShell
      title={document.documentTitle}
      subtitle={`${document.sourceName} · v${document.versionNumber}${document.frozen ? ' · 已引用版本' : ''}`}
      sections={sections}
      saveState={saveState}
      onSave={save}
      onExit={() => returnToSmartPrep(`/teacher/smart-prep?view=basis&courseBasisId=${encodeURIComponent(document.courseBasisId)}`)}
      onSelectSection={(id) => window.document.querySelectorAll('[data-preparation-rich-editor] .tiptap h1, [data-preparation-rich-editor] .tiptap h2, [data-preparation-rich-editor] .tiptap h3, [data-preparation-rich-editor] .tiptap h4')[Number(id)]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    >
      <div className="mx-auto max-w-5xl">
        {message ? <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm" role="status"><span>{message}</span>{saveState === 'conflict' ? <button type="button" onClick={() => void load(true)} className="rounded border border-border px-3 py-1.5">重新加载服务器版本</button> : null}</div> : null}
        <RichMarkdownEditor value={markdown} onChange={change} ariaLabel={`${document.documentTitle}正文`} />
      </div>
    </PreparationDocumentEditorShell>
  );
}

function markdownSections(markdown: string) {
  const headings = markdown.split('\n').flatMap((line) => {
    const match = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    return match ? [{ title: match[2], complete: true }] : [];
  }).map((heading, index) => ({ ...heading, id: String(index) }));
  return headings.length ? headings : [{ id: 'root', title: '正文', complete: Boolean(markdown.trim()) }];
}

function errorText(payload: unknown) {
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const error = root.error && typeof root.error === 'object' ? root.error as Record<string, unknown> : {};
  const code = String(error.code ?? root.error ?? '操作失败');
  return ({
    'version-edit-conflict': '课程依据版本已变化。',
    'version-not-editable': '该版本没有可编辑的提取文本。',
    'invalid-input': '文档内容不符合保存要求。',
  } as Record<string, string>)[code] ?? code;
}

function returnToSmartPrep(fallback: string) {
  try {
    const referrer = new URL(window.document.referrer);
    if (referrer.origin === window.location.origin && referrer.pathname === '/teacher/smart-prep') {
      window.history.back();
      return;
    }
  } catch {
    // Use the governed fallback when the referrer is absent or invalid.
  }
  window.location.assign(fallback);
}
