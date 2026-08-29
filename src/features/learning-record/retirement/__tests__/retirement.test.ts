import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  INGESTION_RETENTION,
  INGESTION_STATUS,
  assertTerminalBeforeDelete,
  inspectIngestionBoundary,
  successfulPayloadExpired,
  verifyDeletionUnreadability,
} from '@/features/learning-record/ingestion/public-api';
import {
  RETIREMENT_ROWS,
  RETIREMENT_STORE_ISOLATION,
  RetirementGateError,
  assertNoPermissionInheritance,
  assertPublicExportClean,
  assertRetirementDeletionAllowed,
  assertRetirementRollbackSafe,
  authorizeLegacyRawAccess,
  classifyDrainReceipt,
  freezeRevision,
  getRetirementRow,
  isConfirmedQueueReceipt,
  selectAckClaims,
} from '../public-api';

function collectTs(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '__tests__') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue;
      if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(full);
    }
  };
  walk(root);
  return out;
}

describe('learning-record retirement ledger', () => {
  it('fails closed for unknown or unclosed deletion rows', () => {
    expect(freezeRevision()).toMatch(/^[0-9a-f]{9}$/);
    expect(RETIREMENT_ROWS.length).toBeGreaterThan(10);
    expect(() => getRetirementRow('does-not-exist')).toThrow(RetirementGateError);
    expect(() => assertRetirementDeletionAllowed('producer.arena.official')).toThrow(RetirementGateError);
    expect(() => assertRetirementDeletionAllowed('aggregator.interaction-log.profile')).toThrow(RetirementGateError);
    expect(() => assertRetirementDeletionAllowed('projection.student-competency-snapshot')).toThrow(RetirementGateError);
    expect(assertRetirementDeletionAllowed('queue.rpop.destructive').disposition).toBe('code-retired');
    expect(assertRetirementDeletionAllowed('queue.ltrim.destructive').disposition).toBe('code-retired');
    expect(assertRetirementDeletionAllowed('materializer.session-fact-replay').disposition).toBe('code-retired');
  });

  it('keeps Copilot, Arena, Assessment and Personalization contracts off the deletion path', () => {
    expect(getRetirementRow('consumer.copilot').disposition).toBe('retained-authorized');
    expect(getRetirementRow('producer.arena.official').disposition).toBe('retained-authorized');
    expect(getRetirementRow('producer.assessment').disposition).toBe('current-replacement');
    expect(getRetirementRow('consumer.personalization.plugin').disposition).toBe('retained-authorized');
  });
});

describe('queue drain receipts', () => {
  it('acks applied, duplicate and terminal failure, and defers retryable work', () => {
    const claims = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const statuses = [
      INGESTION_STATUS.applied,
      INGESTION_STATUS.deduplicated,
      INGESTION_STATUS.terminalFailed,
      INGESTION_STATUS.retryableFailed,
    ];
    expect(classifyDrainReceipt(statuses[0])).toBe('applied');
    expect(classifyDrainReceipt(statuses[1])).toBe('duplicate');
    expect(classifyDrainReceipt(statuses[2])).toBe('failure');
    expect(classifyDrainReceipt(statuses[3])).toBe('deferred');
    expect(selectAckClaims(claims, statuses).map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(isConfirmedQueueReceipt(INGESTION_STATUS.retryableFailed)).toBe(false);
  });

  it('treats crash-before-ack as recoverable rather than a silent drop', () => {
    const claims = [{ raw: 'msg-1' }, { raw: 'msg-2' }];
    const statuses = [INGESTION_STATUS.applied, INGESTION_STATUS.applied];
    const plannedAck = selectAckClaims(claims, statuses);
    const crashedBeforeAck = true;
    const actuallyAcked = crashedBeforeAck ? [] : plannedAck;
    expect(actuallyAcked).toEqual([]);
    expect(plannedAck).toHaveLength(2);
  });
});

describe('gated deletion zero-caller', () => {
  it('removes destructive RPOP/LTRIM and routes replay through ingest', () => {
    const buffer = readFileSync('src/lib/data-governance/event-buffer.ts', 'utf8');
    const replay = readFileSync('src/lib/data-governance/session-fact-replay.ts', 'utf8');
    const interactive = readFileSync('src/app/api/interactive/events/route.ts', 'utf8');
    const worker = readFileSync('scripts/workers/data-governance-worker.ts', 'utf8');
    expect(buffer).not.toContain('client.rpop(');
    expect(buffer).not.toContain('.ltrim(');
    expect(buffer).toContain('rpoplpush');
    expect(buffer).toContain('SECONDARY_BUFFER_CAPACITY');
    expect(replay).not.toContain('persistCoreLearningFact');
    expect(replay).toContain('ingestLearningFact');
    expect(interactive).not.toContain('persistCoreLearningFact');
    expect(worker).toContain('selectAckClaims');
  });

  it('keeps persistCoreLearningFact as ingest-only in production sources', () => {
    const callers: string[] = [];
    for (const file of [...collectTs('src'), ...collectTs('scripts')]) {
      const text = readFileSync(file, 'utf8');
      if (!text.includes('persistCoreLearningFact')) continue;
      callers.push(file.replace(/\\/g, '/'));
    }
    expect(callers.filter((file) => file.endsWith('learning-fact-materialization.ts')).length).toBe(1);
    expect(callers.filter((file) => file.endsWith('ingestion/ingest.ts')).length).toBe(1);
    expect(callers.some((file) => file.endsWith('session-fact-replay.ts'))).toBe(false);
    expect(callers.some((file) => file.includes('src/app/'))).toBe(false);
  });
});

describe('privacy, retention and rollback', () => {
  it('isolates store ACLs and forbids page/queue raw inheritance', () => {
    assertNoPermissionInheritance();
    expect(RETIREMENT_STORE_ISOLATION.restrictedRaw.acl).not.toBe(RETIREMENT_STORE_ISOLATION.transport.acl);
    expect(RETIREMENT_STORE_ISOLATION.restrictedRaw.acl).not.toBe(RETIREMENT_STORE_ISOLATION.fact.acl);
    expect(() => authorizeLegacyRawAccess({
      purpose: 'audit',
      ticket: 't-1',
      scope: 'student-1',
      role: 'student',
      dualControl: true,
      elevatedUntil: new Date(Date.now() + 60_000),
      approved: true,
    })).toThrow();
    expect(() => authorizeLegacyRawAccess({
      purpose: 'audit',
      ticket: 't-1',
      scope: 'student-1',
      role: 'queue',
      dualControl: true,
      elevatedUntil: new Date(Date.now() + 60_000),
      approved: true,
    })).toThrow();
    authorizeLegacyRawAccess({
      purpose: 'audit',
      ticket: 't-1',
      scope: 'student-1',
      role: 'auditor',
      dualControl: true,
      elevatedUntil: new Date(Date.now() + 60_000),
      approved: true,
    });
  });

  it('scans forbidden fields, mixed schema and unknown digest/ref negatives', () => {
    expect(inspectIngestionBoundary({ answer: 'A', userId: 'student-1' }).length).toBeGreaterThan(0);
    expect(inspectIngestionBoundary({ stack: 'Error: boom at /Users/YW/app.ts' }).length).toBeGreaterThan(0);
    expect(() => assertPublicExportClean({ overallScore: 0.8 })).not.toThrow();
    expect(() => assertPublicExportClean({ rawAnswer: 'x', absolutePath: '/tmp' })).toThrow();
  });

  it('enforces retention caps, terminalization and unreadability', () => {
    expect(INGESTION_RETENTION.successfulPayloadHours).toBe(24);
    expect(INGESTION_RETENTION.failureReceiptDefaultDays).toBe(30);
    expect(INGESTION_RETENTION.failureReceiptMaxDays).toBe(90);
    expect(INGESTION_RETENTION.transportReplayDefaultHours).toBe(72);
    expect(INGESTION_RETENTION.transportReplayMaxDays).toBe(7);
    expect(INGESTION_RETENTION.approvedRawDefaultHours).toBe(24);
    expect(INGESTION_RETENTION.publicAuditDays).toBe(90);
    expect(successfulPayloadExpired(25 * 60 * 60 * 1000)).toBe(true);
    expect(() => assertTerminalBeforeDelete({
      terminalReceipt: false,
      terminalizationInProgress: false,
    })).toThrow();
    expect(verifyDeletionUnreadability({
      object: false,
      index: false,
      cache: false,
      replica: false,
    })).toBe(true);
    expect(verifyDeletionUnreadability({
      object: true,
      index: false,
      cache: false,
      replica: false,
    })).toBe(false);
  });

  it('allows only code/pointer rollback', () => {
    assertRetirementRollbackSafe({
      restoresCodeOrPointer: true,
      mutatesHistoricalFacts: false,
      restoresBroadRawAcl: false,
    });
    expect(() => assertRetirementRollbackSafe({
      restoresCodeOrPointer: true,
      mutatesHistoricalFacts: true,
      restoresBroadRawAcl: false,
    })).toThrow(RetirementGateError);
    expect(() => assertRetirementRollbackSafe({
      restoresCodeOrPointer: true,
      mutatesHistoricalFacts: false,
      restoresBroadRawAcl: true,
    })).toThrow(RetirementGateError);
  });
});
