import type { SketchPlotId } from '@/features/ilab/sketch-plots';
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

const VIEW_W = 280;
const VIEW_H = 160;

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

  if (!structure) {
    return {
      plotId,
      supported: false,
      unsupportedReason: '尚未冻结本人低阶辨识模型，完成前序辨识并冻结模型后可叠加解析参考。',
      modelLabel,
      formula,
      viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
      paths: [],
      markers: [],
      referenceNotes: ['尚未冻结本人低阶辨识模型，暂不叠加解析参考线。'],
    };
  }

  if (
    structure.kind !== 'nomoto1' &&
    structure.kind !== 'nomoto2' &&
    structure.kind !== 'fopdt' &&
    structure.kind !== 'roll_oscillator'
  ) {
    return {
      plotId,
      supported: false,
      unsupportedReason: '当前冻结模型为三自由度多变量耦合结构，不支持单回路解析参考线叠合。',
      modelLabel,
      formula,
      viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
      paths: [],
      markers: [],
      referenceNotes: ['三自由度耦合模型不适用单回路解析叠加，请聚焦主航路/DP 频域物理分析。'],
    };
  }

  // Extract representative scalar gain & time constants if available.
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

  if (plotId === 'nyquist') {
    const cx = 190;
    const cy = 55;
    const scale = 70;
    const critX = cx - scale;
    const omegaMax = 8 / Math.max(0.2, t1);
    const coords: string[] = [];
    const steps = 40;
    for (let i = 1; i <= steps; i += 1) {
      const w = (omegaMax * i) / steps;
      let re = 0;
      let im = 0;
      if (structure.kind === 'roll_oscillator') {
        const denomRe = wn * wn - w * w;
        const denomIm = 2 * zeta * wn * w;
        const d2 = Math.max(1e-6, denomRe * denomRe + denomIm * denomIm);
        re = (gain * wn * wn * denomRe) / d2;
        im = (-gain * wn * wn * denomIm) / d2;
      } else {
        const denom1 = 1 + (w * t1) ** 2;
        const denom2 = t2 > 0 ? 1 + (w * t2) ** 2 : 1;
        const mag = gain / Math.sqrt(denom1 * denom2);
        const phase = -Math.atan(w * t1) - (t2 > 0 ? Math.atan(w * t2) : 0) - w * delay;
        re = mag * Math.cos(phase);
        im = mag * Math.sin(phase);
      }
      const normScale = gain > 0 ? scale / Math.max(0.5, gain * 1.1) : scale;
      const px = Math.max(12, Math.min(VIEW_W - 12, cx + re * normScale));
      const py = Math.max(12, Math.min(VIEW_H - 12, cy - im * normScale));
      coords.push(`${i === 1 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`);
    }
    return {
      plotId,
      supported: true,
      modelLabel,
      formula,
      viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
      paths: [
        { id: 'axes', d: `M18,${cy} H${VIEW_W - 12} M${cx},12 V${VIEW_H - 12}`, stroke: '#64748b', dashed: true, label: '复平面坐标轴' },
        { id: 'locus', d: coords.join(' '), stroke: '#f59e0b', label: '学生模型 G(jω) 频响参考轨线' },
      ],
      markers: [
        { id: 'crit', x: critX, y: cy, color: '#ef4444', label: '(-1, j0) 临界点' },
        { id: 'dc', x: Math.min(VIEW_W - 18, cx + Math.min(70, scale * 0.85)), y: cy, color: '#10b981', label: `ω→0 (K=${gain.toFixed(2)})` },
      ],
      referenceNotes: [
        `参考模型：${formula}`,
        '红点为 (-1, j0) 稳定性临界点；琥珀虚线/实线为学生冻结模型频响走势对照。',
        delay > 0 ? `纯时滞 τ=${delay.toFixed(2)}s 会在高频段产生附加相位卷绕。` : '注意比较实轴交点及相位穿越与理论模型的裕度差异。',
      ],
    };
  }

  if (plotId === 'bode') {
    const cornerFreq = structure.kind === 'roll_oscillator' ? wn : 1 / Math.max(0.1, t1);
    const cornerX = Math.max(70, Math.min(200, 140 + Math.log10(Math.max(0.02, cornerFreq)) * 35));
    return {
      plotId,
      supported: true,
      modelLabel,
      formula,
      viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
      paths: [
        { id: 'zero-db', d: `M20,48 H${VIEW_W - 14}`, stroke: '#64748b', dashed: true, label: '0 dB 基准线' },
        { id: 'minus-180', d: `M20,136 H${VIEW_W - 14}`, stroke: '#ef4444', dashed: true, label: '-180° 相位线' },
        {
          id: 'asymp-mag',
          d: `M24,36 L${cornerX.toFixed(1)},36 L${VIEW_W - 20},${structure.kind === 'roll_oscillator' || t2 > 0 ? '92' : '78'}`,
          stroke: '#f59e0b',
          label: '渐近幅频折线',
        },
        {
          id: 'asymp-phase',
          d: `M24,102 C${(cornerX - 24).toFixed(1)},104 ${(cornerX + 24).toFixed(1)},136 ${VIEW_W - 20},${structure.kind === 'roll_oscillator' || delay > 0 || t2 > 0 ? '146' : '128'}`,
          stroke: '#06b6d4',
          dashed: true,
          label: '理论相频趋势',
        },
      ],
      markers: [
        { id: 'corner', x: cornerX, y: 36, color: '#f59e0b', label: `ωc≈${cornerFreq.toFixed(2)} rad/s` },
      ],
      referenceNotes: [
        `参考模型：${formula}`,
        `转折频率参考：ωc ≈ ${cornerFreq.toFixed(2)} rad/s（高频斜率 ${structure.kind === 'roll_oscillator' || t2 > 0 ? '-40' : '-20'} dB/dec）。`,
        delay > 0 ? `存在 τ=${delay.toFixed(2)}s 时滞，高频相位将迅速跌破 -180°。` : '核对幅值穿越 0 dB 处的相位裕度与相频拐点频率。',
      ],
    };
  }

  if (plotId === 'root-locus') {
    const imX = 196;
    const cy = 80;
    const axesPath = {
      id: 's-plane',
      d: `M18,${cy} H${VIEW_W - 14} M${imX},12 V${VIEW_H - 12}`,
      stroke: '#64748b',
      dashed: true,
      label: 's 平面与虚轴稳定边界',
    };

    if (structure.kind === 'fopdt' && delay > 1e-3) {
      return {
        plotId,
        supported: false,
        unsupportedReason: `当前冻结模型含纯时滞 τ=${delay.toFixed(2)}s（超越项对应无穷多条根轨迹分支），请改用伯德图或奈奎斯特图核验相位裕度。`,
        modelLabel,
        formula,
        viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
        paths: [],
        markers: [],
        referenceNotes: [
          `参考模型：${formula}`,
          `含纯时滞 e^(-${delay.toFixed(2)}s·s) 的超越特征方程不适用有限维实/复根轨迹渐近参考，请切换至伯德图或奈奎斯特图。`,
        ],
      };
    }

    if (structure.kind === 'nomoto1' || (structure.kind === 'fopdt' && delay <= 1e-3)) {
      const p1 = -1 / t1;
      const scale = 120 / Math.max(Math.abs(p1), 0.05);
      const p1X = Math.max(36, Math.min(imX - 16, imX + p1 * scale));
      return {
        plotId,
        supported: true,
        modelLabel,
        formula,
        viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
        paths: [
          axesPath,
          {
            id: 'locus-real-ray',
            d: `M${p1X.toFixed(1)},${cy} H22`,
            stroke: '#f59e0b',
            label: '一阶负实轴根轨迹射线（无垂直渐近线）',
          },
        ],
        markers: [
          { id: 'p1', x: p1X, y: cy, color: '#f59e0b', label: `p1=${p1.toFixed(2)}` },
        ],
        referenceNotes: [
          `参考模型：${formula}`,
          `一阶模型仅含单个负实极点 p1=${p1.toFixed(3)}，随比例增益增大沿负实轴单调向左移动，不存在垂直渐近分支。`,
          '虚轴（Re(s)=0）为稳定边界，注意核对闭环响应快慢与增益饱和权衡。',
        ],
      };
    }

    if (structure.kind === 'nomoto2') {
      const p1 = -1 / t1;
      const p2 = -1 / t2;
      const sigmaB = (p1 + p2) / 2;
      const scale = 130 / Math.max(Math.abs(p1), Math.abs(p2), 0.05);
      const p1X = Math.max(28, Math.min(imX - 12, imX + p1 * scale));
      const p2X = Math.max(24, Math.min(imX - 12, imX + p2 * scale));
      const breakX = (p1X + p2X) / 2;
      const leftX = Math.min(p1X, p2X);
      const rightX = Math.max(p1X, p2X);
      return {
        plotId,
        supported: true,
        modelLabel,
        formula,
        viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
        paths: [
          axesPath,
          {
            id: 'locus-real-segment',
            d: `M${leftX.toFixed(1)},${cy} H${rightX.toFixed(1)}`,
            stroke: '#f59e0b',
            label: '两实极点间实轴根轨迹段',
          },
          {
            id: 'locus-vertical-asymptote',
            d: `M${breakX.toFixed(1)},16 V${VIEW_H - 16}`,
            stroke: '#f59e0b',
            dashed: true,
            label: '±90° 渐近垂直根轨迹分支',
          },
        ],
        markers: [
          { id: 'p1', x: p1X, y: cy, color: '#f59e0b', label: `p1=${p1.toFixed(2)}` },
          { id: 'p2', x: p2X, y: cy, color: '#06b6d4', label: `p2=${p2.toFixed(2)}` },
          { id: 'break', x: breakX, y: cy, color: '#10b981', label: `σb=${sigmaB.toFixed(2)}` },
        ],
        referenceNotes: [
          `参考模型：${formula}`,
          `两负实极点 p1=${p1.toFixed(3)}、p2=${p2.toFixed(3)} 于分离点 σb=${sigmaB.toFixed(3)} 汇合并沿 ±90° 垂直分支发展。`,
          '高增益时闭环阻尼比下降但保持左半平面分布（未计高阶滞后前不穿虚轴）。',
        ],
      };
    }

    // roll_oscillator: s^2 + 2*zeta*wn*s + wn^2 = 0
    if (zeta < 1) {
      const sigma = -zeta * wn;
      const wd = wn * Math.sqrt(1 - zeta * zeta);
      const scaleRe = 120 / Math.max(wn, 0.05);
      const scaleIm = 56 / Math.max(wn, 0.05);
      const poleX = Math.max(36, Math.min(imX - 10, imX + sigma * scaleRe));
      const offsetY = Math.max(12, Math.min(58, wd * scaleIm));
      return {
        plotId,
        supported: true,
        modelLabel,
        formula,
        viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
        paths: [
          axesPath,
          {
            id: 'locus-conjugate-branches',
            d: `M${poleX.toFixed(1)},${(cy - offsetY).toFixed(1)} V14 M${poleX.toFixed(1)},${(cy + offsetY).toFixed(1)} V${VIEW_H - 14}`,
            stroke: '#f59e0b',
            dashed: true,
            label: '共轭极点 ±90° 垂直离心分支',
          },
        ],
        markers: [
          { id: 'conj-upper', x: poleX, y: cy - offsetY, color: '#f59e0b', label: `${sigma.toFixed(2)}+j${wd.toFixed(2)}` },
          { id: 'conj-lower', x: poleX, y: cy + offsetY, color: '#f59e0b', label: `${sigma.toFixed(2)}-j${wd.toFixed(2)}` },
        ],
        referenceNotes: [
          `参考模型：${formula}`,
          `欠阻尼二阶振子（ζ=${zeta.toFixed(2)} < 1）开环仅有一对共轭复极点 (${sigma.toFixed(2)} ± j${wd.toFixed(2)})，不存在实轴极点。`,
          '比例增益增大时两共轭分支沿 Re(s)=-ζωn 垂直远离实轴，衰减时间常数近似不变但振荡频率升高。',
        ],
      };
    }

    const radical = Math.sqrt(Math.max(0, zeta * zeta - 1));
    const p1 = wn * (-zeta + radical);
    const p2 = wn * (-zeta - radical);
    const sigmaB = -zeta * wn;
    const scale = 130 / Math.max(Math.abs(p2), 0.05);
    const p1X = Math.max(28, Math.min(imX - 12, imX + p1 * scale));
    const p2X = Math.max(24, Math.min(imX - 12, imX + p2 * scale));
    const breakX = Math.max(26, Math.min(imX - 12, imX + sigmaB * scale));
    return {
      plotId,
      supported: true,
      modelLabel,
      formula,
      viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
      paths: [
        axesPath,
        {
          id: 'locus-real-segment',
          d: `M${p2X.toFixed(1)},${cy} H${p1X.toFixed(1)}`,
          stroke: '#f59e0b',
          label: '过阻尼实轴根轨迹段',
        },
        {
          id: 'locus-vertical-asymptote',
          d: `M${breakX.toFixed(1)},16 V${VIEW_H - 16}`,
          stroke: '#f59e0b',
          dashed: true,
          label: '±90° 渐近垂直根轨迹分支',
        },
      ],
      markers: [
        { id: 'p1', x: p1X, y: cy, color: '#f59e0b', label: `p1=${p1.toFixed(2)}` },
        { id: 'p2', x: p2X, y: cy, color: '#06b6d4', label: `p2=${p2.toFixed(2)}` },
        { id: 'break', x: breakX, y: cy, color: '#10b981', label: `σb=${sigmaB.toFixed(2)}` },
      ],
      referenceNotes: [
        `参考模型：${formula}`,
        `过阻尼二阶振子（ζ=${zeta.toFixed(2)} ≥ 1）含两负实极点 p1=${p1.toFixed(2)}、p2=${p2.toFixed(2)}，在 σb=${sigmaB.toFixed(2)} 处分离为 ±90° 共轭垂直分支。`,
        '虚轴（Re(s)=0）为稳定边界，右半平面根意味闭环发散失稳。',
      ],
    };
  }

  // 'time-response'
  const settleY = 50;
  const bandTopY = 44;
  const bandBotY = 56;
  const overshootPct = structure.kind === 'roll_oscillator' && zeta < 1
    ? Math.exp((-Math.PI * zeta) / Math.sqrt(Math.max(0.05, 1 - zeta * zeta))) * 100
    : 0;
  const peakY = Math.max(18, settleY - Math.round((overshootPct / 100) * 80));
  const peakX = structure.kind === 'roll_oscillator' ? 105 : 185;
  const delayPx = Math.min(55, delay * 16);

  return {
    plotId,
    supported: true,
    modelLabel,
    formula,
    viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
    paths: [
      { id: 'steady', d: `M24,${settleY} H${VIEW_W - 16}`, stroke: '#64748b', dashed: true, label: '稳态参考基准线' },
      { id: 'band', d: `M24,${bandTopY} H${VIEW_W - 16} M24,${bandBotY} H${VIEW_W - 16}`, stroke: '#10b981', dashed: true, label: '±2% 稳态误差带' },
      {
        id: 'ref-curve',
        d: `M24,136 H${(24 + delayPx).toFixed(1)} Q${(60 + delayPx).toFixed(1)},${peakY} ${peakX},${peakY} T${VIEW_W - 18},${settleY}`,
        stroke: '#f59e0b',
        label: '模型理论阶跃轮廓',
      },
    ],
    markers: [
      { id: 'tp', x: peakX, y: peakY, color: '#f59e0b', label: overshootPct > 1 ? `理论超调 ≈${overshootPct.toFixed(0)}%` : `63.2% / τ+T≈${(delay + t1).toFixed(1)}s` },
    ],
    referenceNotes: [
      `参考模型：${formula}`,
      delay > 0 ? `含纯时滞 τ=${delay.toFixed(2)}s（起步水平延迟段），上升斜率受 T=${t1.toFixed(1)}s 制约。` : `一阶特征时间约 T=${t1.toFixed(1)}s，或二阶阻尼比 ζ=${zeta.toFixed(2)}。`,
      '对照手绘曲线的超调量、调节时间及是否存在超调/削顶畸变。',
    ],
  };
}
