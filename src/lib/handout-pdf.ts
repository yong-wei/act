function trimTrailingSlash(value: string | undefined) {
  return (value ?? '').replace(/\/+$/, '');
}

export function buildLessonHandoutPrintPath(lessonId: string) {
  return `/interactive-learning/lessons/${lessonId}/handout-print`;
}

export function buildLessonHandoutPrintUrl({
  origin,
  lessonId,
}: {
  origin?: string;
  lessonId: string;
}) {
  return `${trimTrailingSlash(origin)}${buildLessonHandoutPrintPath(lessonId)}`;
}

export function buildLessonHandoutPdfApiPath(lessonId: string) {
  return `/api/course-runtime/lessons/${lessonId}/handout-pdf`;
}

export function resolveHandoutAssetUrl(
  source: string,
  {
    origin,
    lessonId,
  }: {
    origin?: string;
    lessonId: string;
  },
) {
  if (!source) return source;
  if (/^(?:[a-z]+:)?\/\//i.test(source) || source.startsWith('data:') || source.startsWith('blob:')) {
    return source;
  }

  const normalizedOrigin = trimTrailingSlash(origin);
  if (source.startsWith('/')) {
    return `${normalizedOrigin}${source}`;
  }

  const normalizedSource = source.replace(/^\.?\//, '');
  return `${normalizedOrigin}/course-runtime/lessons/${lessonId}/${normalizedSource}`;
}
