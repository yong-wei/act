'use client';

import { DestroyerSimulation, DrillingSimulation, IcebreakerSimulation } from '@/app/simulations/_components/simulation-loaders';
import type { IlabVesselId } from '@/features/ilab/vessels';

export function experimentScene(vesselId: IlabVesselId | null, seq: number): 'destroyer' | 'icebreaker' | 'drilling' {
  if (seq >= 19 && seq <= 22) return 'drilling';
  if (vesselId === 'hysy981') return 'drilling';
  if (vesselId === 'xuelong') return 'icebreaker';
  return 'destroyer';
}

export function ShipStage({ vesselId, seq }: { vesselId: IlabVesselId | null; seq: number }) {
  const scene = experimentScene(vesselId, seq);
  const caption = scene === 'drilling'
    ? '海洋石油981动力定位场景。步骤 19 到 22 用这艘平台的定位读数。'
    : scene === 'icebreaker'
      ? '雪龙2号场景。吊舱推进，没有传统舵。'
      : vesselId
        ? '055 型驱逐舰场景。在画面中操船，右侧记录用于本步评分。'
        : '尚未选定船型，先显示 055 型驱逐舰。第 1 步选定后会换成对应的船。';

  return (
    <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-950">
      <p className="border-b border-slate-800 px-3 py-2 text-sm text-slate-300">{caption}</p>
      <div className="h-[640px] [&_[data-sim-ui]]:!h-full [&_[data-sim-ui]]:!min-h-0">
        {scene === 'drilling' ? <DrillingSimulation /> : null}
        {scene === 'icebreaker' ? <IcebreakerSimulation /> : null}
        {scene === 'destroyer' ? <DestroyerSimulation /> : null}
      </div>
    </div>
  );
}
