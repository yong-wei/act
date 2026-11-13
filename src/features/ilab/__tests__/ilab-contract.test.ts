import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { buildAiData, emptyAiLedger, recordAiCall } from '@/features/ilab/ai-data';
import { stripIlabUrlParams } from '@/features/ilab/client-grant';
import {
  readIlabGrantFromRequest,
  sealIlabGrant,
  toPublicGrantView,
  unsealIlabGrant,
  type IlabGrantPayload,
} from '@/features/ilab/grant-cookie';
import {
  decodeIlabTicket,
  ilabRefreshSignature,
  ilabRefreshUrl,
  ilabSignature,
  ilabTokenUrl,
  refreshIlabAccessToken,
} from '@/features/ilab/ilab-client';
import {
  ILAB_PROJECT_TITLE,
  buildIlabUploadBody,
  IlabPayloadError,
  type StoredIlabStep,
} from '@/features/ilab/payload';
import { assertIlabRunOpen, IlabServiceError } from '@/features/ilab/run-lock';
import { buildSafeStepWindow } from '@/features/ilab/session-shared';

describe('ilab experiment contract', () => {
  it('builds a timed upload body and ai_data without extra fields', () => {
    const steps: StoredIlabStep[] = Array.from({ length: 12 }, (_, index) => ({
      seq: index + 1,
      title: `样本步骤 ${index + 1}`,
      startTime: 1_700_000_000_000 + index * 2_000,
      endTime: 1_700_000_000_000 + index * 2_000 + 1_000,
      timeUsed: 1,
      expectTime: 120,
      earnedPoints: 5,
      maxPoints: 5,
      repeatCount: 1,
      evaluation: '达到步骤要求。',
      scoringModel: 'sample-model',
      remarks: '契约样本。',
    }));
    const ledger = recordAiCall(emptyAiLedger(), {
      scenario: '方案校核',
      model: 'Qwen/Qwen3.5-35B-A3B',
      provider: 'SiliconFlow',
      deployment: '公有云服务',
      inputTokens: 12,
      outputTokens: 8,
      usageMissing: false,
    });
    const body = buildIlabUploadBody({
      username: 'student',
      appId: '10000',
      originId: 'dsc_test_record',
      childProjectTitle: '055型驱逐舰',
      status: 1,
      steps,
      ledger,
    });

    // 12 步样本各得 5 分：60/106 换算百分制为 57。
    expect(body.score).toBe(57);
    expect(body.steps).toHaveLength(12);
    expect(body.timeUsed).toBe((body.endTime - body.startTime) / 1000);
    for (const step of body.steps) {
      expect(step.endTime - step.startTime).toBe(step.timeUsed * 1000);
      expect(step.maxScore).toBe(100);
    }
    expect(body.ai_data).toEqual({
      ai_call_count: 1,
      ai_models_used: [{
        model: 'Qwen/Qwen3.5-35B-A3B',
        version: 'Qwen/Qwen3.5-35B-A3B',
        deployment: '公有云服务',
        provider: 'SiliconFlow',
      }],
      ai_usage_scenarios: ['方案校核'],
      ai_input_token_count: 12,
      ai_output_token_count: 8,
      ai_remark: 'token 用量来自模型服务商响应，没有估算。版本号使用模型标识，服务商未另给版本号。',
    });
    expect(Object.keys(body.ai_data)).toEqual([
      'ai_call_count',
      'ai_models_used',
      'ai_usage_scenarios',
      'ai_input_token_count',
      'ai_output_token_count',
      'ai_remark',
    ]);

    expect(() => buildIlabUploadBody({
      username: 'student',
      appId: '10000',
      originId: 'dsc_test_record',
      childProjectTitle: '055型驱逐舰',
      status: 1,
      steps: steps.slice(0, 9),
      ledger: emptyAiLedger(),
    })).toThrow(IlabPayloadError);
  });

  it('signs the decoded ticket and keeps the secret out of the request URL', () => {
    const secret = 'secret';
    expect(ilabSignature('ticket', '10000', secret)).toBe(
      createHash('md5').update('ticket10000secret', 'utf8').digest('hex').toUpperCase(),
    );
    expect(ilabSignature('ticket', '10000', secret)).toBe('32CFA3E103343FDBA86604F4060F5901');
    const url = ilabTokenUrl('http://39.105.173.29', 'a+b%2Fc', '10000', secret);
    expect(url).not.toContain(secret);
    expect(url).toContain('ticket=');
    expect(url.startsWith('http://39.105.173.29/open/api/v2/token?')).toBe(true);
  });

  it('does not invent token counts when no call was made', () => {
    expect(buildAiData(emptyAiLedger())).toMatchObject({
      ai_call_count: 0,
      ai_models_used: [],
      ai_usage_scenarios: [],
      ai_input_token_count: 0,
      ai_output_token_count: 0,
    });
  });

  it('freezes steps after the score upload even while the report is still pending', () => {
    expect(() => assertIlabRunOpen({ status: 2, uploadStatus: 'pending' })).not.toThrow();
    expect(() => assertIlabRunOpen({ status: 2, uploadStatus: 'failed' })).not.toThrow();
    expect(() => assertIlabRunOpen({ status: 2, uploadStatus: 'score-uploaded' })).toThrow(IlabServiceError);
    try {
      assertIlabRunOpen({ status: 2, uploadStatus: 'score-uploaded' });
    } catch (error) {
      expect(error).toBeInstanceOf(IlabServiceError);
      expect((error as IlabServiceError).status).toBe(409);
      expect((error as IlabServiceError).retryReport).toBe(true);
    }
    try {
      assertIlabRunOpen({ status: 1, uploadStatus: 'uploaded' });
    } catch (error) {
      expect((error as IlabServiceError).retryReport).toBe(false);
    }
  });

  const originalSecret = process.env.ILAB_SECRET;
  const originalBypass = process.env.ILAB_DEV_BYPASS;
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.ILAB_SECRET;
    else process.env.ILAB_SECRET = originalSecret;
    if (originalBypass === undefined) delete process.env.ILAB_DEV_BYPASS;
    else process.env.ILAB_DEV_BYPASS = originalBypass;
  });

  it('decodes ticket once and keeps refresh signature/URL free of secrets', async () => {
    const secret = 'test-ilab-secret';
    const rawTicket = 'ab+cd/ef=12';
    const encodedTicket = 'ab%2Bcd%2Fef%3D12';
    expect(decodeIlabTicket(rawTicket)).toBe(rawTicket);
    expect(decodeIlabTicket(encodedTicket)).toBe(rawTicket);
    expect(ilabSignature(encodedTicket, '110382', secret)).toBe(
      ilabSignature(rawTicket, '110382', secret),
    );
    // Double-encoded literals only decode a single layer so valid % characters are preserved.
    expect(decodeIlabTicket('a%252Bb')).toBe('a%2Bb');

    const refreshSig = ilabRefreshSignature('tok+1/2=3', '110382', secret);
    expect(refreshSig).toBe(
      createHash('md5').update('tok+1/2=3110382test-ilab-secret', 'utf8').digest('hex').toUpperCase(),
    );
    const refreshUrl = ilabRefreshUrl('https://www.ilab-x.com/', 'tok%2B1%2F2%3D3', '110382', secret);
    expect(refreshUrl).toContain('/open/api/v2/token/refresh?');
    expect(refreshUrl).toContain('access_token=tok%2B1%2F2%3D3');
    expect(refreshUrl).toContain('appid=110382');
    expect(refreshUrl).toContain(`signature=${refreshSig}`);
    expect(refreshUrl).not.toContain(secret);

    const refreshed = await refreshIlabAccessToken({
      accessToken: 'old_token',
      appId: '110382',
      secret,
      baseUrl: 'https://www.ilab-x.com',
      devBypass: false,
      fetcher: async () => new Response(JSON.stringify({
        code: 0,
        access_token: 'new_token',
        un: 'stu01',
        dis: '张三',
        expires_time: 1_900_000_000_000,
      }), { status: 200 }),
    });
    expect(refreshed).toEqual({
      accessToken: 'new_token',
      username: 'stu01',
      displayName: '张三',
      expiresAtMs: 1_900_000_000_000,
      bypass: false,
    });

    await expect(refreshIlabAccessToken({
      accessToken: 'old_token',
      appId: '110382',
      secret,
      baseUrl: 'https://www.ilab-x.com',
      devBypass: false,
      fetcher: async () => new Response(JSON.stringify({ code: 3, msg: '失效' }), { status: 200 }),
    })).rejects.toThrow('失效');
  });

  it('seals, verifies, expires, and strips sensitive fields from the iLab grant cookie', () => {
    process.env.ILAB_SECRET = 'contract-test-cookie-secret-value';
    process.env.ILAB_DEV_BYPASS = '0';
    const issuedAtMs = 1_750_000_000_000;
    const payload: IlabGrantPayload = {
      v: 1,
      appId: '110382',
      username: '2026001',
      displayName: '李四',
      accessToken: 'super-secret-access-token',
      issuedAtMs,
      expiresAtMs: issuedAtMs + 7_200_000,
      bypass: false,
    };

    const sealed = sealIlabGrant(payload);
    expect(unsealIlabGrant(sealed, issuedAtMs + 1_000)).toEqual(payload);
    // Hard TTL of 72h must expire the grant.
    expect(unsealIlabGrant(sealed, issuedAtMs + 72 * 60 * 60 * 1000 + 1)).toBeNull();
    // Tampering with ciphertext must fail authentication.
    const parts = sealed.split('.');
    parts[3] = `${parts[3].slice(0, -1)}${parts[3].endsWith('A') ? 'B' : 'A'}`;
    expect(unsealIlabGrant(parts.join('.'), issuedAtMs + 1_000)).toBeNull();

    const publicView = toPublicGrantView(payload);
    expect(publicView).toEqual({
      connected: true,
      displayName: '李四',
      expiresAtMs: issuedAtMs + 7_200_000,
      bypass: false,
    });
    expect(JSON.stringify(publicView)).not.toContain('super-secret-access-token');
    expect(JSON.stringify(publicView)).not.toContain('2026001');

    const request = new Request('https://act.just.edu.cn/api/ilab/grant', {
      headers: { cookie: `other=1; act_ilab_grant=${encodeURIComponent(sealed)}` },
    });
    expect(readIlabGrantFromRequest(request, issuedAtMs + 1_000)).toEqual(payload);

    expect(stripIlabUrlParams('/simulations', '?ticket=abc%2B1&token=legacy&compat=virtual-lab')).toBe(
      '/simulations?compat=virtual-lab',
    );
    expect(stripIlabUrlParams('/simulations/destroyer', '?ticket=abc')).toBe('/simulations/destroyer');
  });

  it('keeps the top-level start/end envelope when step 1 is redone after step 2', () => {
    const runStartTimeMs = 1_750_000_000_000n;
    const step2Window = buildSafeStepWindow({
      startedAtMs: 1_750_000_005_000,
      runStartTimeMs,
      existingSteps: [],
      seq: 2,
      nowMs: 1_750_000_008_000,
    });
    const step1RedoWindow = buildSafeStepWindow({
      startedAtMs: 1_750_000_010_000,
      runStartTimeMs,
      existingSteps: [{ seq: 2, startTime: step2Window.startTime, endTime: step2Window.endTime }],
      seq: 1,
      nowMs: 1_750_000_012_000,
    });
    const steps: StoredIlabStep[] = [
      {
        seq: 1,
        title: '第一步重做',
        ...step1RedoWindow,
        expectTime: 120,
        earnedPoints: 5,
        maxPoints: 5,
        repeatCount: 2,
        evaluation: '达标',
        scoringModel: '对照曲线读数',
        remarks: '重做。',
      },
      {
        seq: 2,
        title: '第二步',
        ...step2Window,
        expectTime: 120,
        earnedPoints: 5,
        maxPoints: 5,
        repeatCount: 1,
        evaluation: '达标',
        scoringModel: '对照曲线读数',
        remarks: '首次。',
      },
    ];
    for (let seq = 3; seq <= 12; seq += 1) {
      steps.push({
        seq,
        title: `第${seq}步`,
        startTime: 1_750_000_015_000 + seq * 2_000,
        endTime: 1_750_000_015_000 + seq * 2_000 + 1_000,
        timeUsed: 1,
        expectTime: 120,
        earnedPoints: 5,
        maxPoints: 5,
        repeatCount: 1,
        evaluation: '达标',
        scoringModel: '对照曲线读数',
        remarks: '完成。',
      });
    }

    const body = buildIlabUploadBody({
      username: 'stu',
      appId: '110382',
      originId: 'dds_test',
      title: ILAB_PROJECT_TITLE,
      childProjectTitle: '055型驱逐舰',
      status: 1,
      runStartTimeMs: Number(runStartTimeMs),
      steps,
      ledger: emptyAiLedger(),
    });
    expect(body.title).toBe(ILAB_PROJECT_TITLE);
    expect(body.startTime).toBeLessThanOrEqual(Math.min(...steps.map((s) => s.startTime)));
    expect(body.endTime).toBeGreaterThanOrEqual(Math.max(...steps.map((s) => s.endTime)));
    expect(body.startTime).toBe(Number(runStartTimeMs));
    expect(body.timeUsed).toBe(Math.round((body.endTime - body.startTime) / 1000));
  });

  it('forwards iLab environment variables in deploy/podman/deploy.sh', () => {
    const deployScript = readFileSync(resolve(process.cwd(), 'deploy/podman/deploy.sh'), 'utf8');
    const marker = 'for ilab_env_name in ILAB_BASE_URL ILAB_APP_ID ILAB_SECRET ILAB_DEV_BYPASS; do';
    const llmPos = deployScript.indexOf('APP_ENV_ARGS+=(-e LLM_SERVICE_URL="$LLM_SERVICE_URL")');
    const ilabPos = deployScript.indexOf(marker);
    const aiProviderPos = deployScript.indexOf('AI_PROVIDER_ENV_ARGS=()');
    expect(llmPos).toBeGreaterThan(0);
    expect(ilabPos).toBeGreaterThan(llmPos);
    expect(aiProviderPos).toBeGreaterThan(ilabPos);
    expect(deployScript).toContain('APP_ENV_ARGS+=(-e "${ilab_env_name}=${!ilab_env_name}")');
  });
});
