'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Menu, MessageSquareText, Save, X } from 'lucide-react';

export type PreparationEditorSaveState = 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict';

export type PreparationEditorSection = {
  id: string;
  title: string;
  complete?: boolean;
};

export type PreparationEditorSuggestion = {
  id: string;
  message: string;
  anchor?: string | null;
  replacement?: string | null;
  status?: 'open' | 'accepted' | 'ignored';
};

export function PreparationDocumentEditorShell({
  title,
  subtitle,
  sections,
  activeSection,
  onSelectSection,
  suggestions = [],
  saveState,
  onSave,
  onExit,
  onAcceptSuggestion,
  onIgnoreSuggestion,
  children,
}: {
  title: string;
  subtitle?: string;
  sections: PreparationEditorSection[];
  activeSection?: string;
  onSelectSection?: (sectionId: string) => void;
  suggestions?: PreparationEditorSuggestion[];
  saveState: PreparationEditorSaveState;
  onSave: () => Promise<void>;
  onExit: () => void;
  onAcceptSuggestion?: (suggestion: PreparationEditorSuggestion) => void;
  onIgnoreSuggestion?: (suggestion: PreparationEditorSuggestion) => void;
  children: React.ReactNode;
}) {
  const [structureOpen, setStructureOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const stateRef = useRef(saveState);
  stateRef.current = saveState;

  const hasUnsavedWork = saveState !== 'saved';
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedWork) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedWork]);

  const exit = useCallback(() => {
    if (stateRef.current !== 'saved' && !window.confirm('当前修改尚未可靠保存，确定离开并保留本地内容吗？')) return;
    onExit();
  }, [onExit]);

  return (
    <main className="fixed inset-0 z-50 flex min-w-0 flex-col overflow-hidden bg-background" data-preparation-document-editor>
      <header className="flex min-h-16 items-center gap-3 border-b border-border px-3 sm:px-5">
        <button type="button" onClick={exit} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-muted" aria-label="返回备课任务"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">{saveLabel(saveState)}</p>
        <button type="button" onClick={() => void onSave()} disabled={saveState === 'saving' || saveState === 'saved'} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" />保存</button>
        <button type="button" onClick={() => setStructureOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg border border-border lg:hidden" aria-label="打开文档结构"><Menu className="h-4 w-4" /></button>
        <button type="button" onClick={() => setSuggestionsOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg border border-border xl:hidden" aria-label="打开 AI 建议"><MessageSquareText className="h-4 w-4" /></button>
      </header>
      <div className="grid min-h-0 min-w-0 flex-1 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
        <StructurePanel sections={sections} activeSection={activeSection} onSelect={(id) => { onSelectSection?.(id); setStructureOpen(false); }} className="hidden lg:block" />
        <section className="min-w-0 overflow-y-auto overscroll-contain p-3 sm:p-6">{children}</section>
        <SuggestionPanel suggestions={suggestions} onAccept={onAcceptSuggestion} onIgnore={onIgnoreSuggestion} className="hidden xl:block" />
      </div>
      {structureOpen ? <Drawer title="文档结构" hideAt="lg" onClose={() => setStructureOpen(false)}><StructurePanel sections={sections} activeSection={activeSection} onSelect={(id) => { onSelectSection?.(id); setStructureOpen(false); }} /></Drawer> : null}
      {suggestionsOpen ? <Drawer title="AI 建议" side="right" hideAt="xl" onClose={() => setSuggestionsOpen(false)}><SuggestionPanel suggestions={suggestions} onAccept={onAcceptSuggestion} onIgnore={onIgnoreSuggestion} /></Drawer> : null}
    </main>
  );
}

function StructurePanel({ sections, activeSection, onSelect, className = '' }: { sections: PreparationEditorSection[]; activeSection?: string; onSelect?: (id: string) => void; className?: string }) {
  return <aside className={`overflow-y-auto border-r border-border bg-muted/20 p-3 ${className}`} aria-label="文档结构">
    <h2 className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">文档结构</h2>
    <nav className="space-y-1">{sections.map((section) => <button key={section.id} type="button" onClick={() => onSelect?.(section.id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${activeSection === section.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}><span aria-hidden>{section.complete === false ? '○' : '●'}</span><span className="truncate">{section.title}</span></button>)}</nav>
  </aside>;
}

function SuggestionPanel({ suggestions, onAccept, onIgnore, className = '' }: { suggestions: PreparationEditorSuggestion[]; onAccept?: (suggestion: PreparationEditorSuggestion) => void; onIgnore?: (suggestion: PreparationEditorSuggestion) => void; className?: string }) {
  return <aside className={`overflow-y-auto border-l border-border bg-muted/20 p-4 ${className}`} aria-label="AI 建议">
    <h2 className="text-sm font-semibold">AI 建议</h2>
    <p className="mt-1 text-xs text-muted-foreground">接受建议只修改草稿，不会批准文档。</p>
    <div className="mt-4 space-y-3">{suggestions.length ? suggestions.map((suggestion) => <article key={suggestion.id} className="rounded-lg border border-border bg-background p-3 text-sm">
      {suggestion.anchor ? <p className="mb-1 text-xs text-muted-foreground">{suggestion.anchor}</p> : null}
      <p>{suggestion.message}</p>
      {suggestion.status && suggestion.status !== 'open'
        ? <p className="mt-2 text-xs text-muted-foreground">{suggestion.status === 'accepted' ? '已接受' : '已忽略'}</p>
        : onAccept || onIgnore
          ? <div className="mt-3 flex flex-wrap items-center gap-2">{suggestion.replacement && onAccept ? <button type="button" onClick={() => onAccept(suggestion)} className="rounded border border-primary px-2 py-1 text-xs text-primary">接受</button> : <span className="text-xs text-muted-foreground">该建议未包含可应用的修改</span>}{onIgnore ? <button type="button" onClick={() => onIgnore(suggestion)} className="rounded border border-border px-2 py-1 text-xs">忽略</button> : null}</div>
          : null}
    </article>) : <p className="text-sm text-muted-foreground">当前修订没有待处理建议。</p>}</div>
  </aside>;
}

function Drawer({ title, side = 'left', hideAt, onClose, children }: { title: string; side?: 'left' | 'right'; hideAt: 'lg' | 'xl'; onClose: () => void; children: React.ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  const responsiveClass = hideAt === 'lg' ? 'lg:hidden' : 'xl:hidden';
  return <div className={`fixed inset-0 z-[60] bg-black/40 ${responsiveClass}`} role="presentation" onClick={onClose}><section className={`absolute bottom-0 top-0 w-[min(88vw,22rem)] bg-background shadow-2xl ${side === 'right' ? 'right-0' : 'left-0'}`} role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}><header className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="font-semibold">{title}</h2><button ref={closeRef} type="button" onClick={onClose} aria-label="关闭"><X className="h-5 w-5" /></button></header><div className="h-[calc(100%-3.25rem)] overflow-y-auto">{children}</div></section></div>;
}

function saveLabel(state: PreparationEditorSaveState) {
  return { saved: '已保存', dirty: '尚未保存', saving: '保存中', failed: '保存失败', conflict: '存在版本冲突' }[state];
}
