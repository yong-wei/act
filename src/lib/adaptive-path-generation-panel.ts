import type { AdaptivePathResourceKind } from '@/lib/adaptive-path-option-display';

export type AdaptivePracticeGoalId = 'control-correction' | 'frequency-response-foundations';

export type GenerationDifficultyRhythm = 'gentle' | 'steady' | 'challenge';
export type GenerationCheckpointPreference = 'light' | 'standard' | 'dense';

export interface PathGenerationPanelState {
  goalId: AdaptivePracticeGoalId;
  timeBudgetMinutes: number;
  difficultyRhythm: GenerationDifficultyRhythm;
  resourcePreference: AdaptivePathResourceKind[];
  checkpointPreference: GenerationCheckpointPreference;
  allowExternalResources: boolean;
  naturalLanguageIntent: string;
}

export const generationResourceOptions: Array<{ id: AdaptivePathResourceKind; label: string }> = [
  { id: 'knowledge_card', label: '知识卡' },
  { id: 'adaptive_quiz', label: '练习' },
  { id: 'control_workbench', label: '控制工作台' },
  { id: 'simulation', label: '仿真' },
  { id: 'arena_task', label: 'Arena' },
  { id: 'external_resource', label: '外部资源' },
  { id: 'konling', label: '控灵辅导' },
];

export const defaultPathGenerationPanel: PathGenerationPanelState = {
  goalId: 'control-correction',
  timeBudgetMinutes: 90,
  difficultyRhythm: 'steady',
  resourcePreference: ['knowledge_card', 'adaptive_quiz', 'simulation'],
  checkpointPreference: 'standard',
  allowExternalResources: false,
  naturalLanguageIntent: '',
};

export function pathGenerationPanelFromSearchParams(
  searchParams: URLSearchParams,
  activeGoal: AdaptivePracticeGoalId | null,
): PathGenerationPanelState {
  const timeBudget = Number(searchParams.get('pathTime'));
  const difficultyRhythm = searchParams.get('pathRhythm');
  const checkpointPreference = searchParams.get('pathCheckpoint');
  const hasResourcePreference = searchParams.has('pathResources');
  const resourcePreference = (searchParams.get('pathResources') ?? '')
    .split(',')
    .filter((item): item is AdaptivePathResourceKind =>
      generationResourceOptions.some((option) => option.id === item));
  return {
    ...defaultPathGenerationPanel,
    goalId: activeGoal ?? defaultPathGenerationPanel.goalId,
    timeBudgetMinutes: Number.isFinite(timeBudget) && timeBudget >= 5 && timeBudget <= 240
      ? Math.round(timeBudget)
      : defaultPathGenerationPanel.timeBudgetMinutes,
    difficultyRhythm: difficultyRhythm === 'gentle' || difficultyRhythm === 'steady' || difficultyRhythm === 'challenge'
      ? difficultyRhythm
      : defaultPathGenerationPanel.difficultyRhythm,
    resourcePreference: hasResourcePreference ? resourcePreference : defaultPathGenerationPanel.resourcePreference,
    checkpointPreference: checkpointPreference === 'light' || checkpointPreference === 'standard' || checkpointPreference === 'dense'
      ? checkpointPreference
      : defaultPathGenerationPanel.checkpointPreference,
    allowExternalResources: searchParams.get('pathExternal') === '1',
    naturalLanguageIntent: searchParams.get('pathIntent') ?? '',
  };
}

export function buildPathGenerationGoalHref(nextGoal: AdaptivePracticeGoalId, panel: PathGenerationPanelState): string {
  const query = new URLSearchParams({
    goal: nextGoal,
    intent: 'contextual-recommendation',
    pathTime: String(panel.timeBudgetMinutes),
    pathRhythm: panel.difficultyRhythm,
    pathResources: panel.resourcePreference.join(','),
    pathCheckpoint: panel.checkpointPreference,
  });
  if (panel.allowExternalResources) query.set('pathExternal', '1');
  if (panel.naturalLanguageIntent.trim()) query.set('pathIntent', panel.naturalLanguageIntent.trim());
  return `/assessment/adaptive-practice?${query.toString()}`;
}
