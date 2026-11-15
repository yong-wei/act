import type { SimulationModelId } from '@/lib/browser-delivery/client';

import destroyer from './catalog/destroyer.json';
import lng from './catalog/lng.json';
import container from './catalog/container.json';
import cruise from './catalog/cruise.json';
import drilling from './catalog/drilling.json';
import icebreaker from './catalog/icebreaker.json';
import dredger from './catalog/dredger.json';
import teachingCards from './catalog/teaching-cards.json';

export type VesselCourseKey = 'destroyer' | 'lng' | 'container' | 'cruise' | 'drilling' | 'icebreaker' | 'dredger';
export const VESSEL_GUIDE_EDITION = '2026.11.16';
export const VESSEL_TEACHING_CARDS = teachingCards;

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
  guideFile: string;
}

const version3 = 'research-nominal-v3';
export const VESSEL_COURSES: Record<VesselCourseKey, VesselCourse> = {
  destroyer: { key: 'destroyer', experimentId: 'exp-01-055-heading', title: '055型驱逐舰航向控制',
    guideFile: 'guide-01-destroyer.pdf',
    vessel: 'destroyer-055', parameterVersion: 'research-nominal-v6', logicalModelId: 'destroyer',
    modelDesignDraftM: 6.6, legacyYawOffsetRad: 0, ...destroyer },
  lng: { key: 'lng', experimentId: 'exp-02-lng-berthing', title: '长恒系列LNG运输船大惯性操纵（教学代表船）',
    guideFile: 'guide-02-lng-carrier.pdf',
    vessel: 'lng-changheng', parameterVersion: version3, logicalModelId: 'lng-carrier',
    modelDesignDraftM: 11.5, legacyYawOffsetRad: -Math.PI / 2, ...lng },
  container: { key: 'container', experimentId: 'exp-03-container-schedule', title: '集装箱船航速、准点与燃油',
    guideFile: 'guide-03-container.pdf',
    vessel: 'container-msc', parameterVersion: version3, logicalModelId: 'container',
    modelDesignDraftM: 16.8, legacyYawOffsetRad: 0, ...container },
  cruise: { key: 'cruise', experimentId: 'exp-04-cruise-comfort', title: '邮轮转向、减摇与舒适性',
    guideFile: 'guide-04-cruise.pdf',
    vessel: 'cruise-adora', parameterVersion: version3, logicalModelId: 'luxury-liner',
    modelDesignDraftM: 8.26, legacyYawOffsetRad: 0, ...cruise },
  drilling: { key: 'drilling', experimentId: 'exp-05-981-dp', title: '海洋石油981动力定位',
    guideFile: 'guide-05-drilling-platform.pdf',
    vessel: 'semisub-981', parameterVersion: 'research-nominal-v5', logicalModelId: 'drilling-rig',
    modelDesignDraftM: 19, legacyYawOffsetRad: 0, ...drilling },
  icebreaker: { key: 'icebreaker', experimentId: 'exp-06-xuelong2-ice', title: '雪龙2号吊舱与冰区控制',
    guideFile: 'guide-06-icebreaker.pdf',
    vessel: 'icebreaker-xuelong2', parameterVersion: version3, logicalModelId: 'icebreaker',
    modelDesignDraftM: 8.3, legacyYawOffsetRad: 0, ...icebreaker },
  dredger: { key: 'dredger', experimentId: 'exp-07-tianjing-dredging', title: '天鲸号工况切换与作业定位',
    guideFile: 'guide-07-dredger.pdf',
    vessel: 'dredger-tianjing', parameterVersion: version3, logicalModelId: 'dredger',
    modelDesignDraftM: 6, legacyYawOffsetRad: 0, ...dredger },
};

export function findVesselCourse(key: string): VesselCourse | undefined {
  return Object.hasOwn(VESSEL_COURSES, key) ? VESSEL_COURSES[key as VesselCourseKey] : undefined;
}
