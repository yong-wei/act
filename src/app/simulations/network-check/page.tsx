'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/platform/app-shell';
import { SIMULATION_ONLINE_CAPACITY } from '@/lib/simulation-admission';

type Decision = {
  status: 'admitted' | 'queued';
  capacity: number;
  online: number;
  waiting: number;
  position: number | null;
  suggestedWaitMinutes: number | null;
  message: string;
};

type ProbeRow = Decision & { ms: number };

const SAMPLE_PATH = '/api/simulations/network/sample';
const ADMISSION_PATH = '/api/simulations/network/admission';

function clientId(prefix: string, index?: number) {
  return `${prefix}-${index ?? 'self'}-${Math.random().toString(36).slice(2, 8)}`;
}

async function measureOnce(): Promise<{ bytes: number; mbps: number }> {
  const started = performance.now();
  const response = await fetch(SAMPLE_PATH, { cache: 'no-store' });
  if (!response.ok) throw new Error('带宽样本没有返回');
  const buffer = await response.arrayBuffer();
  const seconds = Math.max((performance.now() - started) / 1000, 0.001);
  return { bytes: buffer.byteLength, mbps: (buffer.byteLength * 8) / 1_000_000 / seconds };
}

export default function NetworkCheckPage() {
  const [bandwidth, setBandwidth] = useState<string>('');
  const [bandwidthNote, setBandwidthNote] = useState('尚未测试');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [probe, setProbe] = useState<ProbeRow[]>([]);
  const [busy, setBusy] = useState(false);

  async function runBandwidth() {
    setBusy(true);
    setBandwidthNote('正在向当前服务器拉取测试数据…');
    try {
      await measureOnce();
      const samples = [await measureOnce(), await measureOnce(), await measureOnce()];
      const ordered = samples.map((item) => item.mbps).sort((a, b) => a - b);
      const mbps = ordered[1];
      setBandwidth(mbps.toFixed(1));
      setBandwidthNote(`三次有效取样的中位数 ${mbps.toFixed(1)} Mbps，单次样本 ${samples[0].bytes} 字节。船舶运动在浏览器本地计算，这次测量的是页面、记录和模型读取所用的连接。`);
    } catch (error) {
      setBandwidth('');
      setBandwidthNote(error instanceof Error ? error.message : '带宽测试没有完成');
    } finally {
      setBusy(false);
    }
  }

  async function requestEntry() {
    setBusy(true);
    try {
      const response = await fetch(ADMISSION_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientId: clientId('student') }),
      });
      setDecision(await response.json() as Decision);
    } finally {
      setBusy(false);
    }
  }

  async function runProbe() {
    setBusy(true);
    setProbe([]);
    try {
      const started = performance.now();
      const total = SIMULATION_ONLINE_CAPACITY + 8;
      const rows = await Promise.all(Array.from({ length: total }, async (_item, index) => {
        const t0 = performance.now();
        const response = await fetch(ADMISSION_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ clientId: clientId('probe', index) }),
        });
        const body = await response.json() as Decision;
        return { ...body, ms: Math.round(performance.now() - t0) };
      }));
      rows.sort((a, b) => a.ms - b.ms);
      setProbe(rows);
      const queued = rows.find((row) => row.status === 'queued') ?? null;
      setDecision(queued);
      setBandwidthNote((current) => current || `并发抽查用时 ${Math.round(performance.now() - started)} ms。`);
    } finally {
      setBusy(false);
    }
  }

  const admitted = probe.filter((row) => row.status === 'admitted').length;
  const queued = probe.filter((row) => row.status === 'queued').length;
  const slowest = probe.length ? probe[probe.length - 1].ms : 0;

  return (
    <AppShell
      viewerRole="student"
      activeHref="/simulations"
      sidebarMode="collapsible"
      title="网络与在线名额"
      subtitle="进入仿真实验前的带宽测试和排队提示"
      breadcrumbs={[
        { label: '首页', href: '/' },
        { label: '虚拟仿真', href: '/simulations' },
        { label: '网络检查' },
      ]}
    >
      <main className="mx-auto max-w-5xl space-y-5">
        <section className="surface-card rounded-lg p-5" data-network-bandwidth>
          <h2 className="text-xl font-semibold">客户端到服务器带宽</h2>
          <p className="mt-2 text-sm leading-6 text-subtle">
            三种船舶场景和船体运动都在学生浏览器本地计算，不把连续画面送到服务器渲染。服务器主要处理登录、学习记录和模型读取。请使用稳定的校园网或宽带，进入实验前确认这里的测试能够完成。
          </p>
          <button type="button" className="mt-4 h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60" onClick={() => { void runBandwidth(); }} disabled={busy}>
            测试当前连接
          </button>
          <p className="mt-4 text-3xl font-semibold" data-bandwidth-mbps>{bandwidth ? `${bandwidth} Mbps` : '—'}</p>
          <p className="mt-2 text-sm leading-6">{bandwidthNote}</p>
        </section>

        <section className="surface-card rounded-lg p-5" data-network-concurrency>
          <h2 className="text-xl font-semibold">同时在线与排队</h2>
          <p className="mt-2 text-sm leading-6 text-subtle">
            同时在线名额按 {SIMULATION_ONLINE_CAPACITY} 人控制。名额用完后不再直接进入，页面给出排队位置，并建议按班级分批、错开集中打开的时间。
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60" onClick={() => { void requestEntry(); }} disabled={busy}>
              检查我的名额
            </button>
            <button type="button" className="h-10 rounded-md border border-border px-4 text-sm disabled:opacity-60" onClick={() => { void runProbe(); }} disabled={busy} data-run-concurrency>
              做一次并发抽查
            </button>
            <Link href="/simulations" className="inline-flex h-10 items-center text-sm text-primary">返回仿真目录</Link>
          </div>
          {decision ? (
            <div className={`mt-4 rounded-md border p-4 text-sm leading-6 ${decision.status === 'queued' ? 'border-amber-400/70' : 'border-border'}`} data-admission-status={decision.status}>
              <p className="font-medium">{decision.status === 'queued' ? '在线排队' : '可以进入'}</p>
              <p className="mt-1">{decision.message}</p>
              {decision.status === 'queued' ? <p className="mt-2">错峰建议：同一班级不要在同一分钟全部点击进入，可按小组间隔进入。</p> : null}
            </div>
          ) : null}
          {probe.length ? (
            <div className="mt-4 text-sm" data-concurrency-summary>
              <p>并发抽查 {probe.length} 路：获得名额 {admitted}，进入排队 {queued}，最慢 {slowest} ms。</p>
              <ul className="mt-2 max-h-64 space-y-1 overflow-auto">
                {[...probe.filter((row) => row.status === 'admitted').slice(0, 6), ...probe.filter((row) => row.status === 'queued')].map((row, index) => (
                  <li key={`${row.status}-${index}`}>{index + 1}. {row.status === 'admitted' ? '获得名额' : `排队第 ${row.position} 位`} · {row.ms} ms</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </main>
    </AppShell>
  );
}
