import { NextResponse } from 'next/server';

import { extractDirectAudioSourceFromPreviewHtml } from '@/lib/runtime-media';

export const dynamic = 'force-dynamic';

const ALLOWED_AUDIO_PREVIEW_HOSTS = ['cldisk.com', 'chaoxing.com'];

function isAllowedPreviewUrl(url: URL) {
  return ALLOWED_AUDIO_PREVIEW_HOSTS.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const previewUrl = searchParams.get('previewUrl');

  if (!previewUrl) {
    return NextResponse.json({ error: '缺少预览链接。' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(previewUrl);
  } catch {
    return NextResponse.json({ error: '预览链接无效。' }, { status: 400 });
  }

  if (!isAllowedPreviewUrl(parsedUrl)) {
    return NextResponse.json({ error: '当前链接不在允许范围内。' }, { status: 400 });
  }

  try {
    const response = await fetch(parsedUrl, {
      cache: 'no-store',
      headers: {
        accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: '预览页读取失败。' }, { status: 502 });
    }

    const html = await response.text();
    const sourceUrl = extractDirectAudioSourceFromPreviewHtml(html);
    if (!sourceUrl) {
      return NextResponse.json({ error: '未解析到音频源。' }, { status: 422 });
    }

    return NextResponse.json({ sourceUrl });
  } catch {
    return NextResponse.json({ error: '解析音频源失败。' }, { status: 500 });
  }
}
