'use client';

import { useEffect, useMemo, useState } from 'react';
import { Gauge, Navigation, SlidersHorizontal } from 'lucide-react';
import type { VesselExperimentController } from '../simulations/use-vessel-experiment';
import {
  SimChip,
  SimField,
  SimLockedChip,
  SimNotice,
  SimPanelSection,
  SimPanelStack,
  SimReadout,
  SimReadoutGrid,
  SimRunControls,
  SimSwitchInput,
  SimToggleRow,
} from '../components/simulation-panels';
import { CRUISE_COURSE_STEPS, type CruiseCourseSettings } from './cruise-course';
import { CruiseRollDesign } from './cruise-roll-design';

type SelectSettingKey =
  | 'speedMps'
  | 'resonanceRatio'
  | 'headingRampS'
  | 'dampingRatio'
  | 'stiffnessFraction'
  | 'lowPassCutoffHz'
  | 'notchBandwidthHz';

const SINGLE_FACTOR_KEY: Record<number, SelectSettingKey | 'finsEnabled' | 'notch'> = {
  9: 'finsEnabled',
  10: 'dampingRatio',
  12: 'headingRampS',
  13: 'speedMps',
  14: 'lowPassCutoffHz',
  15: 'notch',
};

const STEP17_DIFF_FIELDS: ReadonlyArray<{ key: keyof CruiseCourseSettings; label: string }> = [
  { key: 'headingRampS', label: '转向斜坡' }, { key: 'dampingRatio', label: '目标阻尼比' },
  { key: 'stiffnessFraction', label: '恢复刚度比' }, { key: 'lowPassCutoffHz', label: '低通截止' },
  { key: 'notchEnabled', label: '陷波开关' }, { key: 'notchCenterHz', label: '陷波中心' },
  { key: 'notchBandwidthHz', label: '陷波带宽' },
];

function BaselineSummaryDetails({ settings, unlockedFactor }: { settings: CruiseCourseSettings; unlockedFactor?: string }) {
  const items = [
    unlockedFactor !== 'speedMps' ? `初始航速 ${settings.speedMps} m/s` : '',
    unlockedFactor !== 'finsEnabled' ? `减摇鳍反馈：${settings.finsEnabled ? '开启' : '关闭'}` : '',
    unlockedFactor !== 'dampingRatio' ? `目标阻尼比 ${settings.dampingRatio}` : '',
    `恢复刚度比 ${settings.stiffnessFraction}`,
    unlockedFactor !== 'lowPassCutoffHz' ? `量测低通截止 ${settings.lowPassCutoffHz} Hz` : '',
    unlockedFactor !== 'notch' ? `陷波滤波：${settings.notchEnabled ? `开启 (${settings.notchCenterHz.toFixed(2)} Hz / 带宽 ${settings.notchBandwidthHz} Hz)` : '关闭'}` : '',
    unlockedFactor !== 'headingRampS' ? `转向斜坡 ${settings.headingRampS} s` : '',
  ].filter(Boolean);

  return (
    <details data-cruise-baseline-summary className="rounded-md border border-platform-border/80 bg-platform-canvas/40 px-2.5 py-2 text-xs text-platform-fg-secondary">
      <summary className="cursor-pointer select-none font-medium text-platform-fg-primary">其余基线联合参数（本步只读锁定）</summary>
      <ul className="mt-1.5 space-y-0.5 text-[11px] leading-5">{items.map((item) => <li key={item}>· {item}</li>)}</ul>
    </details>
  );
}

export function CruiseCourseControls({
  session,
  timeS,
}: {
  session: VesselExperimentController<CruiseCourseSettings>;
  timeS: number;
}) {
  const course = session.course;
  const seq = session.activeSeq;
  const [referencedRunId, setReferencedRunId] = useState('');

  useEffect(() => {
    setReferencedRunId('');
  }, [seq, course?.scopeKey]);

  const step = CRUISE_COURSE_STEPS[seq - 1];
  const settings = course?.settings;
  const locked = Boolean(session.busy || course?.running || timeS > 0);
  const update = (patch: Partial<CruiseCourseSettings>) =>
    course?.setSettings((previous) => ({ ...previous, ...patch }));

  const allRollModels = useMemo(
    () => (course?.models ?? []).filter((m) => m.channel === 'fin-to-roll' && m.payload.structure.kind === 'roll_oscillator'),
    [course?.models],
  );
  const selectableModels = useMemo(
    () =>
      step?.finControl
        ? allRollModels.filter((m) => m.payload.structure.kind === 'roll_oscillator' && m.payload.structure.control_gain > 0)
        : allRollModels,
    [allRollModels, step?.finControl],
  );
  const selected = selectableModels.find((m) => m.id === course?.designModelId);

  useEffect(() => {
    if (!course || !step || locked || (!step.finControl && seq !== 6)) return;
    if (selected) {
      if (seq === 6 && selected.payload.structure.kind === 'roll_oscillator') {
        const period = (2 * Math.PI) / selected.payload.structure.natural_freq_rad_s;
        if (Math.abs(course.settings.identifiedPeriodS - period) > 1e-6) {
          course.setSettings((prev) => ({ ...prev, identifiedPeriodS: period }));
        }
      }
      return;
    }
    const latestValid = selectableModels.at(-1);
    if (!latestValid) return;
    course.setDesignModelId(latestValid.id);
    if (latestValid.payload.structure.kind === 'roll_oscillator') {
      const period = (2 * Math.PI) / latestValid.payload.structure.natural_freq_rad_s;
      course.setSettings((prev) => ({ ...prev, identifiedPeriodS: period }));
    }
  }, [course, step, locked, seq, selected, selectableModels]);

  useEffect(() => {
    if (!course || locked) return;
    if (seq === 8 && (!course.settings.finsEnabled || course.settings.stiffnessFraction !== 0 || course.settings.dampingRatio !== 0.5)) {
      course.setSettings((prev) => ({ ...prev, finsEnabled: true, stiffnessFraction: 0, dampingRatio: 0.5 }));
    }
    if (seq === 10 && (!course.settings.finsEnabled || ![0.3, 0.7].includes(course.settings.dampingRatio))) {
      course.setSettings((prev) => ({
        ...prev,
        finsEnabled: true,
        dampingRatio: [0.3, 0.7].includes(prev.dampingRatio) ? prev.dampingRatio : 0.3,
      }));
    }
  }, [course, locked, seq]);

  if (!course || !step || !settings) return null;

  if (seq === 20) {
    const completedRuns = course.runs.filter((run) => run.stoppedAtMs !== null);
    return (
      <SimPanelStack>
        <SimPanelSection title="报告引用的本人运行" icon={Gauge}>
          <p className="mb-2 text-xs text-platform-fg-secondary">
            已勾选 {course.reportRunIds.length} 次完整运行（报告要求至少引用 5 次并包含两处乘客点指标）。
          </p>
          {completedRuns.length === 0 ? (
            <SimNotice tone="warning">尚未发现已结束的本人运行记录，请先完成前序关键步骤运行。</SimNotice>
          ) : null}
          <div className="space-y-1.5">
            {completedRuns.map((run) => (
              <label key={run.id} className="flex items-center gap-2 text-xs text-platform-fg-secondary">
                <input
                  type="checkbox"
                  checked={course.reportRunIds.includes(run.id)}
                  onChange={(event) =>
                    course.setReportRunIds((previous) =>
                      event.target.checked ? [...previous, run.id] : previous.filter((id) => id !== run.id),
                    )
                  }
                />
                第{run.stepSequence}步 · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
              </label>
            ))}
          </div>
        </SimPanelSection>
      </SimPanelStack>
    );
  }

  const singleFactor = SINGLE_FACTOR_KEY[seq];
  const isJointEdit = seq === 16 || seq === 17;
  const isFrozenBlind = seq === 18 || seq === 19;
  const jointSourceCandidates = course.runs.filter(
    (run) => [16, 17].includes(run.stepSequence) && run.stepSequence < seq && run.stoppedAtMs !== null,
  );
  const step16Candidates = jointSourceCandidates.filter((run) => run.stepSequence === 16);
  const referencedStep16Run =
    seq === 17
      ? step16Candidates.find((r) => r.id === referencedRunId) ??
        (course.designModelId
          ? step16Candidates.find(
              (r) =>
                r.designStudentModelId === course.designModelId &&
                r.courseSettings?.finsEnabled === settings.finsEnabled &&
                STEP17_DIFF_FIELDS.filter(({ key }) => JSON.stringify(r.courseSettings?.[key]) !== JSON.stringify(settings[key])).length <= 1,
            )
          : undefined)
      : undefined;
  const step17ChangedLabels = referencedStep16Run
    ? STEP17_DIFF_FIELDS.filter(({ key }) => JSON.stringify(referencedStep16Run.courseSettings?.[key]) !== JSON.stringify(settings[key])).map((item) => item.label)
    : [];
  const referencedJointRun = isFrozenBlind
    ? jointSourceCandidates.find((r) => r.id === referencedRunId) ??
      (course.designModelId
        ? jointSourceCandidates.find((r) => {
            if (r.designStudentModelId !== course.designModelId || !r.courseSettings) return false;
            const src = { ...r.courseSettings };
            const cur: Record<string, unknown> = { ...settings };
            if (seq === 19) {
              delete src.faultStrategy;
              delete cur.faultStrategy;
            }
            return JSON.stringify(src) === JSON.stringify(cur);
          })
        : undefined)
    : undefined;

  const jointSchemeLocked = Boolean(isFrozenBlind && referencedJointRun);
  const modelLocked = locked || jointSchemeLocked || Boolean(seq === 17 && referencedStep16Run);
  const paramLocked = (factor: string) => locked || jointSchemeLocked || Boolean(singleFactor && singleFactor !== factor);

  const selectSpecs: Array<{ key: SelectSettingKey; label: string; values: number[]; visible: boolean; factor: string }> = [
    { key: 'resonanceRatio', label: '规则波周期与本人固有周期之比', values: [0.7, 1, 1.3], visible: seq === 6, factor: 'resonanceRatio' },
    { key: 'speedMps', label: '初始航速 / m/s', values: seq === 7 ? [0, 2, 8] : [4, 8, 10], visible: seq === 7 || seq === 13, factor: 'speedMps' },
    { key: 'headingRampS', label: '转向斜坡 / s', values: seq === 12 ? [40, 80] : [10, 40, 80], visible: seq === 12 || isJointEdit || isFrozenBlind, factor: 'headingRampS' },
    { key: 'dampingRatio', label: '目标阻尼比', values: seq === 10 ? [0.3, 0.7] : [0.3, 0.5, 0.7], visible: seq === 10 || isJointEdit || isFrozenBlind, factor: 'dampingRatio' },
    { key: 'stiffnessFraction', label: '角度反馈相对恢复刚度', values: [0, 0.2, 0.5], visible: isJointEdit || isFrozenBlind, factor: 'stiffnessFraction' },
    { key: 'lowPassCutoffHz', label: '量测低通截止 / Hz', values: [0.15, 0.3, 0.6], visible: seq === 14 || isJointEdit || isFrozenBlind, factor: 'lowPassCutoffHz' },
    { key: 'notchBandwidthHz', label: '陷波带宽 / Hz', values: [0.03, 0.06, 0.1], visible: seq === 15 || isJointEdit || isFrozenBlind, factor: 'notch' },
  ];

  const renderSelect = (item: (typeof selectSpecs)[number]) => (
    <SimField key={item.key} label={item.label}>
      <select
        className="sim-hud-input"
        aria-label={item.label}
        disabled={paramLocked(item.factor)}
        value={settings[item.key]}
        onChange={(event) => update({ [item.key]: Number(event.target.value) })}
      >
        {item.values.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </SimField>
  );

  return (
    <SimPanelStack>
      <SimRunControls
        running={course.running}
        primaryLabel={course.completed ? '已结束' : course.running ? '暂停' : '开始'}
        disabled={session.busy}
        primaryDisabled={!course.ready || course.completed || step.stepKind === 'analysis'}
        onPrimary={() => { void (course.running ? course.pause() : course.start()); }}
        onReset={() => { void course.reset(); }}
      />

      {seq <= 5 ? (
        <SimNotice tone="neutral">本步采用预设物理激励或环境海况，无须手调控制器参数，按操作步骤直接运行与观测。</SimNotice>
      ) : null}

      {[17, 18, 19].includes(seq) ? (
        <SimPanelSection title="已冻结的联合方案" icon={Navigation}>
          <div className="space-y-2.5">
            <SimField label="引用本人联合方案">
              <select className="sim-hud-input" aria-label="引用邮轮联合方案" disabled={locked} value={referencedRunId || referencedStep16Run?.id || referencedJointRun?.id || ''}
                onChange={(event) => {
                  const source = course.runs.find((run) => run.id === event.target.value);
                  if (!source?.courseSettings) return;
                  setReferencedRunId(source.id);
                  const next = source.courseSettings as unknown as CruiseCourseSettings;
                  course.setSettings(seq === 19 ? { ...next, faultStrategy: settings.faultStrategy } : next);
                  course.setDesignModelId(source.designStudentModelId ?? '');
                }}>
                <option value="">选择此前本人完整运行</option>
                {(seq === 17 ? step16Candidates : jointSourceCandidates).map((run) => (
                  <option key={run.id} value={run.id}>第{run.stepSequence}步 · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}</option>
                ))}
              </select>
            </SimField>

            {seq === 17 && referencedStep16Run ? (
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <SimChip tone={step17ChangedLabels.length === 1 ? 'success' : 'warning'} data-cruise-step17-diff-count={step17ChangedLabels.length}>
                    当前变更维度：{step17ChangedLabels.length}/1
                  </SimChip>
                  <SimLockedChip locked>减摇鳍：{settings.finsEnabled ? '开启' : '关闭'}（防误关锁定）</SimLockedChip>
                </div>
                <p className="text-[11px] text-platform-fg-secondary">
                  {step17ChangedLabels.length === 1
                    ? `已单维修改：${step17ChangedLabels[0]}，可开始第 17 步运行。`
                    : step17ChangedLabels.length === 0
                      ? '请在下方 7 项策略参数中调整恰好 1 项以对比两乘客点变化。'
                      : `已修改 ${step17ChangedLabels.join('、')}，请还原多余项至仅保留 1 项差异。`}
                </p>
              </div>
            ) : null}

            {isFrozenBlind ? (
              jointSchemeLocked && referencedJointRun ? (
                <SimLockedChip locked>已按第{referencedJointRun.stepSequence}步方案锁定全部8项控制与滤波参数</SimLockedChip>
              ) : (
                <SimNotice tone="warning">请先从上方引用第 16 或 17 步本人联合方案；引用后原 8 项控制器/滤波器参数将全部只读锁定。</SimNotice>
              )
            ) : null}

            {seq === 19 ? (
              <SimField label="单鳍失效后的策略">
                <select
                  className="sim-hud-input"
                  aria-label="单鳍失效策略"
                  disabled={locked}
                  value={settings.faultStrategy}
                  onChange={(event) => update({ faultStrategy: event.target.value as CruiseCourseSettings['faultStrategy'] })}
                >
                  <option value="keep">保持当前方案</option>
                  <option value="slow">180s 后降速运行</option>
                  <option value="long-turn">故障后转向延长为 80 s</option>
                </select>
              </SimField>
            ) : null}
          </div>
        </SimPanelSection>
      ) : null}

      {step.finControl || seq === 6 ? (
        <SimPanelSection title="本人横摇模型与鳍反馈" icon={SlidersHorizontal}>
          <div className="space-y-3">
            <SimField label={step.finControl ? '冻结的完整横摇模型（需含鳍效能）' : '冻结的横摇模型'}>
              <select className="sim-hud-input" aria-label="控制所用横摇模型" disabled={modelLocked} value={selected?.id ?? ''}
                onChange={(event) => {
                  const model = selectableModels.find((item) => item.id === event.target.value);
                  course.setDesignModelId(event.target.value);
                  if (model?.payload.structure.kind === 'roll_oscillator') {
                    update({ identifiedPeriodS: (2 * Math.PI) / model.payload.structure.natural_freq_rad_s });
                  }
                }}>
                <option value="">选择本人模型</option>
                {selectableModels.map((model, index) => <option key={model.id} value={model.id}>{model.label} · 版本{index + 1}</option>)}
              </select>
            </SimField>

            {selectableModels.length === 0 ? (
              <SimNotice tone="warning">
                {step.finControl
                  ? '尚未冻结含差动鳍控制效能的第 3 步完整横摇模型，请先完成第 2/3 步辨识冻结。'
                  : '尚未冻结第 2 步横摇自由衰减模型，请先完成第 2 步辨识冻结。'}
              </SimNotice>
            ) : null}

            {seq === 6 ? (
              <p className="text-xs text-platform-fg-secondary">
                本人固有周期 {settings.identifiedPeriodS.toFixed(3)} s，规则波波高 0.5 m、周期{' '}
                {(settings.identifiedPeriodS * settings.resonanceRatio).toFixed(3)} s。
              </p>
            ) : null}

            {seq === 8 ? (
              <div className="space-y-2">
                <SimLockedChip locked>本步锁定为纯横摇速率反馈初值</SimLockedChip>
                <SimReadoutGrid>
                  <SimReadout label="减摇鳍反馈" value="开启（锁定）" />
                  <SimReadout label="目标阻尼比" value="0.5（锁定）" />
                  <SimReadout label="恢复刚度比" value="0（锁定）" />
                </SimReadoutGrid>
              </div>
            ) : null}

            {seq === 9 || seq === 16 || isFrozenBlind ? (
              <SimToggleRow
                label="启用减摇鳍反馈"
                htmlFor="cruise-fins"
                control={
                  <SimSwitchInput
                    id="cruise-fins"
                    checked={settings.finsEnabled}
                    disabled={paramLocked('finsEnabled')}
                    onChange={() => update({ finsEnabled: !settings.finsEnabled })}
                  />
                }
              />
            ) : null}

            {selectSpecs.filter((item) => item.visible).map(renderSelect)}

            {seq === 15 || isJointEdit || isFrozenBlind ? (
              <>
                <SimToggleRow
                  label="启用所选陷波"
                  htmlFor="cruise-notch"
                  control={
                    <SimSwitchInput
                      id="cruise-notch"
                      checked={settings.notchEnabled}
                      disabled={paramLocked('notch')}
                      onChange={() => update({ notchEnabled: !settings.notchEnabled })}
                    />
                  }
                />
                <SimField label="依据本人频谱选择陷波中心 / Hz">
                  <input
                    className="sim-hud-input"
                    type="number"
                    aria-label="陷波中心频率"
                    min={0.02}
                    max={2}
                    step={0.01}
                    disabled={paramLocked('notch')}
                    value={settings.notchCenterHz}
                    onChange={(event) => {
                      const val = Number(event.target.value);
                      if (Number.isFinite(val)) update({ notchCenterHz: val });
                    }}
                  />
                </SimField>
              </>
            ) : null}

            {singleFactor || seq === 11 ? <BaselineSummaryDetails settings={settings} unlockedFactor={singleFactor} /> : null}

            {step.finControl ? (
              <CruiseRollDesign
                model={selected}
                settings={seq === 8 ? { ...settings, finsEnabled: true, stiffnessFraction: 0, dampingRatio: 0.5 } : settings}
              />
            ) : null}
          </div>
        </SimPanelSection>
      ) : seq === 7 ? (
        <SimPanelSection title="低速航速工作点设置" icon={SlidersHorizontal}>
          {selectSpecs.filter((item) => item.visible).map(renderSelect)}
        </SimPanelSection>
      ) : null}
    </SimPanelStack>
  );
}
