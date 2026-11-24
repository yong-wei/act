'use client';

import { useEffect, useMemo, useState } from 'react';
import { Compass, Gauge, SlidersHorizontal, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { VesselExperimentController } from '../simulations/use-vessel-experiment';
import {
  SimChip, SimField, SimNotice, SimPanelSection, SimPanelStack,
  SimRunControls, SimSwitchInput, SimToggleRow,
} from '../components/simulation-panels';
import { simulationUi } from '../components/simulation-ui';
import { ModelComparisonCurve } from './model-comparison-curve';
import { LNG_COURSE_STEPS, type LngCourseSettings } from './lng-course';
import {
  extractLngRunScheme, formatLngModelTag, getLngSelectControls,
  LNG_CONTROL_NOTICES, matchesLngRunScheme,
} from './lng-step-specs';

function ReferenceRunSelector({
  label, ariaLabel, placeholder, runs, selectedId, locked, matched,
  emptyText, matchedText, revisedText, onSelect,
}: {
  label: string; ariaLabel: string; placeholder: string; runs: VesselRunSummary[];
  selectedId: string; locked: boolean; matched: boolean;
  emptyText: string; matchedText: string; revisedText: string; onSelect: (runId: string) => void;
}) {
  return (
    <div className="space-y-2">
      <SimField label={label}>
        <select className="sim-hud-input" aria-label={ariaLabel} disabled={locked} value={selectedId}
          onChange={(event) => onSelect(event.target.value)}>
          <option value="">{placeholder}</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              第{run.stepSequence}步 · {run.lastTimeS.toFixed(1)} s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
            </option>
          ))}
        </select>
      </SimField>
      {runs.length === 0
        ? <SimNotice tone="warning">{emptyText}</SimNotice>
        : <SimNotice tone={matched ? 'accent' : 'neutral'}>{matched ? matchedText : revisedText}</SimNotice>}
    </div>
  );
}

function BerthPlanSection({
  settings, locked, update,
}: {
  settings: LngCourseSettings; locked: boolean; update: (patch: Partial<LngCourseSettings>) => void;
}) {
  return (
    <SimPanelSection title="减速计划" icon={Timer}>
      <div className="space-y-2">
        <SimField label="减速起点 / m">
          <input type="number" className="sim-hud-input" aria-label="减速起点" disabled={locked} min={300} max={1500}
            value={settings.brakingDistanceM} onChange={(event) => update({ brakingDistanceM: Number(event.target.value) })} />
        </SimField>
        {settings.speedNodes.map((node, index) => (
          <div key={index} className="grid grid-cols-2 gap-2">
            <SimField label={`节点${index + 1}剩余距离 / m`}>
              <input type="number" className="sim-hud-input" aria-label={`节点${index + 1}剩余距离`} disabled={locked} min={0}
                value={node.distanceM} onChange={(event) => update({
                  speedNodes: settings.speedNodes.map((item, at) => (at === index ? { ...item, distanceM: Number(event.target.value) } : item)),
                })} />
            </SimField>
            <SimField label={`节点${index + 1}航速 / m/s`}>
              <input type="number" className="sim-hud-input" aria-label={`节点${index + 1}航速`} disabled={locked} min={0} max={4} step={0.1}
                value={node.speedMps} onChange={(event) => update({
                  speedNodes: settings.speedNodes.map((item, at) => (at === index ? { ...item, speedMps: Number(event.target.value) } : item)),
                })} />
            </SimField>
          </div>
        ))}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className={simulationUi.buttonOutline} disabled={locked || settings.speedNodes.length >= 4}
            onClick={() => update({ speedNodes: [...settings.speedNodes, { distanceM: (settings.speedNodes.at(-1)?.distanceM ?? 60) / 2, speedMps: 0 }] })}>
            增加节点
          </Button>
          <Button size="sm" variant="outline" className={simulationUi.buttonOutline} disabled={locked || settings.speedNodes.length <= 1}
            onClick={() => update({ speedNodes: settings.speedNodes.slice(0, -1) })}>
            删除末节点
          </Button>
        </div>
        <p className="text-xs leading-5 text-platform-fg-secondary">节点按剩余距离递减排列。航速为0至4m/s，船艏越线将按实际失败轨迹停止。</p>
      </div>
    </SimPanelSection>
  );
}

function HeadingPlanSection({
  settings, locked, update,
}: {
  settings: LngCourseSettings; locked: boolean; update: (patch: Partial<LngCourseSettings>) => void;
}) {
  const nodes = settings.headingNodes ?? [{ timeS: 0, headingDeg: 0 }];
  return (
    <SimPanelSection title="时序转向计划" icon={Compass}>
      <div className="space-y-2">
        {nodes.map((node, index) => (
          <div key={index} className="grid grid-cols-2 gap-2">
            <SimField label={`转向节点${index + 1}时刻 / s`}>
              <input className="sim-hud-input" type="number" aria-label={`转向节点${index + 1}时刻`} min={0} max={1200}
                disabled={locked || index === 0} value={node.timeS} onChange={(event) => update({
                  headingNodes: nodes.map((item, at) => (at === index ? { ...item, timeS: Number(event.target.value) } : item)),
                })} />
            </SimField>
            <SimField label={`转向节点${index + 1}航向 / °`}>
              <input className="sim-hud-input" type="number" aria-label={`转向节点${index + 1}航向`} min={-30} max={30} step={0.5}
                disabled={locked} value={node.headingDeg} onChange={(event) => update({
                  headingNodes: nodes.map((item, at) => (at === index ? { ...item, headingDeg: Number(event.target.value) } : item)),
                })} />
            </SimField>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className={simulationUi.buttonOutline}
            disabled={locked || nodes.length >= 4 || (nodes.at(-1)?.timeS ?? 0) >= 1200}
            onClick={() => update({ headingNodes: [...nodes, { timeS: Math.min(1200, nodes.at(-1)!.timeS + 200), headingDeg: 0 }] })}>
            增加转向节点
          </Button>
          <Button size="sm" variant="outline" className={simulationUi.buttonOutline} disabled={locked}
            onClick={() => update({ headingNodes: undefined })}>
            恢复直航
          </Button>
        </div>
        <p className="text-xs leading-5 text-platform-fg-secondary">航向参考在节点之间连续变化，实际转向由船体与执行器响应决定。</p>
      </div>
    </SimPanelSection>
  );
}

export function LngCourseControls({
  session,
  timeS,
}: {
  session: VesselExperimentController<LngCourseSettings>;
  timeS: number;
}) {
  const course = session.course;
  const seq = session.activeSeq;
  const definition = LNG_COURSE_STEPS[seq - 1];
  const [selectedStillWaterId, setSelectedStillWaterId] = useState('');
  const [selectedStep18Id, setSelectedStep18Id] = useState('');

  useEffect(() => {
    setSelectedStillWaterId('');
    setSelectedStep18Id('');
  }, [seq, course?.scopeKey]);

  const speedModels = useMemo(
    () => (course?.models ?? []).filter((m) => m.channel === 'shaft-reference-to-speed' && m.payload.structure.kind === 'fopdt'),
    [course?.models],
  );
  const completedRuns = useMemo(() => (course?.runs ?? []).filter((run) => run.stoppedAtMs !== null), [course?.runs]);
  const stillWaterRuns = useMemo(
    () => completedRuns.filter((run) => (run.stepSequence === 8 || run.stepSequence === 9) && run.stopReason !== 'failure'),
    [completedRuns],
  );
  const step18Runs = useMemo(() => completedRuns.filter((run) => run.stepSequence === 18), [completedRuns]);

  if (!course || !definition) return null;

  const settings = course.settings;
  const locked = session.busy || course.running || timeS > 0 || session.tour.active;
  const update = (patch: Partial<LngCourseSettings>) => course.setSettings((previous) => ({ ...previous, ...patch }));
  const forecast = course.comparisons.filter((item) => item.purpose === 'forecast' && item.runId === course.plannedRunId).at(-1);

  const importFrozenScheme = (runId: string, onPick: (id: string) => void) => {
    onPick(runId);
    const source = course.runs.find((run) => run.id === runId);
    if (!source) return;
    const restored = extractLngRunScheme(source, settings);
    if (!restored) return;
    course.setSettings(restored.settings);
    course.setDesignModelId(restored.designModelId);
  };

  const selectControls = getLngSelectControls(seq);
  const stepNotice = LNG_CONTROL_NOTICES[seq];

  return (
    <SimPanelStack>
      {seq !== 20 ? (
        <SimRunControls
          running={course.running}
          primaryLabel={course.completed ? '已结束' : course.running ? '暂停' : '开始'}
          disabled={session.busy}
          primaryDisabled={!course.ready || course.completed || definition.stepKind === 'analysis'}
          onPrimary={() => { void (course.running ? course.pause() : course.start()); }}
          onReset={() => { void course.reset(); }}
        />
      ) : null}

      {definition.berthTask && definition.stepKind === 'run' ? (
        <Button size="sm" variant="outline" className={simulationUi.buttonOutline}
          disabled={session.busy || !course.canFinish} onClick={() => { void course.finish(); }}>
          结束本次靠泊并保留记录
        </Button>
      ) : null}

      {stepNotice ? <SimNotice tone="neutral" title={stepNotice.title}>{stepNotice.body}</SimNotice> : null}

      {seq === 20 ? (
        <SimPanelSection title="报告引用的本人运行" icon={Gauge}
          aside={<SimChip tone={course.reportRunIds.length >= 5 ? 'success' : 'warning'}>已选 {course.reportRunIds.length} 次</SimChip>}>
          {completedRuns.length === 0 ? (
            <SimNotice tone="warning">尚无已完成的本人运行记录，请先完成前序步骤仿真运行。</SimNotice>
          ) : (
            <div className="space-y-1.5">
              {completedRuns.map((run) => (
                <label key={run.id} className="flex items-center gap-2 text-xs text-platform-fg-secondary">
                  <input type="checkbox" checked={course.reportRunIds.includes(run.id)}
                    onChange={(event) => course.setReportRunIds((previous) =>
                      event.target.checked ? [...previous, run.id] : previous.filter((id) => id !== run.id),
                    )} />
                  第{run.stepSequence}步 · {run.lastTimeS.toFixed(1)} s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
                </label>
              ))}
            </div>
          )}
        </SimPanelSection>
      ) : null}

      {selectControls.map((control) => (
        <SimField key={control.key} label={control.label}>
          <select className="sim-hud-input" aria-label={control.label} disabled={locked} value={settings[control.key]}
            onChange={(event) => update({ [control.key]: Number(event.target.value) } as Partial<LngCourseSettings>)}>
            {control.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </SimField>
      ))}

      {definition.speedControl ? (
        <SimPanelSection title="本人航速控制方案" icon={SlidersHorizontal}>
          <div className="space-y-3">
            {speedModels.length === 0 ? (
              <SimNotice tone="warning" title="尚未冻结航速模型">
                请先在第 2 步完成轴速小信号阶跃，再前往第 3 步评估页签辨识并冻结航速模型。
              </SimNotice>
            ) : null}
            <SimField label="冻结的航速模型">
              <select className="sim-hud-input" aria-label="控制所用航速模型" disabled={locked} value={course.designModelId}
                onChange={(event) => course.setDesignModelId(event.target.value)}>
                <option value="">选择本人模型</option>
                {speedModels.map((model, index) => <option key={model.id} value={model.id}>{formatLngModelTag(model, index)}</option>)}
              </select>
            </SimField>
            {([['kpMultiplier', 'Kp相对IMC建议值', 0.2, 3], ['tiMultiplier', 'Ti相对IMC建议值', 0.3, 3]] as const).map(([key, label, min, max]) => (
              <SimField key={key} label={label}>
                <input className="sim-hud-input" type="number" aria-label={label} min={min} max={max} step={0.1}
                  disabled={locked} value={settings[key]} onChange={(event) => update({ [key]: Number(event.target.value) })} />
              </SimField>
            ))}
            <SimToggleRow label="积分抗饱和回算" htmlFor="lng-integral-tracking" control={(
              <SimSwitchInput id="lng-integral-tracking" checked={settings.antiWindup} disabled={locked}
                onChange={() => update({ antiWindup: !settings.antiWindup })} />
            )} />
            {seq === 11 ? (
              <>
                <SimField label="额外命令时延 / s">
                  <select className="sim-hud-input" aria-label="额外命令时延" disabled={locked} value={settings.additionalCommandDelayS}
                    onChange={(event) => update({ additionalCommandDelayS: Number(event.target.value) as 0 | 5 })}>
                    <option value={0}>0 s（无额外命令时延）</option>
                    <option value={5}>5 s（额外纯时延）</option>
                  </select>
                </SimField>
                <SimToggleRow label="给定Smith结构" htmlFor="lng-smith" control={(
                  <SimSwitchInput id="lng-smith" checked={settings.smithEnabled} disabled={locked}
                    onChange={() => update({ smithEnabled: !settings.smithEnabled })} />
                )} />
              </>
            ) : null}
            {seq === 16 ? (
              <ReferenceRunSelector
                label="已冻结的静水靠泊方案"
                ariaLabel="引用第8/9步静水靠泊方案"
                placeholder="选择第 8/9 步静水靠泊方案"
                runs={stillWaterRuns}
                selectedId={selectedStillWaterId}
                locked={locked}
                matched={stillWaterRuns.some((run) => matchesLngRunScheme(run, settings, course.designModelId))}
                emptyText="请先在第 8 或第 9 步完成一次完整静水靠泊运行，再返回本步引用静水方案。"
                matchedText="当前参数与静水基准一致：请先原样复现风流基准，再重置后修改一项策略完成对比。"
                revisedText="当前参数已相对静水基准修订：请确保已保留一条未修改的静水方案风流复现运行。"
                onSelect={(id) => importFrozenScheme(id, setSelectedStillWaterId)}
              />
            ) : null}
            {seq === 19 ? (
              <ReferenceRunSelector
                label="已冻结的综合方案"
                ariaLabel="引用第18步综合方案"
                placeholder="选择第18步本人方案"
                runs={step18Runs}
                selectedId={selectedStep18Id}
                locked={locked}
                matched={step18Runs.some((run) => matchesLngRunScheme(run, settings, course.designModelId))}
                emptyText="请先在第 18 步完成并冻结一次综合靠泊方案，再于本步开展未见工况盲测。"
                matchedText="当前与第 18 步冻结方案一致：可直接分别运行「未见工况甲」与「未见工况乙」原方案盲测。"
                revisedText="当前已修改方案参数：适用于完成两档原方案盲测后提交第 3 次有依据的修正运行。"
                onSelect={(id) => importFrozenScheme(id, setSelectedStep18Id)}
              />
            ) : null}
          </div>
        </SimPanelSection>
      ) : null}

      {definition.berthTask ? <BerthPlanSection settings={settings} locked={locked} update={update} /> : null}
      {[16, 18, 19].includes(seq) ? <HeadingPlanSection settings={settings} locked={locked} update={update} /> : null}

      {definition.berthTask ? (
        <>
          <Button size="sm" variant="outline" className={simulationUi.buttonOutline}
            disabled={locked || !course.ready || !course.designModelId} onClick={() => { void course.freezePrediction(); }}>
            冻结速度与距离预测
          </Button>
          {forecast ? <ModelComparisonCurve comparison={forecast} /> : null}
        </>
      ) : null}

      {timeS > 0 ? <p className="text-xs text-platform-fg-secondary">本次方案已冻结。重置后可以修订参数，各次运行独立保留。</p> : null}
    </SimPanelStack>
  );
}
