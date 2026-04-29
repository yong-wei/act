export function formatLessonStepMenuLabel(index: number, total: number, title: string) {
  const width = Math.max(2, String(total).length);
  const pageNumber = String(index + 1).padStart(width, '0');
  return `第 ${pageNumber} 页 · ${title}`;
}
