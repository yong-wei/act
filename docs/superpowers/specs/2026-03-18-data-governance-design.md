# AI-OBE Platform Data Governance Design Spec

**Date**: 2026-03-18
**Scope**: 4-Phase Implementation (Event Governance → Competency Engine → Teacher Analytics → Growth Portfolio)
**Worker Strategy**: BullMQ with Redis, minimal first iteration

---

## 1. Architecture Overview

### 1.1 Four-Layer Data Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION PRESENTATION LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Student      │  │ Teacher      │  │ AI Copilot   │  │ Recommendation   │ │
│  │ Growth Hub   │  │ Cockpit v2   │  │ Context      │  │ Engine           │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPETENCY PORTRAIT LAYER                            │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────────┐ │
│  │ StudentCompetency  │  │ ClassCompetency    │  │ Risk Detection         │ │
│  │ Snapshot           │  │ Snapshot           │  │ Engine                 │ │
│  └────────────────────┘  └────────────────────┘  └────────────────────────┘ │
│                                                                              │
│  Pre-aggregated snapshots refreshed by BullMQ workers (5-30min intervals)   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LEARNING FACTS LAYER                                 │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────────┐ │
│  │ LearningFact       │  │ UserAnswer         │  │ SimulationLog          │ │
│  │ (unified)          │  │ (existing)         │  │ (existing)             │ │
│  └────────────────────┘  └────────────────────┘  └────────────────────────┘ │
│                                                                              │
│  Structured learning records with competency contribution mapping            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EVENT INGESTION LAYER                               │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────────┐ │
│  │ Core Events        │  │ Secondary Events   │  │ Event Dictionary       │ │
│  │ (PostgreSQL)       │  │ (Redis Buffer)     │  │ (Metadata)             │ │
│  └────────────────────┘  └────────────────────┘  └────────────────────────┘ │
│                                                                              │
│  Priority-based routing: Core events → immediate DB, Secondary → Redis → DB │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Worker Architecture (Minimal First Iteration)

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKER SERVICE (Node.js)                      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  BullMQ Connection (Redis)                               │   │
│  │  - concurrency: 2 (low, controlled)                      │   │
│  │  - batch size: 100 events                              │   │
│  │  - retry: 3 attempts with exponential backoff          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Queue:          │  │ Queue:          │  │ Queue:          │  │
│  │ event-ingestion │  │ snapshot-student│  │ snapshot-class  │  │
│  │                 │  │                 │  │                 │  │
│  │ Consumer:       │  │ Consumer:       │  │ Consumer:       │  │
│  │ - Batch consume │  │ - Calculate     │  │ - Aggregate     │  │
│  │   secondary     │  │   competency    │  │   class stats   │  │
│  │   events        │  │   vector        │  │                 │  │
│  │ - Write to DB   │  │ - Detect risks  │  │ - Update class  │  │
│  │                 │  │ - Update        │  │   snapshots     │  │
│  │ Schedule:       │  │   profile       │  │                 │  │
│  │ Every 5 min     │  │   summary       │  │ Schedule:       │  │
│  │                 │  │                 │  │ Every 15 min    │  │
│  │                 │  │ Schedule:       │  │                 │  │
│  │                 │  │ Every 10 min    │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1: Unified Event Protocol & Redis Buffer

### 2.1 Event Protocol Definition

**File**: `src/lib/data-governance/event-protocol.ts`

```typescript
// Event Priority Classification
type EventPriority = 'core' | 'secondary';

// Unified Event Structure
interface LearningEvent {
  // Identity
  eventId: string;        // ULID for sortability
  occurredAt: string;     // ISO 8601

  // Actor Context
  userId: string;
  role: 'student' | 'teacher' | 'admin';
  classId?: string;

  // Learning Context
  courseId?: string;      // L-2a, L-2b, L-2c, L-2d, L-sum
  lessonId?: string;
  sessionId?: string;     // Classroom session
  pagePath: string;
  pageType: PageType;

  // Action Context
  moduleId?: string;      // Component/module identifier
  actionType: string;     // Verb: submit, complete, change, view
  targetType?: string;    // Noun: question, simulation, parameter
  targetId?: string;

  // Payload
  payload: Record<string, unknown>;

  // Computed Metrics (added by ingestion layer)
  derivedMetrics?: Record<string, number | string | boolean>;

  // Metadata
  source: 'web' | 'system' | 'ai';
  priority: EventPriority;
  clientTimestamp?: number;  // Original client timestamp
}

type PageType =
  | 'theory'           // 理论讲解页
  | 'practice'         // 练习/习题页
  | 'workspace'        // 工作区/设计页
  | 'quiz'             // 测验页
  | 'reflection'       // 反思页
  | 'simulation'       // 仿真页
  | 'dashboard'        // 仪表盘页
  | 'classroom';       // 课堂页
```

### 2.2 Event Type Registry

**File**: `src/lib/data-governance/event-types.ts`

| Event Type | Category | Priority | Description |
|------------|----------|----------|-------------|
| `answer_submit` | assessment | core | 题目提交，带答案和用时 |
| `assessment_complete` | assessment | core | 测评完成，带得分 |
| `simulation_finish` | simulation | core | 仿真完成，带指标 |
| `ai_intervention_complete` | ai | core | AI介入结果反馈 |
| `prompt_assessed` | ai | core | 提示词评价结果 |
| `design_session_complete` | design | core | 设计会话结果 |
| `ethical_violation` | ethics | core | 伦理违规记录 |
| `ethical_resolved` | ethics | core | 伦理整改完成 |
| `page_view` | navigation | secondary | 页面浏览 |
| `step_enter` | navigation | secondary | 进入步骤 |
| `step_leave` | navigation | secondary | 离开步骤 |
| `knowledge_card_open` | interaction | secondary | 打开知识卡片 |
| `param_change` | interaction | secondary | 参数变更（中间状态）|
| `hint_request` | interaction | secondary | 请求提示 |

### 2.3 Redis Buffer Implementation

**File**: `src/lib/data-governance/event-buffer.ts`

**Redis Key Design**:
```
bullmq:queue:event-ingestion              # BullMQ queue metadata
event:buffer:secondary:{yyyy-MM-dd}       # Daily secondary event list
event:stats:daily:{yyyy-MM-dd}            # Daily aggregated stats
event:sequence:{userId}                   # User event sequence counter
```

**Buffer Strategy**:
- Core events: Direct to PostgreSQL via existing EventQueue
- Secondary events: Push to Redis list, Worker batch consumes every 5 minutes
- Redis unavailable: Secondary events dropped (acceptable loss)

### 2.4 Database Schema Extensions

**Additions to `prisma/schema.prisma`**:

```prisma
// Event batch storage for secondary events
model LearningEventBatch {
  id          String   @id @default(cuid())
  batchDate   DateTime @db.Date
  events      Json     // Compressed array of LearningEvent
  eventCount  Int
  processedAt DateTime?
  createdAt   DateTime @default(now())

  @@index([batchDate])
  @@index([processedAt])
}

// Event type metadata dictionary
model EventDictionary {
  eventType   String   @id
  category    String   // simulation, assessment, interaction...
  priority    String   // core, secondary
  description String?
  schema      Json?    // JSON Schema for payload validation
  competencyMapping Json? // Which competencies this event contributes to
  createdAt   DateTime @default(now())
}

// Learning Facts - unified structured records
model LearningFact {
  id              String    @id @default(cuid())
  userId          String
  factType        String    // simulation, question, prompt_design, ai_intervention, ethical
  moduleId        String?   // Component/module identifier
  sessionId       String?   // Classroom session

  startedAt       DateTime
  finishedAt      DateTime?

  outcome         String    // success, partial, failure, abandoned
  score           Float?
  timeSpent       Int?      // Seconds

  // Competency contribution (normalized -1 to 1)
  competencyContribution Json // { controlModeling: 0.8, parameterDesign: 0.3, ... }

  // Source reference
  sourceEventId   String?   // Original event ID
  sourceLogId     String?   // Link to SimulationLog/UserAnswer/etc

  // Metadata
  courseId        String?
  lessonId        String?

  createdAt       DateTime  @default(now())

  @@index([userId, factType])
  @@index([userId, startedAt])
  @@index([sessionId])
}
```

### 2.5 Extended Events API

**File**: `src/app/api/interactive/events/route.ts` (modifications)

Add support for:
- Priority marking (`core` | `secondary`)
- Batch compression for high-frequency events
- Event validation against EventDictionary schema

---

## 3. Phase 2: Competency Engine & Snapshot Tables

### 3.1 Six-Dimensional Competency Model

**File**: `src/lib/data-governance/competency-model.ts`

```typescript
// Six Primary Competency Dimensions
interface CompetencyVector {
  controlModeling: CompetencyScore;      // 控制建模与分析能力
  parameterDesign: CompetencyScore;      // 参数设计与调优能力
  crossDomainTransfer: CompetencyScore;  // 跨域迁移与联动能力
  engineeringDecision: CompetencyScore;  // 工程决策与约束意识
  inquiryReflection: CompetencyScore;    // 探究反思与提示词设计能力
  selfDirectedLearning: CompetencyScore; // 自主学习进展能力
}

interface CompetencyScore {
  score: number;        // 0-100 normalized score
  trend: 'up' | 'stable' | 'down';
  confidence: number;   // 0-1 based on evidence quality
  evidenceCount: number;
  lastUpdated: string;
}

// Secondary indicator to primary competency mapping
const COMPETENCY_MAPPINGS = {
  simulation: {
    metricAchievement: 'parameterDesign',
    iterationEfficiency: 'parameterDesign',
    retryQuality: 'selfDirectedLearning',
    constraintViolationRate: 'engineeringDecision',
    optimizationConvergence: 'parameterDesign',
  },
  assessment: {
    correctRate: 'controlModeling',
    crossDomainMigration: 'crossDomainTransfer',
    weakPointRecovery: 'selfDirectedLearning',
    conceptApplication: 'controlModeling',
  },
  promptDesign: {
    completenessScore: 'inquiryReflection',
    precisionScore: 'inquiryReflection',
    structurizationScore: 'inquiryReflection',
    iterationDepth: 'selfDirectedLearning',
  },
  aiInteraction: {
    appropriateUse: 'inquiryReflection',
    followUpQuality: 'selfDirectedLearning',
    misuseRecovery: 'engineeringDecision',
  },
  ethics: {
    violationRate: 'engineeringDecision',
    remediationQuality: 'engineeringDecision',
    proactiveAwareness: 'engineeringDecision',
  },
};
```

### 3.2 Snapshot Tables

**Additions to `prisma/schema.prisma`**:

```prisma
// Student competency snapshot (for AI assistant quick access)
model StudentCompetencySnapshot {
  id                  String   @id @default(cuid())
  userId              String
  snapshotAt          DateTime

  // Six-dimensional competency vector
  competencyVector    Json     // Full CompetencyVector object

  // Evidence summary (top 3 per dimension)
  evidenceSummary     Json     // { controlModeling: [...], ... }

  // Risk flags
  riskFlags           Json     // ['参与风险', 'AI误用风险', ...]

  // Learning trajectory
  trajectoryVector    Json?    // Direction of improvement

  // Calculation metadata
  calculationVersion  String   @default("v1")
  factCount           Int      // Number of learning facts used

  @@index([userId, snapshotAt])
  @@index([snapshotAt])
}

// Optimized profile summary for AI assistant
model StudentProfileSummary {
  userId                  String   @id
  updatedAt               DateTime @updatedAt

  // Quick-access summary
  overallLevel            String   // 优秀/良好/中等偏上/需关注
  overallScore            Float    // 0-100 aggregated score

  // Parsed from competency vector
  strengthsJson           Json     // ['动态响应分析', '仿真调参']
  weaknessesJson          Json     // ['跨域解释一致性']

  // Trend analysis
  recentTrend             String   // 近两周稳步提升/波动/停滞
  trendDirection          String   // up/down/stable

  // Risk flags
  riskFlagsJson           Json     // ['遇到复杂任务倾向直接请求AI']
  riskLevel               String   // none/low/medium/high

  // Recommendations
  recommendedScaffolding  String   // 先追问解释，再给局部提示

  // Recent activity (last 5 key events)
  recentActivityJson      Json

  // Cache control
  cacheExpiresAt          DateTime

  @@index([updatedAt])
  @@index([riskLevel])
}

// Class-level competency aggregation
model ClassCompetencySnapshot {
  id                String   @id @default(cuid())
  classId           String
  snapshotAt        DateTime

  // Aggregate statistics
  aggregateJson     Json     // Mean/stdev per dimension
  distributionJson  Json     // Score distribution buckets

  // Trend
  trendJson         Json     // Change from previous snapshot

  // Risk summary
  riskSummaryJson   Json     // Risk counts by type

  // Level distribution
  levelDistribution Json     // { excellent: 5, good: 10, ... }

  // Participation
  activeStudentCount Int
  totalStudentCount  Int

  @@index([classId, snapshotAt])
}

// Risk flags for students
model StudentRiskFlag {
  id            String    @id @default(cuid())
  userId        String
  flagType      String    // participation, stagnation, ai_misuse, constraint, cross_domain
  severity      String    // low, medium, high
  description   String

  // Evidence
  evidenceJson  Json      // Supporting data points
  triggeredAt   DateTime

  // Resolution
  isResolved    Boolean   @default(false)
  resolvedAt    DateTime?
  resolutionNote String?

  createdAt     DateTime  @default(now())

  @@index([userId, flagType])
  @@index([userId, isResolved])
  @@index([flagType, severity])
}
```

### 3.3 Competency Calculation Engine

**File**: `src/lib/data-governance/competency-engine.ts`

**Core Functions**:

```typescript
// Calculate competency from learning facts
function calculateCompetencyVector(
  facts: LearningFact[],
  timeWindow: '2w' | '1m' | '3m' | 'all' = '1m'
): CompetencyVector;

// Calculate confidence based on evidence quality
function calculateConfidence(
  evidenceCount: number,
  evidenceQuality: number,
  timeSpan: number // days
): number;

// Calculate trend from snapshots
function calculateTrend(
  current: CompetencyVector,
  previous: CompetencyVector
): TrendVector;

// Generate evidence summary per dimension
function generateEvidenceSummary(
  facts: LearningFact[],
  dimension: keyof CompetencyVector
): EvidenceItem[];

// Update profile summary from competency snapshot
function updateProfileSummary(
  userId: string,
  snapshot: StudentCompetencySnapshot
): Promise<void>;
```

**Scoring Algorithm** (v1 - simple weighted average):
```typescript
// Each fact contributes to relevant dimensions
// Weight = recency * outcome_quality * time_spent_factor

function calculateDimensionScore(facts: LearningFact[]): number {
  const weightedSum = facts.reduce((sum, fact) => {
    const recencyWeight = calculateRecencyWeight(fact.startedAt);
    const outcomeWeight = outcomeToWeight(fact.outcome, fact.score);
    const timeWeight = Math.min(fact.timeSpent || 0, 300) / 300; // Cap at 5min

    const contribution = fact.competencyContribution[dimension] || 0;
    return sum + (contribution * recencyWeight * outcomeWeight * timeWeight);
  }, 0);

  const totalWeight = facts.reduce((sum, fact) => {
    return sum + calculateRecencyWeight(fact.startedAt);
  }, 0);

  return normalizeTo100(weightedSum / totalWeight);
}
```

### 3.4 Worker Implementation

**File**: `scripts/workers/data-governance-worker.ts`

**Three Queues, One Service**:

```typescript
import { Queue, Worker } from 'bullmq';
import { redisClient } from '@/lib/redis-client';

// Queue definitions
const eventQueue = new Queue('event-ingestion', { connection: redisClient.getClient() });
const studentSnapshotQueue = new Queue('snapshot-student', { connection: redisClient.getClient() });
const classSnapshotQueue = new Queue('snapshot-class', { connection: redisClient.getClient() });

// Worker 1: Event Ingestion (every 5 min via cron job addition)
const eventWorker = new Worker('event-ingestion', async (job) => {
  const { batchDate } = job.data;

  // 1. Fetch secondary events from Redis buffer
  const events = await fetchSecondaryEvents(batchDate);

  // 2. Batch insert to LearningEventBatch
  await prisma.learningEventBatch.create({
    data: {
      batchDate: new Date(batchDate),
      events: compressEvents(events),
      eventCount: events.length,
    },
  });

  // 3. Transform to LearningFacts
  const facts = events
    .filter(e => isCoreEventType(e.actionType))
    .map(eventToFact);

  // 4. Upsert LearningFacts
  await prisma.learningFact.createMany({
    data: facts,
    skipDuplicates: true,
  });

  return { processed: events.length, factsCreated: facts.length };
}, {
  connection: redisClient.getClient(),
  concurrency: 2, // Low concurrency for controlled processing
});

// Worker 2: Student Snapshot Refresh (every 10 min)
const studentSnapshotWorker = new Worker('snapshot-student', async (job) => {
  const { userId } = job.data;

  // 1. Fetch recent learning facts
  const facts = await prisma.learningFact.findMany({
    where: { userId, startedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
  });

  // 2. Calculate competency vector
  const competencyVector = calculateCompetencyVector(facts, '1m');

  // 3. Detect risks
  const risks = detectRisks(userId, facts, competencyVector);

  // 4. Create snapshot
  const snapshot = await prisma.studentCompetencySnapshot.create({
    data: {
      userId,
      snapshotAt: new Date(),
      competencyVector: competencyVector as unknown as Prisma.InputJsonValue,
      evidenceSummary: generateEvidenceSummary(facts),
      riskFlags: risks.map(r => r.flagType),
      factCount: facts.length,
    },
  });

  // 5. Update optimized profile summary
  await updateProfileSummary(userId, snapshot);

  // 6. Store/update risk flags
  await upsertRiskFlags(userId, risks);

  return { userId, snapshotId: snapshot.id, risks: risks.length };
}, {
  connection: redisClient.getClient(),
  concurrency: 2,
});

// Worker 3: Class Snapshot Aggregation (every 15 min)
const classSnapshotWorker = new Worker('snapshot-class', async (job) => {
  const { classId } = job.data;

  // 1. Get all students in class
  const students = await prisma.studentProfile.findMany({
    where: { classId },
    select: { userId: true },
  });

  // 2. Fetch latest snapshots for all students
  const snapshots = await Promise.all(
    students.map(s =>
      prisma.studentCompetencySnapshot.findFirst({
        where: { userId: s.userId },
        orderBy: { snapshotAt: 'desc' },
      })
    )
  );

  // 3. Calculate aggregates
  const aggregate = calculateClassAggregate(snapshots);
  const distribution = calculateLevelDistribution(snapshots);
  const riskSummary = aggregateRisks(snapshots);

  // 4. Create class snapshot
  const snapshot = await prisma.classCompetencySnapshot.create({
    data: {
      classId,
      snapshotAt: new Date(),
      aggregateJson: aggregate as unknown as Prisma.InputJsonValue,
      distributionJson: distribution as unknown as Prisma.InputJsonValue,
      riskSummaryJson: riskSummary as unknown as Prisma.InputJsonValue,
      levelDistribution: distribution as unknown as Prisma.InputJsonValue,
      activeStudentCount: snapshots.filter(s => s !== null).length,
      totalStudentCount: students.length,
    },
  });

  return { classId, snapshotId: snapshot.id };
}, {
  connection: redisClient.getClient(),
  concurrency: 1, // Class aggregation is heavier, lower concurrency
});
```

### 3.5 Scheduler Setup

**File**: `scripts/workers/scheduler.ts`

```typescript
import { Queue } from 'bullmq';

// Schedule recurring jobs
async function scheduleJobs() {
  // Event ingestion: every 5 minutes
  await eventQueue.add(
    'ingest-batch',
    { batchDate: new Date().toISOString().split('T')[0] },
    { repeat: { cron: '*/5 * * * *' } }
  );

  // Student snapshots: every 10 minutes, staggered by userId hash
  // Actual per-user jobs added dynamically based on activity

  // Class snapshots: every 15 minutes
  const classes = await prisma.class.findMany({ select: { id: true } });
  for (const cls of classes) {
    await classSnapshotQueue.add(
      `snapshot-class-${cls.id}`,
      { classId: cls.id },
      { repeat: { cron: '*/15 * * * *' } }
    );
  }
}
```

### 3.6 Konling (AI Assistant) Context Injection API

**File**: `src/app/api/ai/konling-context/route.ts`

```typescript
// GET /api/ai/konling-context?userId=xxx&pageId=xxx

interface KonlingContextResponse {
  student_profile_context: {
    overall_level: string;
    overall_score: number;
    strengths: string[];
    weaknesses: string[];
    recent_trend: string;
    trend_direction: string;
    risk_flags: string[];
    risk_level: string;
    recommended_scaffolding: string;
  };
  current_task_context: {
    page_type: string;
    course_id: string;
    current_step: string;
    completion_rate: number;
    relevant_weaknesses: string[];
  };
  competency_vector: CompetencyVector;
}

// Implementation reads from StudentProfileSummary (optimized cache table)
// Response time target: < 100ms
```

---

## 4. Phase 3: Teacher Analytics & Risk Detection

### 4.1 Risk Detection Engine

**File**: `src/lib/data-governance/risk-detector.ts`

**Risk Types**:

```typescript
interface RiskDetectionRule {
  type: string;
  severity: 'low' | 'medium' | 'high';
  check: (userId: string, facts: LearningFact[], competency: CompetencyVector) => RiskFlag | null;
}

const RISK_RULES: RiskDetectionRule[] = [
  {
    type: 'participation',
    severity: 'high',
    check: (userId, facts) => {
      // Check if student has < 3 events in last 3 classroom sessions
      const recentSessions = getRecentSessions(userId, 3);
      const lowParticipation = recentSessions.filter(s => s.eventCount < 5).length >= 3;
      if (lowParticipation) {
        return {
          type: 'participation',
          severity: 'high',
          description: '连续3次课堂参与度过低',
          evidence: { sessions: recentSessions },
        };
      }
      return null;
    },
  },
  {
    type: 'stagnation',
    severity: 'medium',
    check: (userId, facts, competency) => {
      // Check if overall competency hasn't improved in 2 weeks
      const previousSnapshot = getSnapshotFrom(userId, 14);
      if (previousSnapshot) {
        const currentOverall = averageCompetency(competency);
        const previousOverall = averageCompetency(previousSnapshot.competencyVector);
        if (currentOverall <= previousOverall * 0.95) { // Within 5% or declined
          return {
            type: 'stagnation',
            severity: 'medium',
            description: '近2周能力值无提升',
            evidence: { current: currentOverall, previous: previousOverall },
          };
        }
      }
      return null;
    },
  },
  {
    type: 'ai_misuse',
    severity: 'medium',
    check: (userId, facts) => {
      // High AI usage but no improvement in outcomes
      const aiInteractions = facts.filter(f => f.factType === 'ai_intervention');
      const highFrequency = aiInteractions.length > 10; // Last 2 weeks
      const lowHelpfulness = aiInteractions.filter(i => i.outcome === 'failure').length / aiInteractions.length > 0.5;

      if (highFrequency && lowHelpfulness) {
        return {
          type: 'ai_misuse',
          severity: 'medium',
          description: '高频调用AI但后续表现无改善',
          evidence: { totalCalls: aiInteractions.length, failureRate: lowHelpfulness },
        };
      }
      return null;
    },
  },
  {
    type: 'constraint',
    severity: 'medium',
    check: (userId, facts) => {
      // Multiple ethical violations or constraint breaches
      const violations = facts.filter(f =>
        f.factType === 'ethical' && f.outcome === 'failure'
      );
      if (violations.length >= 3) {
        return {
          type: 'constraint',
          severity: 'medium',
          description: '仿真中多次违反约束',
          evidence: { violationCount: violations.length },
        };
      }
      return null;
    },
  },
  {
    type: 'cross_domain',
    severity: 'high',
    check: (userId, facts, competency) => {
      // High in single domain but low in cross-domain
      const singleDomainStrong = competency.controlModeling.score > 70;
      const crossDomainWeak = competency.crossDomainTransfer.score < 50;

      if (singleDomainStrong && crossDomainWeak) {
        return {
          type: 'cross_domain',
          severity: 'high',
          description: '单点题会做，联动解释差',
          evidence: {
            controlModeling: competency.controlModeling.score,
            crossDomainTransfer: competency.crossDomainTransfer.score,
          },
        };
      }
      return null;
    },
  },
];
```

### 4.2 Teacher Dashboard APIs

**File**: `src/app/api/teacher/classes/[classId]/dashboard/route.ts`

```typescript
// GET /api/teacher/classes/{classId}/dashboard

interface TeacherDashboardResponse {
  class: {
    id: string;
    name: string;
    studentCount: number;
    activeToday: number;
  };

  competency: {
    aggregate: ClassAggregate;           // From ClassCompetencySnapshot
    distribution: LevelDistribution;     // excellent/good/avg/needs-help counts
    trend: TrendSnapshot;                // vs previous snapshot
  };

  riskSummary: {
    totalFlags: number;
    byType: Record<string, number>;
    highPriorityStudents: RiskStudentSummary[];
  };

  recentActivity: {
    sessionsCompleted: number;
    avgScore: number;
    topPerformers: StudentMiniProfile[];
    needAttention: StudentMiniProfile[];
  };
}
```

**File**: `src/app/api/teacher/classes/[classId]/risk-students/route.ts`

```typescript
// GET /api/teacher/classes/{classId}/risk-students?severity=high&unresolved=true

interface RiskStudentsResponse {
  students: Array<{
    userId: string;
    name: string;
    avatar?: string;
    riskFlags: Array<{
      type: string;
      severity: string;
      description: string;
      triggeredAt: string;
      evidence: unknown;
    }>;
    overallRisk: 'low' | 'medium' | 'high';
    recommendedAction: string;
  }>;
}
```

**File**: `src/app/api/teacher/classes/[classId]/heatmap/route.ts`

```typescript
// GET /api/teacher/classes/{classId}/heatmap

interface CompetencyHeatmapResponse {
  dimensions: string[]; // ['controlModeling', 'parameterDesign', ...]
  students: Array<{
    userId: string;
    name: string;
    scores: number[]; // Aligned with dimensions
    level: string;
  }>;
  classAverages: number[];
  // For rendering a heatmap: students x dimensions matrix
}
```

### 4.3 Enhanced Session Review

**File**: `src/app/classroom/teacher/[sessionId]/review-v2/page.tsx`

New components:
- **Competency Gain Ranking**: Which students improved most during this session
- **Ineffective Segment Identification**: Which lesson items showed no learning gain
- **2D Knowledge-Performance Matrix**:
  - Quadrant 1: High understanding, High performance (目标区)
  - Quadrant 2: High understanding, Low performance (执行问题)
  - Quadrant 3: Low understanding, High performance (猜测/运气)
  - Quadrant 4: Low understanding, Low performance (需重点关注)

---

## 5. Phase 4: Growth Portfolio & Recommendations

### 5.1 Growth Records System

**Additions to `prisma/schema.prisma`**:

```prisma
model GrowthRecord {
  id          String   @id @default(cuid())
  userId      String

  recordType  String   // milestone, breakthrough, remediation, reflection, portfolio
  title       String
  description String

  // Evidence
  evidenceJson Json     // Linked facts, logs, screenshots
  mediaUrls    String[] // Portfolio artifacts

  // Metadata
  occurredAt  DateTime
  courseId    String?
  isPublic    Boolean  @default(false) // Can be shared with teachers

  createdAt   DateTime @default(now())

  @@index([userId, recordType])
  @@index([userId, occurredAt])
}

// Recommendation cache
model LearningRecommendation {
  id          String   @id @default(cuid())
  userId      String

  recType     String   // immediate, weekly, challenge
  title       String
  description String
  reasoning   String   // Why this is recommended

  // Action
  actionType  String   // practice, review, explore, challenge
  targetModule String? // Which component to use
  estimatedTime Int    // Minutes

  // Status
  isCompleted Boolean  @default(false)
  completedAt DateTime?

  // Feedback
  wasHelpful  Boolean?

  createdAt   DateTime @default(now())
  expiresAt   DateTime

  @@index([userId, recType])
  @@index([userId, isCompleted])
}
```

### 5.2 Recommendation Engine (v1 - Simple)

**File**: `src/lib/data-governance/recommendation-engine.ts`

```typescript
interface Recommendations {
  immediate: LearningRecommendation[];  // Do now (based on current weakness)
  weekly: LearningRecommendation[];     // This week's path
  challenges: LearningRecommendation[]; // Optional stretch goals
}

function generateRecommendations(userId: string): Recommendations {
  const profile = getProfileSummary(userId);
  const weaknesses = profile.weaknesses;
  const recentActivity = getRecentActivity(userId, 7);

  const recommendations: Recommendations = {
    immediate: [],
    weekly: [],
    challenges: [],
  };

  // Immediate: Target top weakness with a focused exercise
  if (weaknesses.length > 0) {
    recommendations.immediate.push({
      recType: 'immediate',
      title: `强化练习：${weaknesses[0]}`,
      description: `根据你的学习画像，建议重点练习${weaknesses[0]}相关题目`,
      actionType: 'practice',
      targetModule: mapWeaknessToModule(weaknesses[0]),
      estimatedTime: 15,
    });
  }

  // Weekly: Build a path through multiple related concepts
  recommendations.weekly.push({
    recType: 'weekly',
    title: '本周能力提升计划',
    description: generateWeeklyPathDescription(weaknesses, recentActivity),
    actionType: 'review',
    estimatedTime: 60,
  });

  // Challenges: Stretch goals based on strengths
  const strengths = profile.strengths;
  if (strengths.length > 0) {
    recommendations.challenges.push({
      recType: 'challenge',
      title: `进阶挑战：${strengths[0]}应用`,
      description: `运用你的${strengths[0]}优势，完成跨域综合题`,
      actionType: 'challenge',
      estimatedTime: 30,
    });
  }

  return recommendations;
}
```

### 5.3 Growth Portfolio Page

**File**: `src/app/profile/portfolio/page.tsx`

Sections:
1. **Featured Works**: Best simulations, best prompt designs
2. **Improvement Timeline**: Remediation cases and their outcomes
3. **AI Collaboration Log**: Quality prompt interactions
4. **Ethics Journey**: Violations and resolutions (learning moments)
5. **Achievement Showcase**: Milestones and badges

---

## 6. Implementation Phases & Priorities

### Phase 1: Foundation (Week 1-2)
- [ ] Create data-governance library structure
- [ ] Implement event protocol and types
- [ ] Extend schema with EventDictionary, LearningEventBatch, LearningFact
- [ ] Build Redis event buffer layer
- [ ] Extend events API with priority marking

### Phase 2: Competency Engine (Week 3-4)
- [ ] Implement competency model and mappings
- [ ] Create snapshot tables (StudentCompetencySnapshot, StudentProfileSummary, ClassCompetencySnapshot)
- [ ] Build competency calculation engine
- [ ] Set up BullMQ worker service with 3 queues
- [ ] Implement Konling context injection API

### Phase 3: Risk & Analytics (Week 5-6)
- [ ] Implement risk detection engine (5 risk types)
- [ ] Build teacher dashboard APIs
- [ ] Create analytics v2 pages
- [ ] Enhanced session review features

### Phase 4: Portfolio & Recommendations (Week 7-8)
- [ ] Growth records system
- [ ] Recommendation engine v1
- [ ] Portfolio page
- [ ] Data migration scripts
- [ ] Monitoring and alerting

---

## 7. Worker Deployment

### Development
```bash
# Run worker in dev mode (with ts-node)
npm run worker:dev

# This executes: ts-node scripts/workers/data-governance-worker.ts
```

### Production (PM2)
```bash
# Add to ecosystem.config.js or pm2 config
npm run worker:prod

# This executes: node dist/scripts/workers/data-governance-worker.js
```

### Environment Variables
```bash
# Worker configuration
WORKER_ENABLED=true
WORKER_LOG_LEVEL=info
WORKER_CONCURRENCY=2

# Queue scheduling
EVENT_INGESTION_INTERVAL=300000      # 5 minutes
STUDENT_SNAPSHOT_INTERVAL=600000     # 10 minutes
CLASS_SNAPSHOT_INTERVAL=900000       # 15 minutes
```

---

## 8. Monitoring & Observability

### Metrics to Track
- Worker queue depths
- Snapshot generation latency
- API response times (p95/p99)
- Data freshness (time since last snapshot)
- Error rates by queue

### Alerts
- Queue depth > 1000 (backlog alert)
- Snapshot latency > 30 minutes (stale data alert)
- Worker crash/restart
- Redis connection loss > 1 minute

---

## 9. Migration Strategy

### Data Migration Scripts

**File**: `scripts/migrations/001-migrate-to-learning-facts.ts`
```typescript
// Migrate existing data to LearningFact format
// - SimulationLog → LearningFact (factType: 'simulation')
// - UserAnswer → LearningFact (factType: 'question')
// - AIIntervention → LearningFact (factType: 'ai_intervention')
// - PromptAssessment → LearningFact (factType: 'prompt_design')
```

**File**: `scripts/migrations/002-backfill-snapshots.ts`
```typescript
// Generate initial competency snapshots from historical data
// Run once after LearningFacts migration
```

**File**: `scripts/migrations/003-seed-event-dictionary.ts`
```typescript
// Seed EventDictionary with all known event types
```

### Migration Order
1. Deploy schema changes (new tables)
2. Run migration scripts (backfill data)
3. Deploy API changes
4. Start workers
5. Verify data consistency

---

## 10. Testing Strategy

### Unit Tests
- Competency calculation algorithms
- Risk detection rules
- Event transformation logic

### Integration Tests
- Worker job processing
- API endpoints
- Redis buffer behavior

### Load Tests
- Event ingestion at scale (1000 events/sec)
- Snapshot generation with 1000+ students

---

## Appendix: File Structure

```
src/
├── lib/data-governance/
│   ├── event-protocol.ts          # Core event types
│   ├── event-types.ts             # Event registry
│   ├── event-buffer.ts            # Redis buffer implementation
│   ├── competency-model.ts        # 6-dimension model
│   ├── competency-engine.ts       # Calculation engine
│   ├── risk-detector.ts           # Risk detection rules
│   ├── recommendation-engine.ts   # Simple recommendations
│   └── index.ts                   # Public exports
├── app/api/ai/konling-context/
│   └── route.ts                   # AI assistant context API
├── app/api/teacher/classes/[classId]/
│   ├── dashboard/route.ts         # Teacher dashboard
│   ├── risk-students/route.ts     # Risk students list
│   └── heatmap/route.ts           # Competency heatmap
└── app/api/user/competency-snapshot/
    └── route.ts                   # Student snapshot API

scripts/
├── workers/
│   ├── data-governance-worker.ts  # Main worker service
│   ├── scheduler.ts               # Job scheduler
│   └── types.ts                   # Worker types
└── migrations/
    ├── 001-migrate-to-learning-facts.ts
    ├── 002-backfill-snapshots.ts
    └── 003-seed-event-dictionary.ts
```

---

**Next Steps**: After approval of this design, proceed to implementation planning via the `writing-plans` skill.
