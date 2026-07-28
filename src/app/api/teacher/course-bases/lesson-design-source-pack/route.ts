import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  buildCourseBasisLessonDesignSourcePack,
  buildCourseBasisLessonDesignSar,
  courseBasisErrorResponse,
  requireCourseBasisActor,
} from '@/lib/course-basis';
import { prisma } from '@/lib/prisma';

const requestSchema = z.object({
  selectedVersionIds: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
  explicitRetiredVersionIds: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  query: z.string().trim().min(1).max(1000),
}).strict().refine(
  (input) => input.explicitRetiredVersionIds.every((id) => input.selectedVersionIds.includes(id)),
  { message: 'retired-version-must-be-selected', path: ['explicitRetiredVersionIds'] },
);

export async function POST(request: Request) {
  const auth = await requireCourseBasisActor();
  if ('response' in auth) return auth.response;
  try {
    const input = requestSchema.parse(await request.json());
    const sar = await buildCourseBasisLessonDesignSar(prisma, {
      actor: auth.actor,
      selectedVersionIds: input.selectedVersionIds,
      explicitRetiredVersionIds: input.explicitRetiredVersionIds,
      query: input.query,
    });
    const sourcePack = await buildCourseBasisLessonDesignSourcePack(prisma, {
      actor: auth.actor,
      selectedVersionIds: input.selectedVersionIds,
      explicitRetiredVersionIds: input.explicitRetiredVersionIds,
      sar,
      retrieval: { query: input.query },
    });
    const pack = sourcePack.retrieval.pack;
    return NextResponse.json({
      sourcePack: {
        packId: pack.packId,
        profile: pack.profile,
        itemCount: pack.items.length,
        citationTargetIds: pack.audit.citationTargetIds,
        retrievalChunkIds: pack.audit.retrievalChunkIds,
        coverage: pack.coverage,
      },
    });
  } catch (error) {
    return courseBasisErrorResponse(error);
  }
}
