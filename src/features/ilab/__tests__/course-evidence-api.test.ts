import { gzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readVesselEvidenceJson, requireVesselEvidenceAccount } from '../course-evidence-api';
import { getServerAuthSession } from '@/lib/auth';

vi.mock('@/lib/auth',()=>({getServerAuthSession:vi.fn()}));
beforeEach(()=>vi.clearAllMocks());

describe('实验原始证据入口',()=>{
  it('普通本人会话可保存，显式预览拒绝写入',async()=>{
    vi.mocked(getServerAuthSession).mockResolvedValue({user:{id:'test-owner',role:'TEACHER'}} as Awaited<ReturnType<typeof getServerAuthSession>>);
    expect(await requireVesselEvidenceAccount(new Request('http://localhost'))).toBe('test-owner');
    await expect(requireVesselEvidenceAccount(new Request('http://localhost',{headers:{'x-act-preview':'1'}}))).rejects.toMatchObject({status:403});
    vi.mocked(getServerAuthSession).mockResolvedValue(null);
    await expect(requireVesselEvidenceAccount(new Request('http://localhost'))).rejects.toMatchObject({status:401});
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
});
