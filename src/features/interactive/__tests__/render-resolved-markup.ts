import type { ReactNode } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';

export async function renderResolvedMarkup(node: ReactNode) {
  const { prelude } = await prerenderToNodeStream(node);
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
