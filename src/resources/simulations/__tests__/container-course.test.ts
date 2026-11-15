import {describe, expect, it} from 'vitest';
import type {VesselSessionFrame, VesselSessionInput} from '@/lib/control-engine/vessel-session';
import type {FrozenVesselStudentModel} from '../experiments/student-analysis';
import {validateExperiment} from '../contracts/experiment-step';
import {CONTAINER_COURSE_STEPS, containerCourseConfiguration, containerCourseDefaultSettings, containerCourseInput,
  containerModelBank, validateContainerCourseSettings} from '../experiments/container-course';
import {lngCourseAdapter} from '../experiments/course-adapter';

const input: VesselSessionInput = {controlMode:'manual',pid:{kp:0,ki:0,kd:0},targetHeadingDeg:0,feedback:'measurement',
  actuators:{shafts:[{speed_reference_rad_s:8,motor_torque_override_nm:null,azimuth_rad:0,drive_cut:false,azimuth_jammed:false}],surfaces:[]}};
const frame = (timeS: number) => ({timeS}) as VesselSessionFrame;
const models = [.2,.6,.9].map((loading,index) => ({id:`model-${index}`,channel:'shaft-reference-to-speed',
  payload:{structure:{kind:'fopdt',k:.05,t_s:160,delay_s:2},operatingPoint:{loadingRatio:loading,speedMps:8,inputOrigin:55}}})) as FrozenVesselStudentModel[];

describe('集装箱船原页面课程合同', () => {
  it('保持20步100分及真实装载、初速与航次条件', () => {
    expect(CONTAINER_COURSE_STEPS).toHaveLength(20);
    expect(validateExperiment(CONTAINER_COURSE_STEPS)).toEqual([]);
    expect(CONTAINER_COURSE_STEPS.reduce((sum,step) => sum+step.points,0)).toBe(100);
    expect(containerCourseConfiguration(2)).toMatchObject({initialWaterSpeedMps:0,loadingRatio:.2});
    expect(containerCourseConfiguration(11).containerVoyage?.segmentSpeedsMps).toEqual([8,8,8,8]);
    expect(containerCourseConfiguration(19,{...containerCourseDefaultSettings(19),validationSeed:29})).toMatchObject({seed:29,loadingRatio:.8});
    expect(() => containerCourseConfiguration(5,{...containerCourseDefaultSettings(5),loadingRatio:.6})).toThrow('分别比较');
  });

  it('30秒激励只改变轴速命令，10m/s可以选用负阶跃', () => {
    const settings=containerCourseDefaultSettings(3);
    const saved=structuredClone(input);
    expect(containerCourseInput(3,settings,input,frame(29),[]).actuators.shafts[0].speed_reference_rad_s).toBe(8);
    expect(containerCourseInput(3,settings,input,frame(30),[]).actuators.shafts[0].speed_reference_rad_s).toBe(8.4);
    expect(containerCourseInput(4,settings,input,frame(30),[]).actuators.shafts[0].speed_reference_rad_s).toBe(7.68);
    expect(containerCourseInput(6,containerCourseDefaultSettings(6),input,frame(30),[]).actuators.shafts[0].speed_reference_rad_s).toBe(7.6);
    expect(input).toEqual(saved);
  });

  it('控制方案引用三个本人模型，固定与调度、积分跟踪及速度计划可区分', () => {
    const settings={...containerCourseDefaultSettings(10),modelIds:models.map((model) => model.id) as [string,string,string]};
    expect(containerModelBank(settings,models).map((model) => model.loadingRatio)).toEqual([.2,.6,.9]);
    expect(containerCourseInput(8,settings,input,frame(40),models).containerSpeed).toMatchObject({schedulingEnabled:false,referenceMps:9});
    expect(containerCourseInput(10,settings,input,frame(100),models).containerSpeed).toMatchObject({schedulingEnabled:true,bumpless:true,referenceMps:10});
    expect(containerCourseInput(10,{...settings,bumpless:false},input,frame(500),models).containerSpeed).toMatchObject({bumpless:false,referenceMps:8});
    expect(() => containerModelBank({...settings,modelIds:['model-0','model-0','model-1']},models)).toThrow('三个不同');
    expect(validateContainerCourseSettings({...settings,segmentSpeedsMps:[8,8,13,8]})).toBeTruthy();
  });

  it('旧LNG草稿与冻结的第7/8步计划仍按原设置恢复', () => {
    const settings=lngCourseAdapter.defaultSettings(7);
    expect(lngCourseAdapter.restoreSettings(settings,8)).toEqual(settings);
    expect(lngCourseAdapter.nativeSequence?.(7)).toBe(8);
    expect(lngCourseAdapter.previousPlanSequence?.(8)).toBe(7);
  });
});
