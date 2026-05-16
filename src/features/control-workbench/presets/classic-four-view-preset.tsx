import Link from 'next/link';

import { MultiRepresentationLinkageClient } from '@/features/interactive/multi-representation-linkage/page-client';
import type { WorkbenchSessionContext } from '../types';
import type { WorkbenchViewConfig, WorkbenchViewId } from '../contracts';

type ClassicPresetViewConfigs = Partial<Record<WorkbenchViewId, WorkbenchViewConfig>>;

function hasClassicModel(session: WorkbenchSessionContext) {
  return Boolean(
    'taskId' in session
      && session.workingModel
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
}: {
  session: WorkbenchSessionContext;
  viewConfigs?: ClassicPresetViewConfigs;
}) {
  if (!('taskId' in session) || !hasClassicModel(session)) {
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

  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-slate-950/30">
      <MultiRepresentationLinkageClient
        initialParams={{
          arenaTaskId: session.taskId,
          embed: true,
          publicationId: 'publicationId' in session ? session.publicationId : undefined,
          role: 'student',
          viewConfigs: mapClassicViewConfigs(viewConfigs),
        }}
      />
    </section>
  );
}
