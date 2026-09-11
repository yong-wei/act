import Link from 'next/link';

import { MultiRepresentationLinkageClient } from '@/features/interactive/multi-representation-linkage/page-client';
import type { ControlAnalysisRequest } from '@/resources/control-system/analysis/types';
import type { WorkbenchSessionContext } from '../types';
import type { WorkbenchViewConfig, WorkbenchViewId } from '../contracts';
import type { WorkbenchPanelInstance } from '../views';
import type {
  MultiRepresentationInitialParams,
  MultiRepresentationPanelOptionsChangeHandler,
} from '@/features/interactive/multi-representation-linkage/model';

type ClassicPresetViewConfigs = Partial<Record<WorkbenchViewId, WorkbenchViewConfig>>;

function hasClassicModel(session: WorkbenchSessionContext) {
  return Boolean(
    session.workingModel
      && session.workingModel.representation.kind === 'transfer-function'
      && session.allowedViews.includes('time-domain')
      && session.allowedViews.includes('bode')
      && session.allowedViews.includes('root-locus')
      && session.allowedViews.includes('nyquist'),
  );
}

function mapClassicViewConfig(config: WorkbenchViewConfig | undefined) {
  if (!config) return undefined;
  return {
    enabled: config.enabled,
    selectedOptions: config.selectedOptions ? [...config.selectedOptions] : undefined,
  };
}

function buildClassicPlantModel(
  session: WorkbenchSessionContext,
): MultiRepresentationInitialParams['plantModel'] {
  const model = session.workingModel;
  if (!model || model.representation.kind !== 'transfer-function') {
    return undefined;
  }

  return {
    id: model.id,
    objectId: model.sourceObjectId,
    name: 'object' in session ? session.object.name : '综合仿真对象',
    display: model.representation.display,
    latex: model.representation.latex,
    numerator: [...model.representation.numerator],
    denominator: [...model.representation.denominator],
    timeRange: 'object' in session ? session.object.timeRange : undefined,
    frequencyRange: 'object' in session ? session.object.frequencyRange : undefined,
    workbenchSeed: 'object' in session ? session.object.workbenchSeed : undefined,
  };
}

function mapClassicViewConfigs(viewConfigs: ClassicPresetViewConfigs | undefined) {
  if (!viewConfigs) return undefined;
  return {
    'time-domain': mapClassicViewConfig(viewConfigs['time-domain']),
    bode: mapClassicViewConfig(viewConfigs.bode),
    'root-locus': mapClassicViewConfig(viewConfigs['root-locus']),
    nyquist: mapClassicViewConfig(viewConfigs.nyquist),
  };
}

export function ClassicFourViewPreset({
  session,
  viewConfigs,
  panelInstances,
  onPanelSelectedOptionsChange,
  onGovernedAnalysisReady,
}: {
  session: WorkbenchSessionContext;
  viewConfigs?: ClassicPresetViewConfigs;
  panelInstances?: WorkbenchPanelInstance[];
  onPanelSelectedOptionsChange?: MultiRepresentationPanelOptionsChangeHandler;
  onGovernedAnalysisReady?: (input: { request: ControlAnalysisRequest }) => void;
}) {
  if (!hasClassicModel(session)) {
    return (
      <section className="rounded-lg border border-amber-400/40 bg-amber-950/20 p-5 text-sm text-amber-100">
        <p className="text-xs font-medium text-amber-200">工作台模式不匹配</p>
        <h2 className="mt-2 text-lg font-semibold text-amber-50">当前挑战不支持经典白箱四视图工作台</h2>
        <p className="mt-2 leading-6">
          该预设只适用于公开传递函数的白箱 SISO LTI 挑战；当前上下文不会渲染隐藏对象的传递函数图表。
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="text-amber-100 underline" href="/arena">
            返回竞技场大厅
          </Link>
          {'taskId' in session ? (
            <Link className="text-amber-100 underline" href={`/arena/challenges/${session.taskId}`}>
              返回挑战详情
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  const plantModel = buildClassicPlantModel(session);

  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-slate-950/30">
      <MultiRepresentationLinkageClient
        key={plantModel?.objectId ?? plantModel?.id ?? 'classic-whitebox'}
        onPanelSelectedOptionsChange={onPanelSelectedOptionsChange}
        onGovernedAnalysisReady={onGovernedAnalysisReady}
        initialParams={{
          arenaTaskId: 'taskId' in session ? session.taskId : undefined,
          embed: true,
          plantModel,
          publicationId: 'publicationId' in session ? session.publicationId : undefined,
          role: 'student',
          panelInstances: panelInstances?.filter((panel) => (
            panel.viewId === 'time-domain'
            || panel.viewId === 'bode'
            || panel.viewId === 'root-locus'
            || panel.viewId === 'nyquist'
          )).map((panel) => ({
            id: panel.id,
            viewId: panel.viewId as 'time-domain' | 'bode' | 'root-locus' | 'nyquist',
            title: panel.title,
            enabled: panel.enabled,
            selectedOptions: panel.selectedOptions ? [...panel.selectedOptions] : undefined,
          })),
          viewConfigs: mapClassicViewConfigs(viewConfigs),
        }}
      />
    </section>
  );
}
