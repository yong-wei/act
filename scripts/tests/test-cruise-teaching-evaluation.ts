import assert from 'node:assert/strict';
import { CruiseShipEngine } from '../src/resources/simulations/physics/engine-factory';
import { cruiseAdoraProfile } from '../src/resources/simulations/profiles/cruise-adora';
import { toDegrees, toRadians } from '../src/resources/simulations/core/constants';

type Scenario = {
  seaState: number;
  waveDirection: number;
  finEnabled: boolean;
  notchEnabled: boolean;
  mode: 'manual' | 'pid';
  rudderDeg: number;
  durationSec?: number;
};

type ScenarioResult = {
  maxRollDeg: number;
  rollRmsDeg: number;
  maxLateralAccelG: number;
  maxYawRateDegS: number;
  msi: number;
  rating: string;
};

function runScenario(s: Scenario): ScenarioResult {
  const dt = 1 / 60;
  const durationSec = s.durationSec ?? 180;
  const steps = Math.floor(durationSec / dt);
  const speed = cruiseAdoraProfile.dynamics.speed.cruise;

  const engine = new CruiseShipEngine(cruiseAdoraProfile);
  engine.initialize(0, 0, 0);
  engine.setSeaState(s.seaState, s.waveDirection);
  engine.setFinStabilizerEnabled(s.finEnabled);
  engine.setNotchFilterEnabled(s.notchEnabled);

  let maxRollDeg = 0;
  let sumRollSq = 0;
  let maxLateralAccelG = 0;
  let maxYawRateDegS = 0;

  for (let i = 0; i < steps; i += 1) {
    const t = i * dt;
    engine.step(30, null, s.mode, s.mode === 'manual' ? s.rudderDeg : 0, speed, dt, t);
    const state = engine.getState(t);
    const rollDeg = Math.abs(toDegrees(state.waveRoll));
    const centripetalAccelG = Math.abs((state.speed * toRadians(state.yawRate)) / 9.81);
    const rollInducedAccelG = Math.abs(Math.sin(state.waveRoll)) * 1.2;
    const lateralAccelG = centripetalAccelG + rollInducedAccelG;

    maxRollDeg = Math.max(maxRollDeg, rollDeg);
    sumRollSq += rollDeg * rollDeg;
    maxLateralAccelG = Math.max(maxLateralAccelG, lateralAccelG);
    maxYawRateDegS = Math.max(maxYawRateDegS, Math.abs(state.yawRate));
  }

  const comfort = engine.getComfortMetrics();

  return {
    maxRollDeg,
    rollRmsDeg: Math.sqrt(sumRollSq / steps),
    maxLateralAccelG,
    maxYawRateDegS,
    msi: comfort.msi,
    rating: comfort.comfortRating,
  };
}

function main() {
  const worst = runScenario({ seaState: 7, waveDirection: 90, finEnabled: false, notchEnabled: false, mode: 'manual', rudderDeg: 35 });
  const highWithControl = runScenario({ seaState: 7, waveDirection: 90, finEnabled: true, notchEnabled: true, mode: 'manual', rudderDeg: 35 });
  const mediumNoControl = runScenario({ seaState: 4, waveDirection: 90, finEnabled: false, notchEnabled: false, mode: 'manual', rudderDeg: 35 });
  const mediumWithControl = runScenario({ seaState: 4, waveDirection: 90, finEnabled: true, notchEnabled: true, mode: 'manual', rudderDeg: 35 });
  const lightNoControl = runScenario({ seaState: 2, waveDirection: 90, finEnabled: false, notchEnabled: false, mode: 'manual', rudderDeg: 35 });
  const calmGentle = runScenario({ seaState: 1, waveDirection: 0, finEnabled: true, notchEnabled: true, mode: 'manual', rudderDeg: 5 });

  console.log('Teaching evaluation baseline:', {
    worst,
    highWithControl,
    mediumNoControl,
    mediumWithControl,
    lightNoControl,
    calmGentle,
  });

  const ratingRank: Record<string, number> = {
    excellent: 0,
    good: 1,
    moderate: 2,
    poor: 3,
    unacceptable: 4,
  };

  // 教学目标约束
  assert.ok(worst.maxRollDeg >= 2.5, '最恶劣工况下应出现明显横倾（max roll >= 2.5°）');
  assert.ok(worst.maxLateralAccelG >= 0.058, '最恶劣工况下满舵横向加速度应明显（>= 0.058g）');
  assert.ok(worst.msi >= 40 || ratingRank[worst.rating] >= ratingRank.unacceptable, '最恶劣工况舒适度应接近或进入红线区');

  assert.ok(ratingRank[highWithControl.rating] >= ratingRank.moderate, '大浪+补偿时舒适度应难以稳定在黄线以下');
  assert.ok(ratingRank[mediumNoControl.rating] >= ratingRank.moderate, '中浪无补偿时舒适度应难以稳定在黄线以下');

  assert.ok(ratingRank[lightNoControl.rating] >= ratingRank.good, '轻浪无补偿时舒适度应难以长期保持优秀');
  assert.ok(ratingRank[mediumWithControl.rating] >= ratingRank.good, '中浪有补偿时舒适度应难以长期保持优秀');

  assert.ok(calmGentle.maxYawRateDegS <= 0.8, '平静海况轻微转向时应保持较低转艏角速度');
  assert.ok(calmGentle.msi < 5 && calmGentle.rating === 'excellent', '仅在平静且低转向强度下保持优秀');

  console.log('PASS: cruise teaching evaluation checks passed.');
}

main();
