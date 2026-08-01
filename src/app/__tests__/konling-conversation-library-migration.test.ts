import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'prisma/migrations/20260726003000_add_konling_conversation_library/migration.sql',
  ),
  'utf8',
);

describe('Konling conversation library migration', () => {
  it('uses stable source identities and rerunnable DDL without reclassifying native conversations', () => {
    expect(migration).toContain('"migrationSourceId" = \'legacy:KonlingSession:\' || "id"');
    expect(migration).toContain('WHERE "migrationSourceId" IS NULL');
    expect(migration).toContain("conversation.\"migrationSourceId\" LIKE 'legacy:KonlingSession:%'");
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS');
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS');
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS "AgentSession_konlingSessionId_fkey"');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "activeTurnId" TEXT');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "activeTurnClaimedAt" TIMESTAMP(3)');
  });

  it('excludes expired, empty, and initialization-failure-only legacy sessions', () => {
    expect(migration).toContain('conversation."expiresAt" > CURRENT_TIMESTAMP');
    expect(migration).toContain('jsonb_typeof(conversation."messages") = \'array\'');
    expect(migration).toContain("message->>'role' = 'user'");
    expect(migration).toContain("message->>'role' = 'assistant'");
    expect(migration).toContain("tool_run.\"status\" IN ('succeeded', 'awaiting_approval')");
    expect(migration).toContain('SET "libraryVisible" = EXISTS');
    expect(migration).toContain('[隐私信息]');
  });

  it('preserves chronological JSON messages and tool rows while attaching their AgentSession relation', () => {
    expect(migration).not.toMatch(/UPDATE "KonlingSession"[\s\S]*SET "messages"/);
    expect(migration).not.toMatch(/DELETE FROM "AgentToolRun"/);
    expect(migration).toContain("agent_session.\"stateJson\"->>'konlingSessionId'");
    expect(migration).toContain('SET "konlingSessionId" =');
    expect(migration).toContain('ON DELETE SET NULL');
    expect(migration).not.toContain('ON DELETE CASCADE');
  });

  it('guards every jsonb array expansion and treats non-array messages as unusable', () => {
    const expansions = migration.split('jsonb_array_elements(').slice(1);
    expect(expansions.length).toBeGreaterThan(0);
    for (const expansion of expansions) {
      expect(expansion.slice(0, 220)).toContain('jsonb_typeof(conversation."messages") = \'array\'');
      expect(expansion.slice(0, 220)).toContain("ELSE '[]'::jsonb");
    }
  });
});
