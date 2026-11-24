import type { SketchPlotId } from '@/features/ilab/sketch-plots';
import type { ModelStructureValue } from '@/lib/student-model-artifact-contract';
import {
  buildSketchCoordinateTemplate,
  mapXToPlot,
  mapYToPlot,
  SKETCH_VIEW_H,
  SKETCH_VIEW_W,
} from './sketch-coordinate-templates';
import type { FrozenVesselStudentModel } from './student-analysis';
import { studentModelFormula } from './student-model-presentation';

export interface SketchAnalyticalOverlaySpec {
  plotId: SketchPlotId;
  supported: boolean;
  unsupportedReason?: string;
  modelLabel: string;
  formula: string;
  viewBox: string;
  paths: Array<{
    id: string;
    d: string;
    stroke: string;
    dashed?: boolean;
    label: string;
  }>;
  markers: Array<{
    id: string;
    x: number;
    y: number;
    color: string;
    label: string;
  }>;
  referenceNotes: string[];
}

const VIEW_BOX = `0 0 ${SKETCH_VIEW_W} ${SKETCH_VIEW_H}`;

function unsupportedSpec(
  plotId: SketchPlotId,
  modelLabel: string,
  formula: string,
  unsupportedReason: string,
  referenceNotes: string[],
): SketchAnalyticalOverlaySpec {
  return { plotId, supported: false, unsupportedReason, modelLabel, formula, viewBox: VIEW_BOX, paths: [], markers: [], referenceNotes };
}

function supportedSpec(
  plotId: SketchPlotId,
  modelLabel: string,
  formula: string,
  paths: SketchAnalyticalOverlaySpec['paths'],
  markers: SketchAnalyticalOverlaySpec['markers'],
  referenceNotes: string[],
): SketchAnalyticalOverlaySpec {
  return { plotId, supported: true, modelLabel, formula, viewBox: VIEW_BOX, paths, markers, referenceNotes };
}

interface ScalarModelParams {
  gain: number;
  t1: number;
  t2: number;
  delay: number;
  wn: number;
  zeta: number;
}

function extractScalarParams(structure: ModelStructureValue): ScalarModelParams {
  let gain = 0.2;
  let t1 = 6;
  let t2 = 0;
  let delay = 0;
  let wn = 0.6;
  let zeta = 0.25;
  if (structure.kind === 'nomoto1') {
    gain = Math.max(0.01, Math.abs(structure.k));
    t1 = Math.max(0.1, Math.abs(structure.t_s));
  } else if (structure.kind === 'nomoto2') {
    gain = Math.max(0.01, Math.abs(structure.k));
    t1 = Math.max(0.1, Math.abs(structure.t1_s));
    t2 = Math.max(0.05, Math.abs(structure.t2_s));
  } else if (structure.kind === 'fopdt') {
    gain = Math.max(0.01, Math.abs(structure.k));
    t1 = Math.max(0.1, Math.abs(structure.t_s));
    delay = Math.max(0, structure.delay_s);
  } else if (structure.kind === 'roll_oscillator') {
    gain = Math.max(0.05, Math.abs(structure.control_gain));
    wn = Math.max(0.1, structure.natural_freq_rad_s);
    zeta = Math.max(0.01, structure.damping);
  }
  return { gain, t1, t2, delay, wn, zeta };
}

function buildFrequencyAmplitudeOverlay(
  structure: ModelStructureValue,
  params: ScalarModelParams,
  modelLabel: string,
  formula: string,
): SketchAnalyticalOverlaySpec {
  if (structure.kind !== 'roll_oscillator') {
    return unsupportedSpec(
      'frequency-amplitude',
      modelLabel,
      formula,
      '当前冻结模型不是二阶横摇振子模型，不支持单自由度横摇共振幅频曲线解析叠合；请先辨识并冻结二阶横摇阻尼模型。',
      ['共振幅频理论参考线仅适用于二阶横摇阻尼模型。'],
    );
  }
  const { wn, zeta } = params;
  const template = buildSketchCoordinateTemplate('frequency-amplitude');
  const magAt = (r: number) => 1 / Math.sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2);
  const coords: string[] = [];
  for (let i = 0; i <= 44; i += 1) {
    const r = 0.5 + (1.1 * i) / 44;
    coords.push(`${i === 0 ? 'M' : 'L'}${mapXToPlot(template, r).toFixed(1)},${mapYToPlot(template, magAt(r)).toFixed(1)}`);
  }
  const m07 = magAt(0.7);
  const m10 = magAt(1.0);
  const m13 = magAt(1.3);
  const hasPeak = zeta < Math.SQRT1_2;
  const rPeak = hasPeak ? Math.sqrt(Math.max(0.25, 1 - 2 * zeta * zeta)) : 0.5;
  const mPeak = magAt(rPeak);
  const markers: SketchAnalyticalOverlaySpec['markers'] = [
    { id: 'ratio-07', x: mapXToPlot(template, 0.7), y: mapYToPlot(template, m07), color: '#0ea5e9', label: `0.7x (${m07.toFixed(2)})` },
    { id: 'ratio-10', x: mapXToPlot(template, 1.0), y: mapYToPlot(template, m10), color: '#f59e0b', label: `1.0x (${m10.toFixed(2)})` },
    { id: 'ratio-13', x: mapXToPlot(template, 1.3), y: mapYToPlot(template, m13), color: '#10b981', label: `1.3x (${m13.toFixed(2)})` },
  ];
  if (hasPeak && rPeak >= 0.5 && rPeak <= 1.6 && Math.abs(rPeak - 1.0) > 0.06 && Math.abs(rPeak - 0.7) > 0.06) {
    markers.push({ id: 'resonance-peak', x: mapXToPlot(template, rPeak), y: mapYToPlot(template, mPeak), color: '#ef4444', label: `峰 ${rPeak.toFixed(2)}x (${mPeak.toFixed(2)})` });
  }
  return supportedSpec(
    'frequency-amplitude',
    modelLabel,
    formula,
    [{ id: 'frf-curve', d: coords.join(' '), stroke: '#f59e0b', label: '二阶横摇理论幅频倍率曲线' }],
    markers,
    [
      `参考模型：${formula}`,
      hasPeak
        ? `理论共振峰约位于 ω/ωₙ=${rPeak.toFixed(2)}（放大 ${mPeak.toFixed(2)}x），ωₙ=${wn.toFixed(2)} rad/s、ζ=${zeta.toFixed(2)}。`
        : `阻尼比 ζ=${zeta.toFixed(2)} ≥ 0.707，系统无明显共振放大尖峰，随频率比增大单调衰减。`,
      `基准倍频核对：0.7x → ${m07.toFixed(2)}，1.0x → ${m10.toFixed(2)}，1.3x → ${m13.toFixed(2)}。`,
    ],
  );
}

function buildNyquistOverlay(
  structure: ModelStructureValue,
  params: ScalarModelParams,
  modelLabel: string,
  formula: string,
): SketchAnalyticalOverlaySpec {
  const { gain, t1, t2, delay, wn, zeta } = params;
  const template = buildSketchCoordinateTemplate('nyquist');
  const scale = gain > 1.3 ? 1.2 / gain : gain < 0.3 ? 0.65 / Math.max(0.05, gain) : 1;
  const omegaMax = structure.kind === 'roll_oscillator' ? wn * 6 : 8 / Math.max(0.2, t1);
  const coords: string[] = [];
  for (let i = 1; i <= 48; i += 1) {
    const w = (omegaMax * i) / 48;
    let re = 0;
    let im = 0;
    if (structure.kind === 'roll_oscillator') {
      const dRe = wn * wn - w * w;
      const dIm = 2 * zeta * wn * w;
      const d2 = Math.max(1e-6, dRe * dRe + dIm * dIm);
      re = (gain * wn * wn * dRe) / d2;
      im = (-gain * wn * wn * dIm) / d2;
    } else {
      const mag = gain / Math.sqrt((1 + (w * t1) ** 2) * (t2 > 0 ? 1 + (w * t2) ** 2 : 1));
      const phase = -Math.atan(w * t1) - (t2 > 0 ? Math.atan(w * t2) : 0) - w * delay;
      re = mag * Math.cos(phase);
      im = mag * Math.sin(phase);
    }
    coords.push(`${i === 1 ? 'M' : 'L'}${mapXToPlot(template, re * scale).toFixed(1)},${mapYToPlot(template, im * scale).toFixed(1)}`);
  }
  return supportedSpec(
    'nyquist',
    modelLabel,
    formula,
    [{ id: 'locus', d: coords.join(' '), stroke: '#f59e0b', label: '学生模型 G(jω) 频响参考轨线' }],
    [
      { id: 'crit', x: mapXToPlot(template, -1), y: mapYToPlot(template, 0), color: '#ef4444', label: '(-1, j0) 临界点' },
      { id: 'dc', x: mapXToPlot(template, gain * scale), y: mapYToPlot(template, 0), color: '#10b981', label: `ω→0 (K=${gain.toFixed(2)})` },
    ],
    [
      `参考模型：${formula}`,
      '红点为 (-1, j0) 稳定性临界点；琥珀轨线为学生冻结模型开环频响走势对照。',
      delay > 0 ? `纯时滞 τ=${delay.toFixed(2)}s 会在高频段产生附加相位卷绕。` : '注意比较实轴交点及相位穿越与理论模型的裕度差异。',
    ],
  );
}

function buildBodeOverlay(
  structure: ModelStructureValue,
  params: ScalarModelParams,
  modelLabel: string,
  formula: string,
): SketchAnalyticalOverlaySpec {
  const { gain, t1, t2, delay, wn } = params;
  const template = buildSketchCoordinateTemplate('bode');
  const { left, right } = template.plotArea;
  const cornerFreq = structure.kind === 'roll_oscillator' ? wn : 1 / Math.max(0.1, t1);
  const logCorner = Math.max(-1.8, Math.min(0.8, Math.log10(Math.max(0.01, cornerFreq))));
  const cornerX = mapXToPlot(template, logCorner);
  const dcDb = Math.max(-28, Math.min(16, 20 * Math.log10(Math.max(0.03, gain))));
  const slopePerDec = structure.kind === 'roll_oscillator' || t2 > 0 ? 40 : 20;
  const endDb = Math.max(template.bounds.yMin + 4, dcDb - slopePerDec * (1 - logCorner));
  const dcY = mapYToPlot(template, dcDb);
  const endMagY = mapYToPlot(template, endDb);
  const phaseStartY = mapYToPlot(template, -10);
  const phaseEndY = mapYToPlot(template, structure.kind === 'roll_oscillator' || delay > 0 || t2 > 0 ? -52 : -32);
  return supportedSpec(
    'bode',
    modelLabel,
    formula,
    [
      { id: 'zero-db', d: `M${left},${mapYToPlot(template, 0).toFixed(1)} H${right}`, stroke: '#64748b', dashed: true, label: '0 dB 基准线' },
      { id: 'minus-180', d: `M${left},${mapYToPlot(template, -40).toFixed(1)} H${right}`, stroke: '#ef4444', dashed: true, label: '-180° 相位线' },
      { id: 'asymp-mag', d: `M${left},${dcY.toFixed(1)} L${cornerX.toFixed(1)},${dcY.toFixed(1)} L${right},${endMagY.toFixed(1)}`, stroke: '#f59e0b', label: '渐近幅频折线' },
      { id: 'asymp-phase', d: `M${left},${phaseStartY.toFixed(1)} C${(cornerX - 28).toFixed(1)},${phaseStartY.toFixed(1)} ${(cornerX + 28).toFixed(1)},${phaseEndY.toFixed(1)} ${right},${phaseEndY.toFixed(1)}`, stroke: '#06b6d4', dashed: true, label: '理论相频趋势' },
    ],
    [{ id: 'corner', x: cornerX, y: dcY, color: '#f59e0b', label: `ωc≈${cornerFreq.toFixed(2)} rad/s` }],
    [
      `参考模型：${formula}`,
      `转折频率参考：ωc ≈ ${cornerFreq.toFixed(2)} rad/s（高频斜率 -${slopePerDec} dB/dec）。`,
      delay > 0 ? `存在 τ=${delay.toFixed(2)}s 时滞，高频相位将迅速跌破 -180°。` : '核对幅值穿越 0 dB 处的相位裕度与相频拐点频率。',
    ],
  );
}

function buildRootLocusOverlay(
  structure: ModelStructureValue,
  params: ScalarModelParams,
  modelLabel: string,
  formula: string,
): SketchAnalyticalOverlaySpec {
  const { t1, t2, delay, wn, zeta } = params;
  const template = buildSketchCoordinateTemplate('root-locus');
  const { left, top, right, bottom } = template.plotArea;
  const imX = mapXToPlot(template, 0);
  const cy = mapYToPlot(template, 0);
  const axesPath = { id: 's-plane', d: `M${left},${cy.toFixed(1)} H${right} M${imX.toFixed(1)},${top} V${bottom}`, stroke: '#64748b', dashed: true, label: 's 平面与虚轴稳定边界' };

  if (structure.kind === 'fopdt' && delay > 1e-3) {
    return unsupportedSpec(
      'root-locus',
      modelLabel,
      formula,
      `当前冻结模型含纯时滞 τ=${delay.toFixed(2)}s（超越项对应无穷多条根轨迹分支），请改用伯德图或奈奎斯特图核验相位裕度。`,
      [`参考模型：${formula}`, `含纯时滞 e^(-${delay.toFixed(2)}s·s) 的超越特征方程不适用有限维实/复根轨迹渐近参考，请切换至伯德图或奈奎斯特图。`],
    );
  }
  const mapPoleX = (sigma: number, maxAbs: number) => {
    const scale = maxAbs > 1.4 ? 1.3 / maxAbs : maxAbs < 0.12 ? 0.45 / Math.max(0.02, maxAbs) : 1;
    return Math.max(left + 16, Math.min(imX - 14, mapXToPlot(template, sigma * scale)));
  };

  if (structure.kind === 'nomoto1' || (structure.kind === 'fopdt' && delay <= 1e-3)) {
    const p1 = -1 / t1;
    const p1X = mapPoleX(p1, Math.abs(p1));
    return supportedSpec(
      'root-locus',
      modelLabel,
      formula,
      [axesPath, { id: 'locus-real-ray', d: `M${p1X.toFixed(1)},${cy.toFixed(1)} H${left + 4}`, stroke: '#f59e0b', label: '一阶负实轴根轨迹射线（无垂直渐近线）' }],
      [{ id: 'p1', x: p1X, y: cy, color: '#f59e0b', label: `p1=${p1.toFixed(2)}` }],
      [`参考模型：${formula}`, `一阶模型仅含单个负实极点 p1=${p1.toFixed(3)}，随比例增益增大沿负实轴单调向左移动，不存在垂直渐近分支。`, '虚轴（Re(s)=0）为稳定边界，注意核对闭环响应快慢与增益饱和权衡。'],
    );
  }

  if (structure.kind === 'nomoto2') {
    const p1 = -1 / t1;
    const p2 = -1 / t2;
    const sigmaB = (p1 + p2) / 2;
    const maxAbs = Math.max(Math.abs(p1), Math.abs(p2), 0.05);
    const p1X = mapPoleX(p1, maxAbs);
    const p2X = mapPoleX(p2, maxAbs);
    const breakX = (p1X + p2X) / 2;
    return supportedSpec(
      'root-locus',
      modelLabel,
      formula,
      [
        axesPath,
        { id: 'locus-real-segment', d: `M${Math.min(p1X, p2X).toFixed(1)},${cy.toFixed(1)} H${Math.max(p1X, p2X).toFixed(1)}`, stroke: '#f59e0b', label: '两实极点间实轴根轨迹段' },
        { id: 'locus-vertical-asymptote', d: `M${breakX.toFixed(1)},${top + 4} V${bottom - 4}`, stroke: '#f59e0b', dashed: true, label: '±90° 渐近垂直根轨迹分支' },
      ],
      [
        { id: 'p1', x: p1X, y: cy, color: '#f59e0b', label: `p1=${p1.toFixed(2)}` },
        { id: 'p2', x: p2X, y: cy, color: '#06b6d4', label: `p2=${p2.toFixed(2)}` },
        { id: 'break', x: breakX, y: cy, color: '#10b981', label: `σb=${sigmaB.toFixed(2)}` },
      ],
      [`参考模型：${formula}`, `两负实极点 p1=${p1.toFixed(3)}、p2=${p2.toFixed(3)} 于分离点 σb=${sigmaB.toFixed(3)} 汇合并沿 ±90° 垂直分支发展。`, '高增益时闭环阻尼比下降但保持左半平面分布（未计高阶滞后前不穿虚轴）。'],
    );
  }

  if (zeta < 1) {
    const sigma = -zeta * wn;
    const wd = wn * Math.sqrt(1 - zeta * zeta);
    const poleX = mapPoleX(sigma, Math.max(wn, 0.05));
    const halfH = (bottom - top) / 2;
    let offsetY = Math.max(14, Math.min(halfH - 16, (wd / 1.2) * halfH));
    if (Math.abs(cy - offsetY - 80) < 0.8) offsetY += 1.5;
    return supportedSpec(
      'root-locus',
      modelLabel,
      formula,
      [axesPath, { id: 'locus-conjugate-branches', d: `M${poleX.toFixed(1)},${(cy - offsetY).toFixed(1)} V${top + 4} M${poleX.toFixed(1)},${(cy + offsetY).toFixed(1)} V${bottom - 4}`, stroke: '#f59e0b', dashed: true, label: '共轭极点 ±90° 垂直离心分支' }],
      [
        { id: 'conj-upper', x: poleX, y: cy - offsetY, color: '#f59e0b', label: `${sigma.toFixed(2)}+j${wd.toFixed(2)}` },
        { id: 'conj-lower', x: poleX, y: cy + offsetY, color: '#f59e0b', label: `${sigma.toFixed(2)}-j${wd.toFixed(2)}` },
      ],
      [`参考模型：${formula}`, `欠阻尼二阶振子（ζ=${zeta.toFixed(2)} < 1）开环仅有一对共轭复极点 (${sigma.toFixed(2)} ± j${wd.toFixed(2)})，不存在实轴极点。`, '比例增益增大时两共轭分支沿 Re(s)=-ζωn 垂直远离实轴，衰减时间常数近似不变但振荡频率升高。'],
    );
  }

  const radical = Math.sqrt(Math.max(0, zeta * zeta - 1));
  const p1 = wn * (-zeta + radical);
  const p2 = wn * (-zeta - radical);
  const sigmaB = -zeta * wn;
  const maxAbs = Math.max(Math.abs(p2), 0.05);
  const p1X = mapPoleX(p1, maxAbs);
  const p2X = mapPoleX(p2, maxAbs);
  const breakX = mapPoleX(sigmaB, maxAbs);
  return supportedSpec(
    'root-locus',
    modelLabel,
    formula,
    [
      axesPath,
      { id: 'locus-real-segment', d: `M${p2X.toFixed(1)},${cy.toFixed(1)} H${p1X.toFixed(1)}`, stroke: '#f59e0b', label: '过阻尼实轴根轨迹段' },
      { id: 'locus-vertical-asymptote', d: `M${breakX.toFixed(1)},${top + 4} V${bottom - 4}`, stroke: '#f59e0b', dashed: true, label: '±90° 渐近垂直根轨迹分支' },
    ],
    [
      { id: 'p1', x: p1X, y: cy, color: '#f59e0b', label: `p1=${p1.toFixed(2)}` },
      { id: 'p2', x: p2X, y: cy, color: '#06b6d4', label: `p2=${p2.toFixed(2)}` },
      { id: 'break', x: breakX, y: cy, color: '#10b981', label: `σb=${sigmaB.toFixed(2)}` },
    ],
    [`参考模型：${formula}`, `过阻尼二阶振子（ζ=${zeta.toFixed(2)} ≥ 1）含两负实极点 p1=${p1.toFixed(2)}、p2=${p2.toFixed(2)}，在 σb=${sigmaB.toFixed(2)} 处分离为 ±90° 共轭垂直分支。`, '虚轴（Re(s)=0）为稳定边界，右半平面根意味闭环发散失稳。'],
  );
}

function buildTimeResponseOverlay(
  structure: ModelStructureValue,
  params: ScalarModelParams,
  modelLabel: string,
  formula: string,
): SketchAnalyticalOverlaySpec {
  const { t1, delay, wn, zeta } = params;
  const template = buildSketchCoordinateTemplate('time-response');
  const { left, right } = template.plotArea;
  const steadyVal = 6;
  const settleY = mapYToPlot(template, steadyVal);
  const bandTopY = mapYToPlot(template, steadyVal * 1.05);
  const bandBotY = mapYToPlot(template, steadyVal * 0.95);
  const overshootRatio = structure.kind === 'roll_oscillator' && zeta < 1
    ? Math.exp((-Math.PI * zeta) / Math.sqrt(Math.max(0.05, 1 - zeta * zeta)))
    : 0;
  const overshootPct = overshootRatio * 100;
  const peakY = mapYToPlot(template, Math.min(9.4, steadyVal * (1 + overshootRatio)));
  const peakTimeS = structure.kind === 'roll_oscillator'
    ? 20 + Math.min(80, Math.PI / Math.max(0.08, wn * Math.sqrt(Math.max(0.05, 1 - zeta * zeta))))
    : 20 + Math.min(180, delay + t1 * 2.2);
  const startX = mapXToPlot(template, 20);
  const delayX = mapXToPlot(template, 20 + delay);
  const peakX = mapXToPlot(template, peakTimeS);
  const baseY = mapYToPlot(template, 0);
  return supportedSpec(
    'time-response',
    modelLabel,
    formula,
    [
      { id: 'steady', d: `M${left},${settleY.toFixed(1)} H${right}`, stroke: '#64748b', dashed: true, label: '稳态参考基准线' },
      { id: 'band', d: `M${left},${bandTopY.toFixed(1)} H${right} M${left},${bandBotY.toFixed(1)} H${right}`, stroke: '#10b981', dashed: true, label: '±5% 稳态误差带' },
      { id: 'ref-curve', d: `M${left},${baseY.toFixed(1)} H${delayX.toFixed(1)} Q${((startX + peakX) / 2).toFixed(1)},${peakY.toFixed(1)} ${peakX.toFixed(1)},${peakY.toFixed(1)} T${right},${settleY.toFixed(1)}`, stroke: '#f59e0b', label: '模型理论阶跃轮廓' },
    ],
    [{ id: 'tp', x: peakX, y: peakY, color: '#f59e0b', label: overshootPct > 1 ? `理论超调 ≈${overshootPct.toFixed(0)}%` : `63.2% / τ+T≈${(delay + t1).toFixed(1)}s` }],
    [
      `参考模型：${formula}`,
      delay > 0 ? `含纯时滞 τ=${delay.toFixed(2)}s（起步水平延迟段），上升斜率受 T=${t1.toFixed(1)}s 制约。` : `一阶特征时间约 T=${t1.toFixed(1)}s，或二阶阻尼比 ζ=${zeta.toFixed(2)}。`,
      '对照手绘曲线的超调量、调节时间及是否存在超调/削顶畸变。',
    ],
  );
}

/**
 * Compute read-only theoretical SVG reference geometry from the student's frozen model parameters.
 * Pure closed-form algebraic/frequency evaluation used solely for SVG visual overlay above SketchPad.
 */
export function buildSketchAnalyticalOverlay(
  plotId: SketchPlotId,
  studentModel?: FrozenVesselStudentModel | null,
): SketchAnalyticalOverlaySpec {
  const structure = studentModel?.payload.structure ?? null;
  const formula = structure ? studentModelFormula(structure) : '待冻结本人低阶模型';
  const modelLabel = studentModel?.label ?? '理论坐标参考';

  if (plotId === 'planar-envelope') {
    return unsupportedSpec(
      plotId,
      modelLabel,
      formula,
      '平面轨迹与警戒圈取决于实时环境扰动与多推力分配闭环轨迹，无单回路传递函数解析曲线；可在仿真运行后叠加实测轨迹进行比对。',
      ['平面位置包络请于运行后开启「实测轨迹比对」覆盖层核验警戒圈余量。'],
    );
  }
  if (!structure) {
    return unsupportedSpec(
      plotId,
      modelLabel,
      formula,
      '尚未冻结本人低阶辨识模型，完成前序辨识并冻结模型后可叠加解析参考。',
      ['尚未冻结本人低阶辨识模型，暂不叠加解析参考线。'],
    );
  }
  if (plotId === 'frequency-amplitude') {
    return buildFrequencyAmplitudeOverlay(structure, extractScalarParams(structure), modelLabel, formula);
  }
  if (
    structure.kind !== 'nomoto1' &&
    structure.kind !== 'nomoto2' &&
    structure.kind !== 'fopdt' &&
    structure.kind !== 'roll_oscillator'
  ) {
    return unsupportedSpec(
      plotId,
      modelLabel,
      formula,
      '当前冻结模型为三自由度多变量耦合结构，不支持单回路解析参考线叠合。',
      ['三自由度耦合模型不适用单回路解析叠加，请聚焦主航路/定位频域物理分析。'],
    );
  }
  const params = extractScalarParams(structure);
  if (plotId === 'nyquist') return buildNyquistOverlay(structure, params, modelLabel, formula);
  if (plotId === 'bode') return buildBodeOverlay(structure, params, modelLabel, formula);
  if (plotId === 'root-locus') return buildRootLocusOverlay(structure, params, modelLabel, formula);
  return buildTimeResponseOverlay(structure, params, modelLabel, formula);
}
