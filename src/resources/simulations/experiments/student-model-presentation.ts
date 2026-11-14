import type { ModelStructureValue } from '@/lib/student-model-artifact-contract';

export function studentModelFormula(structure: ModelStructureValue) {
  const n = (value:number) => Number(value.toPrecision(4));
  if (structure.kind === 'nomoto1') return `G(s) = ${n(structure.k)} / (${n(structure.t_s)}s + 1)`;
  if (structure.kind === 'nomoto2') return `G(s) = ${n(structure.k)} / [(${n(structure.t1_s)}s + 1)(${n(structure.t2_s)}s + 1)]`;
  if (structure.kind === 'fopdt') return `G(s) = ${n(structure.k)} exp(−${n(structure.delay_s)}s) / (${n(structure.t_s)}s + 1)`;
  if (structure.kind === 'roll_oscillator') return `ωₙ = ${n(structure.natural_freq_rad_s)} rad/s，ζ = ${n(structure.damping)}，G = ${n(structure.control_gain)}`;
  return '三输入三输出低频模型';
}
