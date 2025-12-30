'use client';

import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface FormulaDisplayProps {
  formula: string;
  displayMode?: boolean;
}

export function FormulaDisplay({ formula, displayMode = true }: FormulaDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && formula) {
      try {
        katex.render(formula, containerRef.current, {
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
      className="overflow-x-auto rounded-lg bg-slate-800/50 p-3 text-slate-200"
    />
  );
}
