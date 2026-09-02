import {
  prepareKonlingBlindAuditRun,
  listKonlingBlindAuditFailureKeys,
  listKonlingBlindAuditRecordKeys,
  readKonlingBlindAuditFailure,
  releaseKonlingBlindAuditRun,
  writeKonlingBlindAuditFailure,
  writeKonlingBlindAuditRecord,
} from './store';
import {
  buildKonlingBlindAuditTaskKey,
  type KonlingBlindAuditManifest,
  type KonlingBlindAuditMode,
  type KonlingBlindAuditProvider,
  type KonlingBlindAuditRunConfig,
  type KonlingBlindAuditRunSummary,
} from './types';

/**
 * 断点续跑运行器：任务键已存在即跳过（不重复计费），失败项每次运行
 * 至多重试一轮，attempt 历史保留在 failure 记录中（#1820）。
 */
export async function runKonlingBlindAudit(input: {
  root: string;
  runId: string;
  manifest: KonlingBlindAuditManifest;
  manifestPayload: unknown;
  manifestHash: string;
  mode: KonlingBlindAuditMode;
  config: KonlingBlindAuditRunConfig;
  provider: KonlingBlindAuditProvider;
}): Promise<KonlingBlindAuditRunSummary> {
  const runDir = prepareKonlingBlindAuditRun({
    root: input.root,
    runId: input.runId,
    manifestHash: input.manifestHash,
    manifestPayload: input.manifestPayload,
  });
  try {
    const completedBefore = new Set(listKonlingBlindAuditRecordKeys(runDir, input.mode));
    const failedBefore = new Map<string, number>();
    for (const failureKey of listKonlingBlindAuditFailureKeys(runDir, input.mode)) {
      const failure = readKonlingBlindAuditFailure(runDir, input.mode, failureKey);
      failedBefore.set(failureKey, failure?.attempts.length ?? 0);
    }

    const expected = input.manifest.items.length * input.manifest.replicates;
    let completedThisRun = 0;
    let retried = 0;
    let failed = 0;

    for (let replicate = 1; replicate <= input.manifest.replicates; replicate += 1) {
      for (const item of input.manifest.items) {
        const taskKey = buildKonlingBlindAuditTaskKey({
          benchmarkVersion: input.manifest.benchmarkVersion,
          mode: input.mode,
          itemId: item.itemId,
          replicate,
        });
        if (completedBefore.has(taskKey)) continue;
        const priorAttempts = failedBefore.get(taskKey);
        const isRetry = priorAttempts !== undefined;
        // 累计 attempt 超过一次的失败项不再自动重试，累计错误留待人工
        // 裁决（#1820）。
        if (isRetry && (priorAttempts ?? 0) > 1) continue;

        const startedAt = new Date().toISOString();
        const response = await input.provider(item, replicate, input.config);
        const finishedAt = new Date().toISOString();
        if (response.ok) {
          if (isRetry) retried += 1;
          writeKonlingBlindAuditRecord(runDir, input.mode, {
            taskKey,
            mode: input.mode,
            benchmarkVersion: input.manifest.benchmarkVersion,
            itemId: item.itemId,
            replicate,
            model: input.config.model,
            provider: input.config.provider,
            promptVersion: input.config.promptVersion,
            scoreVersion: input.config.scoreVersion,
            gitRevision: input.config.gitRevision,
            status: 'completed',
            startedAt,
            finishedAt,
            result: response.result,
          });
          completedThisRun += 1;
        } else {
          if (isRetry) retried += 1;
          const previousFailure = readKonlingBlindAuditFailure(runDir, input.mode, taskKey);
          const attempt = {
            startedAt,
            finishedAt,
            error: response.error,
          };
          writeKonlingBlindAuditFailure(runDir, input.mode, {
            taskKey,
            mode: input.mode,
            benchmarkVersion: input.manifest.benchmarkVersion,
            itemId: item.itemId,
            replicate,
            model: input.config.model,
            provider: input.config.provider,
            promptVersion: input.config.promptVersion,
            scoreVersion: input.config.scoreVersion,
            gitRevision: input.config.gitRevision,
            status: 'failed',
            attempts: [...(previousFailure?.attempts ?? []), attempt],
          });
          failed += 1;
        }
      }
    }

    const totalCompleted = listKonlingBlindAuditRecordKeys(runDir, input.mode).length;
    return {
      runId: input.runId,
      mode: input.mode,
      expected,
      completedBeforeRun: completedBefore.size,
      completedThisRun,
      retried,
      failed,
      totalCompleted,
      complete: totalCompleted >= expected,
    };
  } finally {
    releaseKonlingBlindAuditRun(runDir);
  }
}
