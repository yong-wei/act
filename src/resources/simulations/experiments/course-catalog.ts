import type { SimulationModelId } from '@/lib/browser-delivery/client';

import destroyer from './catalog/destroyer.json';
import lng from './catalog/lng.json';
import container from './catalog/container.json';
import cruise from './catalog/cruise.json';
import drilling from './catalog/drilling.json';
import icebreaker from './catalog/icebreaker.json';
import dredger from './catalog/dredger.json';

export type VesselCourseKey = 'destroyer' | 'lng' | 'container' | 'cruise' | 'drilling' | 'icebreaker' | 'dredger';

export interface VesselCourseStep {
  sequence: number;
  title: string;
  condition: string;
  interaction: string;
  evidence: string;
}

export interface VesselCourse {
  key: VesselCourseKey;
  experimentId: string;
  title: string;
  vessel: string;
  parameterVersion: string;
  logicalModelId: SimulationModelId;
  modelDesignDraftM: number;
  legacyYawOffsetRad: number;
  steps: readonly VesselCourseStep[];
  sourceIssue: number;
  sourceBodySha256: string;
}

const version2 = 'research-nominal-v2';
export const VESSEL_COURSES: Record<VesselCourseKey, VesselCourse> = {
  destroyer: { key: 'destroyer', experimentId: 'exp-01-055-heading', title: '055型驱逐舰航向控制',
    vessel: 'destroyer-055', parameterVersion: 'research-nominal-v6', logicalModelId: 'destroyer',
    modelDesignDraftM: 6.6, legacyYawOffsetRad: 0, ...destroyer },
  lng: { key: 'lng', experimentId: 'exp-02-lng-berthing', title: '长恒号LNG大惯性靠泊',
    vessel: 'lng-changheng', parameterVersion: version2, logicalModelId: 'lng-carrier',
    modelDesignDraftM: 11.5, legacyYawOffsetRad: -Math.PI / 2, ...lng },
  container: { key: 'container', experimentId: 'exp-03-container-schedule', title: '集装箱船航速、准点与燃油',
    vessel: 'container-msc', parameterVersion: version2, logicalModelId: 'container',
    modelDesignDraftM: 16.8, legacyYawOffsetRad: 0, ...container },
  cruise: { key: 'cruise', experimentId: 'exp-04-cruise-comfort', title: '邮轮转向、减摇与舒适性',
    vessel: 'cruise-adora', parameterVersion: version2, logicalModelId: 'luxury-liner',
    modelDesignDraftM: 8.26, legacyYawOffsetRad: 0, ...cruise },
  drilling: { key: 'drilling', experimentId: 'exp-05-981-dp', title: '海洋石油981动力定位',
    vessel: 'semisub-981', parameterVersion: 'research-nominal-v5', logicalModelId: 'drilling-rig',
    modelDesignDraftM: 19, legacyYawOffsetRad: 0, ...drilling },
  icebreaker: { key: 'icebreaker', experimentId: 'exp-06-xuelong2-ice', title: '雪龙2号吊舱与冰区控制',
    vessel: 'icebreaker-xuelong2', parameterVersion: version2, logicalModelId: 'icebreaker',
    modelDesignDraftM: 8.3, legacyYawOffsetRad: 0, ...icebreaker },
  dredger: { key: 'dredger', experimentId: 'exp-07-tianjing-dredging', title: '天鲸号作业定位与切削控制',
    vessel: 'dredger-tianjing', parameterVersion: version2, logicalModelId: 'dredger',
    modelDesignDraftM: 6, legacyYawOffsetRad: 0, ...dredger },
};

export function findVesselCourse(key: string): VesselCourse | undefined {
  return Object.hasOwn(VESSEL_COURSES, key) ? VESSEL_COURSES[key as VesselCourseKey] : undefined;
}
