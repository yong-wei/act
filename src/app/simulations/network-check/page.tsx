'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/platform/app-shell';
import { TYPE055_NANCHANG_101_V2 } from '@/resources/simulations/model-packages/type055-nanchang-101-v2';
import { initialShipArtifactUrls } from '@/resources/simulations/model-packages/types';

type BandwidthResult = {
  applicationMbps: number;
  modelMbps: number;
  combinedMbps: number;
  bytes: number;
  modelSource: string;
};
type ProbeRow = { ready: boolean; status: number; ms: number };
const SAMPLE_PATH = '/api/simulations/network/sample';

async function readDownload(url: string, range = false) {
  const response = await fetch(url, {
    cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(30000),
    ...(range ? { headers: { Range: 'bytes=0-2097151' } } : {}),
  });
  if (!response.ok) throw new Error('测试数据暂时无法读取。');
  const body = await response.arrayBuffer();
  const declaredBytes = Number(response.headers.get('content-length'));
  const bytes = declaredBytes > 0 ? declaredBytes : body.byteLength;
  if (!bytes) throw new Error('测试数据为空。');
  return { bytes, finishedAt: performance.now(), url };
}

async function readModelDownload() {
  const artifact = TYPE055_NANCHANG_101_V2.roles['ship-lod0']!;
  for (const url of initialShipArtifactUrls(artifact)) {
    try { return await readDownload(url, true); } catch { /* 顺序复用场景的公开资源候选。 */ }
  }
  throw new Error('船模资源暂时无法读取，请稍后重试。');
}

async function measureOnce(): Promise<BandwidthResult> {
  const started = performance.now();
  const [application, model] = await Promise.all([readDownload(SAMPLE_PATH), readModelDownload()]);
  const elapsedS = Math.max((performance.now() - started) / 1000, 0.001);
  const mbps = (bytes: number, finishedAt: number) => bytes * 8 / 1_000_000 / Math.max((finishedAt - started) / 1000, 0.001);
  return {
    applicationMbps: mbps(application.bytes, application.finishedAt),
    modelMbps: mbps(model.bytes, model.finishedAt),
    combinedMbps: (application.bytes + model.bytes) * 8 / 1_000_000 / elapsedS,
    bytes: application.bytes + model.bytes,
    modelSource: new URL(model.url, window.location.href).origin === window.location.origin ? '本站' : 'ESA',
  };
}

export default function NetworkCheckPage() {
  const [bandwidth, setBandwidth] = useState<BandwidthResult | null>(null);
  const [bandwidthNote, setBandwidthNote] = useState('尚未测试');
  const [probe, setProbe] = useState<ProbeRow[]>([]);
  const [dependenciesReady, setDependenciesReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  async function runBandwidth() {
    setBusy(true);
    setBandwidthNote('正在同时读取平台与船模资源…');
    try {
      await measureOnce();
      const samples = [await measureOnce(), await measureOnce(), await measureOnce()];
      samples.sort((a, b) => a.combinedMbps - b.combinedMbps);
      setBandwidth(samples[1]);
      setBandwidthNote(`显示三次有效取样的中位数，本次合计读取 ${samples[1].bytes} 字节，船模来源为${samples[1].modelSource}。综合值按同一时间窗的两路下载字节计算。`);
    } catch (error) {
      setBandwidth(null);
      setBandwidthNote(error instanceof Error ? error.message : '带宽测试没有完成。');
    } finally { setBusy(false); }
  }

  async function runProbe(total: number) {
    setBusy(true);
    setProbe([]);
    setDependenciesReady(null);
    try {
      const dependencies = fetch('/api/readyz', { cache: 'no-store', signal: AbortSignal.timeout(15000) })
        .then(async (response) => {
          const value = await response.json() as { app?: boolean; db?: boolean; redis?: boolean };
          return response.ok && Boolean(value.app && value.db && value.redis);
        }).catch(() => false);
      const rows = await Promise.all(Array.from({ length: total }, async () => {
        const started = performance.now();
        try {
          const response = await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
          const value = await response.json() as { status?: string };
          return { status: response.status, ready: response.ok && value.status === 'ok', ms: Math.round(performance.now() - started) };
        } catch { return { status: 0, ready: false, ms: Math.round(performance.now() - started) }; }
      }));
      setProbe(rows);
      setDependenciesReady(await dependencies);
    } finally { setBusy(false); }
  }

  const available = probe.filter((row) => row.ready).length;
  const slowest = Math.max(0, ...probe.map((row) => row.ms));
  const metrics = [
    { label: '平台下载', value: bandwidth?.applicationMbps },
    { label: '船模下载', value: bandwidth?.modelMbps },
    { label: '综合下载', value: bandwidth?.combinedMbps },
  ];

  return (
    <AppShell viewerRole="student" activeHref="/simulations" sidebarMode="collapsible"
      title="网络检查" subtitle="检查平台连接与船模资源读取"
      breadcrumbs={[{ label: '首页', href: '/' }, { label: '虚拟仿真', href: '/simulations' }, { label: '网络检查' }]}
    >
      <main className="mx-auto max-w-5xl space-y-5">
        <section className="surface-card rounded-lg p-5" data-network-bandwidth>
          <h2 className="text-xl font-semibold">平台与船模综合带宽</h2>
          <p className="mt-2 text-sm leading-6 text-subtle">
            平台负责登录和实验记录，船模通过公开资源通道读取。测试同时下载两路样本，帮助检查当前网络的实际读取速度。船舶运动由学生浏览器计算。
          </p>
          <button type="button" className="mt-4 h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60" onClick={() => { void runBandwidth(); }} disabled={busy}>
            测试当前连接
          </button>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {metrics.map((metric) => <div key={metric.label}>
              <p className="text-sm text-subtle">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold" {...(metric.label === '综合下载' ? { 'data-bandwidth-mbps': true } : {})}>
                {metric.value === undefined ? '—' : `${metric.value.toFixed(1)} Mbps`}
              </p>
            </div>)}
          </div>
          <p className="mt-3 text-sm leading-6" role="status">{bandwidthNote}</p>
        </section>
        <section className="surface-card rounded-lg p-5" data-network-concurrency>
          <h2 className="text-xl font-semibold">服务连接</h2>
          <p className="mt-2 text-sm leading-6 text-subtle">
            八路短请求检查应用连接，同时单次核验数据库、缓存与课程内容就绪状态。班级集中进入的安排需结合交付版本的持续负载实测。
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60" onClick={() => { void runProbe(1); }} disabled={busy}>
              检查当前连接
            </button>
            <button type="button" className="h-10 rounded-md border border-border px-4 text-sm disabled:opacity-60" onClick={() => { void runProbe(8); }} disabled={busy} data-run-concurrency>
              检查八路连接
            </button>
            <Link href="/simulations" className="inline-flex h-10 items-center text-sm text-primary">返回仿真目录</Link>
          </div>
          {probe.length ? <div className="mt-4 text-sm" data-concurrency-summary role="status">
            <p>{probe.length} 路连接中 {available} 路就绪，最慢 {slowest} ms。</p>
            {dependenciesReady !== null ? <p>{dependenciesReady ? '数据库、缓存与课程内容就绪。' : '依赖就绪检查未通过，请稍后重试。'}</p> : null}
            <ul className="mt-2 space-y-1">
              {probe.map((row, index) => <li key={index}>{index + 1}. {row.ready ? '服务就绪' : `暂时不可用（${row.status || '连接失败'}）`} · {row.ms} ms</li>)}
            </ul>
          </div> : null}
        </section>
      </main>
    </AppShell>
  );
}
