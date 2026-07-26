/**
 * v2 校准场景：240 秒，60-150 秒线性渐变过渡。
 * 推荐 API 和四参数优化器默认使用此场景。
 */
function getScenarioLogic(_scenario: 'turn90', targetHeading: number = 90): ScenarioLogic {
  const transitionStart = 60;
  const transitionEnd = 150;
  return {
    scenarioId: 'turn90-calibrated-v1',
    runtimeVersion: 'simulation-optimizer-runtime-v2',
    duration: 240,
    referenceCompletedAt: 150,
    headingSchedule: [
      { time: 0, heading: 0 },
      { time: transitionStart, heading: 0 },
      { time: transitionEnd, heading: targetHeading },
      { time: 240, heading: targetHeading },
    ],
    startPos: { x: 0, z: 0, headingDeg: 0 },
    getDesiredHeading: (time: number) => {
      if (time < transitionStart) return 0;
      if (time >= transitionEnd) return targetHeading;
      const progress = (time - transitionStart) / (transitionEnd - transitionStart);
      return progress * targetHeading;
    },
  };
}