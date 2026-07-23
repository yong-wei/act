import { describe, expect, it, vi } from 'vitest';

import { computeGeneratedSlideContentHash } from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { SmartCoursewareError } from '@/lib/smart-courseware/domain';
import { exportSmartCoursewarePdf } from '@/lib/smart-courseware/pdf-export-service';

import { validCoursewareManifest } from './fixtures';

const actor = { id: 'teacher-1', role: 'TEACHER' } as const;

function publication() {
  const manifest = validCoursewareManifest();
  return {
    id: 'published-1', ownerId: actor.id, revisionNumber: 2, planRevisionNumber: 1,
    manifestSnapshot: manifest, manifestHash: computeGeneratedSlideContentHash(manifest), contentHash: 'a'.repeat(64),
  };
}

describe('smart courseware PDF export service', () => {
  it('rejects a draft, preview, or unpublished identifier before any artifact record can be created', async () => {
    const db = {
      smartCoursewarePdfExport: { findUnique: vi.fn(), create: vi.fn() },
      smartCoursewarePublicationRevision: { findFirst: vi.fn().mockResolvedValue(null) },
    };

    await expect(exportSmartCoursewarePdf(db as never, {
      actor, publicationRevisionId: 'draft-or-preview-1', idempotencyKey: 'pdf-export-key-1',
    })).rejects.toMatchObject({ code: 'pdf-export-published-revision-not-found', status: 404 } satisfies Partial<SmartCoursewareError>);
    expect(db.smartCoursewarePdfExport.create).not.toHaveBeenCalled();
  });

  it('persists only an artifact bound to the immutable publication snapshot and its evidence', async () => {
    const record = publication();
    const create = vi.fn(async ({ data }) => data);
    const db = {
      smartCoursewarePdfExport: { findUnique: vi.fn().mockResolvedValue(null), create, findFirst: vi.fn() },
      smartCoursewarePublicationRevision: { findFirst: vi.fn().mockResolvedValue(record) },
    };

    const exported = await exportSmartCoursewarePdf(db as never, {
      actor, publicationRevisionId: record.id, idempotencyKey: 'pdf-export-key-2',
    });

    expect(create).toHaveBeenCalledOnce();
    expect(exported).toMatchObject({
      publicationRevisionId: record.id,
      rendererVersion: 'smart-courseware-pdf-export-v1',
      manifestHash: record.manifestHash,
      contentHash: record.contentHash,
      pageCount: 6,
      artifactHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(exported.artifactBytes.byteLength).toBe(exported.artifactSizeBytes);
  });
});
