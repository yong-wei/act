import { describe, expect, it } from 'vitest';
import type { VesselTracePoint } from '@/features/simulations/run-evidence';
import { calculateVesselRunMetrics } from '../course-run-metrics';
import { summarizeVesselReview, vesselStepReviewLimits, vesselCourseStepReviewLimits, type VesselStepReview } from '../course-report-review-contract';

function trace(endTimeS:number, settledAtS:number):VesselTracePoint[] {
  return Array.from({length:Math.round(endTimeS*20)},(_,tick)=>{
    const timeS = tick*.05;
    return {timeS,command:{headingDeg:timeS < 20 ? 0 : 10,shaftRpm:[],surfaceDeg:[]},
      measurements:{Heading:{value:timeS < settledAtS ? 0 : 10,sampledAtS:timeS,arrivedAtS:timeS,quality:'Good'}},
      estimate:{headingDeg:0,yawRateDegS:0,groundBodySpeedMps:0,northM:0,eastM:0},
      truth:{headingDeg:999,yawRateDegS:999,rollDeg:1,pitchDeg:0,rollRateDegS:0,pitchRateDegS:0,
        waterSpeedMps:8,groundBodySpeedMps:8,northM:0,eastM:0,shaftRpm:[],surfaceDeg:[tick*.01,tick*.01],
        azimuthDeg:[],windLoad:null,waveFirstLoad:null,waveSecondLoad:null,propellerWorkJ:[],motorPowerW:[2e6],
        positiveMotorWorkJ:timeS*4e6,fuelKg:null}};
  });
}

describe('20Hz运行评价与教师量规',()=>{
  it('从仪器量测评价末120秒，调节时间要求末段连续60秒',()=>{
    const points = trace(180,30);
    const metrics = calculateVesselRunMetrics(points,180);
    expect(metrics.final120sHeadingMaeDeg).toBe(0);
    expect(metrics.settlingTimeS).toBeCloseTo(10,7);
    expect(metrics.headingOvershootPercent).toBeCloseTo(0,12);
    expect(metrics.rudderTotalVariationDeg).toBeCloseTo((points.length-1)*.01,8);
    expect(calculateVesselRunMetrics(trace(50,30),50).settlingTimeS).toBeNull();
  });
  it('末点进入误差带或缺测均不能伪造已收敛',()=>{
    const points = trace(120,119.95);
    expect(calculateVesselRunMetrics(points,120).settlingTimeS).toBeNull();
    for (const point of points) {point.measurements.Heading.value = null;point.measurements.Heading.quality = 'Missing';}
    const missing = calculateVesselRunMetrics(points,120);
    expect(missing.headingRmseDeg).toBeNull();
    expect(missing.final120sHeadingMaeDeg).toBeNull();
    expect(missing.validHeadingSamples).toBe(0);
  });
  it('起始即给定参考和末段反向阶跃分别保留超调幅值定义',()=>{
    const points = trace(180,30);
    for (const point of points) {point.command.headingDeg = 10;point.measurements.Heading.value = 12;}
    expect(calculateVesselRunMetrics(points,180,0).headingOvershootPercent).toBeCloseTo(20);
    for (const point of points) {point.command.headingDeg = point.timeS < 20 ? 60 : 0;point.measurements.Heading.value = -6;}
    expect(calculateVesselRunMetrics(points,180,0).headingOvershootPercent).toBeCloseTo(10);
  });
  it('保持固定的100分权重，待评项保持为空',()=>{
    const steps:VesselStepReview[] = Array.from({length:20},(_,index)=>({stepSequence:index+1,attemptId:`attempt-${index}`,
      ...vesselStepReviewLimits(index+1,index >= 8 && index < 19),feedback:''}));
    expect(summarizeVesselReview(steps)).toEqual({earned:100,complete:true,finalScore:100});
    steps[1].interpretation = null;
    expect(summarizeVesselReview(steps).complete).toBe(false);
    expect(summarizeVesselReview(steps).finalScore).toBeNull();
    expect(summarizeVesselReview(steps).earned).toBe(99.1);
  });
  it('LNG设计阶段与教师服务端、页面使用同一课程量规', () => {
    expect(vesselCourseStepReviewLimits('lng', 7)).toEqual(vesselStepReviewLimits(7, true));
    expect(vesselCourseStepReviewLimits('lng', 6)).toEqual(vesselStepReviewLimits(6, false));
    const score = Array.from({length: 20}, (_, index) => vesselCourseStepReviewLimits('lng', index + 1))
      .flatMap((limits) => Object.values(limits)).reduce((sum, value) => sum + value, 0);
    expect(score).toBeCloseTo(100, 10);
  });
});
