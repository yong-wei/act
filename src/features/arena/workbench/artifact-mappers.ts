import type { ChallengeTask, ControllerArtifact } from '../types';
import type { CorrectionState } from '@/features/interactive/multi-representation-linkage/model';
import type { LinkageAnalysisViewModel } from '@/resources/control-system/analysis/multi-representation-linkage-analysis';

export interface MultiRepresentationArtifactInput {
  task: ChallengeTask;
  correctionState: CorrectionState;
  gain?: number;
  now?: string;
}

export interface ArtifactBuildResult {
  artifact: ControllerArtifact | null;
  error?: string;
  unsupportedMethod?: string;
}

const correctionKindLabels: Record<CorrectionState['kind'], string> = {
  pi: 'PI',
  pd: 'PD',
  pid: 'PID',
  lead: '超前',
  lag: '滞后',
  lead_lag: '滞后-超前',
};

export function buildArenaArtifactFromMultiRepresentationState(
  input: MultiRepresentationArtifactInput,
): ArtifactBuildResult {
  const { task, correctionState, now } = input;
  const createdAt = now ?? new Date().toISOString();
  const controllerGain = Number.isFinite(correctionState.controllerGain)
    ? Math.max(0, correctionState.controllerGain)
    : 1;

  if (!correctionState.enabled) {
    return { artifact: null, error: '请先启用校正器配置控制器参数。' };
  }

  if (correctionState.kind === 'pid' || correctionState.kind === 'pi' || correctionState.kind === 'pd') {
    if (!task.allowedMethods.includes('pid')) {
      return { artifact: null, error: '当前挑战不允许使用 PID 方法。' };
    }
    return {
      artifact: {
        id: `artifact-${task.id}-pid-${Date.parse(createdAt) || Date.now()}`,
        taskId: task.id,
        method: 'pid',
        params: {
          kp: correctionState.kp * controllerGain,
          ki: (correctionState.kind === 'pd' ? 0 : correctionState.ki) * controllerGain,
          kd: (correctionState.kind === 'pi' ? 0 : correctionState.kd) * controllerGain,
        },
        createdAt,
      },
    };
  }

  if (correctionState.kind === 'lead' || correctionState.kind === 'lag') {
    if (!task.allowedMethods.includes('serial-compensator')) {
      return { artifact: null, error: '当前挑战不允许使用串联校正方法。' };
    }
    const isLead = correctionState.kind === 'lead';
    const zeroFreq = isLead ? correctionState.leadZeroFrequency : correctionState.lagZeroFrequency;
    const poleFreq = isLead ? correctionState.leadPoleFrequency : correctionState.lagPoleFrequency;
    return {
      artifact: {
        id: `artifact-${task.id}-serial-${Date.parse(createdAt) || Date.now()}`,
        taskId: task.id,
        method: 'serial-compensator',
        params: { gain: controllerGain, zero: zeroFreq, pole: poleFreq },
        createdAt,
      },
    };
  }

  if (correctionState.kind === 'lead_lag') {
    return {
      artifact: null,
      error: '滞后-超前结构暂不支持官方提交，请使用单独的超前或滞后校正。',
      unsupportedMethod: 'lead_lag',
    };
  }

  return { artifact: null, error: `不支持的校正类型：${correctionKindLabels[correctionState.kind] ?? correctionState.kind}` };
}

export interface PreviewMetricSnapshot {
  metricId: string;
  label: string;
  value: number | null;
  unit?: string;
  isAvailable: boolean;
}

export function buildPreviewMetricsFromControlAnalysis(
  analysis: LinkageAnalysisViewModel | null,
): PreviewMetricSnapshot[] {
  if (!analysis) return [];

  const snapshots: PreviewMetricSnapshot[] = [];

  snapshots.push({
    metricId: 'overshoot',
    label: '超调量',
    value: analysis.timeDomain?.metrics?.overshoot ?? null,
    unit: '%',
    isAvailable: analysis.timeDomain?.metrics?.overshoot !== undefined,
  });

  const settlingRaw = analysis.timeDomain?.metrics?.settlingTime;
  const isStable = analysis.stability?.isStable !== false;
  snapshots.push({
    metricId: 'settlingTime',
    label: '调节时间',
    value: isStable && settlingRaw && settlingRaw > 0 ? settlingRaw : null,
    unit: 's',
    isAvailable: isStable && settlingRaw !== undefined && settlingRaw > 0,
  });

  snapshots.push({
    metricId: 'steadyStateError',
    label: '稳态误差',
    value: analysis.timeDomain?.metrics?.steadyStateError ?? null,
    isAvailable: analysis.timeDomain?.metrics?.steadyStateError !== undefined,
  });

  snapshots.push({
    metricId: 'phaseMargin',
    label: '相角裕度',
    value: analysis.stability?.stabilityMargins?.phaseMargin?.value ?? null,
    unit: '°',
    isAvailable: analysis.stability?.stabilityMargins?.phaseMargin?.value !== undefined,
  });

  snapshots.push({
    metricId: 'gainMargin',
    label: '增益裕度',
    value: analysis.stability?.stabilityMargins?.gainMargin?.value ?? null,
    unit: 'dB',
    isAvailable: analysis.stability?.stabilityMargins?.gainMargin?.value !== undefined,
  });

  return snapshots;
}
