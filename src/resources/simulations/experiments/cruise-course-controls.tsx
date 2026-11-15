'use client';

import { Gauge, SlidersHorizontal, Navigation } from 'lucide-react';
import type { VesselExperimentController } from '../simulations/use-vessel-experiment';
import {
  SimField,
  SimPanelSection,
  SimPanelStack,
  SimRunControls,
  SimSwitchInput,
  SimToggleRow,
} from '../components/simulation-panels';
import { CRUISE_COURSE_STEPS, type CruiseCourseSettings } from './cruise-course';
import { CruiseRollDesign } from './cruise-roll-design';

export function CruiseCourseControls({
  session,
  timeS,
}: {
  session: VesselExperimentController<CruiseCourseSettings>;
  timeS: number;
}) {
  const course = session.course;
  if (!course) return null;
  const step = CRUISE_COURSE_STEPS[session.activeSeq - 1];
  const settings = course.settings;
  const locked = session.busy || course.running || timeS > 0;
  const update = (patch: Partial<CruiseCourseSettings>) =>
    course.setSettings((previous) => ({ ...previous, ...patch }));
  const models = course.models.filter(
    (model) => model.channel === 'fin-to-roll' && model.payload.structure.kind === 'roll_oscillator',
  );
  const selected = models.find((model) => model.id === course.designModelId);
  const selects: Array<{
    key:
      | 'speedMps'
      | 'resonanceRatio'
      | 'dampingRatio'
      | 'stiffnessFraction'
      | 'lowPassCutoffHz'
      | 'notchBandwidthHz'
      | 'headingRampS';
    label: string;
    values: number[];
    visible: boolean;
  }> = [
    {
      key: 'speedMps',
      label: '初始航速 / m/s',
      values: session.activeSeq === 7 ? [0, 2, 8] : [4, 8, 10],
      visible: [7, 13].includes(session.activeSeq),
    },
    {
      key: 'resonanceRatio',
      label: '规则波周期与本人固有周期之比',
      values: [0.7, 1, 1.3],
      visible: session.activeSeq === 6,
    },
    {
      key: 'dampingRatio',
      label: '目标阻尼比',
      values: session.activeSeq === 10 ? [0.3, 0.7] : [0.3, 0.5, 0.7],
      visible: step.finControl && session.activeSeq !== 8,
    },
    {
      key: 'stiffnessFraction',
      label: '角度反馈相对恢复刚度',
      values: [0, 0.2, 0.5],
      visible: step.finControl,
    },
    {
      key: 'lowPassCutoffHz',
      label: '量测低通截止 / Hz',
      values: [0.15, 0.3, 0.6],
      visible: session.activeSeq >= 14 && session.activeSeq <= 19,
    },
    {
      key: 'notchBandwidthHz',
      label: '陷波带宽 / Hz',
      values: [0.03, 0.06, 0.1],
      visible: session.activeSeq >= 15 && session.activeSeq <= 19,
    },
    {
      key: 'headingRampS',
      label: '转向斜坡 / s',
      values: session.activeSeq === 12 ? [40, 80] : [10, 40, 80],
      visible: [12, 16, 17, 18].includes(session.activeSeq),
    },
  ];
  return (
    <SimPanelStack>
      <SimRunControls
        running={course.running}
        primaryLabel={course.completed ? '已结束' : course.running ? '暂停' : '开始'}
        disabled={session.busy}
        primaryDisabled={!course.ready || course.completed || step.stepKind === 'analysis'}
        onPrimary={() => {
          void (course.running ? course.pause() : course.start());
        }}
        onReset={() => {
          void course.reset();
        }}
      />
      {step.finControl || session.activeSeq === 6 ? (
        <SimPanelSection title="本人横摇模型与鳍反馈" icon={SlidersHorizontal}>
          <div className="space-y-3">
            <SimField label="冻结的横摇模型">
              <select
                className="sim-hud-input"
                aria-label="控制所用横摇模型"
                disabled={locked}
                value={course.designModelId}
                onChange={(event) => {
                  const model = models.find((item) => item.id === event.target.value);
                  course.setDesignModelId(event.target.value);
                  if (model?.payload.structure.kind === 'roll_oscillator')
                    update({ identifiedPeriodS: (2 * Math.PI) / model.payload.structure.natural_freq_rad_s });
                }}
              >
                <option value="">选择本人模型</option>
                {models.map((model, index) => (
                  <option key={model.id} value={model.id}>
                    {model.label} · 版本{index + 1}
                  </option>
                ))}
              </select>
            </SimField>
            {session.activeSeq === 6 ? (
              <p className="text-xs text-platform-fg-secondary">
                本人固有周期{settings.identifiedPeriodS.toFixed(3)}s，规则波波高0.5m、周期
                {(settings.identifiedPeriodS * settings.resonanceRatio).toFixed(3)}s。
              </p>
            ) : null}
            {step.finControl ? (
              <SimToggleRow
                label="启用减摇鳍反馈"
                htmlFor="cruise-fins"
                control={
                  <SimSwitchInput
                    id="cruise-fins"
                    checked={settings.finsEnabled}
                    disabled={locked}
                    onChange={() => update({ finsEnabled: !settings.finsEnabled })}
                  />
                }
              />
            ) : null}
            {selects
              .filter((item) => item.visible)
              .map((item) => (
                <SimField key={item.key} label={item.label}>
                  <select
                    className="sim-hud-input"
                    aria-label={item.label}
                    disabled={locked}
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
              ))}
            {session.activeSeq >= 15 && session.activeSeq <= 19 ? (
              <>
                <SimToggleRow
                  label="启用所选陷波"
                  htmlFor="cruise-notch"
                  control={
                    <SimSwitchInput
                      id="cruise-notch"
                      checked={settings.notchEnabled}
                      disabled={locked}
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
                    disabled={locked}
                    value={settings.notchCenterHz}
                    onChange={(event) => update({ notchCenterHz: Number(event.target.value) })}
                  />
                </SimField>
              </>
            ) : null}
            {step.finControl ? (
              <CruiseRollDesign
                model={selected}
                settings={{
                  ...settings,
                  dampingRatio: session.activeSeq === 8 ? 0.5 : settings.dampingRatio,
                }}
              />
            ) : null}
          </div>
        </SimPanelSection>
      ) : (
        selects
          .filter((item) => item.visible)
          .map((item) => (
            <SimField key={item.key} label={item.label}>
              <select
                className="sim-hud-input"
                aria-label={item.label}
                disabled={locked}
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
          ))
      )}
      {[17, 18, 19].includes(session.activeSeq) ? (
        <SimPanelSection title="已冻结的联合方案" icon={Navigation}>
          <SimField label="引用本人联合方案">
            <select
              className="sim-hud-input"
              aria-label="引用邮轮联合方案"
              disabled={locked}
              value=""
              onChange={(event) => {
                const source = course.runs.find((run) => run.id === event.target.value);
                if (!source?.courseSettings) return;
                course.setSettings(source.courseSettings as unknown as CruiseCourseSettings);
                course.setDesignModelId(source.designStudentModelId ?? '');
              }}
            >
              <option value="">选择此前本人完整运行</option>
              {course.runs
                .filter(
                  (run) =>
                    [16, 17].includes(run.stepSequence) &&
                    run.stepSequence < session.activeSeq &&
                    run.stoppedAtMs !== null,
                )
                .map((run) => (
                  <option key={run.id} value={run.id}>
                    第{run.stepSequence}步 · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
                  </option>
                ))}
            </select>
          </SimField>
          {session.activeSeq === 19 ? (
            <SimField label="单鳍失效后的策略">
              <select
                className="sim-hud-input"
                aria-label="单鳍失效策略"
                disabled={locked}
                value={settings.faultStrategy}
                onChange={(event) =>
                  update({ faultStrategy: event.target.value as CruiseCourseSettings['faultStrategy'] })
                }
              >
                <option value="keep">保持原方案</option>
                <option value="slow">180s后降低轴速参考</option>
                <option value="long-turn">故障后转向延长为80s</option>
              </select>
            </SimField>
          ) : null}
        </SimPanelSection>
      ) : null}
      {session.activeSeq === 20 ? (
        <SimPanelSection title="报告引用的本人运行" icon={Gauge}>
          {course.runs
            .filter((run) => run.stoppedAtMs !== null)
            .map((run) => (
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
                第{run.stepSequence}步 · {run.lastTimeS.toFixed(1)}s ·{' '}
                {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
              </label>
            ))}
        </SimPanelSection>
      ) : null}
    </SimPanelStack>
  );
}
