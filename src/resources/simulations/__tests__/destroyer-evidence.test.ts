import { describe, expect, it } from 'vitest';
import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { StudentModelSaveInput } from '@/lib/student-model-artifact-contract';
import { DESTROYER_COURSE_STEPS } from '../experiments/destroyer-course';
import { validateDestroyerCourseEvidence, type DestroyerModelEvidence } from '../experiments/destroyer-evidence';

const input = {controlMode:'p' as const,pid:{kp:1,ki:0,kd:0},targetHeadingDeg:10,
  feedback:'measurement' as const,actuators:{shafts:[],surfaces:[]}};
const model:DestroyerModelEvidence = {id:'own-model',channel:'rudder-to-yaw',createdAtMs:1,
  payload:{structure:{kind:'nomoto1',k:.06,t_s:10},operatingPoint:{speedMps:8},
    trainingRuns:[{runRef:'training',startS:20,endS:300}]} as StudentModelSaveInput};
function run(id:string,sequence:number,kp = 1):VesselRunSummary {
  const step = DESTROYER_COURSE_STEPS[sequence-1];
  return {id,scopeKey:'scope',courseVersion:step.experimentVersion,stepSequence:sequence,createdAtMs:2,
    stoppedAtMs:3,lastTimeS:step.runDurationS ?? 300,durationS:step.runDurationS ?? 300,sampleCount:6000,
    configuration:step.configuration,initialInput:{...input,controlMode:step.controlMode,pid:{...input.pid,kp}},
    stopReason:'duration',designStudentModelId:model.id};
}

describe('055本人控制方案与报告证据', () => {
  it('比例增益检查本人模型的规定倍率及独立运行', () => {
    const evidence = {
      models:[model],
      comparisons:[],
      answers:{prediction:'增大比例增益会加快上升并抬高超调',interpretation:'比较本人两次响应'},
      designKp:()=>1,
    };
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[8],{...evidence,runs:[run('a',9,.5),run('b',9,2)]})).toBeNull();
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[8],{...evidence,runs:[run('a',9,.6),run('b',9,1.4)]})).toContain('0.5、1、2倍');
  });

  it('未见工况继承已修订方案的最终控制器，并核验整次冻结', () => {
    const source = run('source',16);
    source.finalInput = {...source.initialInput,pid:{kp:2,ki:.01,kd:8}};
    const unseen = run('unseen',18);
    unseen.createdAtMs = 4;
    unseen.controllerSourceRunId = source.id;
    unseen.initialInput = structuredClone(source.finalInput);
    const evidence = {
      runs:[source,unseen],
      models:[model],
      comparisons:[],
      answers:{prediction:'6 m/s下舵效减弱但保持有界收敛',interpretation:'分析降速验证'},
    };
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[17],evidence)).toBeNull();
    unseen.finalInput = {...unseen.initialInput,pid:{...unseen.initialInput.pid,kp:3}};
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[17],evidence)).toContain('保持');
  });

  it('波浪与滤波对照需要固定其他条件，积分对照保持PD基准参数',()=>{
    const evidence = {
      models:[model],
      comparisons:[],
      answers:{prediction:'同条件下改变单因子将体现对应物理变化',interpretation:'按同条件证据比较'},
    };
    const calm = run('calm',14), waves = run('waves',14);
    calm.configuration = {...calm.configuration,environment:'P0'};
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[13],{...evidence,runs:[calm,waves]})).toBeNull();
    waves.initialInput = {...waves.initialInput,pid:{...waves.initialInput.pid,kp:2}};
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[13],{...evidence,runs:[calm,waves]})).toContain('同一控制器');
    const raw = run('raw',15), filtered = run('filtered',15);
    raw.initialInput = {...raw.initialInput,derivativeFilterTauS:0};
    filtered.initialInput = {...filtered.initialInput,derivativeFilterTauS:.2};
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[14],{...evidence,runs:[raw,filtered]})).toBeNull();
    filtered.configuration = {...filtered.configuration,seed:17};
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[14],{...evidence,runs:[raw,filtered]})).toContain('固定其余参数');
    const pd = run('pd',11),pid = run('pid',11);
    pd.initialInput = {...pd.initialInput,controlMode:'pd'};
    pid.initialInput = {...pid.initialInput,pid:{kp:1,ki:.01,kd:0}};
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[10],{...evidence,runs:[pd,pid]})).toBeNull();
    pid.initialInput.pid.kd = 1;
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[10],{...evidence,runs:[pd,pid]})).toContain('固定其余参数');
  });

  it('边界步骤保留10m/s及8m/s两次运行并继承同一冻结来源',()=>{
    const source = run('source',17),high = run('high',19),reduced = run('reduced',19);
    for(const item of [high,reduced]) {
      item.createdAtMs=4;item.controllerSourceRunId=source.id;item.initialInput=structuredClone(source.initialInput);
    }
    reduced.configuration={...reduced.configuration,initialWaterSpeedMps:8};
    const evidence = {
      models:[model],
      comparisons:[],
      answers:{prediction:'10 m/s强风浪易触发边界约束，降速至8 m/s可改善安全余量',interpretation:'保留边界和降速证据'},
    };
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[18],{...evidence,runs:[source,high]})).toContain('至少2次');
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[18],{...evidence,runs:[source,high,reduced]})).toBeNull();
    reduced.configuration={...reduced.configuration,seed:17};
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[18],{...evidence,runs:[source,high,reduced]})).toContain('两次同条件');
  });

  it('缺少运行前预测时应拦截第9步与第11步等运行步提交', () => {
    const pd = run('pd',11), pid = run('pid',11);
    pd.initialInput = {...pd.initialInput,controlMode:'pd'};
    pid.initialInput = {...pid.initialInput,pid:{kp:1,ki:.01,kd:0}};
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[8],{
      runs:[run('a',9,.5),run('b',9,2)],
      models:[model],
      comparisons:[],
      answers:{interpretation:'比较本人两次响应'},
      designKp:()=>1,
    })).toBe('请先填写运行前预测与理由。');
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[10],{
      runs:[pd,pid],
      models:[model],
      comparisons:[],
      answers:{prediction:'   ',interpretation:'积分作用消除稳态风偏'},
    })).toBe('请先填写运行前预测与理由。');
  });

  it('六部分报告绑定训练、独立验证及同条件方案，不增加第七个说明', () => {
    const training = run('training',3), validation = run('validation',5);
    const first = run('first',9,.5), second = run('second',10,1);
    const answers = Object.fromEntries(['problem','identification','validation','comparison','revision','conclusion'].map((key)=>[key,'本人证据与推理']));
    const comparison = {id:'comparison',modelId:model.id,actuatorModelId:null,runId:validation.id,mode:'hull_model' as const,
      purpose:'validation' as const,createdAtMs:3,actualSampleCount:100};
    const evidence = {runs:[training,validation,first,second],models:[model],comparisons:[comparison],answers};
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[19],evidence)).toBeNull();
    second.configuration = {...second.configuration,seed:17};
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[19],evidence)).toContain('公平对照');
    second.configuration = first.configuration;
    expect(validateDestroyerCourseEvidence(DESTROYER_COURSE_STEPS[19],{...evidence,comparisons:[]})).toContain('独立运行');
  });
});
