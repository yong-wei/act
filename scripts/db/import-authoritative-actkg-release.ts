import 'dotenv/config';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  importValidatedRelease,
  loadAndValidateRelease,
  reconstructRelease,
  canonicalJson,
  sha256,
} from '../actkg-release/authoritative-release';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is required');
  const db = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const validated = await loadAndValidateRelease();
    const counts = await importValidatedRelease(db, validated);
    const reconstructed = await reconstructRelease(db, validated.entry.release_id);
    const withoutHash = structuredClone(reconstructed);
    delete withoutHash.release_hash;
    if (sha256(canonicalJson(withoutHash)) !== validated.entry.release_hash) {
      throw new Error('persisted ActKG Release round-trip hash mismatch');
    }
    console.log(JSON.stringify({
      releaseId: validated.entry.release_id,
      captureRevision: validated.captureRevision,
      lockRawHash: validated.lockRawHash,
      candidateState: 'CANDIDATE',
      counts,
      roundTripHash: validated.entry.release_hash,
    }));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'ActKG Release import failed');
  process.exitCode = 1;
});
