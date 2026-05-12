# AI-OBE Data Governance Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a four-layer data governance architecture with unified event protocol, Redis buffering, competency snapshots, and BullMQ workers for the AI-OBE platform.

**Architecture:** Core events go directly to PostgreSQL; secondary events buffer in Redis and batch-processed by workers. Competency snapshots are pre-calculated (5-15min intervals) for fast AI assistant context injection and teacher analytics.

**Tech Stack:** Next.js 14, Prisma, PostgreSQL, Redis, BullMQ, TypeScript

---

## File Structure Overview

```
# Data Governance Library
src/lib/data-governance/
├── event-protocol.ts          # Core event types and interfaces
├── event-types.ts             # Event type registry and constants
├── event-buffer.ts            # Redis buffer implementation
├── competency-model.ts        # 6-dimension competency definitions
├── competency-engine.ts       # Calculation algorithms
├── risk-detector.ts           # Risk detection rules
├── recommendation-engine.ts   # Simple recommendation logic
├── worker-client.ts           # BullMQ queue clients
└── index.ts                   # Public exports

# API Routes
src/app/api/interactive/events/
└── route.ts                   # Extended with priority support
src/app/api/ai/konling-context/
└── route.ts                   # AI assistant context injection
src/app/api/user/competency-snapshot/
└── route.ts                   # Student snapshot API
src/app/api/teacher/classes/[classId]/
├── dashboard/
│   └── route.ts               # Teacher dashboard data
├── risk-students/
│   └── route.ts               # Risk students list
└── heatmap/
    └── route.ts               # Competency heatmap

# Workers (separate Node.js service)
scripts/workers/
├── data-governance-worker.ts  # Main worker service
├── scheduler.ts               # Job scheduler setup
└── types.ts                   # Worker type definitions

# Migrations
scripts/migrations/
├── 001-seed-event-dictionary.ts
├── 002-migrate-to-learning-facts.ts
└── 003-backfill-snapshots.ts

# Prisma Schema (modifications)
prisma/schema.prisma           # Add new tables

# Package.json additions
package.json                   # Add bullmq, ioredis (already have ioredis)
```

---

## Phase 1: Foundation - Event Protocol & Schema

### Task 1: Add Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install BullMQ**

```bash
npm install bullmq
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add bullmq for worker queues"
```

---

### Task 2: Add Environment Variables

**Files:**
- Modify: `.env` (or `.env.local`)

- [ ] **Step 1: Add worker environment variables**

```bash
# Worker Configuration
WORKER_ENABLED=true
WORKER_LOG_LEVEL=info
WORKER_CONCURRENCY=2

# Queue Scheduling Intervals (milliseconds)
EVENT_INGESTION_INTERVAL=300000      # 5 minutes
STUDENT_SNAPSHOT_INTERVAL=600000     # 10 minutes
CLASS_SNAPSHOT_INTERVAL=900000       # 15 minutes

# Note: Redis already configured via REDIS_URL
```

- [ ] **Step 2: Commit**

```bash
git add .env
git commit -m "chore: add data governance worker environment variables"
```

---

### Task 3: Create Event Protocol Types

**Files:**
- Create: `src/lib/data-governance/event-protocol.ts`

- [ ] **Step 1: Write the types file**

```typescript
/**
 * Unified Event Protocol for AI-OBE Platform
 *
 * Defines the standard event structure for all learning analytics.
 * All events must conform to this interface.
 */

export type EventPriority = 'core' | 'secondary';

export type UserRole = 'student' | 'teacher' | 'admin';

export type EventSource = 'web' | 'system' | 'ai';

export type PageType =
  | 'theory'
  | 'practice'
  | 'workspace'
  | 'quiz'
  | 'reflection'
  | 'simulation'
  | 'dashboard'
  | 'classroom';

/**
 * Unified Learning Event Structure
 */
export interface LearningEvent {
  // Identity
  eventId: string;
  occurredAt: string; // ISO 8601

  // Actor Context
  userId: string;
  role: UserRole;
  classId?: string;

  // Learning Context
  courseId?: string;
  lessonId?: string;
  sessionId?: string;
  pagePath: string;
  pageType: PageType;

  // Action Context
  moduleId?: string;
  actionType: string;
  targetType?: string;
  targetId?: string;

  // Payload
  payload: Record<string, unknown>;

  // Computed Metrics (added by ingestion layer)
  derivedMetrics?: Record<string, number | string | boolean>;

  // Metadata
  source: EventSource;
  priority: EventPriority;
  clientTimestamp?: number;
}

/**
 * Event with validation status
 */
export interface ValidatedEvent {
  event: LearningEvent;
  isValid: boolean;
  errors?: string[];
}

/**
 * Event batch for bulk processing
 */
export interface EventBatch {
  batchId: string;
  events: LearningEvent[];
  createdAt: string;
  priority: EventPriority;
}

/**
 * Convert client event format to LearningEvent
 */
export function toLearningEvent(
  clientEvent: Record<string, unknown>,
  context: {
    userId: string;
    role: UserRole;
    pagePath: string;
    pageType: PageType;
  }
): LearningEvent {
  const now = new Date().toISOString();

  return {
    eventId: generateEventId(),
    occurredAt: now,
    userId: context.userId,
    role: context.role,
    classId: clientEvent.classId as string | undefined,
    courseId: clientEvent.courseId as string | undefined,
    lessonId: clientEvent.lessonId as string | undefined,
    sessionId: clientEvent.sessionId as string | undefined,
    pagePath: context.pagePath,
    pageType: context.pageType,
    moduleId: clientEvent.moduleId as string | undefined,
    actionType: (clientEvent.actionType as string) || (clientEvent.type as string) || 'unknown',
    targetType: clientEvent.targetType as string | undefined,
    targetId: clientEvent.targetId as string | undefined,
    payload: (clientEvent.payload as Record<string, unknown>) ||
             (clientEvent.data as Record<string, unknown>) ||
             {},
    source: (clientEvent.source as EventSource) || 'web',
    priority: (clientEvent.priority as EventPriority) || 'secondary',
    clientTimestamp: clientEvent.timestamp as number | undefined,
  };
}

/**
 * Generate ULID-like event ID (sortable)
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Validate event structure
 */
export function validateEvent(event: unknown): ValidatedEvent {
  const errors: string[] = [];

  if (!event || typeof event !== 'object') {
    return { event: event as LearningEvent, isValid: false, errors: ['Event must be an object'] };
  }

  const e = event as Record<string, unknown>;

  // Required fields
  if (!e.eventId || typeof e.eventId !== 'string') {
    errors.push('eventId is required and must be a string');
  }

  if (!e.occurredAt || typeof e.occurredAt !== 'string') {
    errors.push('occurredAt is required and must be a string');
  }

  if (!e.userId || typeof e.userId !== 'string') {
    errors.push('userId is required and must be a string');
  }

  if (!e.pagePath || typeof e.pagePath !== 'string') {
    errors.push('pagePath is required and must be a string');
  }

  if (!e.actionType || typeof e.actionType !== 'string') {
    errors.push('actionType is required and must be a string');
  }

  // Validate priority
  const validPriorities: EventPriority[] = ['core', 'secondary'];
  if (!validPriorities.includes(e.priority as EventPriority)) {
    errors.push('priority must be "core" or "secondary"');
  }

  return {
    event: e as LearningEvent,
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data-governance/event-protocol.ts
git commit -m "feat(data-governance): add unified event protocol types"
```

---

### Task 3: Create Event Type Registry

**Files:**
- Create: `src/lib/data-governance/event-types.ts`

- [ ] **Step 1: Write the event types registry**

```typescript
/**
 * Event Type Registry
 *
 * Central registry of all event types with their metadata.
 * This is the single source of truth for event classification.
 */

import type { EventPriority } from './event-protocol';

export interface EventTypeMetadata {
  eventType: string;
  category: EventCategory;
  priority: EventPriority;
  description: string;
  schema?: Record<string, unknown>; // JSON Schema for payload validation
  competencyMapping?: Record<string, number>; // Which competencies this affects
}

export type EventCategory =
  | 'assessment'
  | 'simulation'
  | 'ai'
  | 'design'
  | 'ethics'
  | 'navigation'
  | 'interaction';

// ============================================
// CORE EVENTS - Must be reliably persisted
// ============================================

export const CORE_EVENTS: EventTypeMetadata[] = [
  {
    eventType: 'answer_submit',
    category: 'assessment',
    priority: 'core',
    description: '学生提交题目答案',
    schema: {
      type: 'object',
      properties: {
        questionId: { type: 'string' },
        answer: { type: 'string' },
        isCorrect: { type: 'boolean' },
        timeSpent: { type: 'number' },
      },
      required: ['questionId', 'answer'],
    },
    competencyMapping: {
      controlModeling: 0.8,
      crossDomainTransfer: 0.5,
    },
  },
  {
    eventType: 'assessment_complete',
    category: 'assessment',
    priority: 'core',
    description: '测评完成，包含总分和分项得分',
    schema: {
      type: 'object',
      properties: {
        assessmentId: { type: 'string' },
        totalScore: { type: 'number' },
        correctCount: { type: 'number' },
        totalCount: { type: 'number' },
        timeSpent: { type: 'number' },
      },
      required: ['assessmentId', 'totalScore'],
    },
    competencyMapping: {
      controlModeling: 1.0,
      selfDirectedLearning: 0.3,
    },
  },
  {
    eventType: 'simulation_finish',
    category: 'simulation',
    priority: 'core',
    description: '仿真任务完成',
    schema: {
      type: 'object',
      properties: {
        simulationId: { type: 'string' },
        taskType: { type: 'string' },
        score: { type: 'number' },
        metrics: { type: 'object' },
        duration: { type: 'number' },
      },
      required: ['simulationId', 'score'],
    },
    competencyMapping: {
      parameterDesign: 1.0,
      engineeringDecision: 0.6,
      selfDirectedLearning: 0.4,
    },
  },
  {
    eventType: 'ai_intervention_complete',
    category: 'ai',
    priority: 'core',
    description: 'AI介入完成，记录结果和有效性',
    schema: {
      type: 'object',
      properties: {
        interventionId: { type: 'string' },
        triggerType: { type: 'string' },
        wasHelpful: { type: 'boolean' },
        followUpAction: { type: 'string' },
      },
    },
    competencyMapping: {
      inquiryReflection: 0.7,
      selfDirectedLearning: 0.5,
    },
  },
  {
    eventType: 'prompt_assessed',
    category: 'ai',
    priority: 'core',
    description: '提示词被AI评价',
    schema: {
      type: 'object',
      properties: {
        promptId: { type: 'string' },
        overallScore: { type: 'number' },
        completenessScore: { type: 'number' },
        precisionScore: { type: 'number' },
        suggestions: { type: 'array' },
      },
    },
    competencyMapping: {
      inquiryReflection: 1.0,
      selfDirectedLearning: 0.3,
    },
  },
  {
    eventType: 'design_session_complete',
    category: 'design',
    priority: 'core',
    description: '设计会话完成',
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        taskType: { type: 'string' },
        consistencyScore: { type: 'number' },
        finalResult: { type: 'object' },
      },
    },
    competencyMapping: {
      controlModeling: 0.8,
      parameterDesign: 0.8,
      engineeringDecision: 0.5,
    },
  },
  {
    eventType: 'ethical_violation',
    category: 'ethics',
    priority: 'core',
    description: '伦理违规事件',
    schema: {
      type: 'object',
      properties: {
        violationType: { type: 'string' },
        thresholdValue: { type: 'number' },
        actualValue: { type: 'number' },
        context: { type: 'object' },
      },
    },
    competencyMapping: {
      engineeringDecision: -0.8,
    },
  },
  {
    eventType: 'ethical_resolved',
    category: 'ethics',
    priority: 'core',
    description: '伦理违规已整改',
    schema: {
      type: 'object',
      properties: {
        violationId: { type: 'string' },
        resolution: { type: 'string' },
        studentReflection: { type: 'string' },
      },
    },
    competencyMapping: {
      engineeringDecision: 0.5,
      selfDirectedLearning: 0.3,
    },
  },
];

// ============================================
// SECONDARY EVENTS - Can be buffered/dropped
// ============================================

export const SECONDARY_EVENTS: EventTypeMetadata[] = [
  {
    eventType: 'page_view',
    category: 'navigation',
    priority: 'secondary',
    description: '页面浏览',
    schema: {
      type: 'object',
      properties: {
        referrer: { type: 'string' },
        timeOnPage: { type: 'number' },
      },
    },
  },
  {
    eventType: 'step_enter',
    category: 'navigation',
    priority: 'secondary',
    description: '进入学习步骤',
  },
  {
    eventType: 'step_leave',
    category: 'navigation',
    priority: 'secondary',
    description: '离开学习步骤',
    schema: {
      type: 'object',
      properties: {
        timeSpent: { type: 'number' },
        completionStatus: { type: 'string' },
      },
    },
  },
  {
    eventType: 'knowledge_card_open',
    category: 'interaction',
    priority: 'secondary',
    description: '打开知识卡片',
  },
  {
    eventType: 'param_change',
    category: 'interaction',
    priority: 'secondary',
    description: '参数变更（中间状态）',
    schema: {
      type: 'object',
      properties: {
        parameterName: { type: 'string' },
        oldValue: { type: 'number' },
        newValue: { type: 'number' },
      },
    },
  },
  {
    eventType: 'hint_request',
    category: 'interaction',
    priority: 'secondary',
    description: '请求提示',
    schema: {
      type: 'object',
      properties: {
        hintType: { type: 'string' },
        context: { type: 'string' },
      },
    },
  },
];

// ============================================
// Registry Operations
// ============================================

export const ALL_EVENTS: EventTypeMetadata[] = [...CORE_EVENTS, ...SECONDARY_EVENTS];

const EVENT_TYPE_MAP = new Map(ALL_EVENTS.map(e => [e.eventType, e]));

/**
 * Get metadata for an event type
 */
export function getEventMetadata(eventType: string): EventTypeMetadata | undefined {
  return EVENT_TYPE_MAP.get(eventType);
}

/**
 * Check if an event type is a core event
 */
export function isCoreEvent(eventType: string): boolean {
  const meta = EVENT_TYPE_MAP.get(eventType);
  return meta?.priority === 'core';
}

/**
 * Check if an event type is a secondary event
 */
export function isSecondaryEvent(eventType: string): boolean {
  const meta = EVENT_TYPE_MAP.get(eventType);
  return meta?.priority === 'secondary';
}

/**
 * Get competency mapping for an event type
 */
export function getCompetencyMapping(eventType: string): Record<string, number> | undefined {
  return EVENT_TYPE_MAP.get(eventType)?.competencyMapping;
}

/**
 * Get all core event types
 */
export function getCoreEventTypes(): string[] {
  return CORE_EVENTS.map(e => e.eventType);
}

/**
 * Get all secondary event types
 */
export function getSecondaryEventTypes(): string[] {
  return SECONDARY_EVENTS.map(e => e.eventType);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data-governance/event-types.ts
git commit -m "feat(data-governance): add event type registry with core/secondary classification"
```

---

### Task 4: Create Redis Event Buffer

**Files:**
- Create: `src/lib/data-governance/event-buffer.ts`

- [ ] **Step 1: Write the Redis buffer implementation**

```typescript
/**
 * Redis Event Buffer
 *
 * Buffers secondary events in Redis for batch processing.
 * Core events bypass this and go directly to PostgreSQL.
 */

import { redisClient } from '@/lib/redis-client';
import type { LearningEvent, EventPriority } from './event-protocol';
import { isCoreEvent, isSecondaryEvent } from './event-types';

// Redis key patterns
const REDIS_KEYS = {
  secondaryBuffer: (date: string) => `event:buffer:secondary:${date}`,
  dailyStats: (date: string) => `event:stats:daily:${date}`,
  userSequence: (userId: string) => `event:sequence:${userId}`,
};

export interface BufferStats {
  buffered: number;
  dropped: number;
  lastBufferTime: number;
}

const stats: BufferStats = {
  buffered: 0,
  dropped: 0,
  lastBufferTime: Date.now(),
};

/**
 * Route event to appropriate destination based on priority
 */
export async function routeEvent(event: LearningEvent): Promise<{
  destination: 'postgresql' | 'redis' | 'dropped';
  reason?: string;
}> {
  // Check if Redis is available
  if (!redisClient.isReady()) {
    // Redis unavailable: core events still go to DB, secondary dropped
    if (isCoreEvent(event.actionType)) {
      return { destination: 'postgresql' };
    }
    stats.dropped++;
    return { destination: 'dropped', reason: 'redis_unavailable' };
  }

  // Route based on event type
  if (isCoreEvent(event.actionType)) {
    return { destination: 'postgresql' };
  }

  if (isSecondaryEvent(event.actionType)) {
    const success = await bufferSecondaryEvent(event);
    return {
      destination: success ? 'redis' : 'dropped',
      reason: success ? undefined : 'buffer_full',
    };
  }

  // Unknown event type: treat as secondary (safer)
  const success = await bufferSecondaryEvent(event);
  return {
    destination: success ? 'redis' : 'dropped',
    reason: success ? undefined : 'buffer_full',
  };
}

/**
 * Buffer a secondary event in Redis
 */
export async function bufferSecondaryEvent(event: LearningEvent): Promise<boolean> {
  if (!redisClient.isReady()) {
    return false;
  }

  const client = redisClient.getClient();
  if (!client) return false;

  try {
    const date = new Date().toISOString().split('T')[0];
    const key = REDIS_KEYS.secondaryBuffer(date);

    // Compress event to JSON string
    const eventJson = JSON.stringify(event);

    // Push to list with max length protection (keep last 10000)
    await client.lpush(key, eventJson);
    await client.ltrim(key, 0, 9999);

    // Set expiration (7 days)
    await client.expire(key, 7 * 24 * 60 * 60);

    // Update stats
    await client.hincrby(REDIS_KEYS.dailyStats(date), 'buffered', 1);
    await client.expire(REDIS_KEYS.dailyStats(date), 7 * 24 * 60 * 60);

    stats.buffered++;
    stats.lastBufferTime = Date.now();

    return true;
  } catch (error) {
    console.error('[EventBuffer] Failed to buffer event:', error);
    return false;
  }
}

/**
 * Fetch secondary events from buffer for processing
 */
export async function fetchSecondaryEvents(
  date: string,
  limit: number = 100
): Promise<LearningEvent[]> {
  if (!redisClient.isReady()) {
    return [];
  }

  const client = redisClient.getClient();
  if (!client) return [];

  try {
    const key = REDIS_KEYS.secondaryBuffer(date);

    // Pop events from the end (oldest first)
    const eventJsons: string[] = [];
    for (let i = 0; i < limit; i++) {
      const eventJson = await client.rpop(key);
      if (!eventJson) break;
      eventJsons.push(eventJson);
    }

    // Parse events
    const events: LearningEvent[] = [];
    for (const json of eventJsons) {
      try {
        const event = JSON.parse(json) as LearningEvent;
        events.push(event);
      } catch {
        // Skip invalid JSON
      }
    }

    return events;
  } catch (error) {
    console.error('[EventBuffer] Failed to fetch events:', error);
    return [];
  }
}

/**
 * Get count of buffered events for a date
 */
export async function getBufferedEventCount(date: string): Promise<number> {
  if (!redisClient.isReady()) {
    return 0;
  }

  const client = redisClient.getClient();
  if (!client) return 0;

  try {
    const key = REDIS_KEYS.secondaryBuffer(date);
    return await client.llen(key);
  } catch {
    return 0;
  }
}

/**
 * Get buffer statistics
 */
export function getBufferStats(): BufferStats {
  return { ...stats };
}

/**
 * Get daily statistics from Redis
 */
export async function getDailyStats(date: string): Promise<{
  buffered: number;
  processed: number;
}> {
  if (!redisClient.isReady()) {
    return { buffered: 0, processed: 0 };
  }

  const client = redisClient.getClient();
  if (!client) return { buffered: 0, processed: 0 };

  try {
    const stats = await client.hgetall(REDIS_KEYS.dailyStats(date));
    return {
      buffered: parseInt(stats.buffered || '0', 10),
      processed: parseInt(stats.processed || '0', 10),
    };
  } catch {
    return { buffered: 0, processed: 0 };
  }
}

/**
 * Mark events as processed in stats
 */
export async function markEventsProcessed(count: number): Promise<void> {
  if (!redisClient.isReady()) return;

  const client = redisClient.getClient();
  if (!client) return;

  const date = new Date().toISOString().split('T')[0];
  try {
    await client.hincrby(REDIS_KEYS.dailyStats(date), 'processed', count);
  } catch (error) {
    console.error('[EventBuffer] Failed to mark processed:', error);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data-governance/event-buffer.ts
git commit -m "feat(data-governance): add Redis event buffer for secondary events"
```

---

### Task 5: Extend Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new tables to schema.prisma (append to end)**

```prisma
// ========== Data Governance Tables ==========

// Event batch storage for secondary events
model LearningEventBatch {
  id          String    @id @default(cuid())
  batchDate   DateTime  @db.Date
  events      Json      // Compressed array of LearningEvent
  eventCount  Int
  processedAt DateTime?
  createdAt   DateTime  @default(now())

  @@index([batchDate])
  @@index([processedAt])
}

// Event type metadata dictionary
model EventDictionary {
  eventType         String   @id
  category          String
  priority          String
  description       String?
  schema            Json?    // JSON Schema for payload
  competencyMapping Json?    // Which competencies this event contributes to
  createdAt         DateTime @default(now())
}

// Unified learning facts (derived from events)
model LearningFact {
  id              String   @id @default(cuid())
  userId          String
  factType        String   // simulation, question, ai_intervention, prompt_design, ethical
  moduleId        String?
  sessionId       String?

  startedAt       DateTime
  finishedAt      DateTime?

  outcome         String   // success, partial, failure, abandoned
  score           Float?
  timeSpent       Int?     // Seconds

  // Competency contribution (-1 to 1 per dimension)
  competencyContribution Json

  // Source references
  sourceEventId   String?
  sourceLogId     String?

  // Context
  courseId        String?
  lessonId        String?

  createdAt       DateTime @default(now())

  @@index([userId, factType])
  @@index([userId, startedAt])
  @@index([sessionId])
  @@index([factType, startedAt])
}

// Student competency snapshot
model StudentCompetencySnapshot {
  id                  String   @id @default(cuid())
  userId              String
  snapshotAt          DateTime

  // Six-dimensional competency vector
  competencyVector    Json

  // Evidence summary
  evidenceSummary     Json

  // Risk flags
  riskFlags           Json

  // Learning trajectory
  trajectoryVector    Json?

  // Metadata
  calculationVersion  String   @default("v1")
  factCount           Int

  @@index([userId, snapshotAt])
  @@index([snapshotAt])
}

// Optimized profile summary for AI assistant
model StudentProfileSummary {
  userId                 String   @id
  updatedAt              DateTime @updatedAt

  overallLevel           String   // 优秀/良好/中等偏上/需关注
  overallScore           Float

  strengthsJson          Json     // ['动态响应分析', '仿真调参']
  weaknessesJson         Json     // ['跨域解释一致性']

  recentTrend            String   // 近两周稳步提升/波动/停滞
  trendDirection         String   // up/down/stable

  riskFlagsJson          Json     // ['遇到复杂任务倾向直接请求AI']
  riskLevel              String   // none/low/medium/high

  recommendedScaffolding String

  recentActivityJson     Json

  cacheExpiresAt         DateTime

  @@index([updatedAt])
  @@index([riskLevel])
}

// Class-level competency aggregation
model ClassCompetencySnapshot {
  id                String   @id @default(cuid())
  classId           String
  snapshotAt        DateTime

  aggregateJson     Json     // Mean/stdev per dimension
  distributionJson  Json     // Score distribution
  trendJson         Json     // Change from previous
  riskSummaryJson   Json

  levelDistribution Json     // { excellent: 5, good: 10, ... }

  activeStudentCount Int
  totalStudentCount  Int

  @@index([classId, snapshotAt])
}

// Student risk flags
model StudentRiskFlag {
  id            String    @id @default(cuid())
  userId        String
  flagType      String    // participation, stagnation, ai_misuse, constraint, cross_domain
  severity      String    // low, medium, high
  description   String

  evidenceJson  Json
  triggeredAt   DateTime

  isResolved    Boolean   @default(false)
  resolvedAt    DateTime?
  resolutionNote String?

  createdAt     DateTime  @default(now())

  @@index([userId, flagType])
  @@index([userId, isResolved])
  @@index([flagType, severity])
}

// Growth records for portfolio
model GrowthRecord {
  id          String   @id @default(cuid())
  userId      String

  recordType  String   // milestone, breakthrough, remediation, reflection, portfolio
  title       String
  description String

  evidenceJson Json
  mediaUrls    String[]

  occurredAt  DateTime
  courseId    String?
  isPublic    Boolean  @default(false)

  createdAt   DateTime @default(now())

  @@index([userId, recordType])
  @@index([userId, occurredAt])
}

// Learning recommendations
model LearningRecommendation {
  id          String   @id @default(cuid())
  userId      String

  recType     String   // immediate, weekly, challenge
  title       String
  description String
  reasoning   String

  actionType   String
  targetModule String?
  estimatedTime Int

  isCompleted Boolean   @default(false)
  completedAt DateTime?
  wasHelpful  Boolean?

  createdAt   DateTime  @default(now())
  expiresAt   DateTime

  @@index([userId, recType])
  @@index([userId, isCompleted])
}
```

- [ ] **Step 2: Generate Prisma client**

```bash
npx prisma generate
```

Expected: Prisma client generated successfully

- [ ] **Step 3: Push schema to database (dev)**

```bash
npx prisma db push
```

Expected: Database schema updated

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(data-governance): add schema for snapshots, facts, and risk flags"
```

---

### Task 6: Update Events API with Priority

**Files:**
- Modify: `src/app/api/interactive/events/route.ts`

- [ ] **Step 1: Add priority-based routing to POST handler**

Add imports at top:
```typescript
import { toLearningEvent, validateEvent, type LearningEvent } from '@/lib/data-governance/event-protocol';
import { routeEvent } from '@/lib/data-governance/event-buffer';
import { isCoreEvent } from '@/lib/data-governance/event-types';
```

Modify the POST handler to route events based on priority:

```typescript
// Inside POST handler, after validation, replace the queue insertion with:

// Route events based on priority
const coreEvents: LearningEvent[] = [];
const routingResults = [];

for (const eventData of validEvents) {
  const learningEvent = toLearningEvent(
    { ...eventData.event, priority: isCoreEvent(eventData.event.type) ? 'core' : 'secondary' },
    {
      userId: session.user.id,
      role: (session.user.role?.toLowerCase() as 'student' | 'teacher' | 'admin') || 'student',
      pagePath: eventData.event.pagePath || '/unknown',
      pageType: (eventData.event.pageType as PageType) || 'dashboard',
    }
  );

  const result = await routeEvent(learningEvent);
  routingResults.push({ eventType: learningEvent.actionType, ...result });

  // Core events still go through existing EventQueue for now
  if (result.destination === 'postgresql') {
    coreEvents.push(learningEvent);
  }
}

// Existing queue for core events (will be migrated later)
if (coreEvents.length > 0) {
  const queueEvents = coreEvents.map(event => ({
    userId: event.userId,
    resourceId: null, // Will be set based on context
    resourceKey: event.moduleId || event.actionType,
    sessionId: event.sessionId,
    lessonKey: event.lessonId,
    stepId: event.targetId,
    actorRole: event.role,
    attemptKey: null,
    eventType: event.actionType,
    eventData: event.payload,
    clientEventAt: new Date(event.occurredAt),
  }));

  eventQueue.enqueueBatch(queueEvents);
}

// Update response
return NextResponse.json({
  success: true,
  count: validEvents.length,
  degraded: degradedEvents.length,
  routing: routingResults.reduce((acc, r) => {
    acc[r.destination] = (acc[r.destination] || 0) + 1;
    return acc;
  }, {} as Record<string, number>),
  pending: eventQueue.getStats().pending,
});
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/interactive/events/route.ts
git commit -m "feat(data-governance): extend events API with priority-based routing"
```

---

### Task 7: Create Competency Model

**Files:**
- Create: `src/lib/data-governance/competency-model.ts`

- [ ] **Step 1: Write competency model definitions**

```typescript
/**
 * Six-Dimensional Competency Model
 *
 * Defines the competency framework for student learning analytics.
 */

// Six primary competency dimensions
export interface CompetencyVector {
  controlModeling: CompetencyScore;      // 控制建模与分析能力
  parameterDesign: CompetencyScore;      // 参数设计与调优能力
  crossDomainTransfer: CompetencyScore;  // 跨域迁移与联动能力
  engineeringDecision: CompetencyScore;  // 工程决策与约束意识
  inquiryReflection: CompetencyScore;    // 探究反思与提示词设计能力
  selfDirectedLearning: CompetencyScore; // 自主学习进展能力
}

export interface CompetencyScore {
  score: number;        // 0-100 normalized
  trend: 'up' | 'stable' | 'down';
  confidence: number;   // 0-1 based on evidence
  evidenceCount: number;
  lastUpdated: string;
}

export type TrendDirection = 'up' | 'stable' | 'down';

export interface TrendVector {
  controlModeling: TrendDirection;
  parameterDesign: TrendDirection;
  crossDomainTransfer: TrendDirection;
  engineeringDecision: TrendDirection;
  inquiryReflection: TrendDirection;
  selfDirectedLearning: TrendDirection;
}

// Secondary metric mappings
export const COMPETENCY_MAPPINGS = {
  simulation: {
    metricAchievement: 'parameterDesign',
    iterationEfficiency: 'parameterDesign',
    retryQuality: 'selfDirectedLearning',
    constraintViolationRate: 'engineeringDecision',
    optimizationConvergence: 'parameterDesign',
    avgError: 'parameterDesign',
    maxRudderRate: 'engineeringDecision',
    energyConsumption: 'engineeringDecision',
    settlingTime: 'controlModeling',
  },
  assessment: {
    correctRate: 'controlModeling',
    crossDomainMigration: 'crossDomainTransfer',
    weakPointRecovery: 'selfDirectedLearning',
    conceptApplication: 'controlModeling',
    analysisDepth: 'controlModeling',
  },
  promptDesign: {
    completenessScore: 'inquiryReflection',
    precisionScore: 'inquiryReflection',
    structurizationScore: 'inquiryReflection',
    executabilityScore: 'parameterDesign',
    iterationDepth: 'selfDirectedLearning',
    overallScore: 'inquiryReflection',
  },
  aiInteraction: {
    appropriateUse: 'inquiryReflection',
    followUpQuality: 'selfDirectedLearning',
    misuseRecovery: 'engineeringDecision',
    wasHelpful: 'inquiryReflection',
  },
  ethics: {
    violationRate: 'engineeringDecision',
    remediationQuality: 'engineeringDecision',
    proactiveAwareness: 'engineeringDecision',
    isResolved: 'selfDirectedLearning',
  },
  design: {
    consistencyScore: 'parameterDesign',
    goalBehaviorAlignment: 'controlModeling',
    behaviorResultCoherence: 'crossDomainTransfer',
    iterationCount: 'selfDirectedLearning',
  },
} as const;

export type CompetencyDimension = keyof CompetencyVector;

export const COMPETENCY_DIMENSIONS: CompetencyDimension[] = [
  'controlModeling',
  'parameterDesign',
  'crossDomainTransfer',
  'engineeringDecision',
  'inquiryReflection',
  'selfDirectedLearning',
];

// Level definitions
export const COMPETENCY_LEVELS = {
  excellent: { min: 85, label: '优秀', color: '#22c55e' },
  good: { min: 70, label: '良好', color: '#3b82f6' },
  average: { min: 55, label: '中等', color: '#f59e0b' },
  needsImprovement: { min: 40, label: '需提升', color: '#f97316' },
  atRisk: { min: 0, label: '需关注', color: '#ef4444' },
} as const;

/**
 * Get competency level from score
 */
export function getCompetencyLevel(score: number): keyof typeof COMPETENCY_LEVELS {
  if (score >= COMPETENCY_LEVELS.excellent.min) return 'excellent';
  if (score >= COMPETENCY_LEVELS.good.min) return 'good';
  if (score >= COMPETENCY_LEVELS.average.min) return 'average';
  if (score >= COMPETENCY_LEVELS.needsImprovement.min) return 'needsImprovement';
  return 'atRisk';
}

/**
 * Get Chinese label for competency dimension
 */
export function getCompetencyLabel(dimension: CompetencyDimension): string {
  const labels: Record<CompetencyDimension, string> = {
    controlModeling: '控制建模与分析',
    parameterDesign: '参数设计与调优',
    crossDomainTransfer: '跨域迁移与联动',
    engineeringDecision: '工程决策与约束',
    inquiryReflection: '探究反思与提示词',
    selfDirectedLearning: '自主学习进展',
  };
  return labels[dimension];
}

/**
 * Get description for competency dimension
 */
export function getCompetencyDescription(dimension: CompetencyDimension): string {
  const descriptions: Record<CompetencyDimension, string> = {
    controlModeling: '理解控制系统原理，建立数学模型，进行时域/频域分析',
    parameterDesign: '设计控制器参数，优化系统性能，平衡各项指标',
    crossDomainTransfer: '将知识迁移到不同领域，建立跨域联系',
    engineeringDecision: '考虑工程约束，做出合理决策，识别风险',
    inquiryReflection: '有效使用AI助手，设计优质提示词，反思学习过程',
    selfDirectedLearning: '自主规划学习，识别薄弱环节，主动寻求帮助',
  };
  return descriptions[dimension];
}

/**
 * Create empty competency vector
 */
export function createEmptyCompetencyVector(): CompetencyVector {
  const now = new Date().toISOString();
  const emptyScore: CompetencyScore = {
    score: 0,
    trend: 'stable',
    confidence: 0,
    evidenceCount: 0,
    lastUpdated: now,
  };

  return {
    controlModeling: { ...emptyScore },
    parameterDesign: { ...emptyScore },
    crossDomainTransfer: { ...emptyScore },
    engineeringDecision: { ...emptyScore },
    inquiryReflection: { ...emptyScore },
    selfDirectedLearning: { ...emptyScore },
  };
}

/**
 * Calculate overall score from competency vector
 */
export function calculateOverallScore(vector: CompetencyVector): number {
  const scores = COMPETENCY_DIMENSIONS.map(d => vector[d].score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avg * 10) / 10;
}

/**
 * Calculate trend direction from score change
 */
export function calculateTrendDirection(
  current: number,
  previous: number,
  threshold: number = 5
): TrendDirection {
  const change = current - previous;
  if (change > threshold) return 'up';
  if (change < -threshold) return 'down';
  return 'stable';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data-governance/competency-model.ts
git commit -m "feat(data-governance): add six-dimensional competency model"
```

---

### Task 8: Create Competency Engine

**Files:**
- Create: `src/lib/data-governance/competency-engine.ts`

- [ ] **Step 1: Write the competency calculation engine**

```typescript
/**
 * Competency Calculation Engine
 *
 * Calculates competency scores from learning facts.
 */

import type { LearningFact } from '@prisma/client';
import type {
  CompetencyVector,
  CompetencyScore,
  TrendVector,
  CompetencyDimension,
} from './competency-model';
import {
  COMPETENCY_DIMENSIONS,
  createEmptyCompetencyVector,
  calculateTrendDirection,
  getCompetencyLabel,
} from './competency-model';

// Time windows for calculations
export type TimeWindow = '2w' | '1m' | '3m' | 'all';

const TIME_WINDOW_DAYS: Record<TimeWindow, number> = {
  '2w': 14,
  '1m': 30,
  '3m': 90,
  'all': 365 * 10, // 10 years effectively "all"
};

/**
 * Calculate competency vector from learning facts
 */
export function calculateCompetencyVector(
  facts: LearningFact[],
  timeWindow: TimeWindow = '1m'
): CompetencyVector {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - TIME_WINDOW_DAYS[timeWindow]);

  // Filter facts by time window
  const recentFacts = facts.filter(f => f.startedAt >= cutoffDate);

  // Group facts by competency contribution
  const factsByCompetency = groupFactsByCompetency(recentFacts);

  // Calculate score for each dimension
  const vector = createEmptyCompetencyVector();
  const now = new Date().toISOString();

  for (const dimension of COMPETENCY_DIMENSIONS) {
    const dimensionFacts = factsByCompetency[dimension] || [];
    vector[dimension] = calculateDimensionScore(dimensionFacts, dimension, now);
  }

  return vector;
}

/**
 * Group facts by their primary competency contribution
 */
function groupFactsByCompetency(
  facts: LearningFact[]
): Record<CompetencyDimension, LearningFact[]> {
  const grouped: Record<string, LearningFact[]> = {};

  for (const fact of facts) {
    const contribution = fact.competencyContribution as Record<string, number> || {};

    // Find primary competency (highest contribution)
    let primaryCompetency: string | null = null;
    let maxContribution = 0;

    for (const [competency, value] of Object.entries(contribution)) {
      if (Math.abs(value) > maxContribution) {
        maxContribution = Math.abs(value);
        primaryCompetency = competency;
      }
    }

    if (primaryCompetency) {
      if (!grouped[primaryCompetency]) {
        grouped[primaryCompetency] = [];
      }
      grouped[primaryCompetency].push(fact);
    }
  }

  return grouped as Record<CompetencyDimension, LearningFact[]>;
}

/**
 * Calculate score for a single competency dimension
 */
function calculateDimensionScore(
  facts: LearningFact[],
  dimension: CompetencyDimension,
  now: string
): CompetencyScore {
  if (facts.length === 0) {
    return {
      score: 0,
      trend: 'stable',
      confidence: 0,
      evidenceCount: 0,
      lastUpdated: now,
    };
  }

  // Calculate weighted score
  let weightedSum = 0;
  let totalWeight = 0;

  for (const fact of facts) {
    const weight = calculateFactWeight(fact);
    const contribution = getFactCompetencyContribution(fact, dimension);

    weightedSum += contribution * weight;
    totalWeight += weight;
  }

  const score = totalWeight > 0
    ? Math.max(0, Math.min(100, (weightedSum / totalWeight) * 100))
    : 0;

  const confidence = calculateConfidence(facts.length, facts);

  return {
    score: Math.round(score * 10) / 10,
    trend: 'stable', // Will be updated by comparing with previous snapshot
    confidence: Math.round(confidence * 100) / 100,
    evidenceCount: facts.length,
    lastUpdated: now,
  };
}

/**
 * Calculate weight for a fact based on recency and quality
 */
function calculateFactWeight(fact: LearningFact): number {
  const now = Date.now();
  const factTime = new Date(fact.startedAt).getTime();
  const daysAgo = (now - factTime) / (1000 * 60 * 60 * 24);

  // Recency decay (half-life of 30 days)
  const recencyWeight = Math.exp(-daysAgo / 30);

  // Outcome quality
  const outcomeWeights: Record<string, number> = {
    success: 1.0,
    partial: 0.7,
    failure: 0.3,
    abandoned: 0.1,
  };
  const outcomeWeight = outcomeWeights[fact.outcome] || 0.5;

  // Time spent (more time = more weight, but capped)
  const timeWeight = Math.min((fact.timeSpent || 0) / 300, 1); // Cap at 5 minutes

  return recencyWeight * outcomeWeight * (0.5 + 0.5 * timeWeight);
}

/**
 * Get competency contribution from a fact
 */
function getFactCompetencyContribution(fact: LearningFact, dimension: CompetencyDimension): number {
  const contribution = fact.competencyContribution as Record<string, number> || {};
  return contribution[dimension] || 0;
}

/**
 * Calculate confidence based on evidence quantity and quality
 */
function calculateConfidence(evidenceCount: number, facts: LearningFact[]): number {
  // Base confidence from count (diminishing returns after 10)
  const countConfidence = Math.min(evidenceCount / 10, 1);

  // Quality factor based on score variance
  const scores = facts.map(f => f.score).filter((s): s is number => s !== null);
  if (scores.length < 2) return countConfidence * 0.5;

  const variance = calculateVariance(scores);
  const qualityFactor = Math.exp(-variance / 100); // Lower variance = higher confidence

  return countConfidence * qualityFactor;
}

/**
 * Calculate variance of an array
 */
function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate trend vector by comparing current and previous snapshots
 */
export function calculateTrendVector(
  current: CompetencyVector,
  previous: CompetencyVector
): TrendVector {
  return {
    controlModeling: calculateTrendDirection(
      current.controlModeling.score,
      previous.controlModeling.score
    ),
    parameterDesign: calculateTrendDirection(
      current.parameterDesign.score,
      previous.parameterDesign.score
    ),
    crossDomainTransfer: calculateTrendDirection(
      current.crossDomainTransfer.score,
      previous.crossDomainTransfer.score
    ),
    engineeringDecision: calculateTrendDirection(
      current.engineeringDecision.score,
      previous.engineeringDecision.score
    ),
    inquiryReflection: calculateTrendDirection(
      current.inquiryReflection.score,
      previous.inquiryReflection.score
    ),
    selfDirectedLearning: calculateTrendDirection(
      current.selfDirectedLearning.score,
      previous.selfDirectedLearning.score
    ),
  };
}

/**
 * Generate evidence summary for each dimension
 */
export function generateEvidenceSummary(
  facts: LearningFact[],
  topN: number = 3
): Record<CompetencyDimension, Array<{ factType: string; outcome: string; score?: number }>> {
  const grouped = groupFactsByCompetency(facts);
  const summary = {} as Record<CompetencyDimension, Array<{ factType: string; outcome: string; score?: number }>>;

  for (const dimension of COMPETENCY_DIMENSIONS) {
    const dimensionFacts = grouped[dimension] || [];
    summary[dimension] = dimensionFacts
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, topN)
      .map(f => ({
        factType: f.factType,
        outcome: f.outcome,
        score: f.score || undefined,
      }));
  }

  return summary;
}

/**
 * Identify strengths (top 2 dimensions)
 */
export function identifyStrengths(vector: CompetencyVector): string[] {
  const dimensions = COMPETENCY_DIMENSIONS.map(d => ({
    dimension: d,
    score: vector[d].score,
    label: getCompetencyLabel(d),
  }));

  return dimensions
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .filter(d => d.score > 60) // Only if score > 60
    .map(d => d.label);
}

/**
 * Identify weaknesses (bottom 2 dimensions)
 */
export function identifyWeaknesses(vector: CompetencyVector): string[] {
  const dimensions = COMPETENCY_DIMENSIONS.map(d => ({
    dimension: d,
    score: vector[d].score,
    label: getCompetencyLabel(d),
  }));

  return dimensions
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .filter(d => d.score < 70) // Only if score < 70
    .map(d => d.label);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data-governance/competency-engine.ts
git commit -m "feat(data-governance): add competency calculation engine"
```

---

### Task 9: Create Risk Detector

**Files:**
- Create: `src/lib/data-governance/risk-detector.ts`

- [ ] **Step 1: Write risk detection engine**

```typescript
/**
 * Risk Detection Engine
 *
 * Automatically detects learning risks from competency data and facts.
 */

import type { LearningFact } from '@prisma/client';
import type { CompetencyVector, TrendDirection } from './competency-model';
import { COMPETENCY_DIMENSIONS, calculateOverallScore } from './competency-model';

export type RiskType =
  | 'participation'
  | 'stagnation'
  | 'ai_misuse'
  | 'constraint'
  | 'cross_domain';

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface RiskFlag {
  type: RiskType;
  severity: RiskSeverity;
  description: string;
  evidence: Record<string, unknown>;
  triggeredAt: Date;
}

export interface RiskDetectionContext {
  userId: string;
  facts: LearningFact[];
  competencyVector: CompetencyVector;
  previousSnapshot?: CompetencyVector;
  classAverage?: CompetencyVector;
}

// Risk detection rules
const RISK_RULES: Array<{
  type: RiskType;
  detect: (ctx: RiskDetectionContext) => Omit<RiskFlag, 'type' | 'triggeredAt'> | null;
}> = [
  {
    type: 'participation',
    detect: (ctx) => {
      // Check for low activity in recent period
      const recentFacts = ctx.facts.filter(
        f => f.startedAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );

      if (recentFacts.length < 3) {
        return {
          severity: 'high',
          description: '近一周学习活跃度极低，可能已停止学习',
          evidence: { recentFactCount: recentFacts.length },
        };
      }

      if (recentFacts.length < 5) {
        return {
          severity: 'medium',
          description: '近一周学习活跃度较低',
          evidence: { recentFactCount: recentFacts.length },
        };
      }

      return null;
    },
  },
  {
    type: 'stagnation',
    detect: (ctx) => {
      if (!ctx.previousSnapshot) return null;

      const currentOverall = calculateOverallScore(ctx.competencyVector);
      const previousOverall = calculateOverallScore(ctx.previousSnapshot);
      const change = currentOverall - previousOverall;

      if (change < -10) {
        return {
          severity: 'high',
          description: '能力值出现明显下滑',
          evidence: { currentScore: currentOverall, previousScore: previousOverall, change },
        };
      }

      if (change < -5) {
        return {
          severity: 'medium',
          description: '能力值出现下滑趋势',
          evidence: { currentScore: currentOverall, previousScore: previousOverall, change },
        };
      }

      // Check for no improvement over 2 weeks
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const recentImprovement = ctx.facts.some(f => f.startedAt > twoWeeksAgo && f.outcome === 'success');

      if (!recentImprovement && currentOverall < 70) {
        return {
          severity: 'medium',
          description: '近两周无成功学习记录，能力值停滞',
          evidence: { currentScore: currentOverall },
        };
      }

      return null;
    },
  },
  {
    type: 'ai_misuse',
    detect: (ctx) => {
      const aiFacts = ctx.facts.filter(f => f.factType === 'ai_intervention');

      if (aiFacts.length < 5) return null;

      const recentAIFacts = aiFacts.filter(
        f => f.startedAt > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      );

      if (recentAIFacts.length < 5) return null;

      // High frequency but low success rate
      const failureRate = recentAIFacts.filter(f => f.outcome === 'failure').length / recentAIFacts.length;

      if (failureRate > 0.7) {
        return {
          severity: 'high',
          description: '高频使用AI助手但问题解决率低，可能存在依赖或误用',
          evidence: { totalCalls: recentAIFacts.length, failureRate },
        };
      }

      if (failureRate > 0.5) {
        return {
          severity: 'medium',
          description: '使用AI助手但效果不佳',
          evidence: { totalCalls: recentAIFacts.length, failureRate },
        };
      }

      return null;
    },
  },
  {
    type: 'constraint',
    detect: (ctx) => {
      const ethicalFacts = ctx.facts.filter(f => f.factType === 'ethical');
      const violations = ethicalFacts.filter(f => f.outcome === 'failure');

      if (violations.length >= 5) {
        return {
          severity: 'high',
          description: '多次违反工程约束或伦理规范',
          evidence: { violationCount: violations.length },
        };
      }

      if (violations.length >= 3) {
        return {
          severity: 'medium',
          description: '存在多次约束违规记录',
          evidence: { violationCount: violations.length },
        };
      }

      // Check simulation constraint violations
      const simFacts = ctx.facts.filter(f => f.factType === 'simulation');
      const poorConstraintScore = simFacts.filter(
        f => {
          const contribution = f.competencyContribution as Record<string, number> || {};
          return contribution.engineeringDecision < 0;
        }
      ).length;

      if (poorConstraintScore >= 3) {
        return {
          severity: 'medium',
          description: '仿真中多次忽视工程约束',
          evidence: { poorConstraintCount: poorConstraintScore },
        };
      }

      return null;
    },
  },
  {
    type: 'cross_domain',
    detect: (ctx) => {
      const controlScore = ctx.competencyVector.controlModeling.score;
      const crossDomainScore = ctx.competencyVector.crossDomainTransfer.score;

      // High in single domain but low in cross-domain
      if (controlScore > 75 && crossDomainScore < 50) {
        return {
          severity: 'high',
          description: '单点知识掌握较好但跨域迁移能力薄弱',
          evidence: { controlScore, crossDomainScore },
        };
      }

      if (controlScore > 65 && crossDomainScore < 45) {
        return {
          severity: 'medium',
          description: '跨域知识迁移能力有待提升',
          evidence: { controlScore, crossDomainScore },
        };
      }

      // Check for assessment pattern: single domain success, cross-domain failure
      const assessmentFacts = ctx.facts.filter(f => f.factType === 'question');
      const crossDomainAssessments = assessmentFacts.filter(f => {
        const contribution = f.competencyContribution as Record<string, number> || {};
        return contribution.crossDomainTransfer !== undefined;
      });

      if (crossDomainAssessments.length >= 3) {
        const crossDomainSuccess = crossDomainAssessments.filter(f => f.outcome === 'success').length;
        const crossDomainRate = crossDomainSuccess / crossDomainAssessments.length;

        if (crossDomainRate < 0.3) {
          return {
            severity: 'high',
            description: '跨域题目正确率极低，知识迁移存在明显障碍',
            evidence: { crossDomainRate, totalAttempts: crossDomainAssessments.length },
          };
        }
      }

      return null;
    },
  },
];

/**
 * Detect all risks for a student
 */
export function detectRisks(context: RiskDetectionContext): RiskFlag[] {
  const risks: RiskFlag[] = [];
  const now = new Date();

  for (const rule of RISK_RULES) {
    const detection = rule.detect(context);
    if (detection) {
      risks.push({
        type: rule.type,
        ...detection,
        triggeredAt: now,
      });
    }
  }

  return risks;
}

/**
 * Get risk level description
 */
export function getRiskLevelDescription(riskCount: number): string {
  if (riskCount === 0) return '无风险';
  if (riskCount === 1) return '低风险';
  if (riskCount <= 2) return '中风险';
  return '高风险';
}

/**
 * Get recommended scaffolding based on risks
 */
export function getRecommendedScaffolding(risks: RiskFlag[]): string {
  const riskTypes = new Set(risks.map(r => r.type));

  if (riskTypes.has('participation')) {
    return '建议教师主动关注，了解学习障碍，提供参与激励';
  }

  if (riskTypes.has('ai_misuse')) {
    return '引导学生正确使用AI助手：先独立思考，再针对性提问';
  }

  if (riskTypes.has('cross_domain')) {
    return '加强跨域概念联系，推荐联动练习和对比分析';
  }

  if (riskTypes.has('constraint')) {
    return '强化工程约束意识，在仿真前明确安全边界';
  }

  if (riskTypes.has('stagnation')) {
    return '调整学习路径难度，提供阶梯式挑战和及时反馈';
  }

  return '继续保持当前学习节奏';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data-governance/risk-detector.ts
git commit -m "feat(data-governance): add risk detection engine with 5 risk types"
```

---

### Task 10: Create Worker Client

**Files:**
- Create: `src/lib/data-governance/worker-client.ts`

- [ ] **Step 1: Write BullMQ queue client**

```typescript
/**
 * Worker Client
 *
 * BullMQ queue clients for job scheduling.
 */

import { Queue } from 'bullmq';
import { redisClient } from '@/lib/redis-client';

// Queue names
export const QUEUE_NAMES = {
  EVENT_INGESTION: 'event-ingestion',
  STUDENT_SNAPSHOT: 'snapshot-student',
  CLASS_SNAPSHOT: 'snapshot-class',
} as const;

// Queue instances
let eventIngestionQueue: Queue | null = null;
let studentSnapshotQueue: Queue | null = null;
let classSnapshotQueue: Queue | null = null;

/**
 * Initialize queues
 */
export function initializeQueues(): void {
  const connection = redisClient.getClient();
  if (!connection) {
    console.warn('[WorkerClient] Redis not available, queues not initialized');
    return;
  }

  eventIngestionQueue = new Queue(QUEUE_NAMES.EVENT_INGESTION, { connection });
  studentSnapshotQueue = new Queue(QUEUE_NAMES.STUDENT_SNAPSHOT, { connection });
  classSnapshotQueue = new Queue(QUEUE_NAMES.CLASS_SNAPSHOT, { connection });

  console.log('[WorkerClient] Queues initialized');
}

/**
 * Get event ingestion queue
 */
export function getEventIngestionQueue(): Queue | null {
  return eventIngestionQueue;
}

/**
 * Get student snapshot queue
 */
export function getStudentSnapshotQueue(): Queue | null {
  return studentSnapshotQueue;
}

/**
 * Get class snapshot queue
 */
export function getClassSnapshotQueue(): Queue | null {
  return classSnapshotQueue;
}

/**
 * Schedule event ingestion job
 */
export async function scheduleEventIngestion(batchDate: string): Promise<void> {
  if (!eventIngestionQueue) return;

  await eventIngestionQueue.add(
    'ingest-batch',
    { batchDate },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    }
  );
}

/**
 * Schedule student snapshot job
 */
export async function scheduleStudentSnapshot(userId: string): Promise<void> {
  if (!studentSnapshotQueue) return;

  await studentSnapshotQueue.add(
    `snapshot-${userId}`,
    { userId },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
      jobId: `student-${userId}`, // Deduplication
    }
  );
}

/**
 * Schedule class snapshot job
 */
export async function scheduleClassSnapshot(classId: string): Promise<void> {
  if (!classSnapshotQueue) return;

  await classSnapshotQueue.add(
    `snapshot-class-${classId}`,
    { classId },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 15000 },
      jobId: `class-${classId}`, // Deduplication
    }
  );
}

/**
 * Get queue stats
 */
export async function getQueueStats(): Promise<{
  eventIngestion: { waiting: number; active: number; completed: number; failed: number };
  studentSnapshot: { waiting: number; active: number; completed: number; failed: number };
  classSnapshot: { waiting: number; active: number; completed: number; failed: number };
}> {
  const defaultStats = { waiting: 0, active: 0, completed: 0, failed: 0 };

  return {
    eventIngestion: eventIngestionQueue
      ? await getSingleQueueStats(eventIngestionQueue)
      : defaultStats,
    studentSnapshot: studentSnapshotQueue
      ? await getSingleQueueStats(studentSnapshotQueue)
      : defaultStats,
    classSnapshot: classSnapshotQueue
      ? await getSingleQueueStats(classSnapshotQueue)
      : defaultStats,
  };
}

async function getSingleQueueStats(queue: Queue) {
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}

/**
 * Close all queues
 */
export async function closeQueues(): Promise<void> {
  await Promise.all([
    eventIngestionQueue?.close(),
    studentSnapshotQueue?.close(),
    classSnapshotQueue?.close(),
  ]);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data-governance/worker-client.ts
git commit -m "feat(data-governance): add BullMQ worker queue clients"
```

---

### Task 11: Create Worker Service

**Files:**
- Create: `scripts/workers/types.ts`
- Create: `scripts/workers/data-governance-worker.ts`

- [ ] **Step 1: Write worker types**

```typescript
// scripts/workers/types.ts

export interface EventIngestionJob {
  batchDate: string;
}

export interface StudentSnapshotJob {
  userId: string;
}

export interface ClassSnapshotJob {
  classId: string;
}

export type WorkerJobData = EventIngestionJob | StudentSnapshotJob | ClassSnapshotJob;
```

- [ ] **Step 2: Write the worker service**

```typescript
// scripts/workers/data-governance-worker.ts

/**
 * Data Governance Worker Service
 *
 * Standalone worker service for processing:
 * - Event ingestion (secondary events from Redis)
 * - Student competency snapshots
 * - Class competency snapshots
 *
 * Run with: ts-node scripts/workers/data-governance-worker.ts
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { calculateCompetencyVector, calculateTrendVector, generateEvidenceSummary, identifyStrengths, identifyWeaknesses } from '@/lib/data-governance/competency-engine';
import { detectRisks, getRiskLevelDescription, getRecommendedScaffolding } from '@/lib/data-governance/risk-detector';
import { fetchSecondaryEvents, markEventsProcessed } from '@/lib/data-governance/event-buffer';
import { isCoreEvent } from '@/lib/data-governance/event-types';
import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import type { CompetencyVector } from '@/lib/data-governance/competency-model';
import type { EventIngestionJob, StudentSnapshotJob, ClassSnapshotJob } from './types';

// Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);

// Initialize clients
const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const prisma = new PrismaClient();

// Track worker status
let isShuttingDown = false;

// ============================================
// Worker 1: Event Ingestion
// ============================================

const eventIngestionWorker = new Worker(
  'event-ingestion',
  async (job: Job<EventIngestionJob>) => {
    const { batchDate } = job.data;
    console.log(`[EventIngestion] Processing batch for ${batchDate}`);

    // Fetch events from Redis buffer
    const events = await fetchSecondaryEvents(batchDate, 100);

    if (events.length === 0) {
      console.log(`[EventIngestion] No events to process for ${batchDate}`);
      return { processed: 0, factsCreated: 0 };
    }

    // Store batch
    await prisma.learningEventBatch.create({
      data: {
        batchDate: new Date(batchDate),
        events: events as unknown as Prisma.InputJsonValue,
        eventCount: events.length,
        processedAt: new Date(),
      },
    });

    // Transform core events to LearningFacts
    const coreEvents = events.filter(e => isCoreEvent(e.actionType));
    const facts = coreEvents.map(eventToFact).filter(Boolean);

    // Upsert facts (skip duplicates)
    if (facts.length > 0) {
      await prisma.learningFact.createMany({
        data: facts as Prisma.LearningFactCreateManyInput[],
        skipDuplicates: true,
      });
    }

    // Update stats
    await markEventsProcessed(events.length);

    console.log(`[EventIngestion] Processed ${events.length} events, created ${facts.length} facts`);

    return {
      processed: events.length,
      factsCreated: facts.length,
    };
  },
  { connection: redis, concurrency: WORKER_CONCURRENCY }
);

function eventToFact(event: LearningEvent) {
  // Map event to LearningFact structure
  const competencyMapping = getCompetencyMappingForEvent(event);

  return {
    userId: event.userId,
    factType: mapActionTypeToFactType(event.actionType),
    moduleId: event.moduleId,
    sessionId: event.sessionId,
    startedAt: new Date(event.occurredAt),
    finishedAt: new Date(event.occurredAt),
    outcome: event.payload.outcome as string || 'unknown',
    score: event.payload.score as number | undefined,
    timeSpent: event.payload.timeSpent as number | undefined,
    competencyContribution: competencyMapping,
    sourceEventId: event.eventId,
    sourceLogId: event.payload.sourceLogId as string | undefined,
    courseId: event.courseId,
    lessonId: event.lessonId,
  };
}

function mapActionTypeToFactType(actionType: string): string {
  const mapping: Record<string, string> = {
    answer_submit: 'question',
    assessment_complete: 'question',
    simulation_finish: 'simulation',
    ai_intervention_complete: 'ai_intervention',
    prompt_assessed: 'prompt_design',
    design_session_complete: 'design',
    ethical_violation: 'ethical',
    ethical_resolved: 'ethical',
  };
  return mapping[actionType] || 'unknown';
}

function getCompetencyMappingForEvent(event: LearningEvent): Record<string, number> {
  // Use payload contributions or derive from event type
  return (event.payload.competencyContribution as Record<string, number>) ||
    (event.derivedMetrics as Record<string, number>) ||
    {};
}

// ============================================
// Worker 2: Student Snapshot
// ============================================

const studentSnapshotWorker = new Worker(
  'snapshot-student',
  async (job: Job<StudentSnapshotJob>) => {
    const { userId } = job.data;
    console.log(`[StudentSnapshot] Calculating snapshot for ${userId}`);

    // Fetch recent learning facts
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const facts = await prisma.learningFact.findMany({
      where: {
        userId,
        startedAt: { gte: thirtyDaysAgo },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Calculate competency vector
    const competencyVector = calculateCompetencyVector(facts, '1m');

    // Get previous snapshot for trend calculation
    const previousSnapshot = await prisma.studentCompetencySnapshot.findFirst({
      where: { userId },
      orderBy: { snapshotAt: 'desc' },
    });

    // Calculate trend
    if (previousSnapshot) {
      const previousVector = previousSnapshot.competencyVector as unknown as CompetencyVector;
      const trendVector = calculateTrendVector(competencyVector, previousVector);

      // Update trends in vector
      for (const dim of Object.keys(trendVector)) {
        competencyVector[dim as keyof CompetencyVector].trend = trendVector[dim as keyof CompetencyVector];
      }
    }

    // Detect risks
    const risks = detectRisks({
      userId,
      facts,
      competencyVector,
      previousSnapshot: previousSnapshot?.competencyVector as unknown as CompetencyVector,
    });

    // Create snapshot
    const snapshot = await prisma.studentCompetencySnapshot.create({
      data: {
        userId,
        snapshotAt: new Date(),
        competencyVector: competencyVector as unknown as Prisma.InputJsonValue,
        evidenceSummary: generateEvidenceSummary(facts) as unknown as Prisma.InputJsonValue,
        riskFlags: risks.map(r => r.type),
        factCount: facts.length,
      },
    });

    // Update or create profile summary
    await updateProfileSummary(userId, competencyVector, risks, facts);

    // Store risk flags
    for (const risk of risks) {
      await prisma.studentRiskFlag.upsert({
        where: {
          // Use a composite unique constraint or handle differently
          id: `${userId}-${risk.type}`,
        },
        update: {
          severity: risk.severity,
          description: risk.description,
          evidenceJson: risk.evidence as Prisma.InputJsonValue,
          triggeredAt: risk.triggeredAt,
          isResolved: false,
        },
        create: {
          userId,
          flagType: risk.type,
          severity: risk.severity,
          description: risk.description,
          evidenceJson: risk.evidence as Prisma.InputJsonValue,
          triggeredAt: risk.triggeredAt,
        },
      });
    }

    console.log(`[StudentSnapshot] Created snapshot ${snapshot.id} with ${risks.length} risks`);

    return {
      snapshotId: snapshot.id,
      factCount: facts.length,
      riskCount: risks.length,
    };
  },
  { connection: redis, concurrency: WORKER_CONCURRENCY }
);

async function updateProfileSummary(
  userId: string,
  vector: CompetencyVector,
  risks: ReturnType<typeof detectRisks>,
  facts: Array<{ factType: string; outcome: string; startedAt: Date }>
) {
  const strengths = identifyStrengths(vector);
  const weaknesses = identifyWeaknesses(vector);
  const riskLevel = getRiskLevelDescription(risks.length);

  // Get recent activity (last 5)
  const recentActivity = facts
    .slice(0, 5)
    .map(f => ({
      type: f.factType,
      outcome: f.outcome,
      date: f.startedAt.toISOString(),
    }));

  // Calculate trend description
  const trendDirection = calculateOverallTrend(vector);
  const trendDescriptions: Record<string, string> = {
    up: '近两周稳步提升',
    stable: '近期表现平稳',
    down: '近期出现下滑',
  };

  await prisma.studentProfileSummary.upsert({
    where: { userId },
    update: {
      overallLevel: getOverallLevel(vector),
      overallScore: calculateOverallScore(vector),
      strengthsJson: strengths as Prisma.InputJsonValue,
      weaknessesJson: weaknesses as Prisma.InputJsonValue,
      recentTrend: trendDescriptions[trendDirection],
      trendDirection,
      riskFlagsJson: risks.map(r => r.description) as Prisma.InputJsonValue,
      riskLevel,
      recommendedScaffolding: getRecommendedScaffolding(risks),
      recentActivityJson: recentActivity as Prisma.InputJsonValue,
      cacheExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
    create: {
      userId,
      overallLevel: getOverallLevel(vector),
      overallScore: calculateOverallScore(vector),
      strengthsJson: strengths as Prisma.InputJsonValue,
      weaknessesJson: weaknesses as Prisma.InputJsonValue,
      recentTrend: trendDescriptions[trendDirection],
      trendDirection,
      riskFlagsJson: risks.map(r => r.description) as Prisma.InputJsonValue,
      riskLevel,
      recommendedScaffolding: getRecommendedScaffolding(risks),
      recentActivityJson: recentActivity as Prisma.InputJsonValue,
      cacheExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
}

function getOverallLevel(vector: CompetencyVector): string {
  const avg = calculateOverallScore(vector);
  if (avg >= 85) return '优秀';
  if (avg >= 70) return '良好';
  if (avg >= 55) return '中等偏上';
  if (avg >= 40) return '需提升';
  return '需关注';
}

function calculateOverallScore(vector: CompetencyVector): number {
  const scores = Object.values(vector).map(v => v.score);
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

function calculateOverallTrend(vector: CompetencyVector): 'up' | 'stable' | 'down' {
  const trends = Object.values(vector).map(v => v.trend);
  const upCount = trends.filter(t => t === 'up').length;
  const downCount = trends.filter(t => t === 'down').length;

  if (upCount > downCount + 1) return 'up';
  if (downCount > upCount + 1) return 'down';
  return 'stable';
}

// ============================================
// Worker 3: Class Snapshot
// ============================================

const classSnapshotWorker = new Worker(
  'snapshot-class',
  async (job: Job<ClassSnapshotJob>) => {
    const { classId } = job.data;
    console.log(`[ClassSnapshot] Calculating snapshot for class ${classId}`);

    // Get all students in class
    const students = await prisma.studentProfile.findMany({
      where: { classId },
      select: { userId: true },
    });

    // Get latest snapshots for all students
    const snapshots = await Promise.all(
      students.map(s =>
        prisma.studentCompetencySnapshot.findFirst({
          where: { userId: s.userId },
          orderBy: { snapshotAt: 'desc' },
        })
      )
    );

    const validSnapshots = snapshots.filter(Boolean);

    if (validSnapshots.length === 0) {
      console.log(`[ClassSnapshot] No student snapshots for class ${classId}`);
      return { studentCount: 0, snapshotId: null };
    }

    // Calculate aggregates
    const aggregate = calculateClassAggregate(validSnapshots);
    const distribution = calculateLevelDistribution(validSnapshots);
    const riskSummary = calculateRiskSummary(validSnapshots);

    // Create class snapshot
    const snapshot = await prisma.classCompetencySnapshot.create({
      data: {
        classId,
        snapshotAt: new Date(),
        aggregateJson: aggregate as unknown as Prisma.InputJsonValue,
        distributionJson: distribution as unknown as Prisma.InputJsonValue,
        trendJson: {} as Prisma.InputJsonValue, // TODO: Compare with previous
        riskSummaryJson: riskSummary as unknown as Prisma.InputJsonValue,
        levelDistribution: distribution as unknown as Prisma.InputJsonValue,
        activeStudentCount: validSnapshots.length,
        totalStudentCount: students.length,
      },
    });

    console.log(`[ClassSnapshot] Created snapshot ${snapshot.id} for ${validSnapshots.length}/${students.length} students`);

    return {
      snapshotId: snapshot.id,
      studentCount: validSnapshots.length,
    };
  },
  { connection: redis, concurrency: 1 } // Lower concurrency for heavier work
);

function calculateClassAggregate(snapshots: Array<{ competencyVector: unknown }>) {
  const vectors = snapshots.map(s => s.competencyVector as CompetencyVector);
  const dimensions = Object.keys(vectors[0]) as Array<keyof CompetencyVector>;

  const aggregate: Record<string, { mean: number; stdDev: number }> = {};

  for (const dim of dimensions) {
    const scores = vectors.map(v => v[dim].score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;

    aggregate[dim] = {
      mean: Math.round(mean * 10) / 10,
      stdDev: Math.round(Math.sqrt(variance) * 10) / 10,
    };
  }

  return aggregate;
}

function calculateLevelDistribution(snapshots: Array<{ competencyVector: unknown }>) {
  const vectors = snapshots.map(s => s.competencyVector as CompetencyVector);

  const levels = { excellent: 0, good: 0, average: 0, needsImprovement: 0, atRisk: 0 };

  for (const vector of vectors) {
    const avg = calculateOverallScore(vector);
    if (avg >= 85) levels.excellent++;
    else if (avg >= 70) levels.good++;
    else if (avg >= 55) levels.average++;
    else if (avg >= 40) levels.needsImprovement++;
    else levels.atRisk++;
  }

  return levels;
}

function calculateRiskSummary(snapshots: Array<{ riskFlags: unknown }>) {
  const allFlags = snapshots.flatMap(s => s.riskFlags as string[]);

  const summary: Record<string, number> = {};
  for (const flag of allFlags) {
    summary[flag] = (summary[flag] || 0) + 1;
  }

  return summary;
}

// ============================================
// Event Handlers & Shutdown
// ============================================

// Log worker events
eventIngestionWorker.on('completed', (job) => {
  console.log(`[EventIngestion] Job ${job.id} completed`, job.returnvalue);
});

eventIngestionWorker.on('failed', (job, err) => {
  console.error(`[EventIngestion] Job ${job?.id} failed:`, err.message);
});

studentSnapshotWorker.on('completed', (job) => {
  console.log(`[StudentSnapshot] Job ${job.id} completed`, job.returnvalue);
});

studentSnapshotWorker.on('failed', (job, err) => {
  console.error(`[StudentSnapshot] Job ${job?.id} failed:`, err.message);
});

classSnapshotWorker.on('completed', (job) => {
  console.log(`[ClassSnapshot] Job ${job.id} completed`, job.returnvalue);
});

classSnapshotWorker.on('failed', (job, err) => {
  console.error(`[ClassSnapshot] Job ${job?.id} failed:`, err.message);
});

// Graceful shutdown
async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('[Worker] Shutting down...');

  await Promise.all([
    eventIngestionWorker.close(),
    studentSnapshotWorker.close(),
    classSnapshotWorker.close(),
  ]);

  await prisma.$disconnect();
  await redis.quit();

  console.log('[Worker] Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[Worker] Data governance worker started');
console.log(`[Worker] Concurrency: ${WORKER_CONCURRENCY}`);
```

- [ ] **Step 3: Commit**

```bash
git add scripts/workers/
git commit -m "feat(data-governance): add BullMQ worker service with three queues"
```

---

### Task 12: Create Scheduler

**Files:**
- Create: `scripts/workers/scheduler.ts`

- [ ] **Step 1: Write the scheduler**

```typescript
/**
 * Worker Scheduler
 *
 * Sets up recurring jobs for the data governance workers.
 * Run once to schedule all recurring jobs.
 */

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const prisma = new PrismaClient();

const SCHEDULES = {
  EVENT_INGESTION: '*/5 * * * *',    // Every 5 minutes
  STUDENT_SNAPSHOT: '*/10 * * * *',  // Every 10 minutes
  CLASS_SNAPSHOT: '*/15 * * * *',    // Every 15 minutes
};

async function scheduleJobs() {
  console.log('[Scheduler] Setting up recurring jobs...');

  // Event ingestion queue
  const eventQueue = new Queue('event-ingestion', { connection: redis });

  // Clean existing repeatables
  const existingEventJobs = await eventQueue.getRepeatableJobs();
  for (const job of existingEventJobs) {
    await eventQueue.removeRepeatableByKey(job.key);
  }

  // Schedule event ingestion
  await eventQueue.add(
    'scheduled-ingestion',
    { batchDate: new Date().toISOString().split('T')[0] },
    {
      repeat: { cron: SCHEDULES.EVENT_INGESTION },
      jobId: 'scheduled-event-ingestion',
    }
  );

  console.log(`[Scheduler] Event ingestion scheduled: ${SCHEDULES.EVENT_INGESTION}`);

  // Student snapshot queue
  const studentQueue = new Queue('snapshot-student', { connection: redis });

  const existingStudentJobs = await studentQueue.getRepeatableJobs();
  for (const job of existingStudentJobs) {
    await studentQueue.removeRepeatableByKey(job.key);
  }

  // Schedule student snapshots for active users
  // In production, this would be dynamically scheduled based on activity
  const activeUsers = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true },
    take: 100, // Limit for initial rollout
  });

  for (const user of activeUsers) {
    await studentQueue.add(
      `scheduled-student-${user.id}`,
      { userId: user.id },
      {
        repeat: { cron: SCHEDULES.STUDENT_SNAPSHOT },
        jobId: `scheduled-student-${user.id}`,
      }
    );
  }

  console.log(`[Scheduler] Student snapshots scheduled for ${activeUsers.length} users: ${SCHEDULES.STUDENT_SNAPSHOT}`);

  // Class snapshot queue
  const classQueue = new Queue('snapshot-class', { connection: redis });

  const existingClassJobs = await classQueue.getRepeatableJobs();
  for (const job of existingClassJobs) {
    await classQueue.removeRepeatableByKey(job.key);
  }

  // Schedule class snapshots
  const classes = await prisma.class.findMany({ select: { id: true } });

  for (const cls of classes) {
    await classQueue.add(
      `scheduled-class-${cls.id}`,
      { classId: cls.id },
      {
        repeat: { cron: SCHEDULES.CLASS_SNAPSHOT },
        jobId: `scheduled-class-${cls.id}`,
      }
    );
  }

  console.log(`[Scheduler] Class snapshots scheduled for ${classes.length} classes: ${SCHEDULES.CLASS_SNAPSHOT}`);

  // Cleanup
  await eventQueue.close();
  await studentQueue.close();
  await classQueue.close();
  await prisma.$disconnect();
  await redis.quit();

  console.log('[Scheduler] All jobs scheduled successfully');
}

scheduleJobs().catch((err) => {
  console.error('[Scheduler] Failed to schedule jobs:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/workers/scheduler.ts
git commit -m "feat(data-governance): add worker scheduler for recurring jobs"
```

---

### Task 13: Create Data Governance Index

**Files:**
- Create: `src/lib/data-governance/index.ts`

- [ ] **Step 1: Write the index file**

```typescript
/**
 * Data Governance Library
 *
 * Unified exports for the data governance system.
 */

// Event system
export * from './event-protocol';
export * from './event-types';
export * from './event-buffer';

// Competency system
export * from './competency-model';
export * from './competency-engine';

// Risk detection
export * from './risk-detector';

// Worker client
export * from './worker-client';
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data-governance/index.ts
git commit -m "feat(data-governance): add library index exports"
```

---

### Task 14: Create Migration Scripts

**Files:**
- Create: `scripts/migrations/001-seed-event-dictionary.ts`
- Create: `scripts/migrations/002-migrate-to-learning-facts.ts`
- Create: `scripts/migrations/003-backfill-snapshots.ts`

- [ ] **Step 1: Write event dictionary seeder**

```typescript
// scripts/migrations/001-seed-event-dictionary.ts

/**
 * Seed Event Dictionary
 *
 * Populates the EventDictionary table with all known event types.
 */

import { PrismaClient } from '@prisma/client';
import { ALL_EVENTS } from '@/lib/data-governance/event-types';

const prisma = new PrismaClient();

async function seedEventDictionary() {
  console.log('[Migration] Seeding event dictionary...');

  for (const eventMeta of ALL_EVENTS) {
    await prisma.eventDictionary.upsert({
      where: { eventType: eventMeta.eventType },
      update: {
        category: eventMeta.category,
        priority: eventMeta.priority,
        description: eventMeta.description,
        schema: eventMeta.schema as Prisma.InputJsonValue,
        competencyMapping: eventMeta.competencyMapping as Prisma.InputJsonValue,
      },
      create: {
        eventType: eventMeta.eventType,
        category: eventMeta.category,
        priority: eventMeta.priority,
        description: eventMeta.description,
        schema: eventMeta.schema as Prisma.InputJsonValue,
        competencyMapping: eventMeta.competencyMapping as Prisma.InputJsonValue,
      },
    });

    console.log(`[Migration] Seeded: ${eventMeta.eventType}`);
  }

  console.log('[Migration] Event dictionary seeded successfully');
}

seedEventDictionary()
  .catch((err) => {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Write learning facts migration**

```typescript
// scripts/migrations/002-migrate-to-learning-facts.ts

/**
 * Migrate to Learning Facts
 *
 * Transforms existing data into unified LearningFact format.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateToLearningFacts() {
  console.log('[Migration] Starting LearningFacts migration...');

  // 1. Migrate SimulationLogs
  console.log('[Migration] Processing SimulationLogs...');
  const simulationLogs = await prisma.simulationLog.findMany({
    take: 1000, // Process in batches
  });

  const simulationFacts = simulationLogs.map(log => ({
    userId: log.userId,
    factType: 'simulation',
    moduleId: log.missionId,
    sessionId: log.sessionId,
    startedAt: log.createdAt,
    finishedAt: log.createdAt,
    outcome: log.score && log.score > 60 ? 'success' : log.score && log.score > 30 ? 'partial' : 'failure',
    score: log.score,
    timeSpent: Math.round(log.duration || 0),
    competencyContribution: {
      parameterDesign: log.score ? log.score / 100 : 0,
      engineeringDecision: log.isEthicalViolation ? -0.5 : 0.3,
    },
    sourceLogId: log.id,
    createdAt: log.createdAt,
  }));

  if (simulationFacts.length > 0) {
    await prisma.learningFact.createMany({
      data: simulationFacts,
      skipDuplicates: true,
    });
    console.log(`[Migration] Migrated ${simulationFacts.length} simulation logs`);
  }

  // 2. Migrate UserAnswers
  console.log('[Migration] Processing UserAnswers...');
  const userAnswers = await prisma.userAnswer.findMany({
    take: 1000,
    include: { question: true },
  });

  const answerFacts = userAnswers.map(answer => ({
    userId: answer.userId,
    factType: 'question',
    moduleId: answer.questionId,
    startedAt: answer.createdAt,
    finishedAt: answer.createdAt,
    outcome: answer.isCorrect ? 'success' : 'failure',
    score: answer.isCorrect ? 100 : 0,
    timeSpent: answer.timeSpent,
    competencyContribution: {
      controlModeling: answer.isCorrect ? 0.8 : 0.1,
      crossDomainTransfer: answer.question?.crossDomainHint ? 0.5 : 0,
    },
    sourceLogId: answer.id,
    createdAt: answer.createdAt,
  }));

  if (answerFacts.length > 0) {
    await prisma.learningFact.createMany({
      data: answerFacts,
      skipDuplicates: true,
    });
    console.log(`[Migration] Migrated ${answerFacts.length} user answers`);
  }

  // 3. Migrate AIInterventions
  console.log('[Migration] Processing AIInterventions...');
  const interventions = await prisma.aIIntervention.findMany({
    take: 1000,
  });

  const interventionFacts = interventions.map(intervention => ({
    userId: intervention.userId,
    factType: 'ai_intervention',
    sessionId: intervention.sessionId,
    startedAt: intervention.createdAt,
    finishedAt: intervention.createdAt,
    outcome: intervention.wasHelpful ? 'success' : intervention.wasHelpful === false ? 'failure' : 'partial',
    score: intervention.wasHelpful ? 100 : intervention.wasHelpful === false ? 0 : 50,
    competencyContribution: {
      inquiryReflection: intervention.wasHelpful ? 0.7 : 0.2,
      selfDirectedLearning: 0.4,
    },
    sourceLogId: intervention.id,
    createdAt: intervention.createdAt,
  }));

  if (interventionFacts.length > 0) {
    await prisma.learningFact.createMany({
      data: interventionFacts,
      skipDuplicates: true,
    });
    console.log(`[Migration] Migrated ${interventionFacts.length} AI interventions`);
  }

  // 4. Migrate PromptAssessments
  console.log('[Migration] Processing PromptAssessments...');
  const assessments = await prisma.promptAssessment.findMany({
    take: 1000,
  });

  const promptFacts = assessments.map(assessment => ({
    userId: assessment.userId,
    factType: 'prompt_design',
    sessionId: assessment.sessionId,
    startedAt: assessment.createdAt,
    finishedAt: assessment.createdAt,
    outcome: assessment.overallScore > 70 ? 'success' : assessment.overallScore > 40 ? 'partial' : 'failure',
    score: assessment.overallScore,
    competencyContribution: {
      inquiryReflection: (assessment.overallScore || 0) / 100,
      selfDirectedLearning: (assessment.iterationCount || 0) > 3 ? 0.5 : 0.2,
    },
    sourceLogId: assessment.id,
    createdAt: assessment.createdAt,
  }));

  if (promptFacts.length > 0) {
    await prisma.learningFact.createMany({
      data: promptFacts,
      skipDuplicates: true,
    });
    console.log(`[Migration] Migrated ${promptFacts.length} prompt assessments`);
  }

  console.log('[Migration] LearningFacts migration complete');
}

migrateToLearningFacts()
  .catch((err) => {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Write snapshot backfill script**

```typescript
// scripts/migrations/003-backfill-snapshots.ts

/**
 * Backfill Snapshots
 *
 * Generates initial competency snapshots for all students.
 */

import { PrismaClient } from '@prisma/client';
import { calculateCompetencyVector, generateEvidenceSummary, identifyStrengths, identifyWeaknesses } from '@/lib/data-governance/competency-engine';
import { detectRisks, getRiskLevelDescription, getRecommendedScaffolding } from '@/lib/data-governance/risk-detector';
import type { CompetencyVector } from '@/lib/data-governance/competency-model';

const prisma = new PrismaClient();

async function backfillSnapshots() {
  console.log('[Migration] Starting snapshot backfill...');

  // Get all students
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, name: true },
  });

  console.log(`[Migration] Processing ${students.length} students...`);

  for (const student of students) {
    try {
      // Get all facts for student
      const facts = await prisma.learningFact.findMany({
        where: { userId: student.id },
        orderBy: { startedAt: 'desc' },
      });

      if (facts.length === 0) {
        console.log(`[Migration] No facts for ${student.id}, skipping`);
        continue;
      }

      // Calculate competency
      const competencyVector = calculateCompetencyVector(facts, 'all');

      // Detect risks
      const risks = detectRisks({
        userId: student.id,
        facts,
        competencyVector,
      });

      // Create snapshot
      await prisma.studentCompetencySnapshot.create({
        data: {
          userId: student.id,
          snapshotAt: new Date(),
          competencyVector: competencyVector as unknown as Prisma.InputJsonValue,
          evidenceSummary: generateEvidenceSummary(facts) as unknown as Prisma.InputJsonValue,
          riskFlags: risks.map(r => r.type),
          factCount: facts.length,
        },
      });

      // Create/update profile summary
      const strengths = identifyStrengths(competencyVector);
      const weaknesses = identifyWeaknesses(competencyVector);
      const overallScore = calculateOverallScore(competencyVector);

      await prisma.studentProfileSummary.upsert({
        where: { userId: student.id },
        update: {
          overallLevel: getOverallLevel(overallScore),
          overallScore,
          strengthsJson: strengths as Prisma.InputJsonValue,
          weaknessesJson: weaknesses as Prisma.InputJsonValue,
          recentTrend: '数据初始化',
          trendDirection: 'stable',
          riskFlagsJson: risks.map(r => r.description) as Prisma.InputJsonValue,
          riskLevel: getRiskLevelDescription(risks.length),
          recommendedScaffolding: getRecommendedScaffolding(risks),
          recentActivityJson: facts.slice(0, 5).map(f => ({
            type: f.factType,
            outcome: f.outcome,
            date: f.startedAt.toISOString(),
          })) as Prisma.InputJsonValue,
          cacheExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        create: {
          userId: student.id,
          overallLevel: getOverallLevel(overallScore),
          overallScore,
          strengthsJson: strengths as Prisma.InputJsonValue,
          weaknessesJson: weaknesses as Prisma.InputJsonValue,
          recentTrend: '数据初始化',
          trendDirection: 'stable',
          riskFlagsJson: risks.map(r => r.description) as Prisma.InputJsonValue,
          riskLevel: getRiskLevelDescription(risks.length),
          recommendedScaffolding: getRecommendedScaffolding(risks),
          recentActivityJson: facts.slice(0, 5).map(f => ({
            type: f.factType,
            outcome: f.outcome,
            date: f.startedAt.toISOString(),
          })) as Prisma.InputJsonValue,
          cacheExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      // Create risk flags
      for (const risk of risks) {
        await prisma.studentRiskFlag.create({
          data: {
            userId: student.id,
            flagType: risk.type,
            severity: risk.severity,
            description: risk.description,
            evidenceJson: risk.evidence as Prisma.InputJsonValue,
            triggeredAt: risk.triggeredAt,
          },
        });
      }

      console.log(`[Migration] Processed ${student.id}: ${facts.length} facts, ${risks.length} risks`);
    } catch (err) {
      console.error(`[Migration] Failed for ${student.id}:`, err);
    }
  }

  // Backfill class snapshots
  console.log('[Migration] Backfilling class snapshots...');
  const classes = await prisma.class.findMany();

  for (const cls of classes) {
    // Similar logic to worker class snapshot
    // ... (omitted for brevity)
    console.log(`[Migration] Processed class ${cls.id}`);
  }

  console.log('[Migration] Snapshot backfill complete');
}

function calculateOverallScore(vector: CompetencyVector): number {
  const scores = Object.values(vector).map(v => v.score);
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

function getOverallLevel(score: number): string {
  if (score >= 85) return '优秀';
  if (score >= 70) return '良好';
  if (score >= 55) return '中等偏上';
  if (score >= 40) return '需提升';
  return '需关注';
}

backfillSnapshots()
  .catch((err) => {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Commit**

```bash
git add scripts/migrations/
git commit -m "feat(data-governance): add migration scripts for dictionary, facts, and snapshots"
```

---

### Task 15: Create Konling Context API

**Files:**
- Create: `src/app/api/ai/konling-context/route.ts`

- [ ] **Step 1: Write the Konling context API**

```typescript
/**
 * Konling (AI Assistant) Context API
 *
 * Provides pre-aggregated student context for AI assistant.
 * Target response time: < 100ms
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || session.user.id;

    // Only allow viewing own data unless teacher/admin
    const isTeacherOrAdmin = session.user.role === 'TEACHER' || session.user.role === 'ADMIN';
    if (userId !== session.user.id && !isTeacherOrAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch optimized profile summary (should be < 100ms)
    const profile = await prisma.studentProfileSummary.findUnique({
      where: { userId },
    });

    if (!profile) {
      // Return default context if no profile exists yet
      return NextResponse.json({
        student_profile_context: {
          overall_level: '数据采集中',
          overall_score: 0,
          strengths: [],
          weaknesses: [],
          recent_trend: '暂无数据',
          trend_direction: 'stable',
          risk_flags: [],
          risk_level: 'none',
          recommended_scaffolding: '继续学习以生成个性化建议',
        },
        current_task_context: {
          page_type: 'unknown',
          course_id: null,
          current_step: null,
          completion_rate: 0,
          relevant_weaknesses: [],
        },
        competency_vector: null,
      });
    }

    // Get latest competency snapshot for full vector
    const snapshot = await prisma.studentCompetencySnapshot.findFirst({
      where: { userId },
      orderBy: { snapshotAt: 'desc' },
    });

    const response = {
      student_profile_context: {
        overall_level: profile.overallLevel,
        overall_score: profile.overallScore,
        strengths: profile.strengthsJson as string[],
        weaknesses: profile.weaknessesJson as string[],
        recent_trend: profile.recentTrend,
        trend_direction: profile.trendDirection,
        risk_flags: profile.riskFlagsJson as string[],
        risk_level: profile.riskLevel,
        recommended_scaffolding: profile.recommendedScaffolding,
      },
      current_task_context: {
        page_type: 'unknown', // To be populated from request context
        course_id: null,
        current_step: null,
        completion_rate: 0,
        relevant_weaknesses: (profile.weaknessesJson as string[]) || [],
      },
      competency_vector: snapshot?.competencyVector || null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[KonlingContext] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ai/konling-context/
git commit -m "feat(data-governance): add Konling AI assistant context API"
```

---

### Task 16: Create Teacher Dashboard APIs

**Files:**
- Create: `src/app/api/teacher/classes/[classId]/dashboard/route.ts`

- [ ] **Step 1: Write the teacher dashboard API**

```typescript
/**
 * Teacher Dashboard API
 *
 * Provides class-level analytics from pre-calculated snapshots.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { classId } = params;

    // Verify teacher owns this class
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: { teacherId: true, name: true },
    });

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    const isTeacher = classData.teacherId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isTeacher && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get latest class snapshot
    const snapshot = await prisma.classCompetencySnapshot.findFirst({
      where: { classId },
      orderBy: { snapshotAt: 'desc' },
    });

    // Get student count
    const studentCount = await prisma.studentProfile.count({
      where: { classId },
    });

    // Get active students (had activity in last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeStudents = await prisma.learningFact.groupBy({
      by: ['userId'],
      where: {
        userId: {
          in: await prisma.studentProfile
            .findMany({ where: { classId }, select: { userId: true } })
            .then(profiles => profiles.map(p => p.userId)),
        },
        startedAt: { gte: sevenDaysAgo },
      },
    });

    // Get risk summary
    const riskFlags = await prisma.studentRiskFlag.findMany({
      where: {
        userId: {
          in: await prisma.studentProfile
            .findMany({ where: { classId }, select: { userId: true } })
            .then(profiles => profiles.map(p => p.userId)),
        },
        isResolved: false,
      },
    });

    const riskSummary = riskFlags.reduce((acc, flag) => {
      acc[flag.flagType] = (acc[flag.flagType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      class: {
        id: classId,
        name: classData.name,
        studentCount,
        activeToday: activeStudents.length,
      },
      competency: snapshot
        ? {
            aggregate: snapshot.aggregateJson,
            distribution: snapshot.distributionJson,
            levelDistribution: snapshot.levelDistribution,
            lastUpdated: snapshot.snapshotAt,
          }
        : null,
      riskSummary: {
        totalFlags: riskFlags.length,
        byType: riskSummary,
        highPriorityCount: riskFlags.filter(f => f.severity === 'high').length,
      },
    });
  } catch (error) {
    console.error('[TeacherDashboard] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create risk students API**

```typescript
// src/app/api/teacher/classes/[classId]/risk-students/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { classId } = params;
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity') || undefined;
    const unresolvedOnly = searchParams.get('unresolved') === 'true';

    // Verify teacher
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: { teacherId: true },
    });

    if (!classData || (classData.teacherId !== session.user.id && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get students in class
    const students = await prisma.studentProfile.findMany({
      where: { classId },
      select: { userId: true },
    });

    const studentIds = students.map(s => s.userId);

    // Get risk flags
    const where: Prisma.StudentRiskFlagWhereInput = {
      userId: { in: studentIds },
    };

    if (severity) {
      where.severity = severity;
    }

    if (unresolvedOnly) {
      where.isResolved = false;
    }

    const riskFlags = await prisma.studentRiskFlag.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { triggeredAt: 'desc' },
    });

    // Group by student
    const byStudent = riskFlags.reduce((acc, flag) => {
      if (!acc[flag.userId]) {
        acc[flag.userId] = {
          userId: flag.userId,
          name: flag.user.name,
          avatar: flag.user.image,
          riskFlags: [],
        };
      }
      acc[flag.userId].riskFlags.push({
        type: flag.flagType,
        severity: flag.severity,
        description: flag.description,
        triggeredAt: flag.triggeredAt.toISOString(),
        isResolved: flag.isResolved,
      });
      return acc;
    }, {} as Record<string, unknown>);

    const students_list = Object.values(byStudent).map((s: unknown) => ({
      ...(s as object),
      overallRisk: calculateOverallRisk((s as { riskFlags: Array<{ severity: string }> }).riskFlags),
    }));

    return NextResponse.json({ students: students_list });
  } catch (error) {
    console.error('[RiskStudents] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateOverallRisk(flags: Array<{ severity: string }>): string {
  if (flags.some(f => f.severity === 'high')) return 'high';
  if (flags.some(f => f.severity === 'medium')) return 'medium';
  return 'low';
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/teacher/classes/
git commit -m "feat(data-governance): add teacher dashboard and risk students APIs"
```

---

### Task 17: Add npm Scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add worker scripts to package.json**

Add to `scripts` section:
```json
{
  "scripts": {
    "worker:dev": "ts-node scripts/workers/data-governance-worker.ts",
    "worker:scheduler": "ts-node scripts/workers/scheduler.ts",
    "migrate:events": "ts-node scripts/migrations/001-seed-event-dictionary.ts",
    "migrate:facts": "ts-node scripts/migrations/002-migrate-to-learning-facts.ts",
    "migrate:snapshots": "ts-node scripts/migrations/003-backfill-snapshots.ts"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add data governance worker and migration scripts"
```

---

## Phase 2-4 Summary Tasks

### Phase 2 Remaining: Pages

**Note**: The following pages would be implemented after the core APIs are working:

1. `src/app/profile/growth/page.tsx` - Student growth dashboard
2. `src/app/profile/competency/page.tsx` - Detailed competency breakdown
3. `src/app/profile/portfolio/page.tsx` - Learning portfolio
4. `src/app/teacher/classes/[classId]/analytics-v2/page.tsx` - Teacher analytics dashboard

### Phase 3: Recommendation Engine

File: `src/lib/data-governance/recommendation-engine.ts` - Simple rule-based recommendations

### Phase 4: Enhanced Session Review

File: `src/app/classroom/teacher/[sessionId]/review-v2/page.tsx` - Enhanced review with competency matrix

---

## Testing Checklist

### Unit Tests (to be written)
- `src/lib/data-governance/__tests__/competency-engine.test.ts`
- `src/lib/data-governance/__tests__/risk-detector.test.ts`
- `src/lib/data-governance/__tests__/event-buffer.test.ts`

### Integration Tests
- Event ingestion end-to-end
- Snapshot generation accuracy
- API response times (< 100ms for Konling context)

### Load Tests
- Event buffer at 1000 events/sec
- Snapshot generation for 1000 students

---

## Deployment Checklist

1. **Database Migration**
   ```bash
   npx prisma migrate dev --name data_governance
   npm run migrate:events
   npm run migrate:facts
   npm run migrate:snapshots
   ```

2. **Start Workers**
   ```bash
   npm run worker:dev
   ```

3. **Schedule Recurring Jobs**
   ```bash
   npm run worker:scheduler
   ```

4. **Verify**
   - Check queue stats
   - Verify snapshots being created
   - Test API endpoints

---

## Phase Verification Checkpoints

### Phase 1 Verification
After completing Phase 1 tasks:
- [ ] Run `npm run lint` - must pass with no errors
- [ ] Run `npx prisma generate` - succeeds
- [ ] Run `npx prisma db push` - schema deploys successfully
- [ ] Test event routing: core events go to PostgreSQL, secondary to Redis
- [ ] Verify Redis keys follow pattern: `event:buffer:secondary:{yyyy-MM-dd}`

### Phase 2 Verification
After completing Phase 2 tasks:
- [ ] Run `npm run build` - must succeed
- [ ] Run `npm test` - existing tests pass
- [ ] Start worker: `npm run worker:dev`
- [ ] Verify workers connect to BullMQ queues
- [ ] Run migration: `npm run migrate:events` - EventDictionary seeded
- [ ] Run migration: `npm run migrate:facts` - LearningFacts created
- [ ] Run migration: `npm run migrate:snapshots` - Snapshots backfilled
- [ ] Test Konling API: `GET /api/ai/konling-context` returns < 100ms

### Phase 3 Verification
- [ ] Teacher dashboard API returns data in < 500ms
- [ ] Risk detection correctly identifies risk students
- [ ] Competency heatmap data is accurate

### Phase 4 Verification
- [ ] Recommendation engine generates valid recommendations
- [ ] Growth portfolio page loads correctly
- [ ] End-to-end event flow: event → buffer → fact → snapshot → API

---

## Unit Tests to Implement

Create these test files:

1. **Competency Engine Tests**
   - File: `src/lib/data-governance/__tests__/competency-engine.test.ts`
   - Test: `calculateCompetencyVector` with known facts
   - Test: `calculateTrendVector` direction calculation
   - Test: `identifyStrengths` and `identifyWeaknesses`

2. **Risk Detector Tests**
   - File: `src/lib/data-governance/__tests__/risk-detector.test.ts`
   - Test: Each risk type detection rule
   - Test: Risk level calculation
   - Test: Scaffolding recommendation

3. **Event Buffer Tests**
   - File: `src/lib/data-governance/__tests__/event-buffer.test.ts`
   - Test: Event routing (core vs secondary)
   - Test: Redis buffer operations
   - Test: Graceful degradation when Redis unavailable

---

## Monitoring Setup (Post-Implementation)

After deployment, set up monitoring for:

1. **Queue Metrics**
   - Queue depths (alert if > 1000)
   - Processing latency (alert if > 5 min)
   - Error rates by queue

2. **Data Freshness**
   - Snapshot age (alert if > 30 min)
   - Event ingestion lag (alert if > 10 min)

3. **API Performance**
   - Konling context API p95 latency (alert if > 200ms)
   - Teacher dashboard API p95 latency (alert if > 1000ms)

---

**Plan complete, reviewed, and updated. Ready to execute using superpowers:subagent-driven-development?**
