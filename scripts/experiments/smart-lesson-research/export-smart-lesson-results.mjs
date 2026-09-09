import path from 'node:path';

import {
  BOPPPS_STAGE_KEYS,
  EXPERIMENT_ID,
  GOALS,
  OUTPUT_DIR,
  SPECS,
  checkBopppsStructure,
  formatDate,
  jaccardDistance,
  loadProgress,
  newPool,
  planComparisonText,
  queryRows,
  renderPlanMarkdown,
  runKey,
  TEACHER_LOGIN_ID,
  toCsv,
  writeFile,
  writeJsonFile,
} from './lib.mjs';

function average(values) {
  if (values.length === 0) return Number.NaN;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function pairIndices(count) {
  const pairs = [];
  for (let i = 0; i < count; i += 1) {
    for (let j = i + 1; j < count; j += 1) pairs.push([i, j]);
  }
  return pairs;
}

function seededShuffle(items, seed) {
  const copy = [...items];
  let state = seed >>> 0;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function numeric(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'NA';
  return Number(value.toFixed(6)).toString();
}

function ratingCsvRows(candidates, mapping) {
  return candidates.map((candidate) => ({
    anonymous_plan_id: candidate.anonymousPlanId,
    topic: candidate.topic,
    goal: candidate.goals.join('；'),
    duration_minutes: candidate.durationMinutes,
    class_context: '无班级学情条件',
    plan_file: candidate.planFile,
    teacher_code: '',
    goal_consistency_1_5: '',
    requirement_adaptation_1_5: '',
    activity_reasonableness_1_5: '',
    implementability_1_5: '',
    comment: '',
  }));
}

async function loadData(pool, draftIds) {
  const draftRows = await queryRows(
    pool,
    `select
      d.id as draft_id,
      d.state as draft_state,
      d."contentHash" as content_hash,
      d.content as draft_content,
      d."createdAt" as draft_created_at,
      d."updatedAt" as draft_updated_at,
      t.id as task_id,
      t.topic,
      t."durationMinutes" as duration_minutes,
      t."selectedClassId" as selected_class_id,
      t."createdAt" as task_created_at,
      j.id as job_id,
      j.state as job_state,
      j."failureCode" as failure_code,
      j."inputHash" as input_hash,
      j."startedAt" as job_started_at,
      j."completedAt" as job_completed_at
    from "SmartLessonDraft" d
    join "SmartLessonTask" t on t.id = d."taskId"
    left join lateral (
      select j2.*
      from "SmartLessonGenerationJob" j2
      where j2."draftId" = d.id
      order by j2."createdAt" desc
      limit 1
    ) j on true
    where d.id = any($1::text[])
    order by t."createdAt" asc`,
    [draftIds],
  );
  const stageRows = await queryRows(
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
    where j."draftId" = any($1::text[])
    order by j."createdAt" asc, s."orderIndex" asc`,
    [draftIds],
  );
  const attemptRows = await queryRows(
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
    where j."draftId" = any($1::text[])
    order by a."startedAt" asc`,
    [draftIds],
  );
  return { draftRows, stageRows, attemptRows };
}

function buildRawRows(runs, draftRows, stageRows, attemptRows) {
  const draftsByTask = new Map(draftRows.map((draft) => [draft.task_id, draft]));
  const stagesByDraft = new Map();
  const attemptsByDraft = new Map();
  const stagesByJob = new Map();
  for (const stage of stageRows) {
    stagesByJob.set(stage.job_id, [...(stagesByJob.get(stage.job_id) ?? []), stage]);
  }
  for (const attempt of attemptRows) {
    const draftId = stageRows.find((stage) => stage.stage_id === attempt.stage_id)
      ? null
      : null;
    if (draftId) attemptsByDraft.set(draftId, [...(attemptsByDraft.get(draftId) ?? []), attempt]);
  }
  for (const stage of stageRows) {
    attemptsByDraft.set(`${stage.job_id}:${stage.stage_id}`, [...(attemptsByDraft.get(`${stage.job_id}:${stage.stage_id}`) ?? []), attemptRows.filter((attempt) => attempt.stage_id === stage.stage_id)]);
  }

  const rawTasks = runs.map((run) => {
    const draft = draftsByTask.get(run.task_id);
    return {
      experiment_id: EXPERIMENT_ID,
      condition: run.condition,
      repeat_index: run.repeat_index,
      task_id: run.task_id ?? '',
      draft_id: run.draft_id ?? '',
      job_id: run.job_id ?? draft?.job_id ?? '',
      topic: run.topic ?? '',
      goals: GOALS[run.goal] ?? run.goal ?? '',
      duration_minutes: run.duration_minutes ?? draft?.duration_minutes ?? '',
      selected_class_id: draft?.selected_class_id ?? '',
      input_hash: draft?.input_hash ?? '',
      draft_state: draft?.draft_state ?? '',
      job_state: draft?.job_state ?? '',
      failure_code: draft?.failure_code ?? '',
      started_at: formatDate(draft?.job_started_at),
      completed_at: formatDate(draft?.job_completed_at),
    };
  });

  const stagesWithTask = [];
  for (const run of runs) {
    const draft = draftsByTask.get(run.task_id);
    for (const stage of stagesByJob.get(draft?.job_id) ?? []) {
      stagesWithTask.push({
        experiment_id: EXPERIMENT_ID,
        condition: run.condition,
        repeat_index: run.repeat_index,
        task_id: run.task_id ?? '',
        draft_id: run.draft_id ?? '',
        job_id: stage.job_id,
        stage_id: stage.stage_id,
        stage_kind: stage.stage_kind,
        stage_state: stage.stage_state,
        order_index: stage.order_index,
        output_hash: stage.output_hash ?? '',
        started_at: formatDate(stage.started_at),
        completed_at: formatDate(stage.completed_at),
      });
    }
  }

  const attemptsWithTask = [];
  for (const run of runs) {
    const draft = draftsByTask.get(run.task_id);
    const stages = stagesByJob.get(draft?.job_id) ?? [];
    for (const stage of stages) {
      for (const attempt of attemptRows.filter((row) => row.stage_id === stage.stage_id)) {
        attemptsWithTask.push({
          experiment_id: EXPERIMENT_ID,
          condition: run.condition,
          repeat_index: run.repeat_index,
          task_id: run.task_id ?? '',
          draft_id: run.draft_id ?? '',
          job_id: draft?.job_id ?? '',
          stage_id: stage.stage_id,
          stage_kind: stage.stage_kind,
          attempt_id: attempt.attempt_id,
          attempt_kind: attempt.attempt_kind,
          attempt_number: attempt.attempt_number,
          attempt_outcome: attempt.attempt_outcome,
          corrects_attempt_id: attempt.corrects_attempt_id ?? '',
          provider_kind: attempt.provider_kind,
          model: attempt.model,
          prompt_version: attempt.prompt_version,
          schema_version: attempt.schema_version,
          request_hash: attempt.request_hash,
          content_hash: stage.output_hash ?? '',
          input_tokens: attempt.input_tokens ?? '',
          output_tokens: attempt.output_tokens ?? '',
          started_at: formatDate(attempt.started_at),
          finished_at: formatDate(attempt.finished_at),
        });
      }
    }
  }
  return { rawTasks, stagesWithTask, attemptsWithTask };
}

function computeProviderSummary(attemptRows) {
  const byKey = new Map();
  for (const attempt of attemptRows) {
    const key = `${attempt.model}|${attempt.prompt_version}|${attempt.schema_version}`;
    const entry = byKey.get(key) ?? { model: attempt.model, promptVersion: attempt.prompt_version, schemaVersion: attempt.schema_version, total: 0, succeeded: 0, retryableFailure: 0, other: 0 };
    entry.total += 1;
    if (attempt.attempt_outcome === 'SUCCEEDED') entry.succeeded += 1;
    else if (attempt.attempt_outcome === 'RETRYABLE_FAILURE') entry.retryableFailure += 1;
    else entry.other += 1;
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((left, right) => left.model.localeCompare(right.model) || left.schemaVersion.localeCompare(right.schemaVersion));
}

function computeMetrics(runs, draftRows, stageRows, attemptRows) {
  const launched = runs.filter((run) => run.start_status !== null);
  const ready = draftRows.filter((row) => row.draft_state === 'READY');
  const taskSuccessRate = launched.length === 0 ? Number.NaN : ready.length / launched.length;

  const originalByStage = new Map();
  for (const attempt of attemptRows) {
    if (attempt.attempt_kind !== 'ORIGINAL') continue;
    if (!originalByStage.has(attempt.stage_id)) originalByStage.set(attempt.stage_id, attempt);
  }
  let firstPassNumerator = 0;
  let firstPassDenominator = 0;
  for (const attempt of originalByStage.values()) {
    if (['SUCCEEDED', 'RETRYABLE_FAILURE', 'PERMANENT_FAILURE', 'CANCELLED'].includes(attempt.attempt_outcome)) {
      firstPassDenominator += 1;
      if (attempt.attempt_outcome === 'SUCCEEDED') firstPassNumerator += 1;
    }
  }
  const firstPassRate = firstPassDenominator === 0 ? Number.NaN : firstPassNumerator / firstPassDenominator;

  let bopppsNumerator = 0;
  for (const draft of ready) {
    const result = checkBopppsStructure(draft.draft_content, draft.duration_minutes);
    if (result.pass) bopppsNumerator += 1;
  }
  const bopppsRate = ready.length === 0 ? Number.NaN : bopppsNumerator / ready.length;

  const readyByCondition = new Map();
  for (const draft of ready) {
    const run = runs.find((candidate) => candidate.task_id === draft.task_id);
    if (!run) continue;
    const list = readyByCondition.get(run.condition) ?? [];
    list.push({ ...draft, run });
    readyByCondition.set(run.condition, list);
  }
  const readyA = (readyByCondition.get('A') ?? []).sort((left, right) => {
    const leftDate = new Date(left.task_created_at ?? left.draft_created_at).getTime();
    const rightDate = new Date(right.task_created_at ?? right.draft_created_at).getTime();
    return leftDate - rightDate;
  });
  const baseline = readyA[0] ?? null;

  const repeatPairs = pairIndices(readyA.length).map(([leftIndex, rightIndex]) => ({
    left_draft_id: readyA[leftIndex].draft_id,
    right_draft_id: readyA[rightIndex].draft_id,
    distance: jaccardDistance(planComparisonText(readyA[leftIndex].draft_content), planComparisonText(readyA[rightIndex].draft_content)),
  }));
  const dRepeat = repeatPairs.length === 0 ? Number.NaN : average(repeatPairs.map((pair) => pair.distance));

  const distanceFor = (condition) => {
    const drafts = (readyByCondition.get(condition) ?? [])
      .filter((draft) => baseline && draft.draft_id !== baseline.draft_id);
    const values = drafts.map((draft) => jaccardDistance(
      planComparisonText(baseline.draft_content),
      planComparisonText(draft.draft_content),
    ));
    return { values, mean: values.length === 0 ? Number.NaN : average(values), drafts };
  };
  const goalDistance = distanceFor('V_G');
  const durationDistance = distanceFor('V_D');

  return {
    launched,
    ready,
    taskSuccessRate,
    firstPassNumerator,
    firstPassDenominator,
    firstPassRate,
    bopppsNumerator,
    bopppsRate,
    readyA,
    baseline,
    repeatPairs,
    dRepeat,
    goalDistance,
    durationDistance,
  };
}

function writeRatingPack(metrics) {
  const candidates = [];
  if (metrics.baseline) {
    candidates.push({ kind: 'baseline', draft: metrics.baseline });
  }
  for (const kind of ['V_G', 'V_D']) {
    const drafts = metrics[`${kind.toLowerCase()}Distance`]?.drafts ?? [];
    if (drafts[0]) candidates.push({ kind, draft: drafts[0] });
  }
  const shuffled = seededShuffle(candidates, 20260908)
    .map((candidate, index) => ({
      anonymousPlanId: `P0${index + 1}`,
      kind: candidate.kind,
      draft: candidate.draft,
    }));
  const mapping = new Map(shuffled.map((candidate) => [candidate.kind, candidate]));

  const rows = [];
  for (const candidate of shuffled) {
    const plan = candidate.draft.draft_content;
    const planFile = `ratings/plan_${candidate.anonymousPlanId.toLowerCase()}.md`;
    writeFile(path.join(OUTPUT_DIR, planFile), renderPlanMarkdown(plan, {
      anonymousPlanId: candidate.anonymousPlanId,
      topic: candidate.draft.topic,
      goals: (plan?.goals ?? []).map((goal) => goal.content),
      durationMinutes: candidate.draft.duration_minutes,
      classContext: '无（未指定班级）',
    }));
    rows.push({
      anonymousPlanId: candidate.anonymousPlanId,
      topic: candidate.draft.topic,
      goals: (plan?.goals ?? []).map((goal) => goal.content),
      durationMinutes: candidate.draft.duration_minutes,
      planFile,
    });
  }
  writeFile(path.join(OUTPUT_DIR, 'teacher_ratings_template.csv'), toCsv(ratingCsvRows(rows, mapping)));
  return { shuffled, mapping, rows };
}

function writeSummary(metrics, runs, draftRows, stageRows, attemptRows, ratingPack) {
  const launchedCount = metrics.launched.length;
  const readyCount = metrics.ready.length;
  const failedCount = launchedCount - readyCount;
  const createdFailedCount = runs.filter((run) => run.outcome === 'CREATE_FAILED').length;
  const startedFailedCount = runs.filter((run) => run.outcome === 'START_FAILED').length;
  const timeoutCount = runs.filter((run) => run.outcome === 'POLL_TIMEOUT').length;
  const scriptErrorCount = runs.filter((run) => run.outcome === 'SCRIPT_ERROR').length;
  const providerSummary = computeProviderSummary(attemptRows);

  const providerLines = providerSummary.length
    ? providerSummary.map((entry) => `| ${entry.model} | ${entry.promptVersion} | ${entry.schemaVersion} | ${entry.total} | ${entry.succeeded} | ${entry.retryableFailure} | ${entry.other} |`).join('\n')
    : '| 无实际 attempt 记录 | - | - | 0 | 0 | 0 | 0 |';

  const conditionLines = SPECS.map((spec) => {
    const runList = Array.from({ length: spec.repeats }, (_, index) => runs.find((run) => run.condition === spec.condition && run.repeat_index === index + 1));
    return `| ${spec.condition} | ${spec.topic} | ${GOALS[spec.goalKey]} | ${spec.durationMinutes} | ${spec.repeats} | ${runList.filter((run) => run?.outcome === 'SUCCESS').length} |`;
  }).join('\n');

  const summary = [
    '# 智能备课仿真实验执行摘要',
    '',
    '## 一、实验环境',
    '',
    `- 日期：2026-09-08`,
    `- 本地地址：http://127.0.0.1:3001`,
    `- 数据库：act_obe（本地 PostgreSQL）`,
    `- 课程依据：AUTO-CONTROL-ROOT-LOCUS / 根轨迹法课程依据`,
    `- 文档版本：cmt04ks1z0002h4vg7ae7qq4e（CONFIRMED / EXTRACTED）`,
    `- 实验账号：${TEACHER_LOGIN_ID}（TEACHER）`,
    `- 实验 ID：${EXPERIMENT_ID}`,
    `- 是否使用 fixture：否（SMART_LESSON_E2E_FIXTURE_TOKEN 未设置）`,
    '',
    '## 二、实验条件与样本',
    '',
    '正式实验共设计 13 次生成（实验一 9 次 + 实验二新增 4 次），另有 1 次 smoke 不计入统计。',
    '',
    '| 条件 | 主题 | 目标 | 分钟 | 重复次数 | 实际成功 |',
    '| --- | --- | --- | --- | --- | --- |',
    conditionLines,
    '',
    '## 三、执行结果',
    '',
    `- 已启动 generation 的正式任务数：${launchedCount}`,
    `- READY 草案数：${readyCount}`,
    `- 未进入 READY：${failedCount}`,
    `- 创建失败：${createdFailedCount}；启动失败：${startedFailedCount}；轮询超时：${timeoutCount}；脚本异常：${scriptErrorCount}`,
    '',
    '## 四、正式指标',
    '',
    '| 指标 | 值 | 分子 | 分母 |',
    '| --- | --- | --- | --- |',
    `| 任务生成成功率 | ${numeric(metrics.taskSuccessRate)} | ${readyCount} | ${launchedCount} |`,
    `| 首次生成通过率 | ${numeric(metrics.firstPassRate)} | ${metrics.firstPassNumerator} | ${metrics.firstPassDenominator} |`,
    `| BOPPPS 六阶段结构完整率 | ${numeric(metrics.bopppsRate)} | ${metrics.bopppsNumerator} | ${readyCount} |`,
    `| D_repeat | ${numeric(metrics.dRepeat)} | ${metrics.repeatPairs.length} 对两两距离之和 | ${metrics.repeatPairs.length} |`,
    `| D_goals | ${numeric(metrics.goalDistance.mean)} | ${metrics.goalDistance.values.length} 个 V_G 距离之和 | ${metrics.goalDistance.values.length} |`,
    `| D_duration | ${numeric(metrics.durationDistance.mean)} | ${metrics.durationDistance.values.length} 个 V_D 距离之和 | ${metrics.durationDistance.values.length} |`,
    '',
    'D_repeat 使用 baseline 条件 A 的全部 READY 草案两两比较；D_goals 和 D_duration 以条件 A 第一次成功的 READY 草案为基准。',
    '距离为完整草案 JSON 去除系统级标识字段后的字符 3-gram Jaccard distance，取值 0-1，仅表示输出文本差异，不解释为质量。',
    '',
    '## 五、Provider 实际调用记录',
    '',
    '| model | promptVersion | schemaVersion | 总 attempts | SUCCEEDED | RETRYABLE_FAILURE | 其他 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    providerLines,
    '',
    '## 六、人工评价',
    '',
    '人工评价尚未执行。评分材料见：',
    '',
    '- teacher_ratings_template.csv',
    `- ${ratingPack.rows.map((row) => row.planFile).join('、')}`,
    '',
    '评分要求：随机编号、隐藏实验条件、至少 2 名教师，四维度 1-5 分（教学目标一致性、教学需求适配性、教学活动合理性、整体可实施性）。',
    '',
    '## 七、实验限制',
    '',
    '- BOPPPS 六阶段结构完整率由系统 schema 门禁天然保证，仅作为产品形态符合性证据，不构成 AI 智能水平证明。',
    '- D_goals / D_duration 是完整方案文本的整体差异，不能单独证明差异恰好来自被改变的目标或时长；需结合教师盲评判断设计合理性。',
    '- 距离不使用阈值，不做可区分率解释，不做统计显著性推断，不把距离解释为质量。',
    '- 实验未包含班级学情条件（V_C 已取消），不能推断系统对班级学情的适应能力。',
    '- 实验未包含真实课堂教学，所有指标都不能解释为真实教学效果或学习效果提升。',
    '',
    '## 八、不可推断的结论',
    '',
    '- 不能写“教学效果提升”“学习效果提升”。',
    '- 不能写“AI 优于教师”。',
    '- 不能写“智能程度提升”。',
    '- 不能做显著性检验或“显著提升”表述。',
    '',
  ];
  writeFile(path.join(OUTPUT_DIR, 'experiment_summary.md'), `${summary.join('\n')}\n`);
}

async function main() {
  const progress = loadProgress();
  const runs = Object.values(progress.runs);
  if (runs.length === 0) throw new Error('progress.json 中没有正式实验运行记录');
  const draftIds = runs.map((run) => run.draft_id).filter(Boolean);
  if (draftIds.length === 0) throw new Error('没有可导出的 draft_id');

  const pool = newPool();
  try {
    const { draftRows, stageRows, attemptRows } = await loadData(pool, draftIds);
    const { rawTasks, stagesWithTask, attemptsWithTask } = buildRawRows(runs, draftRows, stageRows, attemptRows);
    const metrics = computeMetrics(runs, draftRows, stageRows, attemptRows);
    const ratingPack = writeRatingPack(metrics);

    writeFile(path.join(OUTPUT_DIR, 'raw_tasks.csv'), toCsv(rawTasks));
    writeFile(path.join(OUTPUT_DIR, 'raw_stages.csv'), toCsv(stagesWithTask));
    writeFile(path.join(OUTPUT_DIR, 'raw_attempts.csv'), toCsv(attemptsWithTask));
    writeJsonFile(path.join(OUTPUT_DIR, 'raw_drafts.json'), draftRows.map((draft) => {
      const run = runs.find((candidate) => candidate.task_id === draft.task_id);
      return {
        experiment_id: EXPERIMENT_ID,
        condition: run?.condition ?? '',
        repeat_index: run?.repeat_index ?? '',
        task_id: draft.task_id,
        draft_id: draft.draft_id,
        job_id: draft.job_id ?? '',
        topic: draft.topic,
        goals: run?.goal ? GOALS[run.goal] ?? run.goal : '',
        duration_minutes: draft.duration_minutes,
        selected_class_id: draft.selected_class_id,
        draft_state: draft.draft_state,
        job_state: draft.job_state ?? '',
        content_hash: draft.content_hash ?? '',
        input_hash: draft.input_hash ?? '',
        failure_code: draft.failure_code ?? '',
        started_at: formatDate(draft.job_started_at),
        completed_at: formatDate(draft.job_completed_at),
        content: draft.draft_content,
      };
    }));
    writeFile(
      path.join(OUTPUT_DIR, 'experiment_metrics.csv'),
      toCsv([
        { metric: 'task_generation_success_rate', value: numeric(metrics.taskSuccessRate), numerator: metrics.ready.length, denominator: metrics.launched.length, notes: `READY / 已启动任务` },
        { metric: 'first_generation_pass_rate', value: numeric(metrics.firstPassRate), numerator: metrics.firstPassNumerator, denominator: metrics.firstPassDenominator, notes: '首次 ORIGINAL attempt 直接 SUCCEEDED 的 stage 数 / 存在 ORIGINAL 且已终态的 stage 数' },
        { metric: 'boppps_structure_completeness_rate', value: numeric(metrics.bopppsRate), numerator: metrics.bopppsNumerator, denominator: metrics.ready.length, notes: 'READY 草案中通过六阶段结构检查的数量 / READY 草案数' },
        { metric: 'd_repeat', value: numeric(metrics.dRepeat), numerator: metrics.repeatPairs.length, denominator: metrics.repeatPairs.length, notes: '条件 A READY 草案两两 3-gram Jaccard distance 平均值' },
        { metric: 'd_goals', value: numeric(metrics.goalDistance.mean), numerator: metrics.goalDistance.values.length, denominator: metrics.goalDistance.values.length, notes: 'V_G READY 草案与 baseline 的 3-gram Jaccard distance 平均值' },
        { metric: 'd_duration', value: numeric(metrics.durationDistance.mean), numerator: metrics.durationDistance.values.length, denominator: metrics.durationDistance.values.length, notes: 'V_D READY 草案与 baseline 的 3-gram Jaccard distance 平均值' },
      ]),
    );
    writeJsonFile(path.join(OUTPUT_DIR, 'distance_detail.json'), {
      d_repeat_pairs: metrics.repeatPairs,
      d_goals: {
        baseline_draft_id: metrics.baseline?.draft_id ?? null,
        pairs: metrics.goalDistance.drafts.map((draft) => ({ draft_id: draft.draft_id, distance: jaccardDistance(planComparisonText(metrics.baseline.draft_content), planComparisonText(draft.draft_content)) })),
        mean: numeric(metrics.goalDistance.mean),
      },
      d_duration: {
        baseline_draft_id: metrics.baseline?.draft_id ?? null,
        pairs: metrics.durationDistance.drafts.map((draft) => ({ draft_id: draft.draft_id, distance: jaccardDistance(planComparisonText(metrics.baseline.draft_content), planComparisonText(draft.draft_content)) })),
        mean: numeric(metrics.durationDistance.mean),
      },
      normalization: 'stableJson(normalizePlanForComparison(draft.content))，删除 goals/knowledgePoints 的 id 与 gapIdentity 等系统标识字段',
    });
    writeSummary(metrics, runs, draftRows, stageRows, attemptRows, ratingPack);

    process.stdout.write('[export] 7 个结果文件已生成\n');
    process.stdout.write(`[metrics] success=${numeric(metrics.taskSuccessRate)} firstPass=${numeric(metrics.firstPassRate)} boppps=${numeric(metrics.bopppsRate)}\n`);
    process.stdout.write(`[metrics] d_repeat=${numeric(metrics.dRepeat)} d_goals=${numeric(metrics.goalDistance.mean)} d_duration=${numeric(metrics.durationDistance.mean)}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
