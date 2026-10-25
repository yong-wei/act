/**
 * 本地演示闭环：强制 ILAB_DEV_BYPASS，不调用模型，不回传实验空间。
 * 成功后删除本次写入的实验记录。密钥只留在进程内，不打印。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(file: string) {
  const text = readFileSync(file, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq);
    if (process.env[key]) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnv(resolve(process.cwd(), '.env'));
process.env.ILAB_DEV_BYPASS = '1';
delete process.env.AI_API_KEY;
delete process.env.SILICONFLOW_API_KEY;

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

async function main() {
const { openIlabSession, submitIlabStep, completeIlabSession, readIlabReport } = await import('../../src/features/ilab/session-service.ts');
const { prisma } = await import('../../src/lib/prisma.ts');

let originId = '';
try {
  const session = await openIlabSession('dev-bypass');
  originId = session.originId;
  if (JSON.stringify(session).includes('dev-bypass-token') || JSON.stringify(session).includes('accessToken')) {
    throw new Error('session view leaked the access token');
  }
  const startedAtMs = Date.now() - 5_000;
  let latest = session;
  for (let seq = 1; seq <= 24; seq += 1) {
    latest = await submitIlabStep(originId, { seq, payload: goldenPayloads[seq], startedAtMs });
  }
  const step23 = latest.steps.find((step) => step.seq === 23);
  if (!step23 || step23.earnedPoints !== 0 || step23.evaluation !== '待教师复核') {
    throw new Error('step 23 did not stay at teacher review');
  }
  if (!latest.steps.some((step) => step.seq === 2 && step.remarks.includes('没有计入 ai_data'))) {
    throw new Error('missing AI call was counted');
  }
  const done = await completeIlabSession(originId, String(goldenPayloads[24].reflection));
  if (done.session.status !== 1 || done.session.score !== 94 || done.session.uploadStatus !== 'skipped') {
    throw new Error(`unexpected completion ${done.session.status}/${done.session.score}/${done.session.uploadStatus}`);
  }
  if (!done.upload || done.upload.steps.length !== 24) throw new Error('upload body missing 24 steps');
  const aiKeys = Object.keys(done.upload.ai_data).sort();
  const html = await readIlabReport(originId);
  const checks = {
    originId,
    score: done.session.score,
    uploadStatus: done.session.uploadStatus,
    stepCount: done.upload.steps.length,
    aiCallCount: done.upload.ai_data.ai_call_count,
    aiKeys,
    reportHasTitle: html.includes('场景选择与参数读取') && html.includes('实验报告提交'),
    reportHasReview: html.includes('待教师复核'),
    reportBytes: Buffer.byteLength(html),
    remote: done.remote.message,
  };
  if (!checks.reportHasTitle || !checks.reportHasReview || checks.aiCallCount !== 0 || checks.aiKeys.join(',') !== 'ai_call_count,ai_input_token_count,ai_models_used,ai_output_token_count,ai_remark,ai_usage_scenarios') {
    throw new Error(`smoke checks failed ${JSON.stringify(checks)}`);
  }
  console.log(JSON.stringify(checks));
} finally {
  if (originId) {
    await prisma.ilabExperimentRun.delete({ where: { originId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
}
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'smoke failed';
  console.error(message);
  process.exit(1);
});
