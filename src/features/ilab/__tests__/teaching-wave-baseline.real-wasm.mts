import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createServerVesselSessionWithAssets } from '@/lib/control-engine/wasm-server';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import { drillingCourseConfiguration, drillingCourseDefaultSettings, drillingCourseInput } from '@/resources/simulations/experiments/drilling-course';

const settings = drillingCourseDefaultSettings(13);
const results = [];
for (const profile of ['full', 'teaching']) {
  const configuration = drillingCourseConfiguration(13, settings);
  if (profile === 'full') delete configuration.waveTableProfile;
  const native = await createServerVesselSessionWithAssets(configuration);
  try {
    let frame = JSON.parse(native.read()) as VesselSessionFrame;
    let input = drillingCourseInput(13, settings, frame.input, frame);
    const secondOrderSquares = [0, 0, 0, 0, 0, 0];
    const firstOrderSquares = [0, 0, 0, 0, 0, 0];
    let sampleCount = 0;
    let positionSquares = 0;
    let headingSquares = 0;
    let tailSamples = 0;
    let checkpoint = '';
    for (let second = 0; second < 600; second++) {
      input = drillingCourseInput(13, settings, input, frame);
      frame = JSON.parse(native.advance(1, JSON.stringify(input))) as VesselSessionFrame;
      for (const sample of frame.controlSamples) {
        for (let axis = 0; axis < 6; axis++) {
          secondOrderSquares[axis] += (sample.dynamics?.external_components?.tau_wave_2[axis] ?? 0) ** 2;
          firstOrderSquares[axis] += (sample.dynamics?.external_components?.tau_wave_1[axis] ?? 0) ** 2;
        }
        sampleCount++;
        if (sample.timeS >= 420) {
          positionSquares += sample.truth.position_ned[0] ** 2 + sample.truth.position_ned[1] ** 2;
          headingSquares += sample.attitudeDeg.heading ** 2;
          tailSamples++;
        }
      }
      if (second === 299) checkpoint = native.snapshot();
    }
    const resumed = await createServerVesselSessionWithAssets(configuration);
    const repeated = await createServerVesselSessionWithAssets(configuration);
    try {
      resumed.restore(checkpoint);
      repeated.restore(checkpoint);
      const restored = JSON.parse(resumed.read()) as VesselSessionFrame;
      assert(Math.abs(restored.timeS - 300) < 1e-7);
      assert.equal(resumed.advance(1, JSON.stringify(input)), repeated.advance(1, JSON.stringify(input)));
    } finally {
      resumed.free();
      repeated.free();
    }
    const result = {
      profile,
      qtfRms: secondOrderSquares.map((value) => Math.sqrt(value / sampleCount)),
      firstRms: firstOrderSquares.map((value) => Math.sqrt(value / sampleCount)),
      positionRmsM: Math.sqrt(positionSquares / tailSamples),
      headingRmsDeg: Math.sqrt(headingSquares / tailSamples),
      fineMetrics: frame.fineStepMetrics!.values,
      restoreFutureExact: true,
      parameterHash: frame.parameterHash,
    };
    results.push(result);
    console.log(JSON.stringify(result));
  } finally { native.free(); }
}
const [before, after] = results;
const qtfRelativeError = [0, 1, 5].map((axis) => Math.abs(after.qtfRms[axis] - before.qtfRms[axis]) / Math.max(before.qtfRms[axis], 1));
// 教学验收比较运动响应，原始载荷分量误差独立保留。
assert(Math.abs(after.headingRmsDeg - before.headingRmsDeg) / before.headingRmsDeg <= .5);
assert(Math.abs(after.positionRmsM - before.positionRmsM) / before.positionRmsM <= .5);
for (const key of ['maximumRollDeg', 'maximumPitchDeg'] as const) {
  assert(Math.abs(after.fineMetrics[key] - before.fineMetrics[key]) / before.fineMetrics[key] <= .5);
}
for (const key of ['shaftPowerViolationS', 'systemPowerViolationS', 'shaftSpeedViolationS'] as const) {
  assert.equal(after.fineMetrics[key], before.fineMetrics[key]);
}
assert.notEqual(before.parameterHash, after.parameterHash);
console.log(JSON.stringify({ status: 'passed', amplitudeTolerance: .5, qtfRelativeError, oneRepresentativeBaseline: true }));
if (process.env.VESSEL_TEACHING_VALIDATION_OUTPUT) {
  await writeFile(process.env.VESSEL_TEACHING_VALIDATION_OUTPUT, JSON.stringify({
    schema: 'act.teaching-wave-baseline.v1', durationS: 600, seed: 20261106, motionAmplitudeTolerance: .5,
    sourceDataSha256: '2f1251e6c2ad163c4d6771ceec143edcc028445f7c77181ea8ff84b0fb17bb4b',
    teachingDataSha256: '7664c50fecf6cafabd4ada5e70be9794c9f3c6630033974cdf236976f1e4ecfa',
    results, qtfRelativeError,
  }, null, 2) + '\n');
}
