import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { LngCourseSettings } from './lng-course';
import {
  extractLngReverseFraction,
  extractLngSloshActualSeries,
  extractLngSpeedActualSeries,
  formatLngParam,
  isDefaultLngBerthPlan,
  LNG_STEP_SPECS_EARLY,
  type LngStepWorkbenchSpec,
} from './lng-step-specs-early';
import { LNG_STEP_SPECS_LATE } from './lng-step-specs-late';
import type { FrozenVesselStudentModel } from './student-analysis';

export type { LngStepWorkbenchSpec };
export {
  extractLngReverseFraction,
  extractLngSloshActualSeries,
  extractLngSpeedActualSeries,
  formatLngParam,
  isDefaultLngBerthPlan,
  LNG_STEP_SPECS_EARLY,
  LNG_STEP_SPECS_LATE,
};

export const LNG_STEP_SPECS: Readonly<Record<number, LngStepWorkbenchSpec>> = {
  ...LNG_STEP_SPECS_EARLY,
  ...LNG_STEP_SPECS_LATE,
};

export const LNG_CONTROL_NOTICES: Readonly<Record<number, { title: string; body: string }>> = {
  1: {
    title: '静水匀速直航观测',
    body: '本步参数锁定（85% 装载 · 4.0 m/s · 120 s），直接点击「开始」观察轴速、推力、航速与航程的因果阶梯。',
  },
  3: {
    title: '分析步骤：辨识并冻结航速模型',
    body: '本步无需新开运行，请前往右侧「评估」页签选中第 2 步运行窗口，辨识并冻结「轴速参考 → 对水航速」模型。',
  },
  4: {
    title: '自动 −4% 轴速减速验证',
    body: '初速 4.0 m/s、85% 装载，t=20 s 自动施加 −4% 轴速阶跃。600 s 结束后前往「评估」页签以第 3 步模型执行独立对照。',
  },
  5: {
    title: '自由滑行停车观测',
    body: '初速 4.0 m/s、85% 装载，t=20 s 自动将电机转矩置零自由滑行，请运行至 1200 s 并记录是否降至 0.2 m/s。',
  },
};

export interface LngSelectControlDef {
  key: 'excitationPercent' | 'reverseFraction' | 'loadingRatio' | 'headingRampS' | 'filterTauS' | 'validationSeed';
  label: string;
  options: Array<{ value: number; label: string }>;
}

export function getLngSelectControls(seq: number): LngSelectControlDef[] {
  const controls: Array<LngSelectControlDef & { visible: boolean }> = [
    {
      key: 'excitationPercent',
      label: '轴速参考阶跃 / %',
      visible: seq === 2,
      options: [{ value: 3, label: '+3%（小幅阶跃）' }, { value: 5, label: '+5%（推荐基准）' }, { value: 8, label: '+8%（较大阶跃）' }],
    },
    {
      key: 'reverseFraction',
      label: '反车额定转速比例',
      visible: seq === 6,
      options: [{ value: 0.3, label: '0.3（轻度反车制动）' }, { value: 0.6, label: '0.6（强力反车制动）' }],
    },
    {
      key: 'loadingRatio',
      label: '液舱填充率',
      visible: [12, 14].includes(seq),
      options: [{ value: 0.30, label: '0.30（30% 低填充率）' }, { value: 0.70, label: '0.70（70% 中填充率）' }, { value: 0.95, label: '0.95（95% 高填充率）' }],
    },
    {
      key: 'headingRampS',
      label: '转向斜坡 / s',
      visible: [13, 15].includes(seq),
      options: [{ value: 5, label: '5 s（急促转向）' }, { value: 20, label: '20 s（常规转向）' }, { value: 60, label: '60 s（平缓转向）' }],
    },
    {
      key: 'filterTauS',
      label: '航速量测滤波 / s',
      visible: [17, 18].includes(seq),
      options: [{ value: 0.2, label: '0.2 s（快响应弱滤波）' }, { value: 1, label: '1 s（中等折中滤波）' }, { value: 3, label: '3 s（强平滑强滞后）' }],
    },
    {
      key: 'validationSeed',
      label: '未见装载工况',
      visible: seq === 19,
      options: [{ value: 17, label: '未见工况甲（70% 填充率）' }, { value: 29, label: '未见工况乙（95% 填充率）' }],
    },
  ];
  return controls.filter((item) => item.visible);
}

export function formatLngModelTag(model: FrozenVesselStudentModel | undefined, index?: number): string {
  if (!model) return '未选择';
  const fill = model.payload.operatingPoint.loadingRatio;
  const speed = model.payload.operatingPoint.speedMps;
  const fillText = typeof fill === 'number' && Number.isFinite(fill) ? ` · ${Math.round(fill * 100)}%填充` : '';
  const speedText = typeof speed === 'number' && Number.isFinite(speed) ? ` · ${speed.toFixed(1)}m/s` : '';
  const verText = typeof index === 'number' ? ` · 版本${index + 1}` : '';
  return `${model.label}${fillText}${speedText}${verText}`;
}

export function extractLngRunScheme(
  run: VesselRunSummary,
  current: LngCourseSettings,
): { settings: LngCourseSettings; designModelId: string } | null {
  const frozen = run.courseSettings as Partial<LngCourseSettings> | undefined;
  const longitudinal = run.initialInput.longitudinal;
  const berthPlan = run.initialInput.berthPlan;
  if (!frozen && !longitudinal && !berthPlan) return null;
  const nextHeadingNodes = frozen?.headingNodes ?? berthPlan?.headingNodes;
  return {
    settings: {
      ...current,
      ...(frozen ?? {}),
      kpMultiplier: frozen?.kpMultiplier ?? longitudinal?.kpMultiplier ?? current.kpMultiplier,
      tiMultiplier: frozen?.tiMultiplier ?? longitudinal?.tiMultiplier ?? current.tiMultiplier,
      antiWindup: frozen?.antiWindup ?? longitudinal?.antiWindup ?? current.antiWindup,
      filterTauS: (frozen?.filterTauS ?? longitudinal?.filterTauS ?? current.filterTauS) as LngCourseSettings['filterTauS'],
      brakingDistanceM: frozen?.brakingDistanceM ?? berthPlan?.brakingDistanceM ?? current.brakingDistanceM,
      speedNodes: structuredClone(frozen?.speedNodes ?? berthPlan?.nodes ?? current.speedNodes),
      headingNodes: nextHeadingNodes ? structuredClone(nextHeadingNodes) : undefined,
      validationSeed: current.validationSeed,
    },
    designModelId: run.designStudentModelId ?? '',
  };
}

export function matchesLngRunScheme(
  source: VesselRunSummary,
  current: LngCourseSettings,
  designModelId: string,
): boolean {
  const extracted = extractLngRunScheme(source, current);
  if (!extracted) return false;
  const ref = extracted.settings;
  return extracted.designModelId === designModelId
    && ref.kpMultiplier === current.kpMultiplier
    && ref.tiMultiplier === current.tiMultiplier
    && ref.antiWindup === current.antiWindup
    && ref.filterTauS === current.filterTauS
    && ref.brakingDistanceM === current.brakingDistanceM
    && JSON.stringify(ref.speedNodes) === JSON.stringify(current.speedNodes)
    && JSON.stringify(ref.headingNodes ?? null) === JSON.stringify(current.headingNodes ?? null);
}
