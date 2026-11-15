import { describe, expect, it, vi } from 'vitest';
import type { VesselObservedSample, VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import type { VesselRunEvidence } from '@/features/simulations/run-evidence';
import { compareVesselStudentModel, evaluateVesselHeadingRun, forecastVesselSpeed, identifyVesselStudentModel, measuredWindow,
  type FrozenVesselStudentModel } from '../experiments/student-analysis';
import { computeVirtualSimulationStep } from '../physics/simulation-engine-facade';

vi.mock('../physics/simulation-engine-facade', () => ({ computeVirtualSimulationStep: vi.fn() }));

function evidence(missingYaw = false): VesselRunEvidence {
  const nativeSensorSamples: VesselObservedSample[] = [];
  for (let tick = 0; tick <= 100; tick++) {
    const time = tick*.02;
    nativeSensorSamples.push({ signal: { SurfaceEncoder: 0 }, measurement: {
      t_sample_s: time, t_arrive_s: time+.02, value: time, quality: 'Good',
    } });
  }
  for (let tick = 0; tick <= 40; tick++) {
    const time = tick*.05;
    nativeSensorSamples.push({ signal: 'YawRate', measurement: {
      t_sample_s: time, t_arrive_s: time+.05,
      value: missingYaw && tick === 20 ? null : time*2,
      quality: missingYaw && tick === 20 ? 'Missing' : 'Good',
    } });
  }
  return { id: 'owned-run', scopeKey: 'owned-scope', courseKey: 'destroyer', courseVersion: 'test',
    stepSequence: 3, prediction: '观测舵角与转艏速率', durationS: 2.1, createdAtMs: 1, lastTimeS: 2.1, stoppedAtMs: 2,
    configuration: {}, initialInput: { controlMode: 'manual', pid: { kp: 0, ki: 0, kd: 0 }, targetHeadingDeg: 0,
      feedback: 'measurement', actuators: { shafts: [], surfaces: [] } }, parameterHash: 'test',
    initialCheckpoint: '', checkpoint: '', nativeSensorSamples, changes: [], stopReason: 'duration', failure: null,
    trace: Array.from({ length: 43 }, (_,tick) => ({ timeS: tick*.05,
      command: { headingDeg: 0, shaftRpm: [], surfaceDeg: [5] }, measurements: {},
      estimate: { headingDeg: 0, yawRateDegS: 0, groundBodySpeedMps: 0, northM: 0, eastM: 0 },
      truth: { headingDeg: 999, yawRateDegS: 999, rollDeg: 999, pitchDeg: 999, rollRateDegS: 999, pitchRateDegS: 999,
        waterSpeedMps: 999, groundBodySpeedMps: 999, northM: 999, eastM: 999, shaftRpm: [], surfaceDeg: [999], azimuthDeg: [],
        windLoad: null, waveFirstLoad: null, waveSecondLoad: null, propellerWorkJ: [], motorPowerW: [], positiveMotorWorkJ: 0, fuelKg: null } })) };
}

describe('学生模型量测窗口', () => {
  it('按20Hz转艏率采样时间保持50Hz舵角量测，保留单位及原生记录', () => {
    const run = evidence();
    const window = measuredWindow(run,'rudder-to-yaw',0,2);
    expect(window.timeS).toHaveLength(41);
    expect(window.dtS).toBeCloseTo(.05,12);
    expect(window.input[1]).toBeCloseTo(.04,12);
    expect(window.output[1]).toBeCloseTo(.1,12);
    expect(window.input).not.toContain(999);
    expect(window.output).not.toContain(999);
    expect(run.nativeSensorSamples).toHaveLength(142);
  });

  it('舵机辨识使用50Hz编码器记录和已记录舵指令', () => {
    const window = measuredWindow(evidence(),'rudder-servo',0,2);
    expect(window.dtS).toBeCloseTo(.02,12);
    expect(window.input.every((value) => value === 5)).toBe(true);
    expect(window.output[1]).toBeCloseTo(.02,12);
  });

  it('缺测产生明确窗口错误', () => {
    expect(() => measuredWindow(evidence(true),'rudder-to-yaw',0,2)).toThrow('不连续采样');
  });

  it('双吊舱伺服保持50Hz原生编码器时钟，20Hz显示记录不替代辨识输入', () => {
    const run = evidence();
    run.courseKey = 'icebreaker';
    run.nativeSensorSamples = Array.from({ length: 101 }, (_, tick) => [0, 1].map((index) => ({
      signal: { AzimuthEncoder: index }, measurement: {
        t_sample_s: tick * .02, t_arrive_s: tick * .02, value: -tick * .02, quality: 'Good' as const,
      },
    }))).flat();
    run.trace = run.trace.map((point) => ({ ...point, command: { ...point.command, azimuthDeg: [-3, -3] },
      measurements: { EquivalentAzimuth: { value: 999, quality: 'Good', sampledAtS: Math.floor(point.timeS / .02) * .02, arrivedAtS: point.timeS } } }));
    const window = measuredWindow(run, 'azimuth-servo', 0, 2);
    expect(window.timeS).toHaveLength(101);
    expect(window.dtS).toBeCloseTo(.02, 12);
    expect(window.output[1]).toBeCloseTo(.02, 12);
    expect(window.input.every((value) => value === 3)).toBe(true);
    expect(window.output).not.toContain(999);
  });

  it('冰区航向辨识保留非稳态窗口初值，直航工作点保持零偏转和零转艏率', () => {
    const run = evidence();
    run.courseKey = 'icebreaker';
    run.nativeSensorSamples.push(...Array.from({ length: 101 }, (_, tick) => [0, 1].map((index) => ({
      signal: { AzimuthEncoder: index }, measurement: {
        t_sample_s: tick * .02, t_arrive_s: tick * .02, value: -5 - tick * .02, quality: 'Good' as const,
      },
    }))).flat());
    vi.mocked(computeVirtualSimulationStep).mockReturnValue({ identifiedOk: true,
      structure: { kind: 'nomoto1', k: .02, t_s: 75 }, predicted: [], metrics: { rmse: .02 } });
    const model = identifyVesselStudentModel(run, 'azimuth-to-yaw', 'nomoto1', .5, 2);
    expect(vi.mocked(computeVirtualSimulationStep).mock.lastCall?.[0]).toMatchObject({ inputOrigin: 0, outputOrigin: 0 });
    expect(model.payload.operatingPoint).toMatchObject({ inputOrigin: 0, outputOrigin: 0 });
    expect(model.payload.trainingRuns).toEqual([{ runRef: run.id, startS: .5, endS: 2 }]);
    expect(measuredWindow(run, 'azimuth-to-yaw', .5, 2).output[0]).toBe(1);
  });

  it('分别保留轴速参考和实际轴速，LNG联合模型使用参考命令及5Hz计程仪', () => {
    const run = evidence();
    run.lastTimeS = 4;
    run.trace = Array.from({length:81},(_,index)=>({...run.trace[0],timeS:index*.05,
      command:{headingDeg:0,surfaceDeg:[999],shaftRpm:[index < 20 ? 100 : 105]}}));
    run.nativeSensorSamples = Array.from({length:21},(_,index)=>[
      {signal:'SpeedLog' as const,measurement:{t_sample_s:index*.2,t_arrive_s:index*.2,value:4+index*.01,quality:'Good' as const}},
      {signal:{ShaftSpeed:0},measurement:{t_sample_s:index*.2,t_arrive_s:index*.2,value:90+index,quality:'Good' as const}},
    ]).flat();
    const reference = measuredWindow(run,'shaft-reference-to-speed',0,4);
    const shaft = measuredWindow(run,'shaft-to-speed',0,4);
    expect(reference.dtS).toBeCloseTo(.2,12);
    expect(reference.signals).toMatchObject({input:'ShaftReference0',output:'SpeedLog'});
    expect(reference.input.slice(0,6)).toEqual([100,100,100,100,100,105]);
    expect(shaft.input.slice(0,6)).toEqual([90,91,92,93,94,95]);
    vi.mocked(computeVirtualSimulationStep).mockReturnValue({identifiedOk:true,
      structure:{kind:'fopdt',k:.04,t_s:80,delay_s:5},predicted:[],metrics:{rmse:.01}});
    const model = identifyVesselStudentModel(run,'shaft-reference-to-speed','fopdt',0,4);
    expect(model.payload.ioContract).toMatchObject({inputChannel:'ShaftReference0',inputUnit:'r/min',outputChannel:'SpeedLog'});
    const validation = {...run,id:'independent-speed-run'};
    const comparison = compareVesselStudentModel(validation,model,'command_to_output',0,4);
    expect(comparison).toMatchObject({outputChannel:'SpeedLog',outputUnit:'m/s',actuatorModelId:null});
    expect(vi.mocked(computeVirtualSimulationStep).mock.lastCall?.[0]).toMatchObject({operation:'predict',input:reference.input});
    expect(()=>compareVesselStudentModel(validation,model,'hull_model',0,4)).toThrow('请选择B指令对照');
  });
});

describe('学生运行评价', () => {
  it('结束状态的累积功覆盖20Hz末帧近似值，细步安全指标保持独立', () => {
    vi.mocked(computeVirtualSimulationStep).mockReturnValue({positiveMotorWorkJ:4,headingRmseDeg:2});
    const run = evidence();
    run.checkpoint = JSON.stringify({plant:{state:{actuator_states:{positive_motor_work_j:[7,11]}}}});
    expect(evaluateVesselHeadingRun(run).metrics.positiveMotorWorkJ).toBe(18);
    run.checkpoint = JSON.stringify({course_evidence:{metrics:{positiveMotorWorkJ:23,maximumRollDeg:9}},
      plant:{state:{actuator_states:{positive_motor_work_j:[7,11]}}}});
    const evaluation = evaluateVesselHeadingRun(run);
    expect(evaluation.metrics).toMatchObject({positiveMotorWorkJ:23,headingRmseDeg:2});
    expect(evaluation.fineStepMetrics).toMatchObject({sampleCadenceS:1/120,rollWarningDeg:8,
      values:{maximumRollDeg:9,positiveMotorWorkJ:23}});
  });

  it('正在运行时保留未完成语义', () => {
    const run = evidence();
    run.stoppedAtMs = null;
    expect(() => evaluateVesselHeadingRun(run)).toThrow('运行结束后');
  });

  it('冰区到达评价补入真实结束状态，覆盖最后一帧采样之前的过线', () => {
    const run = evidence();
    run.courseKey = 'icebreaker';
    run.trace[0].ice = { brokenAreaM2: 0 } as NonNullable<typeof run.trace[0]['ice']>;
    run.checkpoint = JSON.stringify({ plant: { state: { position_ned: [800.01, 2, 0],
      actuator_states: { positive_motor_work_j: [7, 11] } } }, input: run.initialInput });
    vi.mocked(computeVirtualSimulationStep).mockReturnValue({ positiveMotorWorkJ: 4 });
    evaluateVesselHeadingRun(run);
    expect(vi.mocked(computeVirtualSimulationStep).mock.lastCall?.[0]).toMatchObject({
      operation: 'ice_metrics', terminalPoint: { timeS: 2.1, northM: 800.01, eastM: 2, positiveMotorWorkJ: 18 },
    });
  });
});

describe('邮轮横摇仪器模型', () => {
  function rollEvidence():VesselRunEvidence {
    const run=evidence();
    run.courseKey='cruise';run.stepSequence=2;
    run.parameters={rollInertiaKgM2:12e9} as VesselSessionFrame['parameters'];
    run.nativeSensorSamples=Array.from({length:106},(_,index)=>[
      {signal:{SurfaceEncoder:0},measurement:{value:1,t_sample_s:index*.02,t_arrive_s:index*.02,quality:'Good' as const}},
      {signal:{SurfaceEncoder:1},measurement:{value:-1,t_sample_s:index*.02,t_arrive_s:index*.02,quality:'Good' as const}},
    ]).flat();
    run.trace=run.trace.map((point,index)=>({...point,command:{...point.command,surfaceDeg:[999,-999]},
      cruise:{estimatedRollRad:(2-index*.01)*Math.PI/180,estimatedPitchRad:0,filteredRollRad:0,filteredRollRateRadS:0,
        requestedMomentNm:0,availableMomentNm:0,allocatedMomentNm:0,anglesRad:[0,0],measurementGood:true,lowSpeedAuthority:false,samples:index}}));
    return run;
  }

  it('仅用编码器差动与仪器姿态估计，保留自由衰减的非零初态', () => {
    const run=rollEvidence();
    const window=measuredWindow(run,'fin-to-roll',0,2);
    expect(window.dtS).toBeCloseTo(.05,12);
    expect(window.input.every((value)=>value === 1)).toBe(true);
    expect(window.output[0]).toBeCloseTo(2,12);
    expect(window.output).not.toContain(999);
    vi.mocked(computeVirtualSimulationStep).mockReturnValue({identifiedOk:true,
      structure:{kind:'roll_oscillator',natural_freq_rad_s:.3,damping:.05,control_gain:.1},predicted:[],metrics:{rmse:.01}});
    const model=identifyVesselStudentModel(run,'fin-to-roll','roll_oscillator',0,2);
    expect(vi.mocked(computeVirtualSimulationStep).mock.lastCall?.[0]).toMatchObject({inputOrigin:0,outputOrigin:0,output:window.output});
    expect(model.payload.operatingPoint.rollInertiaKgM2).toBe(12e9);
    expect(model.payload.ioContract).toMatchObject({inputChannel:'FinDifferential',outputChannel:'EstimatedRoll',inputUnit:'°',outputUnit:'°'});
    const validation={...run,id:'independent-roll'};
    expect(compareVesselStudentModel(validation,model,'hull_model',0,2)).toMatchObject({outputChannel:'EstimatedRoll',outputUnit:'°'});
  });

  it('联合控制效能引用本人独立衰减来源，并拒绝跨轮次来源', () => {
    const excited=rollEvidence();excited.id='excitation';excited.stepSequence=3;
    const decay=rollEvidence();
    vi.mocked(computeVirtualSimulationStep).mockReturnValue({identifiedOk:true,
      structure:{kind:'roll_oscillator',natural_freq_rad_s:.3,damping:.05,control_gain:.1},predicted:[],metrics:{rmse:.01}});
    const model=identifyVesselStudentModel(excited,'fin-to-roll','roll_oscillator',0,2,{run:decay,startS:0,endS:2});
    expect(model.payload.trainingRuns.map((window)=>window.runRef)).toEqual(['excitation','owned-run']);
    expect(vi.mocked(computeVirtualSimulationStep).mock.lastCall?.[0]).toHaveProperty('freeDecayOutput');
    expect(()=>identifyVesselStudentModel(excited,'fin-to-roll','roll_oscillator',0,2,
      {run:{...decay,scopeKey:'other'},startS:0,endS:2})).toThrow('同一实验轮次');
  });
});

describe('运行前独立航速与距离预测', () => {
  it('以冻结局部模型和给定计划建立独立状态，保留距离曲线及原生采样周期', () => {
    const model: FrozenVesselStudentModel = {id: 'model', scopeKey: 'scope', channel: 'shaft-reference-to-speed',
      label: '本人速度模型', createdAtMs: 1, serverId: null, contentHash: null, payload: {
        experimentKey: 'lng', lineageKey: 'fixture', structure: {kind: 'fopdt', k: .08, t_s: 210, delay_s: 1},
        ioContract: {inputChannel: 'ShaftReference0', outputChannel: 'SpeedLog', inputUnit: 'r/min', outputUnit: 'm/s'},
        operatingPoint: {speedMps: 4, inputOrigin: 50, outputOrigin: 4},
        identification: {algorithm: 'fixture', settings: {}, identifiedOk: true},
        trainingRuns: [{runRef: 'training', startS: 10, endS: 580}], validationRuns: [], sampleDt: .2,
      }};
    const input = evidence().initialInput;
    input.longitudinal = {localModel: {structure: {kind: 'fopdt', k: .08, t_s: 210, delay_s: 1},
      speedMps: 4, shaftReferenceRpm: 50}, referenceMps: 4, kpMultiplier: 1, tiMultiplier: 1,
      antiWindup: true, smithEnabled: false, filterTauS: .2, additionalCommandDelayS: 0};
    input.berthPlan = {brakingDistanceM: 1200, nodes: [{distanceM: 30, speedMps: 0}]};
    vi.mocked(computeVirtualSimulationStep).mockReturnValue({predicted: [4, 3.9, 3.8], commandsRpm: [50, 49, 48],
      bowClearanceM: [1500, 1499.21, 1498.44], outsideLocalSpeedDomain: false});
    const before = structuredClone(input);
    const comparison = forecastVesselSpeed('scope', 'future-run', {initialWaterSpeedMps: 4,
      berth: {stopLineNorthM: 0, initialBowDistanceM: 1500}}, .4, input,
      {shaftConfigurations: [{ratedRpm: 110}]} as VesselSessionFrame['parameters'], model);
    expect(comparison).toMatchObject({purpose: 'forecast', actual: [], actuatorModelId: null,
      timeS: [0, .2, .4], predictedBowClearanceM: [1500, 1499.21, 1498.44]});
    expect(vi.mocked(computeVirtualSimulationStep).mock.lastCall?.[0]).toMatchObject({operation: 'speed_closed_loop',
      dtS: .2, maximumRpm: 110, initialBowDistanceM: 1500, brakingPlan: input.berthPlan});
    expect(vi.mocked(computeVirtualSimulationStep).mock.lastCall?.[0]).not.toHaveProperty('output');
    expect(input).toEqual(before);
  });

  it('靠泊从声明初态独立预测，首个计程仪量测晚到时按真实时刻评价', () => {
    const run = evidence();
    run.courseKey='lng';run.lastTimeS=4;run.configuration={initialWaterSpeedMps:4,
      berth:{initialBowDistanceM:1500,stopLineNorthM:0}};
    run.trace=Array.from({length:81},(_,index) => ({...run.trace[0],timeS:index*.05,
      command:{headingDeg:0,surfaceDeg:[],shaftRpm:[50]}}));
    run.nativeSensorSamples=Array.from({length:20},(_,index) => ({signal:'SpeedLog',
      measurement:{t_sample_s:(index+1)*.2,t_arrive_s:(index+1)*.2+.05,value:3.9,quality:'Good'}}));
    const structure={kind:'fopdt' as const,k:.08,t_s:210,delay_s:1};
    run.initialInput.longitudinal={localModel:{structure,speedMps:4,shaftReferenceRpm:50},referenceMps:4,
      kpMultiplier:1,tiMultiplier:1,antiWindup:true,smithEnabled:false,filterTauS:.2,additionalCommandDelayS:0};
    run.initialInput.berthPlan={brakingDistanceM:1200,nodes:[{distanceM:30,speedMps:0}]};
    run.parameters={shaftConfigurations:[{ratedRpm:110}]} as VesselSessionFrame['parameters'];
    const model:FrozenVesselStudentModel={id:'model',scopeKey:run.scopeKey,channel:'shaft-reference-to-speed',label:'fixture',
      createdAtMs:0,serverId:null,contentHash:null,payload:{experimentKey:'lng',lineageKey:'fixture',structure,
        ioContract:{inputChannel:'ShaftReference0',outputChannel:'SpeedLog',inputUnit:'r/min',outputUnit:'m/s'},
        operatingPoint:{speedMps:4,inputOrigin:50,outputOrigin:4},identification:{algorithm:'fixture',settings:{},identifiedOk:true},
        trainingRuns:[],validationRuns:[],sampleDt:.2}};
    vi.mocked(computeVirtualSimulationStep).mockReturnValue({predicted:[4,...Array(20).fill(3.8)],
      commandsRpm:Array(21).fill(50),bowClearanceM:Array.from({length:21},(_,index)=>1500-index),metrics:{rmse:.1}});
    const comparison=compareVesselStudentModel(run,model,'independent_closed_loop',0,4);
    expect(vi.mocked(computeVirtualSimulationStep).mock.lastCall?.[0]).toMatchObject({initialSpeedMps:4,outputOffsetSamples:1});
    expect(comparison.timeS[0]).toBe(.2);
    expect(comparison.predicted).toHaveLength(20);
    expect(comparison.actual).toEqual(Array(20).fill(3.9));
    expect(comparison.predictedBowClearanceM?.[0]).toBe(1499);
    expect(()=>compareVesselStudentModel(run,model,'independent_closed_loop',.2,4)).toThrow('0s完整初态');
  });
});

describe('学生运行评价', () => {
  it('结束状态的累积功覆盖20Hz末帧近似值，细步安全指标保持独立', () => {
    vi.mocked(computeVirtualSimulationStep).mockReturnValue({positiveMotorWorkJ:4,headingRmseDeg:2});
    const run = evidence();
    run.checkpoint = JSON.stringify({plant:{state:{actuator_states:{positive_motor_work_j:[7,11]}}}});
    expect(evaluateVesselHeadingRun(run).metrics.positiveMotorWorkJ).toBe(18);
    run.checkpoint = JSON.stringify({course_evidence:{metrics:{positiveMotorWorkJ:23,maximumRollDeg:9}},
      plant:{state:{actuator_states:{positive_motor_work_j:[7,11]}}}});
    const evaluation = evaluateVesselHeadingRun(run);
    expect(evaluation.metrics).toMatchObject({positiveMotorWorkJ:23,headingRmseDeg:2});
    expect(evaluation.fineStepMetrics).toMatchObject({sampleCadenceS:1/120,rollWarningDeg:8,
      values:{maximumRollDeg:9,positiveMotorWorkJ:23}});
  });

  it('正在运行时保留未完成语义', () => {
    const run = evidence();
    run.stoppedAtMs = null;
    expect(() => evaluateVesselHeadingRun(run)).toThrow('运行结束后');
  });
});
