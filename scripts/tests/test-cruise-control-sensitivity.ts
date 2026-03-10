import assert from 'node:assert/strict';
import { CruiseShipEngine } from '../src/resources/simulations/physics/engine-factory';
import { cruiseAdoraProfile } from '../src/resources/simulations/profiles/cruise-adora';
import { toDegrees } from '../src/resources/simulations/core/constants';

type RunConfig = {
  seaState: number;
  waveDirection: number;
  finEnabled: boolean;
  notchEnabled: boolean;
  durationSec?: number;
  dt?: number;
};

type RunResult = {
  maxRollDeg: number;
  rmsRollDeg: number;
};

function runScenario(config: RunConfig): RunResult {
  const durationSec = config.durationSec ?? 180;
  const dt = config.dt ?? 1 / 60;
  const steps = Math.floor(durationSec / dt);

  const engine = new CruiseShipEngine(cruiseAdoraProfile);
  engine.initialize(0, 0, 0);
  engine.setSeaState(config.seaState, config.waveDirection);
  engine.setFinStabilizerEnabled(config.finEnabled);
  engine.setNotchFilterEnabled(config.notchEnabled);

  let maxRollDeg = 0;
  let sumRollSq = 0;

  for (let i = 0; i < steps; i += 1) {
    const time = i * dt;
    engine.step(0, null, 'pid', 0, cruiseAdoraProfile.dynamics.speed.cruise, dt, time);
    const rollDeg = Math.abs(toDegrees(engine.getInternalState().rollCoupled.rollRad));
    maxRollDeg = Math.max(maxRollDeg, rollDeg);
    sumRollSq += rollDeg * rollDeg;
  }

  return {
    maxRollDeg,
    rmsRollDeg: Math.sqrt(sumRollSq / steps),
  };
}

function main() {
  const lowSea = runScenario({ seaState: 1, waveDirection: 90, finEnabled: true, notchEnabled: true });
  const highSea = runScenario({ seaState: 7, waveDirection: 90, finEnabled: true, notchEnabled: true });
  const headSea = runScenario({ seaState: 7, waveDirection: 0, finEnabled: true, notchEnabled: true });

  const fullOn = runScenario({ seaState: 7, waveDirection: 90, finEnabled: true, notchEnabled: true });
  const noFin = runScenario({ seaState: 7, waveDirection: 90, finEnabled: false, notchEnabled: true });
  const noNotch = runScenario({ seaState: 7, waveDirection: 90, finEnabled: true, notchEnabled: false });
  const noControls = runScenario({ seaState: 7, waveDirection: 90, finEnabled: false, notchEnabled: false });

  console.log('Sensitivity metrics:', {
    lowSea,
    highSea,
    headSea,
    fullOn,
    noFin,
    noNotch,
    noControls,
    seaRatio: highSea.rmsRollDeg / Math.max(lowSea.rmsRollDeg, 1e-9),
    waveDirRatio: highSea.rmsRollDeg / Math.max(headSea.rmsRollDeg, 1e-9),
    finReduction: (noFin.rmsRollDeg - fullOn.rmsRollDeg) / Math.max(noFin.rmsRollDeg, 1e-9),
    notchReduction: (noNotch.rmsRollDeg - fullOn.rmsRollDeg) / Math.max(noNotch.rmsRollDeg, 1e-9),
  });

  // 目标：各开关和环境配置都具备“明显感知”差异
  assert.ok(noControls.maxRollDeg >= 2.0, '高海况横浪且全部控制关闭时，最大横摇角应 >= 2°');
  assert.ok(highSea.rmsRollDeg >= lowSea.rmsRollDeg * 2.0, '海况7相较海况1，横摇RMS应至少提升2倍');
  assert.ok(highSea.rmsRollDeg >= headSea.rmsRollDeg * 2.0, '横浪相较迎浪，横摇RMS应至少提升2倍');
  assert.ok(fullOn.rmsRollDeg <= noFin.rmsRollDeg * 0.8, '开启减摇鳍后，横摇RMS应至少下降20%');
  assert.ok(fullOn.rmsRollDeg <= noNotch.rmsRollDeg * 0.8, '开启陷波滤波器后，横摇RMS应至少下降20%');

  console.log('PASS: cruise control sensitivity checks passed.');
}

main();
