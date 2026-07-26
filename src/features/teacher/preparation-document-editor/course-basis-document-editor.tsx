'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PreparationDocumentEditorShell, type PreparationEditorSaveState } from './editor-shell';
import { PreparationConflictComparison } from './conflict-comparison';
import { RichMarkdownEditor } from './rich-markdown-editor';
import { returnToPreparationEditorOrigin } from './return-state';
import { usePreparationSaveCoordinator } from './use-save-coordinator';

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
  lifecycle?: { state: string; label: string };
};

export function CourseBasisDocumentEditor({ versionId }: { versionId: string }) {
  const [document, setDocument] = useState<EditableCourseBasisDocument | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [saveState, setSaveState] = useState<PreparationEditorSaveState>('saved');
  const [message, setMessage] = useState('');
  const markdownRef = useRef('');
  const [baseContentHash, setBaseContentHash] = useState<string | null>(null);
  const [serverComparison, setServerComparison] = useState<EditableCourseBasisDocument | null>(null);
  const saveCoordinator = usePreparationSaveCoordinator();
  const storageKey = `preparation-editor:course-basis:${versionId}`;

  const load = useCallback(async (preferServer = false) => {
    try {
      const response = await fetch(`/api/teacher/course-bases/versions/${encodeURIComponent(versionId)}?mode=editor`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) return setMessage(errorText(payload));
      const next = payload.document as EditableCourseBasisDocument;
      const local = !preferServer ? readLocalDraft(storageKey) : null;
      if (preferServer) {
        setServerComparison(next);
        setMessage('已加载服务器版本供比较；本地修改仍完整保留。');
        setSaveState('conflict');
        return;
      }
      setDocument(next);
      setMarkdown(local?.markdown ?? next.markdown);
      markdownRef.current = local?.markdown ?? next.markdown;
      setBaseContentHash(local ? local.baseContentHash : next.contentHash);
      saveCoordinator.restore(Boolean(local));
      setSaveState(local ? local.baseContentHash === null ? 'conflict' : 'dirty' : 'saved');
      setMessage(local
        ? local.baseContentHash === null
          ? '已恢复旧版本地修改，但缺少原始版本基线；请复制内容后重新加载服务器版本。'
          : '已恢复上次未完成的本地修改。'
        : next.lifecycle?.state === 'DISABLED'
          ? '这是已停用的历史版本；内容仍可核查，保存修改时会建立新的可编辑版本。'
          : next.frozen ? '当前版本已冻结；保存修改时会建立新的可编辑版本。' : '');
    } catch {
      setMessage('文档加载失败，本地修改仍保留，请重试。');
    }
  }, [saveCoordinator, storageKey, versionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = useCallback((next: string) => {
    const saving = saveCoordinator.markEdited();
    markdownRef.current = next;
    setMarkdown(next);
    setSaveState(baseContentHash === null ? 'conflict' : saving ? 'saving' : 'dirty');
    writeLocalDraft(storageKey, next, baseContentHash);
  }, [baseContentHash, saveCoordinator, storageKey]);

  const save = useCallback(async () => {
    if (!document) return;
    if (baseContentHash === null) {
      setSaveState('conflict');
      setMessage('本地修改缺少原始版本基线；请复制内容后重新加载服务器版本。');
      return;
    }
    const saveGeneration = saveCoordinator.beginSave();
    if (saveGeneration === null) return;
    setSaveState('saving');
    try {
      const response = await fetch(`/api/teacher/course-bases/versions/${encodeURIComponent(document.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedContentHash: baseContentHash, markdown }),
      });
      const payload = await response.json();
      if (!response.ok) {
        saveCoordinator.finishSave(saveGeneration);
        setSaveState(response.status === 409 ? 'conflict' : 'failed');
        setMessage(response.status === 409 ? '服务器版本已变化。本地文档仍保留，可重新加载后比较。' : errorText(payload));
        return;
      }
      if (payload.createdSuccessor) {
        const unchanged = saveCoordinator.finishSave(saveGeneration);
        window.localStorage.removeItem(storageKey);
        if (!unchanged) {
          writeLocalDraft(
            `preparation-editor:course-basis:${payload.version.id}`,
            markdownRef.current,
            payload.version.contentHash,
          );
        }
        setMessage(`原版本保持不变，已建立 v${payload.version.versionNumber} 可编辑版本。`);
        window.location.replace(`/teacher/smart-prep/editor/course-basis/${encodeURIComponent(payload.version.id)}`);
        return;
      }
      setBaseContentHash(payload.version.contentHash);
      setDocument((current) => current ? { ...current, contentHash: payload.version.contentHash, frozen: false } : current);
      if (saveCoordinator.finishSave(saveGeneration)) {
        window.localStorage.removeItem(storageKey);
        setSaveState('saved');
        setMessage('修改已可靠保存。');
      } else {
        writeLocalDraft(storageKey, markdownRef.current, payload.version.contentHash);
        setSaveState('dirty');
        setMessage('较早修改已保存，正在继续保存新的修改。');
      }
    } catch {
      saveCoordinator.finishSave(saveGeneration);
      setSaveState('failed');
      setMessage('保存请求失败，本地修改仍保留，请重试。');
    }
  }, [baseContentHash, document, markdown, saveCoordinator, storageKey]);

  useEffect(() => {
    if (saveState !== 'dirty') return;
    const timer = window.setTimeout(() => void save(), 1200);
    return () => window.clearTimeout(timer);
  }, [save, saveState]);

  const sections = useMemo(() => markdownSections(markdown), [markdown]);
  if (!document) {
    return <main className="grid min-h-screen place-items-center bg-background"><div className="text-center"><p role="status">{message || '正在加载文档…'}</p>{message ? <button type="button" onClick={() => void load()} className="mt-3 rounded border border-border px-3 py-1.5">重试加载</button> : null}</div></main>;
  }

  return (
    <PreparationDocumentEditorShell
      title={document.documentTitle}
      subtitle={`${document.sourceName} · v${document.versionNumber} · ${document.lifecycle?.label ?? (document.frozen ? '已冻结' : '可编辑')}`}
      sections={sections}
      saveState={saveState}
      onSave={save}
      onExit={() => returnToPreparationEditorOrigin(`/teacher/smart-prep?view=basis&courseBasisId=${encodeURIComponent(document.courseBasisId)}`)}
      onSelectSection={(id) => window.document.querySelectorAll('[data-preparation-rich-editor] .tiptap h1, [data-preparation-rich-editor] .tiptap h2, [data-preparation-rich-editor] .tiptap h3, [data-preparation-rich-editor] .tiptap h4')[Number(id)]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    >
      <div className="w-full">
        {serverComparison ? <PreparationConflictComparison
          local={markdown}
          server={serverComparison.markdown}
          onKeepLocal={() => {
            setDocument(serverComparison);
            setBaseContentHash(serverComparison.contentHash);
            writeLocalDraft(storageKey, markdownRef.current, serverComparison.contentHash);
            setServerComparison(null);
            setSaveState('dirty');
            setMessage('已保留本地内容，并改用当前服务器版本作为保存基线。');
          }}
          onUseServer={() => {
            setDocument(serverComparison);
            setMarkdown(serverComparison.markdown);
            markdownRef.current = serverComparison.markdown;
            setBaseContentHash(serverComparison.contentHash);
            window.localStorage.removeItem(storageKey);
            saveCoordinator.restore(false);
            setServerComparison(null);
            setSaveState('saved');
            setMessage('已采用服务器版本，本地修改已明确丢弃。');
          }}
        /> : null}
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

function writeLocalDraft(key: string, markdown: string, baseContentHash: string | null) {
  window.localStorage.setItem(key, JSON.stringify({
    markdown,
    baseContentHash,
    savedAt: new Date().toISOString(),
  }));
}

function readLocalDraft(key: string): { markdown: string; baseContentHash: string | null } | null {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value.markdown !== 'string') return { markdown: raw, baseContentHash: null };
    return {
      markdown: value.markdown,
      baseContentHash: typeof value.baseContentHash === 'string' ? value.baseContentHash : null,
    };
  } catch {
    return { markdown: raw, baseContentHash: null };
  }
}
