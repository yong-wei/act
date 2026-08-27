'use client';

import { useMemo } from 'react';
import 'katex/dist/katex.min.css';

import {
  renderGovernedKatexHtml,
  type GovernedRichTextProjection,
} from '@/lib/governed-math';
import type { GovernedMathSpan } from '@/lib/governed-math/types';

async function copyText(value: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
  }
}

function MathSpanView({
  span,
  theme,
  showCopy,
}: {
  span: GovernedMathSpan;
  theme: 'light' | 'dark';
  showCopy: boolean;
}) {
  const html = useMemo(
    () => renderGovernedKatexHtml({
      latex: span.latex,
      displayMode: span.display === 'block',
      macroProfileId: span.macroProfileId,
      macroProfileHash: span.macroProfileHash,
      theme,
    }),
    [span.display, span.latex, span.macroProfileHash, span.macroProfileId, theme],
  );
  return (
    <span
      className={span.display === 'block' ? 'block overflow-x-auto' : 'inline'}
      data-governed-math-span={span.renderKey}
      data-governed-math-display={span.display}
    >
      <span
        aria-label={span.accessibleLabel}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {showCopy ? (
        <button
          type="button"
          className="ml-1 align-middle text-[10px] text-platform-fg-muted underline"
          data-governed-copy-latex="true"
          onClick={() => {
            void copyText(span.copyLatex);
          }}
        >
          复制公式
        </button>
      ) : null}
    </span>
  );
}

export function GovernedRichText({
  projection,
  theme = 'dark',
  density = 'detail',
  className,
}: {
  projection: GovernedRichTextProjection | null | undefined;
  theme?: 'light' | 'dark';
  density?: 'canvas' | 'preview' | 'detail';
  className?: string;
}) {
  if (!projection || projection.state === 'missing') return null;
  if (projection.state === 'registered-unavailable') {
    return (
      <span
        className={className}
        data-governed-rich-text="unavailable"
        aria-label={projection.accessibleName}
      >
        {projection.fallbackText}
      </span>
    );
  }
  const showCopy = density === 'detail';
  return (
    <span
      className={className}
      data-governed-rich-text={projection.renderKey}
      data-governed-rich-text-density={density}
      aria-label={projection.accessibleName}
    >
      {projection.blocks.map((block, blockIndex) => (
        <span
          key={`${projection.renderKey}:${blockIndex}`}
          className={block.kind === 'math-block' || density === 'detail' ? 'block' : 'inline'}
          data-governed-rich-text-block={block.kind}
        >
          {block.spans.map((span, spanIndex) => (
            span.kind === 'text' ? (
              <span key={`${projection.renderKey}:${blockIndex}:${spanIndex}`}>{span.text}</span>
            ) : (
              <MathSpanView
                key={`${projection.renderKey}:${blockIndex}:${spanIndex}:${span.renderKey}`}
                span={span}
                theme={theme}
                showCopy={showCopy}
              />
            )
          ))}
        </span>
      ))}
      {showCopy ? (
        <button
          type="button"
          className="mt-1 block text-[10px] text-platform-fg-muted underline"
          data-governed-copy-text="true"
          onClick={() => {
            void copyText(projection.copyText);
          }}
        >
          复制全文
        </button>
      ) : null}
    </span>
  );
}

export function GovernedBlockMath({
  latex,
  macroProfileId,
  macroProfileHash,
  accessibleLabel,
  copyLatex,
  display = 'block',
  theme = 'dark',
}: {
  latex: string;
  macroProfileId: string;
  macroProfileHash: string;
  accessibleLabel: string;
  copyLatex: string;
  display?: 'inline' | 'block';
  theme?: 'light' | 'dark';
}) {
  const span: GovernedMathSpan = {
    kind: 'math',
    display,
    latex,
    macroProfileId,
    macroProfileHash,
    accessibleLabel,
    copyLatex,
    renderKey: `${macroProfileId}:${display}:${latex}`,
  };
  return <MathSpanView span={span} theme={theme} showCopy />;
}

export function GovernedUnavailableMath({ message }: { message: string }) {
  return (
    <p className="text-sm text-platform-fg-muted" data-governed-math-unavailable="true">
      {message}
    </p>
  );
}
