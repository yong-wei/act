import { NextResponse } from 'next/server';

import { recognizeSketch } from '@/features/ilab/sketch-recognition';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let image = '';
  try {
    const body = await request.json() as { image?: unknown };
    image = typeof body.image === 'string' ? body.image : '';
  } catch {
    return NextResponse.json({ error: '手绘图无法识别，请重画一张较小的图。' }, { status: 400 });
  }
  const recognition = await recognizeSketch({ image });
  if (!recognition.ok) return NextResponse.json({ error: recognition.message }, { status: 422 });
  return NextResponse.json(recognition.fields);
}
