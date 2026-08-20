# Governed Prompt Assessment History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist authenticated, student-owned prompt-quality and consistency evaluations as durable learning-process history without changing official learning records or learner portraits.

**Architecture:** Keep scoring algorithms pure in `prompt-quality.ts`. Add a small persistence service that owns database mapping, serializable version allocation, conflict retry, and history projection. Routes establish authenticated ownership and delegate to that service; Prisma stores the new task-context and consistency JSON fields on the existing `PromptAssessment` row.

**Tech Stack:** Next.js App Router, TypeScript, Prisma 7/PostgreSQL, Vitest, Playwright, OpenSpec.

## Global Constraints

- The integration baseline is `integration`; final code must pass `rtk npm run typecheck`.
- Authentication is the authoritative user scope; request-body and path `userId` values do not grant access.
- `PromptAssessment` remains context-only evidence and must not create `LearningFact`, learner-portrait, official-score, leaderboard, or recommendation writes.
- Database changes are additive and require a PostgreSQL migration plus local migration verification.
- Demo mode remains client-only and must not call anonymous production endpoints.
- Commercial UI evidence is captured only from a clean, fixed Git revision with desktop and 320px artifacts.

---

### Task 1: Define persistence-facing history types and failing route regressions

**Files:**
- Create: `src/app/__tests__/prompt-assessment-history-routes.test.ts`
- Modify: `src/features/evaluation/prompt-quality.ts`
- Modify: `src/app/api/evaluation/assess-prompt/route.ts`
- Modify: `src/app/api/evaluation/track-consistency/route.ts`
- Modify: `src/app/api/evaluation/prompt-history/[userId]/route.ts`

**Interfaces:**
- Consumes: `AssessPromptRequest`, `AssessPromptResponse`, `TrackConsistencyRequest`, and `TrackConsistencyResponse` from `src/features/evaluation/prompt-quality.ts`.
- Produces: expected route contract: unauthenticated calls return `401`; authenticated requests use `session.user.id`; a foreign history path is rejected before a persistence call.

- [ ] **Step 1: Write the failing route tests**

```ts
it('rejects unauthenticated evaluation and history requests before persistence', async () => {
  mocks.getServerAuthSession.mockResolvedValue(null);

  expect((await assess(postRequest())).status).toBe(401);
  expect((await consistency(postRequest(consistencyBody))).status).toBe(401);
  expect((await history(getRequest('student-1'), ownContext('student-1'))).status).toBe(401);
  expect(mocks.prisma.promptAssessment.findMany).not.toHaveBeenCalled();
});

it('uses the authenticated student instead of a forged body userId', async () => {
  await assess(postRequest({ ...assessmentBody, userId: 'other-student' }));

  expect(mocks.prisma.promptAssessment.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ userId: 'student-1' }),
  }));
});
```

- [ ] **Step 2: Run the new route test to verify it fails**

Run: `rtk npx vitest run src/app/__tests__/prompt-assessment-history-routes.test.ts`

Expected: FAIL because the current routes accept anonymous request identities and use process-local history.

- [ ] **Step 3: Remove mutable history ownership from the scoring module**

```ts
export function assessPromptQuality(request: AssessPromptRequest): AssessPromptResponse {
  // Retain pure scoring only; persistence is delegated by the authenticated route.
}

export function trackConsistency(request: TrackConsistencyRequest): TrackConsistencyResponse {
  // Retain pure consistency calculation only; do not mutate a module-global record.
}
```

- [ ] **Step 4: Run the focused route test and scoring tests**

Run: `rtk npx vitest run src/app/__tests__/prompt-assessment-history-routes.test.ts src/lib/__tests__/ai-task-boundary-contracts.test.ts`

Expected: route test remains red until Task 2; existing scoring assertions pass.

### Task 2: Add durable assessment persistence with version integrity

**Files:**
- Create: `src/features/evaluation/prompt-assessment-history.ts`
- Create: `src/features/evaluation/__tests__/prompt-assessment-history.test.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_persist_governed_prompt_assessment_history/migration.sql`

**Interfaces:**
- Consumes: pure scoring result from `prompt-quality.ts`, `prisma` from `src/lib/prisma.ts`, and authenticated `userId` from routes.
- Produces: `createPromptAssessmentAttempt({ userId, sessionId, request })`, `attachPromptConsistencyResult({ userId, sessionId, version, request })`, and `listPromptAssessmentHistory(userId)`.

- [ ] **Step 1: Write failing persistence tests**

```ts
it('retries a version conflict and creates the next distinct session version', async () => {
  mocks.prisma.$transaction
    .mockRejectedValueOnce(Object.assign(new Error('serialization'), { code: 'P2034' }))
    .mockImplementationOnce((callback) => callback(mocks.prisma));
  mocks.prisma.promptAssessment.findFirst.mockResolvedValue({ version: 2 });

  await createPromptAssessmentAttempt({ userId: 'student-1', sessionId: 'session-1', request: assessmentBody });

  expect(mocks.prisma.promptAssessment.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ userId: 'student-1', sessionId: 'session-1', version: 3 }),
  }));
});

it('does not attach consistency to an absent or foreign assessment', async () => {
  mocks.prisma.promptAssessment.updateMany.mockResolvedValue({ count: 0 });

  await expect(attachPromptConsistencyResult({ userId: 'student-1', sessionId: 'session-1', version: 1, request: consistencyBody }))
    .rejects.toMatchObject({ code: 'PROMPT_ASSESSMENT_NOT_FOUND' });
});
```

- [ ] **Step 2: Run persistence tests to verify they fail**

Run: `rtk npx vitest run src/features/evaluation/__tests__/prompt-assessment-history.test.ts`

Expected: FAIL because the persistence service and error type do not exist.

- [ ] **Step 3: Add the additive Prisma model changes and migration**

```prisma
model PromptAssessment {
  // existing fields
  auditTaskContext  Json?
  consistencyResult Json?

  @@unique([userId, sessionId, version])
}
```

```sql
-- Fail before creating the unique index if a deployment database has ambiguous history.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "PromptAssessment"
    GROUP BY "userId", "sessionId", "version"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PromptAssessment duplicate user/session/version rows require remediation before migration';
  END IF;
END $$;
```

- [ ] **Step 4: Implement the persistence service**

```ts
export async function createPromptAssessmentAttempt(input: CreatePromptAssessmentAttemptInput) {
  return retryPromptAssessmentConflict(() => prisma.$transaction(async (tx) => {
    const latest = await tx.promptAssessment.findFirst({
      where: { userId: input.userId, sessionId: input.sessionId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const assessment = assessPromptQuality(input.request);
    return tx.promptAssessment.create({
      data: { userId: input.userId, sessionId: input.sessionId, version: (latest?.version ?? 0) + 1, /* mapped result */ },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}
```

- [ ] **Step 5: Run persistence tests and Prisma generation**

Run: `rtk npx vitest run src/features/evaluation/__tests__/prompt-assessment-history.test.ts`

Expected: PASS.

Run: `rtk npx prisma generate`

Expected: Prisma Client generated successfully.

### Task 3: Enforce route ownership and preserve page compatibility

**Files:**
- Modify: `src/app/api/evaluation/assess-prompt/route.ts`
- Modify: `src/app/api/evaluation/track-consistency/route.ts`
- Modify: `src/app/api/evaluation/prompt-history/[userId]/route.ts`
- Modify: `src/app/__tests__/prompt-assessment-history-routes.test.ts`
- Modify: `src/app/evaluation/prompt-assessment/page.tsx`
- Modify: `src/lib/__tests__/ai-task-boundary-ui-source.test.ts`

**Interfaces:**
- Consumes: persistence-service functions from Task 2 and `getServerAuthSession()`.
- Produces: existing JSON quality/consistency responses, `{ history, total }` history response, `401` unauthenticated response, `403` mismatched history-path response, and unchanged local demo execution.

- [ ] **Step 1: Extend the failing tests with owned-history and no-side-effect assertions**

```ts
it('reads only the authenticated student history and never calls a learning fact writer', async () => {
  const response = await history(getRequest('student-1'), ownContext('student-1'));

  expect(response.status).toBe(200);
  expect(mocks.prisma.promptAssessment.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { userId: 'student-1' },
  }));
  expect(Object.keys(mocks.prisma)).toEqual(['$transaction', 'promptAssessment']);
});

it('rejects a foreign history path before querying records', async () => {
  const response = await history(getRequest('student-2'), ownContext('student-2'));
  expect(response.status).toBe(403);
  expect(mocks.prisma.promptAssessment.findMany).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the expanded route test to verify it fails**

Run: `rtk npx vitest run src/app/__tests__/prompt-assessment-history-routes.test.ts`

Expected: FAIL because routes still call pure calculators directly and the history route has no session check.

- [ ] **Step 3: Implement minimal authenticated route delegation**

```ts
const session = await getServerAuthSession();
const userId = session?.user?.id;
if (!userId) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

if (routeUserId !== userId) {
  return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
}
```

- [ ] **Step 4: Preserve the client demo guard and response mapping**

```ts
if (autoDemo) {
  // Generate local demo data and return before fetch('/api/evaluation/...').
  return;
}
```

- [ ] **Step 5: Run route and page contract tests**

Run: `rtk npx vitest run src/app/__tests__/prompt-assessment-history-routes.test.ts src/lib/__tests__/ai-task-boundary-contracts.test.ts src/lib/__tests__/ai-task-boundary-ui-source.test.ts`

Expected: PASS.

### Task 4: Verify migration, browser behavior, and OpenSpec delivery state

**Files:**
- Create: `tests/prompt-assessment-history-1422.spec.ts`
- Create: `scripts/tests/capture-prompt-assessment-history-1422.ts`
- Create: `artifacts/commercial-ui/prompt-assessment-history-1422/browser-evidence.json`
- Create: `artifacts/commercial-ui/prompt-assessment-history-1422/desktop.png`
- Create: `artifacts/commercial-ui/prompt-assessment-history-1422/mobile.png`
- Modify: `openspec/changes/persist-governed-prompt-assessment-history/tasks.md`

**Interfaces:**
- Consumes: local PostgreSQL via `DATABASE_URL`, authenticated browser fixture, and the final clean Git revision.
- Produces: migration evidence, browser screenshot manifest with a fixed full SHA, screenshot hashes, viewport metrics, source/generator hashes, and fail-closed pre/post-capture worktree checks.

- [ ] **Step 1: Write the failing browser test**

```ts
test('authenticated prompt assessment history is reachable at desktop and 320px without horizontal overflow', async ({ page }) => {
  await page.goto('/evaluation/prompt-assessment');
  await expect(page.getByRole('heading', { name: '提示词评价' })).toBeVisible();
  await expect(page.locator('body')).toEvaluate((body) => body.scrollWidth <= window.innerWidth);
});
```

- [ ] **Step 2: Run the browser test to verify the fixture and route evidence path**

Run: `rtk playwright test tests/prompt-assessment-history-1422.spec.ts --workers=1`

Expected: FAIL until the authenticated fixture, route response, and capture contract are wired to the local runtime.

- [ ] **Step 3: Implement a fail-closed evidence capture script**

```ts
assertCleanWorktreeAtCaptureStart();
const headCommit = gitRevParse('HEAD');
await captureViewport(1440, 1200, 'desktop.png');
await captureViewport(320, 900, 'mobile.png');
assertCleanWorktreeAndSameHead(headCommit);
writeManifest({ headCommit, capturedAt, sourceHashes, screenshotHashes, metrics });
```

- [ ] **Step 4: Apply and verify the local migration**

Run: `rtk npx prisma migrate deploy`

Expected: migration completes against the local PostgreSQL database.

Run: `rtk npx vitest run src/features/evaluation/__tests__/prompt-assessment-history.test.ts src/app/__tests__/prompt-assessment-history-routes.test.ts`

Expected: PASS with persistence and ownership assertions.

- [ ] **Step 5: Capture fixed-revision browser evidence**

Run: `rtk npx tsx scripts/tests/capture-prompt-assessment-history-1422.ts`

Expected: exit code 0 and a manifest bound to the final clean SHA with 1440px and 320px screenshots.

- [ ] **Step 6: Run final verification and mark OpenSpec tasks**

Run: `rtk npm run typecheck`

Expected: exit code 0.

Run: `rtk openspec validate persist-governed-prompt-assessment-history --type change --strict; rtk openspec validate --specs --strict; rtk git diff --check`

Expected: all checks pass.

- [ ] **Step 7: Commit the stable change checkpoint**

```bash
git add docs/grill/student-learning-prompt-history openspec/changes/persist-governed-prompt-assessment-history prisma src tests scripts artifacts
git commit -m "fix(evaluation): persist governed prompt assessment history"
```

Expected: one coherent commit with the decision record, OpenSpec artifacts, implementation, migration, tests, and evidence. Do not push, create a PR, or request Codex review without an explicit user instruction.
