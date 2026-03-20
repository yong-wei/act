'use client';

import { buildLessonHandoutPdfApiPath } from '@/lib/handout-pdf';

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
}: {
  lessonId: string;
  lessonTitle: string;
}) {
  const response = await fetch(buildLessonHandoutPdfApiPath(lessonId));
  if (!response.ok) {
    let message = '讲义 PDF 导出失败，请稍后重试。';

    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) {
        message = data.error;
      }
    } catch {
      // Ignore JSON parse errors and keep the fallback message.
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = extractDownloadFilename(
    response.headers.get('content-disposition'),
    `${lessonTitle}-讲义.pdf`,
  );
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(downloadUrl);
}
