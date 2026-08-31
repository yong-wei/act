'use client';

import { buildLessonHandoutPdfApiPath, buildLessonHandoutPdfAssetPath } from '@/lib/handout-pdf';

function extractDownloadFilename(headerValue: string | null, fallback: string) {
  if (!headerValue) return fallback;

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = headerValue.match(/filename="([^"]+)"/i);
  return asciiMatch?.[1] ?? fallback;
}

export async function downloadLessonHandoutPdf({
  lessonId,
  lessonTitle,
  handoutPdfPath,
}: {
  lessonId: string;
  lessonTitle: string;
  handoutPdfPath?: string | null;
}) {
  const response = await fetch(handoutPdfPath ?? buildLessonHandoutPdfAssetPath(lessonId));
  // A session-bound pinned blob is the captured bytes by address: when it is
  // unavailable, failing closed beats silently regenerating the PDF from the
  // current (possibly different) runtime release via the unbound API fallback.
  const isPinnedBlobPath = handoutPdfPath?.startsWith('/api/course-runtime/blob-assets/') ?? false;
  const finalResponse = !response.ok && !isPinnedBlobPath
    ? await fetch(buildLessonHandoutPdfApiPath(lessonId))
    : response;
  if (!finalResponse.ok) {
    let message = '讲义 PDF 导出失败，请稍后重试。';

    try {
      const data = (await finalResponse.json()) as { error?: string };
      if (data.error) {
        message = data.error;
      }
    } catch {
      // Ignore JSON parse errors and keep the fallback message.
    }

    throw new Error(message);
  }

  const blob = await finalResponse.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = extractDownloadFilename(
    finalResponse.headers.get('content-disposition'),
    `${lessonTitle}-讲义.pdf`,
  );
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(downloadUrl);
}
