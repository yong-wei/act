'use client';

import React, { useMemo, useState } from 'react';
import { ShipAvatar } from '@/resources/interactive-learning/control-odyssey/components/ShipAvatar';
import type { BaseControllerId, ControllerId } from '@/resources/interactive-learning/control-odyssey/level-data';
import styles from './ShipSandbox.module.css';

const controllerOptions: BaseControllerId[] = ['P', 'PI', 'PD', 'PID'];
const controllerLevelIds: ControllerId[] = ['P', 'PI', 'PD', 'VFB', 'FF', 'SMITH'];
const levelOptions = Array.from({ length: 11 }, (_, index) => index);

export default function ControlOdysseyShipSandboxPage() {
  const [controlMode, setControlMode] = useState<'MANUAL' | 'AUTO'>('AUTO');
  const [controllerId, setControllerId] = useState<BaseControllerId>('PID');
  const [enableFeedforward, setEnableFeedforward] = useState(true);
  const [enableSpeedFeedback, setEnableSpeedFeedback] = useState(true);
  const [showHull, setShowHull] = useState(true);
  const [showWings, setShowWings] = useState(true);
  const [showPanels, setShowPanels] = useState(true);
  const [showEngines, setShowEngines] = useState(true);
  const [showThrusters, setShowThrusters] = useState(true);
  const [controllerLevels, setControllerLevels] = useState<Record<ControllerId, number>>({
    P: 1,
    PI: 1,
    PD: 1,
    PID: 1,
    VFB: 1,
    FF: 1,
    SMITH: 1
  });

  const statusText = useMemo(() => {
    const modeLabel = controlMode === 'AUTO' ? '自动' : '手动';
    const ffLabel = enableFeedforward ? '前馈开' : '前馈关';
    const vfLabel = enableSpeedFeedback ? '测速反馈开' : '测速反馈关';
    return `${modeLabel} · ${controllerId} · ${ffLabel} · ${vfLabel}`;
  }, [controlMode, controllerId, enableFeedforward, enableSpeedFeedback]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>控制奥德赛 · 飞船外形调试</h1>
        <p className={styles.status}>{statusText}</p>
      </header>

      <section className={styles.preview}>
        <ShipAvatar
          controlMode={controlMode}
          controllerId={controllerId}
          enableFeedforward={enableFeedforward}
          enableSpeedFeedback={enableSpeedFeedback}
          controllerLevels={controllerLevels}
          showHull={showHull}
          showWings={showWings}
          showPanels={showPanels}
          showEngines={showEngines}
          showThrusters={showThrusters}
          className={styles.shipPreview}
        />
      </section>

      <section className={styles.controls}>
        <div className={styles.controlGrid}>
          <div className={styles.controlLeft}>
            <div className={styles.group}>
              <span className={styles.groupLabel}>控制模式</span>
              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={controlMode === 'AUTO' ? styles.buttonActive : styles.button}
                  onClick={() => setControlMode('AUTO')}
                >
                  自动
                </button>
                <button
                  type="button"
                  className={controlMode === 'MANUAL' ? styles.buttonActive : styles.button}
                  onClick={() => setControlMode('MANUAL')}
                >
                  手动
                </button>
              </div>
            </div>

            <div className={styles.inlineGroups}>
              <div className={styles.group}>
                <span className={styles.groupLabel}>控制器组合</span>
                <div className={styles.buttonRow}>
                  {controllerOptions.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={controllerId === id ? styles.buttonActive : styles.button}
                      onClick={() => setControllerId(id)}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.group}>
                <span className={styles.groupLabel}>附加模块</span>
                <div className={styles.buttonRow}>
                  <button
                    type="button"
                    className={enableFeedforward ? styles.buttonActive : styles.button}
                    onClick={() => setEnableFeedforward((prev) => !prev)}
                  >
                    前馈
                  </button>
                  <button
                    type="button"
                    className={enableSpeedFeedback ? styles.buttonActive : styles.button}
                    onClick={() => setEnableSpeedFeedback((prev) => !prev)}
                  >
                    测速反馈
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.group}>
              <span className={styles.groupLabel}>机身部件</span>
              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={showHull ? styles.buttonActive : styles.button}
                  onClick={() => setShowHull((prev) => !prev)}
                >
                  机身
                </button>
                <button
                  type="button"
                  className={showWings ? styles.buttonActive : styles.button}
                  onClick={() => setShowWings((prev) => !prev)}
                >
                  机翼
                </button>
                <button
                  type="button"
                  className={showEngines ? styles.buttonActive : styles.button}
                  onClick={() => setShowEngines((prev) => !prev)}
                >
                  引擎
                </button>
                <button
                  type="button"
                  className={showPanels ? styles.buttonActive : styles.button}
                  onClick={() => setShowPanels((prev) => !prev)}
                >
                  面板/座舱
                </button>
                <button
                  type="button"
                  className={showThrusters ? styles.buttonActive : styles.button}
                  onClick={() => setShowThrusters((prev) => !prev)}
                >
                  尾焰
                </button>
              </div>
            </div>
          </div>

          <div className={styles.controlRight}>
          <div className={styles.group}>
            <span className={styles.groupLabel}>控制器等级</span>
            <p className={styles.levelHint}>PID 仅作为开关，等级读取 P / PI / PD。</p>
            <div className={styles.levelGrid}>
                {controllerLevelIds.map((id) => (
                  <div key={id} className={styles.levelRow}>
                    <span className={styles.levelLabel}>{id}</span>
                    <div className={styles.levelButtons}>
                      {levelOptions.map((level) => (
                        <button
                          key={`${id}-${level}`}
                          type="button"
                          className={controllerLevels[id] === level ? styles.buttonActive : styles.button}
                          onClick={() =>
                            setControllerLevels((prev) => ({
                              ...prev,
                              [id]: level
                            }))
                          }
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
