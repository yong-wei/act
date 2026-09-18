const LATEX_COMMAND = /\\[a-zA-Z]+/;
const LATEX_RUN = /\\[a-zA-Z]+(?:\s*\{[^{}]*\})+(?:\s*[_^](?:\{[^{}]*\}|[A-Za-z0-9]+))?|\\[a-zA-Z]+|_\{[^}]+\}|\^\{[^}]+\}/g;

export function toLearnerMathMarkdown(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (trimmed.includes('$')) return trimmed;
  if (looksLikeStandaloneLatex(trimmed)) return `$${trimmed}$`;
  if (!LATEX_COMMAND.test(trimmed) && !/_\{/.test(trimmed) && !/\^\{/.test(trimmed)) return trimmed;
  return trimmed.replace(LATEX_RUN, (run) => `$${run}$`);
}

function looksLikeStandaloneLatex(text: string): boolean {
  return LATEX_COMMAND.test(text) && !/[\u4e00-\u9fff]/u.test(text);
}
