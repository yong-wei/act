import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import {
  acknowledgeSmartCoursewarePublicationGap,
  acknowledgeSmartCoursewareStalePlan,
  getSmartCoursewarePublicationState,
  publishSmartCoursewareRevision,
  runSmartCoursewareBrowserPublicationValidation,
  runSmartCoursewareStaticPublicationValidation,
} from '@/lib/smart-courseware';

import {
  coursewareIdempotencySchema,
  coursewareIdSchema,
  readCoursewareJson,
  requireSmartCoursewareActor,
  smartCoursewareErrorResponse,
} from '../../../_shared';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('validate-static') }).strict(),
  z.object({ action: z.literal('validate-browser') }).strict(),
  z.object({
    action: z.literal('acknowledge-gap'),
    scope: z.enum(['GOAL', 'MODULE']),
    targetId: coursewareIdSchema,
    gapIdentity: z.string().trim().min(1).max(200),
    reason: z.string().trim().min(1).max(4000),
  }).strict(),
  z.object({
    action: z.literal('acknowledge-stale-plan'),
    newestPlanRevisionId: coursewareIdSchema,
    reason: z.string().trim().min(1).max(4000),
  }).strict(),
  z.object({ action: z.literal('publish'), idempotencyKey: coursewareIdempotencySchema }).strict(),
]);

type RouteContext = { params: Promise<{ revisionId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSmartCoursewareActor();
  if ('response' in auth) return auth.response;
  try {
    const sourceRevisionId = coursewareIdSchema.parse((await context.params).revisionId);
    const publication = await getSmartCoursewarePublicationState(prisma, { actor: auth.actor, sourceRevisionId });
    return NextResponse.json({ publication });
  } catch (error) {
    return smartCoursewareErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSmartCoursewareActor();
  if ('response' in auth) return auth.response;
  try {
    const sourceRevisionId = coursewareIdSchema.parse((await context.params).revisionId);
    const input = actionSchema.parse(await readCoursewareJson(request));
    if (input.action === 'validate-static') {
      await runSmartCoursewareStaticPublicationValidation(prisma, { actor: auth.actor, sourceRevisionId });
    } else if (input.action === 'validate-browser') {
      await runSmartCoursewareBrowserPublicationValidation(prisma, { actor: auth.actor, sourceRevisionId });
    } else if (input.action === 'acknowledge-gap') {
      await acknowledgeSmartCoursewarePublicationGap(prisma, { actor: auth.actor, sourceRevisionId, ...input });
    } else if (input.action === 'acknowledge-stale-plan') {
      await acknowledgeSmartCoursewareStalePlan(prisma, { actor: auth.actor, sourceRevisionId, ...input });
    } else {
      await publishSmartCoursewareRevision(prisma, { actor: auth.actor, sourceRevisionId, idempotencyKey: input.idempotencyKey });
    }
    const publication = await getSmartCoursewarePublicationState(prisma, { actor: auth.actor, sourceRevisionId });
    return NextResponse.json({ publication }, { status: input.action === 'publish' ? 201 : 200 });
  } catch (error) {
    return smartCoursewareErrorResponse(error);
  }
}
