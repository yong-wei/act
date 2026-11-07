import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { buildAiData, emptyAiLedger, recordAiCall } from '@/features/ilab/ai-data';
import { ilabSignature, ilabTokenUrl } from '@/features/ilab/ilab-client';
import { buildIlabUploadBody, IlabPayloadError, type StoredIlabStep } from '@/features/ilab/payload';
import { assertIlabRunOpen, IlabServiceError } from '@/features/ilab/run-lock';

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
});
