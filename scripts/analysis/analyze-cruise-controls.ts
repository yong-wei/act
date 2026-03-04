import { CruiseShipEngine } from '../src/resources/simulations/physics/engine-factory';
import { cruiseAdoraProfile } from '../src/resources/simulations/profiles/cruise-adora';
import { toDegrees } from '../src/resources/simulations/core/constants';

type Scenario = {
  name: string;
  seaState: number;
  waveDirection: number;
  finEnabled: boolean;
  notchEnabled: boolean;
};

type ScenarioResult = {
  name: string;
  seaState: number;
  waveDirection: number;
  finEnabled: boolean;
  notchEnabled: boolean;
  maxRollDeg: number;
  rmsRollDeg: number;
  avgRollDeg: number;
  maxRollRateDegS: number;
  maxYawRateDegS: number;
  finalMsiPct: number;
  maxFinMomentNm: number;
  avgFinMomentNm: number;
  maxFinPowerKw: number;
};

function createEngine(): CruiseShipEngine {
  return new CruiseShipEngine(cruiseAdoraProfile);
}

function runScenario(scenario: Scenario, durationSec = 180, dt = 1 / 60): ScenarioResult {
  const engine = createEngine();
  const targetHeading = 0;
  const cruiseSpeed = cruiseAdoraProfile.dynamics.speed.cruise;

  engine.initialize(0, 0, 0);
  engine.setSeaState(scenario.seaState, scenario.waveDirection);
  engine.setFinStabilizerEnabled(scenario.finEnabled);
  engine.setNotchFilterEnabled(scenario.notchEnabled);

  let maxRollDeg = 0;
  let sumRollDeg = 0;
  let sumRollDegSq = 0;
  let maxRollRateDegS = 0;
  let maxYawRateDegS = 0;
  let maxFinMomentNm = 0;
  let sumFinMomentNm = 0;
  let maxFinPowerKw = 0;

  const steps = Math.floor(durationSec / dt);

  for (let i = 0; i < steps; i += 1) {
    const time = i * dt;
    engine.step(targetHeading, null, 'pid', 0, cruiseSpeed, dt, time);

    const internal = engine.getInternalState();
    const rollDeg = Math.abs(toDegrees(internal.rollCoupled.rollRad));
    const rollRateDegS = Math.abs(toDegrees(internal.rollCoupled.rollRateRad));
    const yawRateDegS = Math.abs(toDegrees(internal.rollCoupled.yawRateRad));
    const finMomentNm = Math.abs(internal.fin.antiRollMoment);
    const finPowerKw = internal.fin.powerConsumption;

    maxRollDeg = Math.max(maxRollDeg, rollDeg);
    sumRollDeg += rollDeg;
    sumRollDegSq += rollDeg * rollDeg;
    maxRollRateDegS = Math.max(maxRollRateDegS, rollRateDegS);
    maxYawRateDegS = Math.max(maxYawRateDegS, yawRateDegS);
    maxFinMomentNm = Math.max(maxFinMomentNm, finMomentNm);
    sumFinMomentNm += finMomentNm;
    maxFinPowerKw = Math.max(maxFinPowerKw, finPowerKw);
  }

  const comfort = engine.getComfortMetrics();
  const avgRollDeg = sumRollDeg / steps;
  const rmsRollDeg = Math.sqrt(sumRollDegSq / steps);

  return {
    name: scenario.name,
    seaState: scenario.seaState,
    waveDirection: scenario.waveDirection,
    finEnabled: scenario.finEnabled,
    notchEnabled: scenario.notchEnabled,
    maxRollDeg,
    rmsRollDeg,
    avgRollDeg,
    maxRollRateDegS,
    maxYawRateDegS,
    finalMsiPct: comfort.msi,
    maxFinMomentNm,
    avgFinMomentNm: sumFinMomentNm / steps,
    maxFinPowerKw,
  };
}

function percentDelta(base: number, value: number): string {
  if (Math.abs(base) < 1e-9) {
    return 'n/a';
  }
  const pct = ((value - base) / base) * 100;
  return `${pct.toFixed(1)}%`;
}

function main() {
  const scenarios: Scenario[] = [
    { name: 'A_低海况迎浪_全开', seaState: 1, waveDirection: 0, finEnabled: true, notchEnabled: true },
    { name: 'B_低海况横浪_全开', seaState: 1, waveDirection: 90, finEnabled: true, notchEnabled: true },
    { name: 'C_高海况横浪_全开', seaState: 7, waveDirection: 90, finEnabled: true, notchEnabled: true },
    { name: 'D_高海况迎浪_全开', seaState: 7, waveDirection: 0, finEnabled: true, notchEnabled: true },
    { name: 'E_高海况横浪_关减摇鳍', seaState: 7, waveDirection: 90, finEnabled: false, notchEnabled: true },
    { name: 'F_高海况横浪_关陷波', seaState: 7, waveDirection: 90, finEnabled: true, notchEnabled: false },
    { name: 'G_高海况横浪_双关', seaState: 7, waveDirection: 90, finEnabled: false, notchEnabled: false },
  ];

  const results = scenarios.map((s) => runScenario(s));

  const printable = results.map((r) => ({
    场景: r.name,
    海况: r.seaState,
    波向: `${r.waveDirection}°`,
    减摇鳍: r.finEnabled ? '开' : '关',
    陷波: r.notchEnabled ? '开' : '关',
    最大横摇角: r.maxRollDeg.toFixed(3),
    横摇RMS: r.rmsRollDeg.toFixed(3),
    平均横摇: r.avgRollDeg.toFixed(3),
    最大横摇角速度: r.maxRollRateDegS.toFixed(3),
    最终MSI: r.finalMsiPct.toFixed(3),
    最大鳍力矩N_m: r.maxFinMomentNm.toFixed(2),
    平均鳍力矩N_m: r.avgFinMomentNm.toFixed(2),
    最大鳍功率kW: r.maxFinPowerKw.toFixed(2),
  }));

  console.log('\n=== 邮轮仿真控制对照实验（180s, dt=1/60） ===');
  console.table(printable);

  const baseline = results.find((r) => r.name === 'C_高海况横浪_全开');
  if (!baseline) {
    return;
  }

  console.log('\n=== 以 C_高海况横浪_全开 为基准的差异（最大横摇角 / RMS / MSI） ===');
  for (const r of results) {
    console.log(
      `${r.name}: maxRoll ${percentDelta(baseline.maxRollDeg, r.maxRollDeg)}, ` +
      `rmsRoll ${percentDelta(baseline.rmsRollDeg, r.rmsRollDeg)}, ` +
      `MSI ${percentDelta(baseline.finalMsiPct, r.finalMsiPct)}`
    );
  }

  const c = results.find((r) => r.name === 'C_高海况横浪_全开');
  const e = results.find((r) => r.name === 'E_高海况横浪_关减摇鳍');
  const f = results.find((r) => r.name === 'F_高海况横浪_关陷波');
  const g = results.find((r) => r.name === 'G_高海况横浪_双关');

  if (c && e && f && g) {
    const pairs = [
      { tag: 'C vs E (仅减摇鳍差异, 陷波开)', a: c, b: e },
      { tag: 'F vs G (仅减摇鳍差异, 陷波关)', a: f, b: g },
      { tag: 'C vs F (仅陷波差异, 减摇鳍开)', a: c, b: f },
    ];
    console.log('\n=== 关键开关对比（绝对差值） ===');
    for (const pair of pairs) {
      console.log(
        `${pair.tag}: ` +
        `ΔmaxRoll=${Math.abs(pair.a.maxRollDeg - pair.b.maxRollDeg).toExponential(6)}°, ` +
        `ΔrmsRoll=${Math.abs(pair.a.rmsRollDeg - pair.b.rmsRollDeg).toExponential(6)}°, ` +
        `ΔMSI=${Math.abs(pair.a.finalMsiPct - pair.b.finalMsiPct).toExponential(6)}`
      );
    }
  }
}

main();
