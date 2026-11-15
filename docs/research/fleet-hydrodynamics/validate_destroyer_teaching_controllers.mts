import { createHash } from 'node:crypto';
import { readFileSync,writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createServerVesselSession } from '@/lib/control-engine/wasm-server';
import { computeVirtualSimulationServerStep } from '@/lib/control-engine/server';
import { CONTROL_ENGINE_FILE_HASHES } from '@/lib/control-engine/identity.generated';
import type { VesselSessionFrame,VesselSessionInput } from '@/lib/control-engine/vessel-session';
import { collectVesselTracePoint,type VesselTracePoint } from '@/features/simulations/run-evidence';
import { calculateVesselRunMetrics } from '@/features/ilab/course-run-metrics';
import { DESTROYER_COURSE_STEPS,destroyerCourseCommands } from '@/resources/simulations/experiments/destroyer-course';

const priorPath = 'docs/research/fleet-hydrodynamics/destroyer-course-session-validation.json';
const prior = JSON.parse(readFileSync(priorPath,'utf8'));
const model = prior.identification.find((item:{step:number})=>item.step === 3).result.structure;
const design = computeVirtualSimulationServerStep<{kp:number;ki:number;kd:number}>({modelId:'student_model_analysis',operation:'heading_design',structure:model});
const cases = [
  {sequence:10,name:'identified-model-pd',gains:{kp:design.kp,ki:0,kd:design.kd}},
  {sequence:16,name:'e1-first-scheme',gains:{kp:.7,ki:.005,kd:6}},
  {sequence:17,name:'e1-revised-scheme',gains:{kp:1,ki:.006,kd:8}},
];
const results:Record<string,unknown>[] = [];
for (const candidate of cases) {
  const started = performance.now();
  const step = DESTROYER_COURSE_STEPS[candidate.sequence-1];
  const native = createServerVesselSession(step.configuration);
  try {
    const initial = JSON.parse(native.read()) as VesselSessionFrame;
    const input:VesselSessionInput = {...initial.input,controlMode:step.controlMode,pid:candidate.gains,
      feedback:'measurement',derivativeFilterTauS:.2,headingIntegralTracking:{enabled:true,timeS:1}};
    const points:VesselTracePoint[] = [];
    let final = initial;
    for (let second=0;second<step.runDurationS!;second++) {
      input.targetHeadingDeg = destroyerCourseCommands(step,second).headingDeg;
      final = JSON.parse(native.advance(1,JSON.stringify(input))) as VesselSessionFrame;
      for (const sample of final.controlSamples) points.push(collectVesselTracePoint(sample,points.at(-1)?.measurements ?? {}));
    }
    const metrics = calculateVesselRunMetrics(points,final.timeS,step.configuration.initialHeadingDeg ?? 0);
    const meetsHeadingGoal = candidate.sequence === 10
      ? metrics.final120sHeadingMaeDeg !== null && metrics.final120sHeadingMaeDeg <= 1
        && metrics.headingOvershootPercent !== null && metrics.headingOvershootPercent <= 20 && metrics.settlingTimeS !== null
      : metrics.headingRmseDeg !== null && metrics.headingRmseDeg <= 2;
    const constraintsAtControlSamples = points.every((point)=>point.truth.surfaceDeg.every((angle)=>Math.abs(angle) <= 35+1e-6)
      && point.truth.motorPowerW.every((power)=>power <= 15e6+1e-3));
    const result = {sequence:candidate.sequence,case:candidate.name,parameterHash:final.parameterHash,
      configuration:step.configuration,controller:input,virtualSeconds:final.timeS,physicsTicks:final.physicsTicks,
      controllerTicks:final.controllerTicks,metrics,meetsHeadingGoal,constraintsAtControlSamples,
      rollTeachingAlert:metrics.maximumRollDeg > 8,elapsedMs:performance.now()-started};
    results.push(result);
    console.log(JSON.stringify({sequence:candidate.sequence,case:candidate.name,meetsHeadingGoal,metrics,elapsedMs:result.elapsedMs}));
  } finally {native.free();}
}
const report = {schema:'act.destroyer-teaching-controller-validation.v1',
  status:results.every((result)=>result.meetsHeadingGoal && result.constraintsAtControlSamples) ? 'passed' : 'failed',
  wasmSha256:CONTROL_ENGINE_FILE_HASHES['index_bg.wasm'],
  generatorSha256:createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  identificationEvidenceSha256:createHash('sha256').update(readFileSync(priorPath)).digest('hex'),
  frozenStudentModel:model,suggestedDesign:design,
  scope:'Frozen parameter pack, measured heading, one model-based PD and two distinct E1 schemes. Roll above 8 degrees is the source-defined teaching alert. Control-sample maxima are 20Hz; fine-step safety accumulation is verified separately.',
  cases:results};
writeFileSync('docs/research/fleet-hydrodynamics/destroyer-teaching-controller-validation.json',`${JSON.stringify(report,null,2)}\n`);
if (report.status !== 'passed') process.exitCode=1;
