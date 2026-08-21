export function boundTextbookCoachPrompt(body: string, selectionHint: string | null, budget = 4000): string {
  if (!selectionHint) return body.slice(0, budget);
  const hintBlock = `选区提示：${selectionHint}`;
  const remaining = Math.max(0, budget - hintBlock.length - 1);
  const index = body.indexOf(selectionHint);
  let window = body;
  if (index >= 0 && body.length > remaining) {
    const start = Math.max(0, index - Math.floor(Math.max(remaining - selectionHint.length, 0) / 2));
    window = body.slice(start, start + remaining);
  } else {
    window = body.slice(0, remaining);
  }
  return `${window}\n${hintBlock}`.slice(0, budget);
}
