'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

import type { GovernedQuestionSummary } from './assignment-ui-contracts';

export function GovernedQuestionPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (item: GovernedQuestionSummary) => Promise<boolean>;
}) {
  const [items, setItems] = useState<GovernedQuestionSummary[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [knowledge, setKnowledge] = useState('ALL');
  const [difficulty, setDifficulty] = useState('ALL');
  const [review, setReview] = useState('ALL');
  const [rubric, setRubric] = useState('ALL');
  const [version, setVersion] = useState('ALL');
  const [selectionError, setSelectionError] = useState('');
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const selectionErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelectionError('');
    setState('loading');
    void fetch('/api/teacher/assignments/question-catalog', {
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('catalog');
        const payload = (await response.json()) as {
          items: GovernedQuestionSummary[];
        };
        setItems(payload.items);
        setState('ready');
      })
      .catch(() => setState('error'));
    window.setTimeout(() => closeRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (selectionError) selectionErrorRef.current?.focus();
  }, [selectionError]);

  const options = (key: keyof GovernedQuestionSummary) =>
    Array.from(
      new Set(
        items.flatMap((item) => {
          const value = item[key];
          return Array.isArray(value)
            ? value.map(String)
            : value === null
              ? []
              : [String(value)];
        }),
      ),
    );
  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const matches = (
          selected: string,
          value: string | number | null | string[],
        ) =>
          selected === 'ALL' ||
          (Array.isArray(value)
            ? value.includes(selected)
            : String(value) === selected);
        return (
          item.stemPreview
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()) &&
          matches(source, item.sourceFamily) &&
          matches(type, item.questionType) &&
          matches(knowledge, item.knowledgeTags) &&
          matches(difficulty, item.difficulty) &&
          matches(review, item.reviewState) &&
          matches(rubric, item.rubricReadiness) &&
          matches(version, item.sourceVersion)
        );
      }),
    [
      difficulty,
      items,
      knowledge,
      query,
      review,
      rubric,
      source,
      type,
      version,
    ],
  );

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-picker-title"
        className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-700 p-5">
          <div>
            <h2
              id="question-picker-title"
              className="text-xl font-semibold text-white"
            >
              从受治理题库选题
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              列表仅显示安全预览，不包含答案或评分指导。
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="关闭受治理题库"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-lg hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="grid max-h-[72vh] md:grid-cols-[15rem_1fr]">
          <aside
            aria-label="题库筛选"
            className="space-y-3 overflow-y-auto border-b border-slate-700 p-4 md:border-b-0 md:border-r"
          >
            <label className="relative block">
              <span className="sr-only">搜索题库</span>
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索题面"
                className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3"
              />
            </label>
            {[
              ['来源', source, setSource, options('sourceFamily')],
              ['题型', type, setType, options('questionType')],
              ['知识点', knowledge, setKnowledge, options('knowledgeTags')],
              ['难度', difficulty, setDifficulty, options('difficulty')],
              ['审核', review, setReview, options('reviewState')],
              ['评分标准', rubric, setRubric, options('rubricReadiness')],
              ['版本', version, setVersion, options('sourceVersion')],
            ].map(([label, value, setter, values]) => (
              <label
                key={String(label)}
                className="block text-xs text-slate-400"
              >
                {String(label)}
                <select
                  value={String(value)}
                  onChange={(event) =>
                    (setter as (value: string) => void)(event.target.value)
                  }
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white"
                >
                  <option value="ALL">全部</option>
                  {(values as string[]).map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </aside>
          <div className="overflow-y-auto p-4">
            {state === 'loading' && <p role="status">正在加载题库……</p>}
            {state === 'error' && (
              <p role="alert" className="text-rose-300">
                题库暂时无法加载。
              </p>
            )}
            {state === 'ready' && (
              <>
                {selectionError && (
                  <p
                    ref={selectionErrorRef}
                    tabIndex={-1}
                    role="alert"
                    className="mb-3 rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-rose-200"
                  >
                    {selectionError}
                  </p>
                )}
                <p role="status" className="mb-3 text-sm text-slate-400">
                  {filtered.length} 道可选题
                </p>
                <div className="space-y-3">
                  {filtered.map((item) => (
                    <article
                      key={item.catalogItemId}
                      className="rounded-xl border border-slate-700 p-4"
                    >
                      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                        <span>{item.sourceFamily}</span>
                        <span>{item.questionType}</span>
                        <span>{item.reviewState}</span>
                        <span>{item.sourceVersion}</span>
                      </div>
                      <p className="mt-3 text-sm text-white">
                        {item.stemPreview}
                      </p>
                      {item.rubricReadiness === 'needs-authoring' && (
                        <p className="mt-2 text-xs text-amber-300">
                          可选，发布前必须补全参考答案与评分标准
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={selectingId !== null}
                        onClick={async () => {
                          setSelectingId(item.catalogItemId);
                          setSelectionError('');
                          try {
                            const selected = await onSelect(item);
                            if (selected) onClose();
                            else {
                              setSelectionError('题库题目载入失败，请重试。');
                              window.setTimeout(
                                () => selectionErrorRef.current?.focus(),
                                0,
                              );
                            }
                          } catch {
                            setSelectionError('题库题目载入失败，请重试。');
                            window.setTimeout(
                              () => selectionErrorRef.current?.focus(),
                              0,
                            );
                          } finally {
                            setSelectingId(null);
                          }
                        }}
                        className="mt-3 min-h-11 rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white"
                      >
                        {selectingId === item.catalogItemId
                          ? '正在载入……'
                          : '选择此题'}
                      </button>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
