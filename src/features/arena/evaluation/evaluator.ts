import { getArenaChallengeObject, getArenaChallengeTask } from '../data/seed-challenges';
import type { ControllerArtifact } from '../types';
import type { ArenaEvaluationResult } from './types';
import { evaluateBlackBoxSubmission } from './blackbox-evaluator';
import { evaluateWhiteBoxSubmission } from './whitebox-evaluator';
import { defaultControlAnalysisService } from './control-analysis-service';
import { evaluateOdysseySubmission } from '../odyssey/evaluator';

export {
  getArenaEvaluationProtocolVersion,
  ANALYSIS_WHITEBOX_PROTOCOL_VERSION,
  TEMPLATE_WHITEBOX_PROTOCOL_VERSION,
  BLACKBOX_PROTOCOL_VERSION,
  BLACKBOX_OFFICIAL_PROTOCOL_VERSION,
  CODE_SANDBOX_DISABLED_PROTOCOL_VERSION,
} from './protocol';

function rejectCodeControllerWithoutSandbox(taskId: string, artifact: ControllerArtifact): ArenaEvaluationResult {
  return {
    taskId,
    artifact,
    valid: false,
    score: 0,
    metrics: {},
    satisfaction: {},
    hardConstraintResults: [
      {
        id: 'external_sandbox_verified',
        label: '外部沙箱验证',
        passed: false,
        reason: '代码型控制器需要外部沙箱验证后才能进入官方评测。',
      },
    ],
    penalties: [],
    explanation: [
      '代码型控制器需要外部沙箱验证，当前官方评测默认失败关闭。',
      '沙箱必须验证禁止网络访问、运行时间限制、内存限制、固定随机种子、依赖锁，以及禁止访问真实模型内部参数。',
    ],
  };
}

export function evaluateArenaSubmission({
  taskId,
  artifact,
}: {
  taskId: string;
  artifact: ControllerArtifact;
}): Promise<ArenaEvaluationResult> {
  if (artifact.method === 'code-controller') {
    return Promise.resolve(rejectCodeControllerWithoutSandbox(taskId, artifact));
  }
  const task = getArenaChallengeTask(taskId);
  const object = task ? getArenaChallengeObject(task.objectId) : undefined;
  if (object?.source === 'control-odyssey') {
    return Promise.resolve(evaluateOdysseySubmission({ taskId, artifact }));
  }
  if (object?.visibility === 'black-box') {
    return Promise.resolve(evaluateBlackBoxSubmission({ taskId, artifact }));
  }
  return evaluateWhiteBoxSubmission({
    taskId,
    artifact,
    controlAnalysisService: defaultControlAnalysisService,
  });
}
