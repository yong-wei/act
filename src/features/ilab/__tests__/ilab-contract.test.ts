import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { buildAiData, emptyAiLedger, recordAiCall } from '@/features/ilab/ai-data';
import { ilabSignature, ilabTokenUrl } from '@/features/ilab/ilab-client';
import { buildIlabUploadBody, IlabPayloadError, type StoredIlabStep } from '@/features/ilab/payload';
import { buildIlabReportHtml } from '@/features/ilab/report';
import { scoreIlabStep } from '@/features/ilab/scoring';
import { ILAB_MAX_POINTS, ILAB_STEPS } from '@/features/ilab/steps';

const headingSamples = [0, 2, 4, 6, 8, 10.8, 10.4, 10.1, 10, 10, 10, 10];

const goldenPayloads: Record<number, Record<string, unknown>> = {
  1: { vesselId: 'destroyer-055' },
  2: { K: 0.08, T: 55, modelKind: 'nomoto-1st' },
  3: { blocks: ['hull', 'actuator', 'kinematics', 'disturbance'] },
  4: { actuator: 'rudder', maxRudderDeg: 35, maxRateDeg: 5 },
  5: { commandDeg: 10, yawRateDeg: 0.8, headingChangeDeg: 4 },
  6: { correctedK: 0.08, correctedT: 55 },
  7: { samples: headingSamples, sampleDtS: 1 },
  8: { testedT: 80, conclusion: 'open-loop-stable-for-positive-T' },
  9: { gainLow: 0.5, gainHigh: 3 },
  10: { nyquist: 'does-not-encircle', note: '曲线不包围负一实点，闭环稳定。' },
  11: { phaseMarginDeg: 45, gainMarginDb: 10 },
  12: { conclusion: '闭环稳定，相位裕度与极点都位于可接受范围。' },
  13: { scheme: 'pid', reason: '用比例积分微分兼顾超调和稳态误差。' },
  14: { kp: 1.4, ki: 0.02, kd: 0.7, samples: headingSamples, sampleDtS: 1 },
  15: { compensatorType: 'lead', phaseMarginDeg: 50 },
  16: { headingErrorDeg: 0.8, effortPct: 40 },
  17: { seaState: 6, headingErrorDeg: 1.5 },
  18: { challengeErrorDeg: 0.9 },
  19: { targetNorthM: 2, targetEastM: -1, currentSpeedMps: 0.8, windSpeedMps: 12 },
  20: { feedforward: 'on', estimator: 'observer', predictedErrorM: 0.6 },
  21: { fault: 'gps', observation: 'position-drift' },
  22: { strategy: 'safe-hold', residualErrorM: 3 },
  23: { reflection: '本组把航向精度和舵机磨损分开讨论，互评时会核对高海况记录。' },
  24: { reflection: '报告已按四个阶段整理，下一步等待教师复核定位误差和裕度。' },
};

describe('ilab experiment contract', () => {
  it('scores the declaration steps from the published ship data', () => {
    expect(ILAB_STEPS).toHaveLength(24);
    expect(ILAB_MAX_POINTS).toBe(106);
    let earned = 0;
    for (const step of ILAB_STEPS) {
      const result = scoreIlabStep(step.seq === 1 ? null : 'destroyer-055', step.seq, goldenPayloads[step.seq]);
      expect(result.ok, step.title).toBe(true);
      if (!result.ok) continue;
      earned += result.score.earnedPoints;
      if (step.seq === 23) {
        expect(result.score.earnedPoints).toBe(0);
        expect(result.score.evaluation).toBe('待教师复核');
      } else {
        expect(result.score.earnedPoints, step.title).toBe(step.maxPoints);
      }
    }
    expect(earned).toBe(100);
  });

  it('rejects a Nomoto gain that is far from the ship reading', () => {
    const result = scoreIlabStep('destroyer-055', 2, { K: 1, T: 55 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.score.earnedPoints).toBe(0);
  });

  it('builds a timed upload body and ai_data without extra fields', () => {
    const steps: StoredIlabStep[] = ILAB_STEPS.map((step, index) => ({
      seq: step.seq,
      title: step.title,
      startTime: 1_700_000_000_000 + index * 2_000,
      endTime: 1_700_000_000_000 + index * 2_000 + 1_000,
      timeUsed: 1,
      expectTime: step.minutes * 60,
      earnedPoints: step.seq === 23 ? 0 : step.maxPoints,
      maxPoints: step.maxPoints,
      repeatCount: 1,
      evaluation: step.seq === 23 ? '待教师复核' : '达到步骤要求。',
      scoringModel: step.scoringModel,
      remarks: '按船型读数评分。',
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

    expect(body.score).toBe(94);
    expect(body.steps).toHaveLength(24);
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

    const report = buildIlabReportHtml({
      displayName: '本地演示',
      vesselName: '055型驱逐舰',
      steps,
      ledger,
      reflection: '等待教师复核。',
    });
    expect(report).toContain('场景选择与参数读取');
    expect(report).toContain('实验报告提交');
    expect(report).toContain('待教师复核');
    expect(Buffer.byteLength(report, 'utf8')).toBeLessThan(5 * 1024 * 1024);

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
});
