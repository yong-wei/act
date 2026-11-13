/**
 * 本地 7 船全流程演示闭环（ILAB_DEV_BYPASS=1）：
 * 使用单个模拟 ticket 换取共享 IlabGrantPayload，并依次跑完 055 驱逐舰 + 6 艘特种船舶（共 140 步），
 * 拦截第 19 步手绘图视觉接口为本地模拟响应，验证 DB、重做时间窗包络、ai_data 6 键与报告 HTML 后清理记录。
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
process.env.AI_PROVIDER = 'siliconflow';
process.env.AI_BASE_URL = 'https://mock.local.ai/v1';
process.env.AI_API_KEY = 'smoke-local-mock-key';

const TINYPNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const EXPECTED_AI_KEYS = [
  'ai_call_count',
  'ai_input_token_count',
  'ai_models_used',
  'ai_output_token_count',
  'ai_remark',
  'ai_usage_scenarios',
].join(',');

const DESTROYER_CHOICES: Record<number, string> = {
  12: '留在零附近',
  13: '航速还在',
  15: '向左转了',
  17: '船向右转',
};

const VESSEL_CHOICES: Record<string, string> = {
  'lng-berthing:7': '航速几乎立刻跟上',
  'lng-berthing:9': '距离还够',
  'container-voyage:3': '低速更省',
  'container-voyage:8': '没有顶满',
  'container-voyage:9': '后半段更快',
  'cruise-comfort:2': '横摇变大',
  'cruise-comfort:3': '横摇小下来',
  'cruise-comfort:5': '过程中明显升高',
  'drilling-dp:3': '超过了',
  'drilling-dp:5': '偏差明显变大',
  'drilling-dp:6': '偏差小回来',
  'drilling-dp:7': '没有停机',
  'drilling-dp:9': '开解耦才能守住',
  'icebreaker-ice:2': '航向仍在零附近',
  'icebreaker-ice:6': '冰阻力明显上来了',
  'icebreaker-ice:8': '几乎没转到',
  'icebreaker-ice:9': '冰把航速压住了',
  'dredger-mode:4': '还没有回到原点',
  'dredger-mode:5': '还能守住',
  'dredger-mode:6': '被流带离',
  'dredger-mode:7': '定位',
  'dredger-mode:9': '离开定位才会漂',
  'lng-berthing:12': '向左转了',
  'lng-berthing:14': '比靠泊快',
  'lng-berthing:16': '航向留在零附近',
  'lng-berthing:18': '已经改用低速',
  'lng-berthing:19': '奈奎斯特图',
  'container-voyage:12': '后段更快',
  'container-voyage:19': '伯德图',
  'cruise-comfort:13': '减摇鳍没有出力',
  'cruise-comfort:14': '航向留在零附近',
  'cruise-comfort:17': '这是四级海况',
  'cruise-comfort:18': '航速在巡航附近',
  'cruise-comfort:19': '根轨迹图',
  'drilling-dp:13': '偏差变大了',
  'drilling-dp:14': '没有停机',
  'drilling-dp:16': '位置收得回来',
  'drilling-dp:18': '功率已经出现',
  'drilling-dp:19': '时域响应图',
  'icebreaker-ice:12': '冰阻力上来了',
  'icebreaker-ice:13': '航向留在零附近',
  'icebreaker-ice:15': '冰把航速压住了',
  'icebreaker-ice:18': '几乎没有冰阻力',
  'icebreaker-ice:19': '奈奎斯特图',
  'dredger-mode:12': '正在定位',
  'dredger-mode:15': '被流带离',
  'dredger-mode:18': '还离原点很远',
  'dredger-mode:19': '伯德图',
};

async function main() {
  const originalFetch = globalThis.fetch;
  let expectedSketchKind = 'nyquist';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith('https://mock.local.ai/v1/chat/completions')) {
      return new Response(JSON.stringify({
        usage: { prompt_tokens: 128, completion_tokens: 36 },
        choices: [{
          message: {
            content: JSON.stringify({
              plotKind: expectedSketchKind,
              blank: false,
              evaluation: '曲线形状和所选图种一致。',
            }),
          },
        }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  const { prisma } = await import('../../src/lib/prisma.ts');
  const { resolveSessionAuth } = await import('../../src/features/ilab/session-shared.ts');
  const { sealIlabGrant, unsealIlabGrant, toPublicGrantView } = await import('../../src/features/ilab/grant-cookie.ts');
  const { sketchIdForLabel } = await import('../../src/features/ilab/sketch-plots.ts');
  const { openDestroyerSession, submitDestroyerStep, completeDestroyerSession } = await import('../../src/features/ilab/destroyer-session.ts');
  const { openVesselSession, submitVesselStep, completeVesselSession } = await import('../../src/features/ilab/vessel-session.ts');
  const { ILAB_PROJECT_TITLE } = await import('../../src/features/ilab/payload.ts');
  const { preloadServerControlEngine, computeVirtualSimulationServerStep } = await import('../../src/lib/control-engine/server.ts');
  const { preloadVirtualSimulationRuntime } = await import('../../src/resources/simulations/physics/simulation-engine-facade.ts');
  const { SIMULATION_FIXED_STEP_SECONDS } = await import('../../src/resources/simulations/lib/simulation-timing.ts');
  const { DEFAULT_PID_GAINS } = await import('../../src/resources/simulations/core/constants.ts');
  const {
    buildDestroyerHifiStepRequest,
    createDestroyerHifiStateFromSimulation,
  } = await import('../../src/resources/simulations/rust/destroyer-hifi-adapter.ts');
  const {
    DESTROYER_EXPERIMENT_STEPS,
    destroyerSceneMotion,
    scriptedManualRudder,
    signedHeading,
  } = await import('../../src/resources/simulations/simulations/destroyer-experiment.ts');
  const {
    collectSamples,
    thinVesselSamples,
    vesselValue,
  } = await import('../../src/resources/simulations/simulations/vessel-experiment.ts');
  const { VESSEL_EXPERIMENTS } = await import('../../src/resources/simulations/simulations/vessel-experiments.ts');
  const {
    createContainerDrive,
    createCruiseDrive,
    createDredgerDrive,
    createDrillingDrive,
    createIceDrive,
    createLngDrive,
  } = await import('../../src/resources/simulations/simulations/vessel-drives.ts');

  const drives: Record<string, () => {
    reset: (command: ReturnType<(typeof VESSEL_EXPERIMENTS)[number]['command']>) => void;
    step: (command: ReturnType<(typeof VESSEL_EXPERIMENTS)[number]['command']>, dt: number, time: number) => {
      time: number;
      values: Record<string, number>;
    };
  }> = {
    'lng-berthing': createLngDrive,
    'container-voyage': createContainerDrive,
    'cruise-comfort': createCruiseDrive,
    'drilling-dp': createDrillingDrive,
    'icebreaker-ice': createIceDrive,
    'dredger-mode': createDredgerDrive,
  };

  preloadServerControlEngine();
  await preloadVirtualSimulationRuntime();

  const createdOriginIds: string[] = [];
  const summary: Array<{
    vesselKey: string;
    originId: string;
    score: number;
    uploadStatus: string;
    steps: number;
    aiCallCount: number;
    reportBytes: number;
  }> = [];

  try {
    const auth = await resolveSessionAuth('dev-bypass', null);
    if (!auth) throw new Error('expected dev-bypass auth');
    const sealedCookie = sealIlabGrant(auth.grant);
    const sharedGrant = unsealIlabGrant(sealedCookie);
    if (!sharedGrant) throw new Error('grant cookie round-trip failed');
    const publicView = toPublicGrantView(sharedGrant);
    if (JSON.stringify(publicView).includes('dev-bypass-token') || JSON.stringify(publicView).includes('accessToken')) {
      throw new Error('public grant view leaked token');
    }

    // 1. 055 型驱逐舰（含第 1 步重做验证 repeatCount 与顶层时间窗包络）
    const ddsOpened = await openDestroyerSession({ grant: sharedGrant });
    if (!ddsOpened.connected) throw new Error('failed to open destroyer session from grant');
    const ddsOriginId = ddsOpened.session.originId;
    createdOriginIds.push(ddsOriginId);
    if (!ddsOriginId.startsWith('dds_')) throw new Error(`unexpected destroyer originId ${ddsOriginId}`);
    if (JSON.stringify(ddsOpened.session).includes('dev-bypass-token') || JSON.stringify(ddsOpened.session).includes('accessToken')) {
      throw new Error('destroyer session leaked accessToken');
    }

    const destroyerInputs = new Map<number, {
      samples: Array<{
        time: number;
        desiredHeading: number;
        actualHeading: number;
        yawRate: number;
        rudder: number;
        manualRudder: number;
        speed: number;
        crossTrackError: number;
      }>;
      readings: Record<string, string>;
      sketchImage?: string;
    }>();

    for (const step of DESTROYER_EXPERIMENT_STEPS) {
      const motion = destroyerSceneMotion(step, 15);
      const until = step.minRunS + 1;
      let state = createDestroyerHifiStateFromSimulation({
        timeS: 0,
        headingDeg: motion.start.headingDeg,
        yawRateDegS: 0,
        positionX: motion.start.x,
        positionZ: motion.start.z,
        rudderDeg: 0,
        speedMps: 15,
        surgeMps: 15,
        swayMps: 0,
        integralDegS: 0,
        prevErrorDeg: 0,
      });
      const samples: Array<{
        time: number;
        desiredHeading: number;
        actualHeading: number;
        yawRate: number;
        rudder: number;
        manualRudder: number;
        speed: number;
        crossTrackError: number;
      }> = [];
      let nextSample = 0;
      const sampleStepS = until > 400 ? 2 : 1;
      const dt = 0.2;
      for (let time = 0; time <= until; time += dt) {
        const scripted = scriptedManualRudder(step, time);
        const manualRudder = scripted ?? (step.seq === 2 ? 15 : step.seq === 3 ? (time < 90 ? 15 : 0) : 0);
        const result = computeVirtualSimulationServerStep<{
          timeS: number;
          headingDeg: number;
          yawRateDegS: number;
          positionX: number;
          positionZ: number;
          rudderDeg: number;
          speedMps: number;
          surgeMps: number;
          swayMps: number;
          integralDegS: number;
          prevErrorDeg: number;
        }>(buildDestroyerHifiStepRequest({
          dtS: dt,
          targetHeadingDeg: motion.desiredHeading(time),
          controlMode: step.defaultMode === 'manual' ? 'manual' : step.defaultMode,
          pid: DEFAULT_PID_GAINS,
          manualRudderDeg: manualRudder,
          disturbanceEnabled: motion.disturbance,
          state,
        }));
        state = result;
        if (time + 1e-6 >= nextSample || time + dt > until) {
          samples.push({
            time,
            desiredHeading: signedHeading(motion.desiredHeading(time)),
            actualHeading: signedHeading(result.headingDeg),
            yawRate: result.yawRateDegS,
            rudder: result.rudderDeg,
            manualRudder,
            speed: result.speedMps,
            crossTrackError: 0,
          });
          nextSample += sampleStepS;
        }
      }

      const last = samples[samples.length - 1];
      let readings: Record<string, string>;
      let sketchImage: string | undefined;
      if (step.seq >= 10 && step.seq <= 19) {
        readings = {};
        for (const field of step.fields) {
          if (field.kind === 'choice' && field.key === 'plotKind') {
            readings.plotKind = '奈奎斯特图';
          } else if (field.kind === 'choice') {
            readings.choice = DESTROYER_CHOICES[step.seq] ?? '';
          } else if (field.kind === 'sketch') {
            expectedSketchKind = sketchIdForLabel(readings.plotKind ?? '') ?? 'nyquist';
            sketchImage = TINYPNG_DATA_URL;
          } else if (field.kind === 'number') {
            const value = field.key === 'yawRate'
              ? last.yawRate
              : field.key === 'rudder'
                ? last.rudder
                : field.key === 'speed'
                  ? last.speed
                  : last.actualHeading;
            readings[field.key] = value.toFixed(field.key === 'yawRate' ? 2 : 1);
          }
        }
      } else if (step.seq === 1) {
        readings = { heading: last.actualHeading.toFixed(1), speed: last.speed.toFixed(1) };
      } else if (step.seq === 2) {
        readings = { rudder: last.manualRudder.toFixed(0), yawRate: last.yawRate.toFixed(2) };
      } else if (step.seq === 3) {
        readings = { yawRate: last.yawRate.toFixed(2) };
      } else if (step.seq === 4 || step.seq === 5) {
        const target = step.seq === 4 ? 15 : 90;
        const peak = samples
          .filter((sample) => Math.abs(signedHeading(sample.desiredHeading) - target) <= 1.5)
          .reduce((best, sample) => Math.max(best, sample.actualHeading), -Infinity);
        readings = { peakHeading: peak.toFixed(1) };
      } else if (step.seq === 6) {
        readings = { endError: Math.abs(signedHeading(last.actualHeading) - (-90)).toFixed(1) };
      } else if (step.seq === 7) {
        readings = { saturated: samples.some((sample) => Math.abs(sample.rudder) >= 34) ? '顶满了' : '没有顶满' };
      } else if (step.seq === 8) {
        readings = { yawRate: last.yawRate.toFixed(2), rudder: last.rudder.toFixed(1) };
      } else if (step.seq === 9) {
        const deviation = samples.reduce((best, sample) => Math.max(best, Math.abs(sample.actualHeading)), 0);
        readings = { maxHeadingDev: deviation.toFixed(1) };
      } else {
        readings = { note: '舵角变化之后，航向和转艏速率跟着变，回中后转艏变慢。' };
      }
      destroyerInputs.set(step.seq, { samples, readings, sketchImage });
      await submitDestroyerStep(ddsOriginId, {
        seq: step.seq,
        readings,
        samples,
        startedAtMs: Date.now() - 2_000,
        sketchImage,
      });
      if (step.seq === 2) {
        const step1Input = destroyerInputs.get(1)!;
        await submitDestroyerStep(ddsOriginId, {
          seq: 1,
          readings: step1Input.readings,
          samples: step1Input.samples,
          startedAtMs: Date.now() - 1_500,
        });
      }
    }

    const ddsDone = await completeDestroyerSession(ddsOriginId);
    const ddsRow = await prisma.ilabExperimentRun.findUnique({
      where: { originId: ddsOriginId },
      select: { reportHtml: true },
    });
    const ddsHtml = ddsRow?.reportHtml ?? '';
    assertCompletedUpload('destroyer-055', ddsDone.session.status, ddsDone.session.score, ddsDone.session.uploadStatus, ddsDone.upload, ddsHtml, true);
    summary.push({
      vesselKey: 'destroyer-055',
      originId: ddsOriginId,
      score: ddsDone.session.score,
      uploadStatus: ddsDone.session.uploadStatus,
      steps: ddsDone.upload!.steps.length,
      aiCallCount: ddsDone.upload!.ai_data.ai_call_count,
      reportBytes: Buffer.byteLength(ddsHtml),
    });

    // 2. 6 艘特种船舶（同用一个 sharedGrant）
    for (const experiment of VESSEL_EXPERIMENTS) {
      const opened = await openVesselSession({ grant: sharedGrant, experimentKey: experiment.key });
      if (!opened.connected) throw new Error(`failed to open vessel session ${experiment.key}`);
      const originId = opened.session.originId;
      createdOriginIds.push(originId);
      if (!originId.startsWith(experiment.originPrefix)) {
        throw new Error(`unexpected prefix for ${experiment.key}: ${originId}`);
      }
      if (JSON.stringify(opened.session).includes('dev-bypass-token') || JSON.stringify(opened.session).includes('accessToken')) {
        throw new Error(`vessel session ${experiment.key} leaked accessToken`);
      }
      const create = drives[experiment.key];
      if (!create) throw new Error(`missing drive ${experiment.key}`);
      const drive = create();

      for (const step of experiment.steps) {
        drive.reset(experiment.command(step, 0));
        const samples = collectSamples(step.duration, SIMULATION_FIXED_STEP_SECONDS, (time, dt) => (
          drive.step(experiment.command(step, time), dt, time)
        ));
        const last = samples[samples.length - 1];
        const readings: Record<string, string> = {};
        let sketchImage: string | undefined;
        for (const field of step.fields) {
          if (field.kind === 'text') {
            readings[field.key] = '曲线终点和过程已经看过。';
          } else if (field.kind === 'choice') {
            const choice = VESSEL_CHOICES[`${experiment.key}:${step.seq}`];
            if (!choice) throw new Error(`missing fixed choice ${experiment.key}:${step.seq}`);
            readings[field.key] = choice;
          } else if (field.kind === 'sketch') {
            expectedSketchKind = sketchIdForLabel(readings.plotKind ?? '') ?? 'nyquist';
            sketchImage = TINYPNG_DATA_URL;
          } else {
            const digits = experiment.series.find((series) => series.id === field.key)?.digits ?? 1;
            readings[field.key] = vesselValue(last, field.key).toFixed(digits);
          }
        }
        await submitVesselStep(originId, {
          experimentKey: experiment.key,
          seq: step.seq,
          readings,
          samples: thinVesselSamples(samples),
          startedAtMs: Date.now() - 2_000,
          sketchImage,
        });
      }

      const done = await completeVesselSession(originId);
      const vesselRow = await prisma.ilabExperimentRun.findUnique({
        where: { originId },
        select: { reportHtml: true },
      });
      const html = vesselRow?.reportHtml ?? '';
      assertCompletedUpload(experiment.key, done.session.status, done.session.score, done.session.uploadStatus, done.upload, html, false);
      summary.push({
        vesselKey: experiment.key,
        originId,
        score: done.session.score,
        uploadStatus: done.session.uploadStatus,
        steps: done.upload!.steps.length,
        aiCallCount: done.upload!.ai_data.ai_call_count,
        reportBytes: Buffer.byteLength(html),
      });
    }

    if (new Set(createdOriginIds).size !== 7) {
      throw new Error(`expected 7 unique originIds, got ${createdOriginIds.length}`);
    }
    console.log(JSON.stringify({ totalVessels: summary.length, vessels: summary }));
  } finally {
    globalThis.fetch = originalFetch;
    if (createdOriginIds.length > 0) {
      await prisma.ilabExperimentRun.deleteMany({
        where: { originId: { in: createdOriginIds } },
      }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }

  function assertCompletedUpload(
    vesselKey: string,
    status: number,
    score: number,
    uploadStatus: string,
    upload: {
      title: string;
      startTime: number;
      endTime: number;
      steps: Array<{ seq: number; startTime: number; endTime: number; repeatCount: number }>;
      ai_data: {
        ai_call_count: number;
        ai_input_token_count: number;
        ai_output_token_count: number;
      };
    } | null,
    html: string,
    expectStep1Repeat: boolean,
  ) {
    if (status !== 1 || score !== 100 || uploadStatus !== 'skipped') {
      throw new Error(`${vesselKey}: unexpected completion ${status}/${score}/${uploadStatus}`);
    }
    if (!upload || upload.steps.length !== 20) {
      throw new Error(`${vesselKey}: upload missing 20 steps`);
    }
    if (upload.title !== ILAB_PROJECT_TITLE) {
      throw new Error(`${vesselKey}: unexpected upload title ${upload.title}`);
    }
    const minStepStart = Math.min(...upload.steps.map((s) => s.startTime));
    const maxStepEnd = Math.max(...upload.steps.map((s) => s.endTime));
    if (upload.startTime > minStepStart || upload.endTime < maxStepEnd) {
      throw new Error(`${vesselKey}: envelope violated`);
    }
    if (expectStep1Repeat) {
      const step1 = upload.steps.find((s) => s.seq === 1);
      if (!step1 || step1.repeatCount !== 2) {
        throw new Error(`${vesselKey}: expected step 1 repeatCount=2, got ${step1?.repeatCount}`);
      }
    }
    const aiKeys = Object.keys(upload.ai_data).sort().join(',');
    if (
      aiKeys !== EXPECTED_AI_KEYS
      || upload.ai_data.ai_call_count !== 1
      || upload.ai_data.ai_input_token_count !== 128
      || upload.ai_data.ai_output_token_count !== 36
    ) {
      throw new Error(`${vesselKey}: unexpected ai_data ${JSON.stringify(upload.ai_data)}`);
    }
    if (!html.includes('实验得分：100/100')) {
      throw new Error(`${vesselKey}: report missing 100/100 score`);
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'smoke failed';
  console.error(message);
  process.exit(1);
});
