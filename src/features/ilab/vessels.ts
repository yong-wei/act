/**
 * 实验空间申报实验使用的船型读数。
 * 数值来自平台已有船型配置，不在这里另造一套船体参数。
 * 055：src/resources/simulations/profiles/destroyer-055.ts
 * 雪龙2号：src/resources/simulations/profiles/icebreaker-xuelong.ts
 * 海洋石油981：src/resources/simulations/profiles/drilling-hysy981.ts
 */

export type IlabVesselId = 'destroyer-055' | 'xuelong' | 'hysy981';

export interface IlabVessel {
  id: IlabVesselId;
  name: string;
  scene: string;
  lengthM: number;
  beamM: number;
  draftM: number;
  displacementT: number;
  actuator: 'rudder' | 'azipod' | 'thruster';
  /** 雪龙2号的 Nomoto 行是说明书参考值，实船没有传统舵。981 没有该模型。 */
  nomoto: { K: number; T: number; maxRudderDeg: number; maxRudderRateDeg: number; speedMps: number } | null;
  pid: { kp: number; ki: number; kd: number };
  headingToleranceDeg: number;
  overshootMaxPct: number;
  settlingTimeS: number;
  /** 仅 981 使用的动力定位读数。 */
  dp: {
    positionToleranceM: number;
    maxSingleThrustKn: number;
    maxAzimuthRateDeg: number;
    maxCurrentMps: number;
    maxWindMps: number;
    emergencyDisconnectM: number;
    redAlertM: number;
  } | null;
}

export const ILAB_VESSELS: Record<IlabVesselId, IlabVessel> = {
  'destroyer-055': {
    id: 'destroyer-055',
    name: '055型驱逐舰',
    scene: '智能船舶自动舵',
    lengthM: 180,
    beamM: 20,
    draftM: 6.6,
    displacementT: 13000,
    actuator: 'rudder',
    nomoto: { K: 0.08, T: 55, maxRudderDeg: 35, maxRudderRateDeg: 5, speedMps: 15 },
    pid: { kp: 1.4, ki: 0.02, kd: 0.7 },
    headingToleranceDeg: 1,
    overshootMaxPct: 10,
    settlingTimeS: 60,
    dp: null,
  },
  xuelong: {
    id: 'xuelong',
    name: '雪龙2号',
    scene: '极地科考高海况',
    lengthM: 122.5,
    beamM: 22,
    draftM: 7.85,
    displacementT: 13990,
    actuator: 'azipod',
    nomoto: { K: 0.06, T: 45, maxRudderDeg: 0, maxRudderRateDeg: 12, speedMps: 6 },
    pid: { kp: 1.2, ki: 0.015, kd: 0.8 },
    headingToleranceDeg: 2,
    overshootMaxPct: 15,
    settlingTimeS: 90,
    dp: null,
  },
  hysy981: {
    id: 'hysy981',
    name: '海洋石油981',
    scene: '半潜平台动力定位',
    lengthM: 114,
    beamM: 78,
    draftM: 37,
    displacementT: 55000,
    actuator: 'thruster',
    nomoto: null,
    pid: { kp: 500, ki: 10, kd: 2000 },
    headingToleranceDeg: 2,
    overshootMaxPct: 10,
    settlingTimeS: 120,
    dp: {
      positionToleranceM: 1,
      maxSingleThrustKn: 800,
      maxAzimuthRateDeg: 15,
      maxCurrentMps: 1.5,
      maxWindMps: 25,
      emergencyDisconnectM: 10,
      redAlertM: 5,
    },
  },
};

export const ILAB_VESSEL_LIST = Object.values(ILAB_VESSELS);

export function isIlabVesselId(value: string): value is IlabVesselId {
  return value === 'destroyer-055' || value === 'xuelong' || value === 'hysy981';
}

export const ILAB_DP_REFERENCE = ILAB_VESSELS.hysy981;
