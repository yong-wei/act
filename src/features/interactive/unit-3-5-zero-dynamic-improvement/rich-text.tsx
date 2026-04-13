'use client';

import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

export function getUNIT_3_5PlainText(text: string) {
  return text.replace(/\$/g, '');
}

export function UNIT_3_5InlineRichText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <span className={className}>{children}</span>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
