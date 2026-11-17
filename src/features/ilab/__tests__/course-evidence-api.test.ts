import { gunzipSync, gzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readVesselEvidenceJson, requireVesselEvidenceAccount, vesselEvidenceJsonResponse, vesselEvidenceErrorResponse } from '../course-evidence-api';
import { EvidenceCpuError } from '@/lib/control-engine/evidence-cpu-pool';
import { getServerAuthSession } from '@/lib/auth';

vi.mock('@/lib/auth',()=>({getServerAuthSession:vi.fn()}));
beforeEach(()=>vi.clearAllMocks());

describe('实验原始证据入口',()=>{
  it('计算服务繁忙与校验错误保留可恢复状态，未知内部错误继续隐藏',async()=>{
    const busy = vesselEvidenceErrorResponse(new EvidenceCpuError('保存服务暂时繁忙，请稍后重试。',503));
    expect(busy.status).toBe(503);
    expect(await busy.json()).toEqual({error:'保存服务暂时繁忙，请稍后重试。'});
    expect(vesselEvidenceErrorResponse(new EvidenceCpuError('正文无效',400)).status).toBe(400);
    const unknown = vesselEvidenceErrorResponse(new Error('internal secret'));
    expect(unknown.status).toBe(500);
    expect(JSON.stringify(await unknown.json())).not.toContain('internal secret');
  });
  it('普通本人会话可保存，显式预览拒绝写入',async()=>{
    vi.mocked(getServerAuthSession).mockResolvedValue({user:{id:'test-owner',role:'TEACHER'}} as Awaited<ReturnType<typeof getServerAuthSession>>);
    expect(await requireVesselEvidenceAccount(new Request('http://localhost'))).toBe('test-owner');
    await expect(requireVesselEvidenceAccount(new Request('http://localhost',{headers:{'x-act-preview':'1'}}))).rejects.toMatchObject({status:403});
    vi.mocked(getServerAuthSession).mockResolvedValue(null);
    await expect(requireVesselEvidenceAccount(new Request('http://localhost'))).rejects.toMatchObject({status:401});
  });
  it('核验失败响应保留已保存进度和准确的独立状态', async () => {
    const error = Object.assign(new EvidenceCpuError('恢复点尚未通过核验。', 400), {
      savedProgress: { runRef: 'own-run', saveStatus: 'saved', evidenceStatus: 'failed', lastTimeS: 5 },
    });
    const response = vesselEvidenceErrorResponse(error);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ savedProgress: {
      runRef: 'own-run', saveStatus: 'saved', evidenceStatus: 'failed', lastTimeS: 5,
    } });
  });
  it('普通及gzip请求使用相同的有界JSON读取',async()=>{
    const data = {schema:'test',values:[1,null,3]};
    expect(await readVesselEvidenceJson(new Request('http://localhost',{method:'POST',body:JSON.stringify(data)}))).toEqual(data);
    expect(await readVesselEvidenceJson(new Request('http://localhost',{method:'POST',headers:{'content-encoding':'gzip'},body:gzipSync(JSON.stringify(data))}))).toEqual(data);
  });
  it('压缩后很小的超长正文也返回413',async()=>{
    const request = new Request('http://localhost',{method:'POST',headers:{'content-encoding':'gzip'},body:gzipSync(JSON.stringify({value:'x'.repeat(4*1024*1024)}))});
    await expect(readVesselEvidenceJson(request)).rejects.toMatchObject({status:413});
    await expect(readVesselEvidenceJson(new Request('http://localhost',{method:'POST',body:'{'}))).rejects.toMatchObject({status:400});
  });
  it('大恢复点按客户端接受的gzip发送，解压后内容及私有缓存合同一致',async()=>{
    const data = {checkpoint: '本人完整恢复点'.repeat(20000), samples: [1, null, 3]};
    const response = await vesselEvidenceJsonResponse(new Request('http://localhost', {
      headers: {'accept-encoding': 'br, gzip; q=0.8'},
    }), data);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Accept-Encoding');
    expect(response.headers.get('content-length')).toBe(String(bytes.length));
    expect(bytes.length).toBeLessThan(JSON.stringify(data).length / 10);
    expect(JSON.parse(gunzipSync(bytes).toString())).toEqual(data);
  });
  it.each(['', 'identity', 'gzip;q=0, *;q=1', 'gzip;q=invalid'])('编码声明%s保留普通JSON兼容',async(encoding)=>{
    const data = {checkpoint: '保存内容'.repeat(1000)};
    const response = await vesselEvidenceJsonResponse(new Request('http://localhost', {headers: {'accept-encoding': encoding}}), data);
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(await response.json()).toEqual(data);
  });
  it('通配编码可压缩大正文，小回复继续直接读取',async()=>{
    const request = new Request('http://localhost', {headers: {'accept-encoding': '*;q=0.5'}});
    expect((await vesselEvidenceJsonResponse(request, {checkpoint:'data'.repeat(1000)})).headers.get('content-encoding')).toBe('gzip');
    const small = await vesselEvidenceJsonResponse(request, {authenticated:false});
    expect(small.headers.get('content-encoding')).toBeNull();
    expect(await small.json()).toEqual({authenticated:false});
  });
});
