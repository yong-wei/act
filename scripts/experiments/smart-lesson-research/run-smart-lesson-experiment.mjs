import path from 'node:path';

import {
  EXPERIMENT_ID,
  OUTPUT_DIR,
  SPECS,
  apiRequest,
  createTaskPayload,
  idempotencyKeyFor,
  loadDraftSnapshot,
  loadProgress,
  login,
  newPool,
  pollDraftUntilTerminal,
  queryRows,
  runKey,
  saveProgress,
  writeJsonFile,
} from './lib.mjs';

function option(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
}

function has(name, argv) {
  return argv.includes(name);
}

function smokeSpec() {
  return {
    condition: 'SMOKE',
    topic: '根轨迹基础概念',
    goalKey: 'GA1',
    durationMinutes: 60,
    repeats: 1,
    experiment: 'SMOKE',
  };
}

async function loadRunChain(pool, draftId) {
  const stages = await queryRows(
    pool,
    `select
      s.id as stage_id,
      s."jobId" as job_id,
      s.kind as stage_kind,
      s.state as stage_state,
      s."orderIndex" as order_index,
      s."outputHash" as output_hash,
      s."startedAt" as started_at,
      s."completedAt" as completed_at
    from "SmartLessonGenerationStage" s
    join "SmartLessonGenerationJob" j on j.id = s."jobId"
    where j."draftId" = $1
    order by s."orderIndex" asc`,
    [draftId],
  );
  const attempts = await queryRows(
    pool,
    `select
      a.id as attempt_id,
      a."stageId" as stage_id,
      s.kind as stage_kind,
      a."attemptNumber" as attempt_number,
      a.kind as attempt_kind,
      a.outcome as attempt_outcome,
      a."correctsAttemptId" as corrects_attempt_id,
      a."providerKind" as provider_kind,
      a.model,
      a."promptVersion" as prompt_version,
      a."schemaVersion" as schema_version,
      a."requestHash" as request_hash,
      a."inputTokens" as input_tokens,
      a."outputTokens" as output_tokens,
      a."startedAt" as started_at,
      a."finishedAt" as finished_at
    from "SmartLessonProviderAttempt" a
    join "SmartLessonGenerationStage" s on s.id = a."stageId"
    join "SmartLessonGenerationJob" j on j.id = s."jobId"
    where j."draftId" = $1
    order by a."startedAt" asc`,
    [draftId],
  );
  return { stages, attempts };
}

async function attachRunChain(pool, run) {
  if (!run?.draft_id) return;
  const chain = await loadRunChain(pool, run.draft_id);
  run.stages = chain.stages;
  run.attempts = chain.attempts;
}

function newRun(key, spec, repeatIndex) {
  const now = new Date().toISOString();
  return {
    experiment_id: EXPERIMENT_ID,
    condition: spec.condition,
    repeat_index: repeatIndex,
    task_id: null,
    draft_id: null,
    job_id: null,
    topic: spec.topic,
    goal: spec.goalKey,
    duration_minutes: spec.durationMinutes,
    create_status: null,
    create_error_code: null,
    start_status: null,
    start_job_state: null,
    start_error_code: null,
    started_at: null,
    completed_at: null,
    draft_state: null,
    job_state: null,
    failure_code: null,
    outcome: null,
    error_message: null,
    created_at: now,
  };
}

async function executeRun(pool, cookieHeader, key, spec, repeatIndex, pollTimeoutMs) {
  const run = newRun(key, spec, repeatIndex);
  try {
    const createResponse = await apiRequest('POST', '/api/teacher/smart-lesson-tasks', {
      cookie: cookieHeader,
      body: createTaskPayload(spec),
    });
    run.create_status = createResponse.status;
    run.create_error_code = createResponse.json?.error?.code ?? null;
    if (createResponse.status !== 201) {
      run.outcome = 'CREATE_FAILED';
      return run;
    }
    const task = createResponse.json.task;
    const draft = task?.drafts?.[0];
    if (!task?.id || !draft?.id) {
      run.create_error_code = 'task-or-draft-missing';
      run.outcome = 'CREATE_FAILED';
      return run;
    }
    run.task_id = task.id;
    run.draft_id = draft.id;

    const generationResponse = await apiRequest(
      'POST',
      `/api/teacher/smart-lesson-tasks/drafts/${encodeURIComponent(draft.id)}/generation`,
      {
        cookie: cookieHeader,
        body: { idempotencyKey: idempotencyKeyFor(spec.condition, repeatIndex) },
      },
    );
    run.start_status = generationResponse.status;
    run.start_job_state = generationResponse.json?.job?.state ?? null;
    run.start_error_code = generationResponse.json?.error?.code ?? null;

    if (generationResponse.status !== 202) {
      const snapshot = await loadDraftSnapshot(pool, draft.id);
      run.job_id = snapshot?.job_id ?? null;
      run.draft_state = snapshot?.draft_state ?? null;
      run.job_state = snapshot?.job_state ?? null;
      run.failure_code = snapshot?.failure_code ?? null;
      run.outcome = 'START_FAILED';
      return run;
    }

    const finalSnapshot = await pollDraftUntilTerminal(pool, draft.id, pollTimeoutMs);
    run.job_id = finalSnapshot.job_id ?? null;
    run.draft_state = finalSnapshot.draft_state ?? null;
    run.job_state = finalSnapshot.job_state ?? null;
    run.failure_code = finalSnapshot.failure_code ?? null;
    run.started_at = finalSnapshot.job_started_at ? new Date(finalSnapshot.job_started_at).toISOString() : null;
    run.completed_at = finalSnapshot.job_completed_at ? new Date(finalSnapshot.job_completed_at).toISOString() : null;
    run.outcome = finalSnapshot.outcome ?? 'UNKNOWN';
    return run;
  } catch (error) {
    run.outcome = 'SCRIPT_ERROR';
    run.error_message = error instanceof Error ? error.message : String(error);
    return run;
  }
}

function assertRunNotInFlight(run, key) {
  if (run && run.outcome === null && run.started_at !== null) {
    throw new Error(`运行 ${key} 已启动但未记录结果，禁止自动重试或恢复，请人工检查后决定`);
  }
}

async function runSmokeAndMaybeFormal(pool, cookieHeader, argv) {
  const mode = option(argv, '--mode', 'all');
  const pollTimeoutMinutes = Number(option(argv, '--poll-timeout-minutes', '30'));
  if (!Number.isFinite(pollTimeoutMinutes) || pollTimeoutMinutes <= 0) {
    throw new Error('--poll-timeout-minutes 必须是正数');
  }
  const pollTimeoutMs = pollTimeoutMinutes * 60 * 1000;
  const progress = loadProgress();
  const smokeIndex = Number(option(argv, '--smoke-index', '1')) || 1;
  const smokeKey = `SMOKE-r${smokeIndex}`;
  progress.smokeHistory = progress.smokeHistory ?? {};
  if (progress.smoke && !progress.smokeHistory['SMOKE-r1']) {
    progress.smokeHistory['SMOKE-r1'] = progress.smoke;
    progress.smoke = null;
  }

  if (mode === 'all' || mode === 'smoke-only') {
    assertRunNotInFlight(progress.smokeHistory[smokeKey], smokeKey);
    if (!progress.smokeHistory[smokeKey]) {
      process.stdout.write(`[smoke] 开始 ${smokeKey}\n`);
      progress.smokeHistory[smokeKey] = await executeRun(
        pool,
        cookieHeader,
        smokeKey,
        smokeSpec(),
        smokeIndex,
        pollTimeoutMs,
      );
      await attachRunChain(pool, progress.smokeHistory[smokeKey]);
      saveProgress(progress);
      writeJsonFile(path.join(OUTPUT_DIR, 'smoke_raw.json'), {
        experiment_id: EXPERIMENT_ID,
        smokeHistory: progress.smokeHistory,
        generatedAt: new Date().toISOString(),
      });
    }
    const smokeRun = progress.smokeHistory[smokeKey];
    process.stdout.write(
      `[smoke] ${smokeRun.outcome} task=${smokeRun.task_id ?? ''} draft=${smokeRun.draft_id ?? ''} draft_state=${smokeRun.draft_state ?? ''} job_state=${smokeRun.job_state ?? ''}\n`,
    );
  }

  const smokeReady = Object.values(progress.smokeHistory).some((run) => run?.outcome === 'SUCCESS');
  if (!smokeReady && (mode === 'all' || mode === 'smoke-only')) {
    throw new Error(`smoke 未成功（${Object.values(progress.smokeHistory).map((run) => run?.outcome ?? 'missing').join(',')}），不启动正式实验`);
  }
  if (mode === 'smoke-only') return progress;

  for (const spec of SPECS) {
    for (let repeatIndex = 1; repeatIndex <= spec.repeats; repeatIndex += 1) {
      const key = runKey(spec.condition, repeatIndex);
      const existing = progress.runs[key];
      assertRunNotInFlight(existing, key);
      if (existing?.outcome) {
        process.stdout.write(`[skip] ${key} 已有结果 ${existing.outcome}\n`);
        continue;
      }
      process.stdout.write(`[run] ${key} 开始 topic=${spec.topic} duration=${spec.durationMinutes}\n`);
      progress.runs[key] = await executeRun(pool, cookieHeader, key, spec, repeatIndex, pollTimeoutMs);
      saveProgress(progress);
      const run = progress.runs[key];
      process.stdout.write(
        `[run] ${key} ${run.outcome} task=${run.task_id ?? ''} draft=${run.draft_id ?? ''} draft_state=${run.draft_state ?? ''} job_state=${run.job_state ?? ''} failure=${run.failure_code ?? ''}\n`,
      );
    }
  }

  const summary = SPECS.map((spec) => {
    const runs = Array.from({ length: spec.repeats }, (_, index) => progress.runs[runKey(spec.condition, index + 1)]);
    return {
      condition: spec.condition,
      repeats: spec.repeats,
      success: runs.filter((run) => run?.outcome === 'SUCCESS').length,
      failure: runs.filter((run) => run?.outcome && run.outcome !== 'SUCCESS').length,
    };
  });
  writeJsonFile(`${OUTPUT_DIR}/run-summary.json`, {
    experiment_id: EXPERIMENT_ID,
    smoke: progress.smoke,
    summary,
    generatedAt: new Date().toISOString(),
  });
  return progress;
}

async function main() {
  const argv = process.argv.slice(2);
  if (has('--help', argv) || has('-h', argv)) {
    process.stdout.write(
      [
        '用法: node run-smart-lesson-experiment.mjs [--mode all|smoke-only|formal-only] [--poll-timeout-minutes 30]',
        '      [--smoke-index 1|2] 指定本次要执行的 smoke 轮次，默认 1',
        '',
        '--mode=all 先执行 1 次 smoke，成功后执行 13 次正式实验',
        '--mode=smoke-only 只执行 smoke',
        '--mode=formal-only 跳过 smoke 直接执行正式实验（仅用于 smoke 已通过后的续跑）',
      ].join('\n') + '\n',
    );
    return;
  }
  const pool = newPool();
  try {
    const auth = await login();
    process.stdout.write(`[auth] 教师账号登录成功 userId=${auth.userId}\n`);
    const progress = await runSmokeAndMaybeFormal(pool, auth.cookieHeader, argv);
    process.stdout.write('[done] 实验执行完成，最终状态保存在 progress.json\n');
    process.stdout.write(`[done] 正式运行记录数: ${Object.keys(progress.runs).length}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
