'use client';

import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface FormulaDisplayProps {
  formula: string;
  displayMode?: boolean;
}

/** 以 `\quad` 并列的多个式子在窄侧栏里改为逐行排列，避免横向溢出。 */
export function stackFormulaParts(formula: string) {
  const parts = formula
    .split(/,?\s*\\quad\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? `\\begin{gathered}${parts.join(' \\\\ ')}\\end{gathered}` : formula;
}

export function FormulaDisplay({ formula, displayMode = true }: FormulaDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && formula) {
      try {
        katex.render(displayMode ? stackFormulaParts(formula) : formula, containerRef.current, {
          displayMode,
          throwOnError: false,
          errorColor: '#ef4444',
        });
      } catch (error) {
        console.error('KaTeX render error:', error);
        if (containerRef.current) {
          containerRef.current.textContent = formula;
        }
      }
    }
  }, [formula, displayMode]);

  if (!formula) return null;

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto rounded-lg border border-platform-border bg-platform-canvas/60 p-3 text-[13px] text-platform-fg-primary"
    />
  );
}
