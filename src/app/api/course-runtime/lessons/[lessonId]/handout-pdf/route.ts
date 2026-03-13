import { NextResponse } from 'next/server';

import { generateLessonHandoutPdf } from '@/lib/handout-pdf-export';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { lessonId: string } },
) {
  try {
    const origin = new URL(request.url).origin;
    const { pdf, lessonTitle } = await generateLessonHandoutPdf({
      origin,
      lessonId: params.lessonId,
    });
    const asciiFilename = `${params.lessonId}-handout.pdf`;
    const utf8Filename = encodeURIComponent(`${lessonTitle}-讲义.pdf`);

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.byteLength),
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Failed to export lesson handout pdf:', error);
    return NextResponse.json(
      { error: '讲义 PDF 导出失败，请稍后重试。' },
      { status: 500 },
    );
  }
}
