export function withLessonArtifactPrefix(lessonId: string, filename: string) {
  const prefix = `${lessonId}-`;
  return filename.startsWith(prefix) ? filename : `${prefix}${filename}`;
}

export function buildLessonHandoutMarkdownFilename(lessonId: string) {
  return withLessonArtifactPrefix(lessonId, 'handout.md');
}

export function buildLessonHandoutPdfFilename(lessonId: string) {
  return withLessonArtifactPrefix(lessonId, 'handout.pdf');
}

export function isLessonHandoutMarkdownFilename(filename: string) {
  return filename === 'handout.md'
    || (!filename.endsWith('teacher-handout.md') && /^[A-Za-z0-9][A-Za-z0-9-]*-handout\.md$/.test(filename));
}
