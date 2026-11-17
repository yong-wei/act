import { gzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../api/ilab/experiment-runs/[runRef]/chunks/route';
import { getServerAuthSession } from '@/lib/auth';
import { appendVesselEvidenceChunk, stageVesselEvidenceBytes } from '@/features/ilab/course-evidence-chunks';
import { EvidenceCpuError } from '@/lib/control-engine/evidence-cpu-pool';

vi.mock('@/lib/auth', () => ({ getServerAuthSession: vi.fn() }));
vi.mock('@/features/ilab/course-evidence-chunks', () => ({
  appendVesselEvidenceChunk: vi.fn(), stageVesselEvidenceBytes: vi.fn(),
}));

const runRef = '00000000-0000-4000-8000-000000000001';
const context = { params: Promise.resolve({ runRef }) };
const chunk = { schema: 'act.vessel-trace-chunk.v1', runRef, chunkIndex: 0,
  controlStart: 0, nativeStart: 0, parameterHash: 'parameters', endTimeS: 5,
  points: [], nativeSamples: [], changes: [] };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getServerAuthSession).mockResolvedValue({ user: { id: 'owner', role: 'STUDENT' } } as never);
});

describe('保存分块正常HTTP入口', () => {
  it('鉴权和预览限制先于读取正文与计算', async () => {
    vi.mocked(getServerAuthSession).mockResolvedValue(null);
    const unauthorized = await POST(new Request('http://localhost/chunks?stage=1', { method: 'POST', body: '{' }), context);
    expect(unauthorized.status).toBe(401);
    vi.mocked(getServerAuthSession).mockResolvedValue({ user: { id: 'owner' } } as never);
    const preview = await POST(new Request('http://localhost/chunks?stage=1', {
      method: 'POST', headers: { 'x-act-preview': '1' }, body: '{',
    }), context);
    expect(preview.status).toBe(403);
    expect(stageVesselEvidenceBytes).not.toHaveBeenCalled();
    expect(appendVesselEvidenceChunk).not.toHaveBeenCalled();
  });

  it('压缩正文以同一原始字节交给合并计算入口', async () => {
    const text = JSON.stringify(chunk);
    vi.mocked(stageVesselEvidenceBytes).mockResolvedValue({ reference: 'private-reference' });
    const response = await POST(new Request('http://localhost/chunks?stage=1', {
      method: 'POST', headers: { 'content-encoding': 'gzip' }, body: gzipSync(text),
    }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reference: 'private-reference' });
    const [owner, address, bytes] = vi.mocked(stageVesselEvidenceBytes).mock.calls[0];
    expect([owner, address, Buffer.from(bytes).toString()]).toEqual(['owner', runRef, text]);
    expect(appendVesselEvidenceChunk).not.toHaveBeenCalled();
  });

  it('原有直接追加入口继续校验正文与地址', async () => {
    vi.mocked(appendVesselEvidenceChunk).mockResolvedValue({ status: 'running' } as never);
    const response = await POST(new Request('http://localhost/chunks', { method: 'POST', body: JSON.stringify(chunk) }), context);
    expect(response.status).toBe(200);
    expect(appendVesselEvidenceChunk).toHaveBeenCalledWith('owner', chunk);
    const mismatch = await POST(new Request('http://localhost/chunks', {
      method: 'POST', body: JSON.stringify({ ...chunk, runRef: '00000000-0000-4000-8000-000000000002' }),
    }), context);
    expect(mismatch.status).toBe(400);
    expect(stageVesselEvidenceBytes).not.toHaveBeenCalled();
  });

  it('队列繁忙作为可重试503反馈给正常调用者', async () => {
    vi.mocked(stageVesselEvidenceBytes).mockRejectedValue(new EvidenceCpuError('保存服务暂时繁忙，请稍后重试。', 503));
    const response = await POST(new Request('http://localhost/chunks?stage=1', { method: 'POST', body: JSON.stringify(chunk) }), context);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: '保存服务暂时繁忙，请稍后重试。' });
  });
});
