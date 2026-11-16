// @vitest-environment jsdom
import {act, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {gzipSync} from 'node:zlib';
import NetworkCheckPage from '../simulations/network-check/page';
import {GET, BANDWIDTH_SAMPLE_BYTES} from '../api/simulations/network/sample/route';

vi.mock('@/components/platform/app-shell', () => ({AppShell: ({children}: {children: ReactNode}) => <div>{children}</div>}));
vi.mock('@/resources/simulations/model-packages/types', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/resources/simulations/model-packages/types')>(),
  initialShipArtifactUrls: () => ['https://static.adapt-learn.online/test.glb', '/assets/test.glb'],
}));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();});

async function clickAndRead(label: string, expected: string) {
  await act(async () => root.render(<NetworkCheckPage />));
  const button = [...host.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
  expect(button).toBeTruthy();
  await act(async () => {
    button!.click();
    for (let attempt = 0; attempt < 10; attempt++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(host.textContent).toContain(expected);
}

describe('仿真网络检查的实际传输口径', () => {
  it('同时读取平台与船模，以编码长度汇总三次中位取样', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const model = String(input).includes('.glb');
      if (model) expect(new Headers(init?.headers).get('range')).toBe('bytes=0-2097151');
      return new Response(new Uint8Array(1000), {status: model ? 206 : 200,
        headers: {'content-length': model ? '300' : '200'}});
    });
    vi.stubGlobal('fetch', fetch);
    await clickAndRead('测试当前连接', '本次合计读取 500 字节，船模来源为ESA');
    expect(fetch).toHaveBeenCalledTimes(8);
    expect(host.textContent).toContain('综合下载');
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/api/simulations/network/sample'))).toHaveLength(4);
  });

  it('ESA不可达时采用既有本站候选并显示实际来源', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('https://static.')) throw new TypeError('connection unavailable');
      return new Response(new Uint8Array(250), {headers: {'content-length': '250'}});
    });
    vi.stubGlobal('fetch', fetch);
    await clickAndRead('测试当前连接', '本次合计读取 500 字节，船模来源为本站');
    expect(fetch).toHaveBeenCalledTimes(12);
  });

  it('八路抽查直接核验服务状态并显示失败数量', async () => {
    let calls = 0;
    const fetch = vi.fn(async (_input: RequestInfo | URL) => {
      calls++;
      return Response.json({app: calls > 2, db: true, redis: true});
    });
    vi.stubGlobal('fetch', fetch);
    await clickAndRead('检查八路连接', '8 路连接中 6 路就绪');
    expect(fetch).toHaveBeenCalledTimes(8);
    expect(fetch.mock.calls.every((call) => call[0] === '/api/readyz')).toBe(true);
  });

  it('带宽样本保留真实体积并要求传输层保留原始表示', async () => {
    const response = GET();
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.length).toBe(BANDWIDTH_SAMPLE_BYTES);
    expect(response.headers.get('content-length')).toBe(String(bytes.length));
    expect(response.headers.get('cache-control')).toBe('no-store, no-transform');
    expect(gzipSync(bytes).length).toBeGreaterThan(bytes.length * .9);
  });
});
