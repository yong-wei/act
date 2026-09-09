import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params as never[]);
}

function maskUrl(url: string | undefined): string {
  if (!url) return '(missing)';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '(unparseable)';
  }
}

async function main() {
  const result: Record<string, unknown> = {};

  result.db = (await query('select current_database() as database, current_user as user_name')).rows[0];

  result.env = {
    databaseUrl: maskUrl(process.env.DATABASE_URL),
    aiProvider: process.env.AI_PROVIDER ?? null,
    aiModel: process.env.AI_MODEL ?? null,
    aiBaseUrl: process.env.AI_BASE_URL ?? null,
    smartLessonE2EFixtureToken: process.env.SMART_LESSON_E2E_FIXTURE_TOKEN ?? null,
    smartLessonRealProviderRequired: process.env.SMART_LESSON_REAL_PROVIDER_REQUIRED ?? null,
  };

  const aiSettings = await query<{ value: unknown }>(
    `select value from "PlatformSetting" where key = 'ai_provider_settings'`,
  );
  result.aiProviderSettings = aiSettings.rows.length > 0 ? aiSettings.rows[0].value : null;

  const users = await query<{
    id: string;
    name: string | null;
    email: string | null;
    employeeNumber: string | null;
    role: string;
  }>(`select id, name, email, "employeeNumber", role from "User" where role in ('TEACHER','ADMIN') order by "updatedAt" desc limit 30`);
  result.users = users.rows;

  const courseBases = await query<{
    id: string;
    title: string;
    ownerId: string;
    courseIdentity: string;
    docs: string;
  }>(`select cb.id, cb.title, cb."ownerId", cb."courseIdentity",
      (select count(*)::text from "CourseBasisDocument" d where d."courseBasisId" = cb.id) as docs
      from "CourseBasis" cb order by cb."updatedAt" desc limit 30`);
  result.courseBases = courseBases.rows;

  const versions = await query<{
    id: string;
    documentId: string;
    sourceName: string;
    sourceType: string;
    reviewState: string;
    retiredAt: Date | null;
    extractionState: string;
    byteSize: number;
  }>(`select id, "documentId", "sourceName", "sourceType", "reviewState", "retiredAt", "extractionState", "byteSize"
      from "CourseBasisDocumentVersion"
      where "retiredAt" is null
      order by "createdAt" desc
      limit 50`);
  result.courseBasisVersions = versions.rows;

  const tasks = await query<{
    id: string;
    ownerId: string;
    courseBasisId: string;
    topic: string;
    durationMinutes: number;
    outlineConfirmationRequired: boolean;
    selectedClassId: string | null;
    aggregateClassContextRef: string | null;
    classContextStaleAt: Date | null;
    scopeConfirmedAt: Date | null;
    goalsConfirmedAt: Date | null;
    sourceCount: string;
    knowledgePointCount: string;
    goalCount: string;
    draftCount: string;
  }>(`select t.id, t."ownerId", t."courseBasisId", t.topic, t."durationMinutes",
      t."outlineConfirmationRequired", t."selectedClassId", t."aggregateClassContextRef",
      t."classContextStaleAt", t."scopeConfirmedAt", t."goalsConfirmedAt",
      (select count(*)::text from "SmartLessonSourceSelection" s where s."taskId" = t.id and s.state = 'SELECTED') as "sourceCount",
      (select count(*)::text from "SmartLessonKnowledgePoint" kp where kp."taskId" = t.id and kp.state = 'CONFIRMED') as "knowledgePointCount",
      (select count(*)::text from "SmartLessonGoal" g where g."taskId" = t.id and g.state = 'CONFIRMED') as "goalCount",
      (select count(*)::text from "SmartLessonDraft" d where d."taskId" = t.id) as "draftCount"
      from "SmartLessonTask" t
      order by t."updatedAt" desc
      limit 40`);
  result.smartLessonTasks = tasks.rows;

  const classes = await query<{
    id: string;
    name: string;
    teacherId: string;
    isActive: boolean;
    profileCount: string;
    currentPortrait: string;
  }>(`select c.id, c.name, c."teacherId", c."isActive",
      (select count(*)::text from "StudentProfile" sp where sp."classId" = c.id) as "profileCount",
      (select count(*)::text from "ClassCumulativePortraitCurrentState" cs where cs."classId" = c.id) as "currentPortrait"
      from "Class" c
      order by c."updatedAt" desc
      limit 60`);
  result.classes = classes.rows;

  const portraits = await query<{
    classId: string;
    versionId: string;
    materializationVersion: string;
    calculationVersion: string;
    activeStudentCount: number;
    totalStudentCount: number;
    generatedAt: Date;
  }>(`select cs."classId", cs."versionId", cs."materializationVersion", cs."calculationVersion",
      v."activeStudentCount", v."totalStudentCount", v."generatedAt"
      from "ClassCumulativePortraitCurrentState" cs
      join "ClassCumulativePortraitVersion" v on v.id = cs."versionId"
      order by v."generatedAt" desc
      limit 60`);
  result.classPortraits = portraits.rows;

  const attemptSummary = await query<{
    providerKind: string;
    promptVersion: string;
    schemaVersion: string;
    model: string;
    outcome: string;
    count: string;
  }>(`select "providerKind", "promptVersion", "schemaVersion", model, outcome, count(*)::text as count
      from "SmartLessonProviderAttempt"
      group by 1,2,3,4,5
      order by count desc
      limit 60`);
  result.providerAttemptSummary = attemptSummary.rows;

  console.log(JSON.stringify(result, null, 2));
}

main()
  .finally(() => pool.end())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
