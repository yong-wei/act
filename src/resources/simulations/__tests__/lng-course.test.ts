import { describe, expect, it } from 'vitest';
import type { VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import { validateExperiment } from '../contracts/experiment-step';
import { LNG_COURSE_STEPS, lngCourseConfiguration, lngCourseDefaultSettings, lngCourseInput,
  validateLngCourseSettings } from '../experiments/lng-course';

const initial: VesselSessionInput = {controlMode:'manual',pid:{kp:0,ki:0,kd:0},targetHeadingDeg:0,feedback:'measurement',
  actuators:{shafts:[0,1].map(()=>({speed_reference_rad_s:10,motor_torque_override_nm:null,
    azimuth_rad:0,drive_cut:false,azimuth_jammed:false})),surfaces:[]}};
const parameters = {shaftConfigurations:[{ratedRpm:200},{ratedRpm:200}]} as VesselSessionFrame['parameters'];

describe('LNG专项课程命令合同',()=>{
  it('固定20步、100分及各装载和靠泊初态',()=>{
    expect(LNG_COURSE_STEPS).toHaveLength(20);
    expect(validateExperiment(LNG_COURSE_STEPS)).toEqual([]);
    expect(LNG_COURSE_STEPS.reduce((sum,step)=>sum+step.points,0)).toBe(100);
    expect(LNG_COURSE_STEPS.filter(step=>step.stepKind === 'analysis').map(step=>step.sequence)).toEqual([3,7,20]);
    expect(lngCourseConfiguration(8)).toMatchObject({waterDepthM:40,initialWaterSpeedMps:4,
      berth:{initialBowDistanceM:1500,stopLineNorthM:0}});
    expect(lngCourseConfiguration(12).loadingRatio).toBe(.30);
    expect(lngCourseConfiguration(19,{...lngCourseDefaultSettings(19),validationSeed:29})).toMatchObject({loadingRatio:.95,seed:29});
  });

  it('小阶跃、自由停车和反车只修改命令，初始命令保持独立',()=>{
    const settings = lngCourseDefaultSettings(2);
    const before = structuredClone(initial);
    expect(lngCourseInput(LNG_COURSE_STEPS[1],settings,initial,{timeS:19,parameters}).actuators.shafts[0].speed_reference_rad_s).toBe(10);
    expect(lngCourseInput(LNG_COURSE_STEPS[1],settings,initial,{timeS:20,parameters}).actuators.shafts[0].speed_reference_rad_s).toBe(10.5);
    expect(lngCourseInput(LNG_COURSE_STEPS[4],settings,initial,{timeS:20,parameters}).actuators.shafts[0].motor_torque_override_nm).toBe(0);
    expect(lngCourseInput(LNG_COURSE_STEPS[5],settings,initial,{timeS:20,parameters}).actuators.shafts[0].speed_reference_rad_s).toBeCloseTo(-200*Math.PI/30*.3);
    expect(initial).toEqual(before);
  });

  it('转向终值相同且斜坡可选，速度计划需要本人模型及有序节点',()=>{
    const settings = {...lngCourseDefaultSettings(13),headingRampS:60 as const};
    expect(lngCourseInput(LNG_COURSE_STEPS[12],settings,initial,{timeS:50,parameters}).targetHeadingDeg).toBe(5);
    expect(lngCourseInput(LNG_COURSE_STEPS[12],settings,initial,{timeS:80,parameters}).targetHeadingDeg).toBe(10);
    expect(()=>lngCourseInput(LNG_COURSE_STEPS[7],settings,initial,{timeS:0,parameters})).toThrow('本人冻结');
    expect(validateLngCourseSettings({...settings,speedNodes:[{distanceM:30,speedMps:1},{distanceM:600,speedMps:2}]})).toContain('递减');
  });
});
