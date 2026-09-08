import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

export const BASE_URL = (process.env.NEXTAUTH_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
export const COURSE_BASIS_ID = 'cmt04kluy0000h4vg61gw7yf1';
export const SOURCE_VERSION_ID = 'cmt04ks1z0002h4vg7ae7qq4e';
export const TEACHER_LOGIN_ID = process.env.SMART_LESSON_TEACHER_LOGIN_ID;
export const TEACHER_PASSWORD = process.env.SMART_LESSON_TEACHER_PASSWORD;

export const OUTPUT_DIR = path.resolve(
  process.cwd(),
  'scripts/experiments/outputs/2026-09-08-autocontrol-root-locus',
);
export const PROGRESS_FILE = path.join(OUTPUT_DIR, 'progress.json');
export const EXPERIMENT_ID = 'SL_EXP_2026_09_08_AUTOCONTROL_ROOT_LOCUS';

export const BOPPPS_STAGE_KEYS = [
  'bridgeIn',
  'objectives',
  'preAssessment',
  'participatoryLearning',
  'postAssessment',
  'summary',
];

export const GOALS = {
  GA1: '掌握根轨迹基本概念，能够根据开环零极点判断根轨迹起点、终点及实轴分布',
  GB1: '掌握分离点、会合点及虚轴交点计算方法',
  GC1: '利用根轨迹分析系统稳定性、动态性能与参数调整关系',
  GA2: '综合根轨迹特征分析系统稳定裕度，并提出控制参数调整方案',
};

export const KNOWLEDGE_POINTS = {
  A: {
    title: '根轨迹的基本概念与绘制依据',
    content: '根轨迹的定义，开环零极点与根轨迹起点、终点及实轴分布的关系',
  },
  B: {
    title: '根轨迹关键点分析',
    content: '根轨迹分离点、会合点和虚轴交点的计算与几何意义',
  },
  C: {
    title: '根轨迹与系统性能分析',
    content: '根轨迹与系统稳定性、动态性能及参数调整的关系',
  },
};

export const SPECS = [
  { condition: 'A', topic: '根轨迹基础概念', goalKey: 'GA1', durationMinutes: 60, repeats: 3, experiment: 'EXPERIMENT_1_RELIABILITY' },
  { condition: 'B', topic: '根轨迹关键点分析', goalKey: 'GB1', durationMinutes: 60, repeats: 3, experiment: 'EXPERIMENT_1_RELIABILITY' },
  { condition: 'C', topic: '根轨迹性能分析', goalKey: 'GC1', durationMinutes: 90, repeats: 3, experiment: 'EXPERIMENT_1_RELIABILITY' },
  { condition: 'V_G', topic: '根轨迹基础概念', goalKey: 'GA2', durationMinutes: 60, repeats: 2, experiment: 'EXPERIMENT_2_RESPONSE' },
  { condition: 'V_D', topic: '根轨迹基础概念', goalKey: 'GA1', durationMinutes: 90, repeats: 2, experiment: 'EXPERIMENT_2_RESPONSE' },
];

const AUDIENCE = '自动化、控制类本科学生，已具备自动控制原理线性系统分析基础';
const PREREQUISITES = '开环传递函数、劳斯判据、二阶系统动态性能指标';

export function runKey(condition, repeatIndex) {
  return `${condition}-r${repeatIndex}`;
}

export function newPool() {
  return new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

export function writeJsonFile(filePath, value) {
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function loadProgress() {
  const fallback = {
    createdAt: new Date().toISOString(),
    smoke: null,
    runs: {},
  };
  const progress = readJsonFile(PROGRESS_FILE, fallback);
  progress.runs = progress.runs ?? {};
  return progress;
}

export function saveProgress(progress) {
  writeJsonFile(PROGRESS_FILE, progress);
}

export async function login() {
  if (!TEACHER_LOGIN_ID || !TEACHER_PASSWORD) {
    throw new Error('缺少 SMART_LESSON_TEACHER_LOGIN_ID / SMART_LESSON_TEACHER_PASSWORD 环境变量');
  }
  const jar = new Map();
  const remember = (response) => {
    const lines = response.headers.getSetCookie?.() ?? [];
    for (const line of lines) {
      const pair = line.split(';', 1)[0];
      const eq = pair.indexOf('=');
      if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  };
  const cookieHeader = () => [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');

  const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`, {
    headers: { cookie: cookieHeader() },
  });
  remember(csrfResponse);
  const csrfBody = await csrfResponse.json();
  const csrfToken = String(csrfBody.csrfToken ?? '');
  if (!csrfToken) throw new Error('无法读取 csrfToken');

  const loginResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: cookieHeader(),
    },
    body: new URLSearchParams({
      csrfToken,
      email: TEACHER_LOGIN_ID,
      password: TEACHER_PASSWORD,
      redirect: 'false',
      json: 'true',
    }),
  });
  remember(loginResponse);
  const loginBody = await loginResponse.json().catch(() => ({}));
  const loginUrl = String(loginBody.url ?? loginResponse.headers.get('location') ?? '');
  if (loginResponse.status >= 400 || loginUrl.includes('error=CredentialsSignin')) {
    throw new Error(`登录失败: ${loginResponse.status} ${loginUrl}`);
  }

  const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { cookie: cookieHeader() },
  });
  remember(sessionResponse);
  const session = await sessionResponse.json();
  if (!session?.user?.id || session?.user?.role !== 'TEACHER') {
    throw new Error(`教师会话无效: ${JSON.stringify(session)}`);
  }
  return { userId: session.user.id, cookieHeader: cookieHeader() };
}

export async function apiRequest(method, pathName, { cookie, body } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${BASE_URL}${pathName}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: response.status, json: json ?? {} };
}

export function createTaskPayload(spec) {
  const goalContent = GOALS[spec.goalKey];
  const knowledgePoint = KNOWLEDGE_POINTS[spec.condition] ?? KNOWLEDGE_POINTS.A;
  const gapReason = '当前课程依据为课程标准纲要，本条输入由实验教师依据专业教学要求补充，暂无已验证教材绑定';
  return {
    courseBasisId: COURSE_BASIS_ID,
    topic: spec.topic,
    audience: AUDIENCE,
    prerequisites: PREREQUISITES,
    durationMinutes: spec.durationMinutes,
    outlineConfirmationRequired: false,
    sourceVersionIds: [SOURCE_VERSION_ID],
    knowledgePoints: [
      {
        title: knowledgePoint.title,
        content: knowledgePoint.content,
        origin: 'TEACHER_CREATED',
        sourceState: 'no_reliable_source',
        sourceBindings: [],
        sourceConfirmed: false,
        gapReason,
      },
    ],
    goals: [
      {
        content: goalContent,
        sourceState: 'no_reliable_source',
        sourceBindings: [],
        sourceConfirmed: false,
        gapReason,
      },
    ],
    selectedClassId: null,
    confirmScope: true,
    confirmGoals: true,
  };
}

export function idempotencyKeyFor(condition, repeatIndex) {
  return `sl-exp-20260908-${condition.toLowerCase()}-${repeatIndex.toString().padStart(2, '0')}`;
}

export async function queryRows(pool, text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

export async function loadDraftSnapshot(pool, draftId) {
  const rows = await queryRows(
    pool,
    `select
      d.id as draft_id,
      d.state as draft_state,
      d.content as draft_content,
      d."contentHash" as content_hash,
      j.id as job_id,
      j.state as job_state,
      j."failureCode" as failure_code,
      j."inputHash" as input_hash,
      j."startedAt" as job_started_at,
      j."completedAt" as job_completed_at,
      t.id as task_id,
      t.topic,
      t."durationMinutes" as duration_minutes,
      t."selectedClassId" as selected_class_id,
      t."createdAt" as task_created_at,
      t."updatedAt" as task_updated_at
    from "SmartLessonDraft" d
    join "SmartLessonTask" t on t.id = d."taskId"
    left join lateral (
      select j2.*
      from "SmartLessonGenerationJob" j2
      where j2."draftId" = d.id
      order by j2."createdAt" desc
      limit 1
    ) j on true
    where d.id = $1`,
    [draftId],
  );
  return rows[0] ?? null;
}

export async function pollDraftUntilTerminal(pool, draftId, timeoutMs = 30 * 60 * 1000) {
  const startedAt = Date.now();
  let snapshot = await loadDraftSnapshot(pool, draftId);
  for (;;) {
    snapshot = snapshot ?? (await loadDraftSnapshot(pool, draftId));
    const jobState = snapshot?.job_state;
    const draftState = snapshot?.draft_state;
    if (!snapshot || !snapshot.job_id) {
      if (Date.now() - startedAt >= timeoutMs) return { ...(snapshot ?? {}), outcome: 'POLL_TIMEOUT' };
      await sleep(5000);
      snapshot = await loadDraftSnapshot(pool, draftId);
      continue;
    }
    if (jobState === 'COMPLETED' && draftState === 'READY') {
      return { ...snapshot, outcome: 'SUCCESS' };
    }
    if (['RETRYABLE', 'FAILED', 'CANCELLED'].includes(jobState)) {
      return { ...snapshot, outcome: 'FAILURE' };
    }
    if (jobState === 'COMPLETED' && draftState !== 'READY') {
      return { ...snapshot, outcome: 'FAILURE' };
    }
    if (Date.now() - startedAt >= timeoutMs) {
      return { ...snapshot, outcome: 'POLL_TIMEOUT' };
    }
    await sleep(5000);
    snapshot = await loadDraftSnapshot(pool, draftId);
  }
}

export function formatDate(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function normalizePlanForComparison(plan) {
  const clone = structuredClone(plan);
  for (const goal of clone.goals ?? []) {
    delete goal.id;
    delete goal.gapIdentity;
  }
  for (const point of clone.knowledgePoints ?? []) {
    delete point.id;
    delete point.gapIdentity;
  }
  return clone;
}

function gramSet(text, size) {
  const chars = Array.from(String(text).replace(/\s+/gu, ''));
  const set = new Set();
  for (let i = 0; i <= chars.length - size; i += 1) {
    set.add(chars.slice(i, i + size).join(''));
  }
  return set;
}

export function jaccardDistance(leftText, rightText, size = 3) {
  const left = gramSet(leftText, size);
  const right = gramSet(rightText, size);
  if (left.size === 0 && right.size === 0) return 0;
  let intersection = 0;
  for (const gram of left) {
    if (right.has(gram)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : 1 - intersection / union;
}

export function planComparisonText(plan) {
  return stableJson(normalizePlanForComparison(plan));
}

export function checkBopppsStructure(content, expectedDurationMinutes) {
  const reasons = [];
  if (!content || typeof content !== 'object') return { pass: false, reasons: ['content-not-object'] };
  if (content.durationMinutes !== expectedDurationMinutes) {
    reasons.push(`duration-mismatch:${content.durationMinutes ?? 'null'}:${expectedDurationMinutes}`);
  }
  const boppps = content.boppps;
  if (!boppps || typeof boppps !== 'object') return { pass: false, reasons: ['boppps-missing'] };
  for (const key of BOPPPS_STAGE_KEYS) {
    const stage = boppps[key];
    if (!stage || typeof stage !== 'object') {
      reasons.push(`${key}-missing`);
      continue;
    }
    if (!Number.isInteger(stage.minutes) || stage.minutes <= 0) reasons.push(`${key}-minutes-invalid`);
    if (!String(stage.teacherActivity ?? '').trim()) reasons.push(`${key}-teacherActivity-empty`);
    if (!String(stage.studentActivity ?? '').trim()) reasons.push(`${key}-studentActivity-empty`);
    if (!String(stage.assessment ?? '').trim()) reasons.push(`${key}-assessment-empty`);
    if (!Array.isArray(stage.steps) || stage.steps.length === 0) {
      reasons.push(`${key}-steps-empty`);
    } else {
      const stepMinutes = stage.steps.reduce((total, step) => total + Number(step.minutes ?? 0), 0);
      if (stepMinutes !== stage.minutes) reasons.push(`${key}-step-duration-mismatch`);
    }
  }
  const stageMinutes = BOPPPS_STAGE_KEYS.reduce((total, key) => total + Number(boppps[key]?.minutes ?? 0), 0);
  if (stageMinutes !== content.durationMinutes) reasons.push(`boppps-duration-mismatch:${stageMinutes}:${content.durationMinutes}`);
  const outline = content.coursewareStepOutline;
  if (!Array.isArray(outline)) {
    reasons.push('coursewareStepOutline-missing');
  } else {
    const outlineMinutes = outline.reduce((total, step) => total + Number(step.minutes ?? 0), 0);
    if (outlineMinutes !== content.durationMinutes) reasons.push(`courseware-duration-mismatch:${outlineMinutes}:${content.durationMinutes}`);
    for (const key of BOPPPS_STAGE_KEYS) {
      const byStage = outline
        .filter((step) => step.bopppsStage === key)
        .reduce((total, step) => total + Number(step.minutes ?? 0), 0);
      if (byStage !== Number(boppps[key]?.minutes ?? 0)) reasons.push(`courseware-stage-duration-mismatch:${key}`);
    }
  }
  return { pass: reasons.length === 0, reasons };
}

export function renderPlanMarkdown(plan, context) {
  const lines = [];
  lines.push(`# 教案 ${context.anonymousPlanId}`);
  lines.push('');
  lines.push('## 教学输入');
  lines.push('');
  lines.push(`- 教学主题：${context.topic}`);
  lines.push(`- 教学目标：${context.goals.join('；')}`);
  lines.push(`- 教学时长：${context.durationMinutes} 分钟`);
  lines.push(`- 班级学情：${context.classContext}`);
  lines.push('');
  lines.push('## 教学过程');
  lines.push('');
  lines.push('| 环节 | 分钟 | 教师活动 | 学生活动 | 评价要点 |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const key of BOPPPS_STAGE_KEYS) {
    const stage = plan.boppps?.[key];
    if (!stage) continue;
    const teacher = String(stage.teacherActivity ?? '').replaceAll('\n', ' ');
    const student = String(stage.studentActivity ?? '').replaceAll('\n', ' ');
    const assessment = String(stage.assessment ?? '').replaceAll('\n', ' ');
    lines.push(`| ${key} | ${stage.minutes} | ${teacher} | ${student} | ${assessment} |`);
  }
  lines.push('');
  lines.push('## 分步安排');
  lines.push('');
  for (const key of BOPPPS_STAGE_KEYS) {
    const stage = plan.boppps?.[key];
    if (!stage?.steps?.length) continue;
    lines.push(`### ${key}`);
    for (const step of stage.steps) {
      lines.push(`- **${step.title}（${step.minutes} 分钟）**：教师 ${step.teacherActivity}；学生 ${step.studentActivity}；评价 ${step.assessment}`);
    }
  }
  return lines.join('\n');
}
