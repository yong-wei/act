'use client';

import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  /** 有搜索词时的命中数；无搜索词时不显示。 */
  matchCount?: number;
  onSubmit?: () => void;
}

export function SearchBar({ value, onChange, matchCount, onSubmit }: SearchBarProps) {
  const hasQuery = value.trim().length > 0;
  return (
    <div className="min-w-0">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-platform-fg-muted" aria-hidden="true" />
        <input
          aria-label="搜索控制理论概念"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit?.();
            }
          }}
          placeholder="搜索概念，回车定位"
          className="h-8 w-full rounded-md border border-platform-border bg-platform-canvas/60 pl-8 pr-8 text-sm text-platform-fg-primary placeholder:text-platform-fg-muted focus:border-platform-action-primary focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button
            type="button"
            aria-label="清除搜索"
            onClick={() => onChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-platform-fg-muted hover:text-platform-fg-primary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {hasQuery && matchCount !== undefined ? (
        <p className="mt-1 text-[11px] text-platform-fg-secondary" role="status" data-control-map-search-status="">
          {matchCount > 0 ? `命中 ${matchCount} 个概念` : '未找到匹配概念'}
        </p>
      ) : null}
    </div>
  );
}
