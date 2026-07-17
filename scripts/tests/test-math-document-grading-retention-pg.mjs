import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Check before importing the repository Prisma wrapper: that module loads
// dotenv/config, which must never make this explicit integration gate choose
// an unrelated .env database.
if (!process.env.DATABASE_URL?.trim()) {
  console.error('DATABASE_URL is required; refusing to load dotenv or connect to another database.');
  process.exit(2);
}

const { createPrismaClient } = await import('../lib/prisma-client.mjs');
const clients = [createPrismaClient(), createPrismaClient()];
const now = new Date();
const resourceKeys = [];
const phaseFiveTable = `issue916_phase5_lease_${process.pid}`;
const phaseFiveHoldTable = `issue916_phase5_hold_${process.pid}`;
const phaseSixLegacyTable = `issue916_phase6_legacy_${process.pid}`;
const phaseSixPolicyTable = `issue916_phase6_policy_${process.pid}`;

async function createFixture(client, resourceKey, overrides = {}) {
  await client.gradingTombstone.create({
    data: {
      id: `integration:${randomUUID()}`,
      resourceType: 'IntegrationFixture',
      resourceId: randomUUID(),
      resourceKey,
      lookupKey: overrides.lookupKey ?? `integration:grading-lookup:${resourceKey}`,
      reason: 'integration-test',
      status: 'PENDING',
      deletionIntentAt: now,
      ...overrides,
    },
  });
  resourceKeys.push(resourceKey);
}

async function claim(client, resourceKey, token, at) {
  return client.$transaction(async (tx) => {
    const result = await tx.gradingTombstone.updateMany({
      where: {
        resourceKey,
        status: { in: ['PENDING', 'RETRYABLE', 'BLOCKED'] },
        OR: [{ deletionClaimToken: null }, { deletionLeaseExpiresAt: { lt: at } }],
      },
      data: {
        deletionClaimToken: token,
        deletionClaimedAt: at,
        deletionLeaseExpiresAt: new Date(at.getTime() + 300_000),
      },
    });
    return result.count;
  });
}

try {
  const resourceKey = `integration:grading-tombstone:${randomUUID()}`;
  const ownerA = randomUUID();
  const ownerB = randomUUID();
  await createFixture(clients[0], resourceKey);
  const counts = await Promise.all([claim(clients[0], resourceKey, ownerA, now), claim(clients[1], resourceKey, ownerB, now)]);
  assert.equal(counts.filter((count) => count === 1).length, 1, `expected one lease winner, got ${counts.join(',')}`);
  const winner = counts[0] === 1 ? ownerA : ownerB;
  const loser = winner === ownerA ? ownerB : ownerA;
  const staleCompletion = await clients[0].gradingTombstone.updateMany({ where: { resourceKey, status: 'PENDING', deletionClaimToken: loser }, data: { status: 'DELETED' } });
  assert.equal(staleCompletion.count, 0, 'stale owner must not complete a live lease');
  const completion = await clients[1].gradingTombstone.updateMany({ where: { resourceKey, status: 'PENDING', deletionClaimToken: winner }, data: { status: 'DELETED', physicalDeletedAt: now, contentDeletedAt: now, deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null } });
  assert.equal(completion.count, 1, 'current owner must complete its lease');

  const takeoverKey = `integration:grading-tombstone-expiry:${randomUUID()}`;
  const expiredOwner = randomUUID();
  const takeoverOwner = randomUUID();
  await createFixture(clients[0], takeoverKey, {
    deletionClaimToken: expiredOwner,
    deletionClaimedAt: new Date(now.getTime() - 600_000),
    deletionLeaseExpiresAt: new Date(now.getTime() - 1),
  });
  assert.equal(await claim(clients[1], takeoverKey, takeoverOwner, now), 1, 'expired lease must be takeable');
  const staleRenewal = await clients[0].gradingTombstone.updateMany({ where: { resourceKey: takeoverKey, status: 'PENDING', deletionClaimToken: expiredOwner }, data: { deletionLeaseExpiresAt: new Date(now.getTime() + 300_000) } });
  assert.equal(staleRenewal.count, 0, 'stale owner must not renew after takeover');
  const staleTakeoverCompletion = await clients[0].gradingTombstone.updateMany({ where: { resourceKey: takeoverKey, status: 'PENDING', deletionClaimToken: expiredOwner }, data: { status: 'DELETED' } });
  assert.equal(staleTakeoverCompletion.count, 0, 'stale owner must not complete after takeover');
  const takeoverCompletion = await clients[1].gradingTombstone.updateMany({ where: { resourceKey: takeoverKey, status: 'PENDING', deletionClaimToken: takeoverOwner }, data: { status: 'DELETED', physicalDeletedAt: now, contentDeletedAt: now, deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null } });
  assert.equal(takeoverCompletion.count, 1, 'new owner must complete after takeover');

  await clients[0].$executeRawUnsafe(`CREATE TABLE "${phaseFiveTable}" ("id" TEXT PRIMARY KEY, "claim_token" TEXT NOT NULL, "state" TEXT NOT NULL, "claimed_at" TIMESTAMP(3), "lease_expires_at" TIMESTAMP(3))`);
  for (const id of ['grading-job', 'grading-tombstone', 'batch-item', 'source-asset']) {
    await clients[0].$executeRawUnsafe(`INSERT INTO "${phaseFiveTable}" ("id", "claim_token", "state", "claimed_at", "lease_expires_at") VALUES ($1, $2, 'ACTIVE', $3, $4)`, id, 'owner-a', now, new Date(now.getTime() + 300_000));
  }
  const staleExpiry = new Date(now.getTime() + 360_000);
  const laterExpiry = new Date(now.getTime() + 900_000);
  const laterClaimedAt = new Date(now.getTime() + 600_000);
  // Every renewal uses the database CAS predicate: lease_expires_at < proposed_expiry
  // and claimed_at < proposed_claimed_at; a stale client may not write back its snapshot.
  for (const id of ['grading-job', 'grading-tombstone', 'batch-item', 'source-asset']) {
    const laterCount = await clients[1].$executeRawUnsafe(`UPDATE "${phaseFiveTable}" SET "claimed_at" = $1, "lease_expires_at" = $2 WHERE "id" = $3 AND "claim_token" = 'owner-a' AND "state" = 'ACTIVE' AND "lease_expires_at" < $2`, laterClaimedAt, laterExpiry, id);
    assert.equal(laterCount, 1, `${id} later heartbeat must win`);
    const staleCount = await clients[0].$executeRawUnsafe(`UPDATE "${phaseFiveTable}" SET "claimed_at" = $1, "lease_expires_at" = $2 WHERE "id" = $3 AND "claim_token" = 'owner-a' AND "state" = 'ACTIVE' AND "lease_expires_at" < $2 AND "claimed_at" < $1`, now, staleExpiry, id);
    assert.equal(staleCount, 0, `${id} stale heartbeat must not overwrite the later expiry`);
    const [row] = await clients[0].$queryRawUnsafe(`SELECT "claimed_at", "lease_expires_at" FROM "${phaseFiveTable}" WHERE "id" = $1`, id);
    assert.ok(row.lease_expires_at.getTime() >= laterExpiry.getTime(), `${id} must retain the later lease`);
  }

  await clients[0].$executeRawUnsafe(`UPDATE "${phaseFiveTable}" SET "claim_token" = 'owner-b' WHERE "id" = 'source-asset'`);
  const staleOwnerCount = await clients[0].$executeRawUnsafe(`UPDATE "${phaseFiveTable}" SET "lease_expires_at" = $1 WHERE "id" = 'source-asset' AND "claim_token" = 'owner-a' AND "lease_expires_at" < $1`, new Date(now.getTime() + 1_200_000));
  assert.equal(staleOwnerCount, 0, 'stale owner must not renew after token takeover');

  await clients[0].$executeRawUnsafe(`CREATE TABLE "${phaseFiveHoldTable}" ("object_key" TEXT PRIMARY KEY, "claim_token" TEXT NOT NULL, "status" TEXT NOT NULL, "hold_active" BOOLEAN NOT NULL DEFAULT FALSE, "physical_deleted_at" TIMESTAMP(3))`);
  await clients[0].$executeRawUnsafe(`INSERT INTO "${phaseFiveHoldTable}" ("object_key", "claim_token", "status") VALUES ('hold-barrier-object', 'hold-owner', 'PENDING')`);
  await clients[1].$executeRawUnsafe(`UPDATE "${phaseFiveHoldTable}" SET "hold_active" = TRUE WHERE "object_key" = 'hold-barrier-object'`);
  const deletedWithHold = await clients[0].$executeRawUnsafe(`UPDATE "${phaseFiveHoldTable}" SET "status" = 'DELETED_WITH_HOLD', "physical_deleted_at" = $1 WHERE "object_key" = 'hold-barrier-object' AND "claim_token" = 'hold-owner' AND "status" = 'PENDING' AND "hold_active" = TRUE`, now);
  assert.equal(deletedWithHold, 1, 'hold barrier must preserve the physical deletion fact');
  const [holdRow] = await clients[0].$queryRawUnsafe(`SELECT "status", "physical_deleted_at" FROM "${phaseFiveHoldTable}" WHERE "object_key" = 'hold-barrier-object'`);
  assert.equal(holdRow.status, 'DELETED_WITH_HOLD');
  assert.ok(holdRow.physical_deleted_at);

  await clients[0].$executeRawUnsafe(`CREATE TABLE "${phaseSixLegacyTable}" ("id" TEXT PRIMARY KEY, "text_snapshot" TEXT, "lifecycle_blocked_at" TIMESTAMP(3), "lifecycle_block_reason" TEXT, "item_state" TEXT NOT NULL, "item_claim" TEXT, "job_state" TEXT NOT NULL, "job_claim" TEXT, "batch_state" TEXT NOT NULL)`);
  await clients[0].$executeRawUnsafe(`INSERT INTO "${phaseSixLegacyTable}" ("id", "text_snapshot", "item_state", "item_claim", "job_state", "job_claim", "batch_state") VALUES ('historical-text-snapshot', '真实历史答案', 'GRADING', 'old-item-owner', 'RUNNING', 'old-job-owner', 'RUNNING')`);
  await clients[0].$transaction(async (tx) => {
    // This mirrors the phase-six transaction boundary: block the legacy row,
    // Prisma's workerClaimToken and workerClaimedAt map to these SQL claim
    // columns; freeze its active grading job and batch item and clear both.
    await tx.$executeRawUnsafe(`UPDATE "${phaseSixLegacyTable}" SET "lifecycle_blocked_at" = CURRENT_TIMESTAMP, "lifecycle_block_reason" = 'legacy-text-snapshot-lifecycle-policy-incomplete' WHERE "text_snapshot" IS NOT NULL AND "lifecycle_blocked_at" IS NULL`);
    await tx.$executeRawUnsafe(`UPDATE "${phaseSixLegacyTable}" SET "item_state" = 'BLOCKED', "item_claim" = NULL WHERE "lifecycle_blocked_at" IS NOT NULL AND "item_state" IN ('QUEUED', 'CONVERTING', 'GRADING', 'RETRYABLE')`);
    await tx.$executeRawUnsafe(`UPDATE "${phaseSixLegacyTable}" SET "job_state" = 'CONTENT_UNAVAILABLE', "job_claim" = NULL WHERE "lifecycle_blocked_at" IS NOT NULL AND "job_state" IN ('QUEUED', 'RUNNING', 'RETRYABLE')`);
    await tx.$executeRawUnsafe(`UPDATE "${phaseSixLegacyTable}" SET "batch_state" = 'BLOCKED' WHERE "lifecycle_blocked_at" IS NOT NULL AND "batch_state" IN ('QUEUED', 'RUNNING', 'RETRYABLE')`);
  });
  const [legacyRow] = await clients[0].$queryRawUnsafe(`SELECT "text_snapshot", "lifecycle_blocked_at", "item_state", "item_claim", "job_state", "job_claim", "batch_state" FROM "${phaseSixLegacyTable}" WHERE "id" = 'historical-text-snapshot'`);
  assert.equal(legacyRow.text_snapshot, '真实历史答案', 'historical text snapshot must never be nulled by legacy blocking');
  assert.ok(legacyRow.lifecycle_blocked_at, 'legacy snapshot must be lifecycle blocked');
  assert.equal(legacyRow.item_state, 'BLOCKED');
  assert.equal(legacyRow.item_claim, null);
  assert.equal(legacyRow.job_state, 'CONTENT_UNAVAILABLE');
  assert.equal(legacyRow.job_claim, null);
  assert.equal(legacyRow.batch_state, 'BLOCKED');

  await clients[0].$executeRawUnsafe(`CREATE TABLE "${phaseSixPolicyTable}" ("id" TEXT PRIMARY KEY, "retention_seconds" INTEGER, "governed_record_rule" TEXT, "delete_strategy" TEXT, CHECK (("retention_seconds" IS NULL AND "delete_strategy" = 'retain-governed-record' AND NULLIF(BTRIM("governed_record_rule"), '') IS NOT NULL) OR ("retention_seconds" IS NOT NULL AND "retention_seconds" >= 1 AND "delete_strategy" IN ('delete-content', 'pseudonymize-lineage') AND NULLIF(BTRIM("governed_record_rule"), '') IS NULL)))`);
  await clients[0].$executeRawUnsafe(`INSERT INTO "${phaseSixPolicyTable}" VALUES ('finite', 60, NULL, 'delete-content'), ('governed', NULL, 'legal-evidence.v1', 'retain-governed-record')`);
  await assert.rejects(
    clients[0].$executeRawUnsafe(`INSERT INTO "${phaseSixPolicyTable}" VALUES ('invalid-retain-finite', 60, 'legal-evidence.v1', 'retain-governed-record')`),
    /violates check constraint|check constraint/i,
    'finite retention and governed retention must be mutually exclusive',
  );

  const rows = await clients[0].gradingTombstone.findMany({ where: { resourceKey: { in: [resourceKey, takeoverKey] } }, select: { status: true, deletionClaimToken: true } });
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.status === 'DELETED' && row.deletionClaimToken === null));
  console.log('real PostgreSQL grading tombstone CAS/expiry takeover/stale-owner test passed');
} finally {
  for (const resourceKey of resourceKeys) {
    await clients[0].gradingTombstone.deleteMany({ where: { resourceKey } }).catch(() => undefined);
  }
  await clients[0].$executeRawUnsafe(`DROP TABLE IF EXISTS "${phaseFiveHoldTable}"`).catch(() => undefined);
  await clients[0].$executeRawUnsafe(`DROP TABLE IF EXISTS "${phaseFiveTable}"`).catch(() => undefined);
  await clients[0].$executeRawUnsafe(`DROP TABLE IF EXISTS "${phaseSixPolicyTable}"`).catch(() => undefined);
  await clients[0].$executeRawUnsafe(`DROP TABLE IF EXISTS "${phaseSixLegacyTable}"`).catch(() => undefined);
  await Promise.all(clients.map((client) => client.$disconnect()));
}
