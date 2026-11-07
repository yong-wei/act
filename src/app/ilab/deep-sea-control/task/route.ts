import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 旧 24 步综合实验资料页已退役（#2155）：恒定返回 410 退役说明。
 */
export async function GET() {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>旧综合实验资料页已退役</title></head>
<body style="font-family:system-ui;max-width:36rem;margin:4rem auto;padding:0 1rem;line-height:1.7">
<h1>旧综合实验资料页已退役（410）</h1>
<p>原「深海载体运动控制」24 步综合实验已于 2026 年 11 月退役，由七个独立船舶实验取代。</p>
<p><a href="/simulations">前往七个独立实验</a> · <a href="/ilab/deep-sea-control">退役说明</a></p>
</body></html>`,
    { status: 410, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}
