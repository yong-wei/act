import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  recordPathChoiceEvidence,
  type PathChoiceEvidenceAction,
} from '@/lib/control-correction-path-rounds';
import {
  assertCanWriteStudentPath,
  getLearningPathRequester,
  readPathForAccess,
  refreshPathEvidenceFeatureCache,
  requireIdempotencyKey,
} from '../../route-helpers';

export const dynamic = 'force-dynamic';

const CHOICE_ACTIONS = new Set(['selection', 'rejection', 'switch', 'helpfulness']);

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const requester = await getLearningPathRequester();
    if (requester instanceof NextResponse) return requester;
    const params = await props.params;
    const path = await readPathForAccess(params.id);
    if (path instanceof NextResponse) return path;
    const denied = assertCanWriteStudentPath(requester, path);
    if (denied) return denied;

    const body = await request.json();
    const missingIdempotencyKey = requireIdempotencyKey(body.idempotencyKey);
    if (missingIdempotencyKey) return missingIdempotencyKey;
    if (typeof body.action !== 'string' || !CHOICE_ACTIONS.has(body.action)) {
      return NextResponse.json({ error: '路径选择动作不符合契约' }, { status: 400 });
    }

    const pathOptions = readPathOptions(path.pathPayload);
    const styleIds = new Set(Array.from(pathOptions.values()).map((option) => option.styleId));
    const selectedOption = resolveChoiceOption(pathOptions, body.selectedOptionId, body.selectedStyleId);
    const selectedStyleId = selectedOption?.styleId ?? null;
    const previousStyleId = nullableString(body.previousStyleId);
    const rejectedStyleIds = [
      ...readStringArray(body.rejectedStyleIds),
      ...readStringArray(body.rejectedOptionIds).map((optionId) => pathOptions.get(optionId)?.styleId ?? optionId),
    ];
    const hasUnknownStyle = [
      selectedStyleId,
      previousStyleId,
      ...rejectedStyleIds,
    ].some((styleId) => styleId && !styleIds.has(styleId));
    if (
      styleIds.size === 0 ||
      hasUnknownStyle ||
      ((body.action === 'selection' || body.action === 'switch' || body.action === 'helpfulness') && !selectedStyleId) ||
      (body.action === 'rejection' && rejectedStyleIds.length === 0)
    ) {
      return NextResponse.json({ error: '路径选择必须引用当前路径方案中的 styleId' }, { status: 400 });
    }
    if (selectedStyleId && rejectedStyleIds.includes(selectedStyleId)) {
      return NextResponse.json({ error: '路径选择不能同时选择并拒绝同一 styleId' }, { status: 400 });
    }
    if (body.action === 'helpfulness' && rejectedStyleIds.length > 0) {
      return NextResponse.json({ error: '路径有用性反馈不能携带 rejectedStyleIds' }, { status: 400 });
    }
    const choice = await recordPathChoiceEvidence(prisma as any, {
      pathId: params.id,
      userId: path.userId,
      goalId: path.goalId ?? null,
      action: body.action as PathChoiceEvidenceAction,
      selectedStyleId,
      selectedPolicyFamily: selectedOption?.policyFamily ?? null,
      rejectedStyleIds,
      previousStyleId,
      diagnosisSnapshotRef: resolveServerDiagnosisSnapshotRef(path),
      resourceMix: selectedOption?.resourceMix ?? {},
      rationaleMetadata: selectedOption?.rationaleMetadata ?? {},
      helpful: typeof body.helpful === 'boolean' ? body.helpful : null,
      eventId: nullableString(body.eventId),
      idempotencyKey: body.idempotencyKey,
      actorUserId: requester.userId,
      actorRole: requester.role,
    });
    const cacheRefresh = await refreshPathEvidenceFeatureCache(path.userId);

    return NextResponse.json({ choice, cacheRefresh });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[LearningPathChoice] Error:', error);
    return NextResponse.json({ error: '记录路径选择失败' }, { status: 500 });
  }
}

interface ServerPathChoiceOption {
  optionId: string;
  styleId: string;
  policyFamily: string | null;
  resourceMix: Record<string, number>;
  rationaleMetadata: Record<string, unknown>;
}

function readPathOptions(pathPayload: unknown): Map<string, ServerPathChoiceOption> {
  const payload = readRecord(pathPayload);
  const policyBundle = readRecord(payload.policyBundle);
  const paths = Array.isArray(policyBundle.paths) ? policyBundle.paths : [];
  const options = new Map<string, ServerPathChoiceOption>();
  paths.forEach((item, index) => {
    const option = readRecord(item);
    const styleId = nullableString(option.styleId);
    if (!styleId) return;
    const optionId = nullableString(option.optionId) ?? `path-option-${index + 1}`;
    const serverOption = {
      optionId,
      styleId,
      policyFamily: nullableString(option.policyFamily),
      resourceMix: readNumberRecord(option.resourceMix),
      rationaleMetadata: compactRecord({
        evidenceBasis: readStringArray(option.evidenceBasis),
        limitations: readStringArray(option.limitations),
        terminalValidationNodeIds: readStringArray(option.terminalValidationNodeIds),
        terminalValidationStrategy: readRecord(option.terminalValidationStrategy),
      }),
    };
    options.set(styleId, serverOption);
    options.set(optionId, serverOption);
  });
  return options;
}

function resolveChoiceOption(
  pathOptions: Map<string, ServerPathChoiceOption>,
  optionId: unknown,
  styleId: unknown,
): ServerPathChoiceOption | null {
  const selectedOptionId = nullableString(optionId);
  if (selectedOptionId) return pathOptions.get(selectedOptionId) ?? null;
  const selectedStyleId = nullableString(styleId);
  if (selectedStyleId) return pathOptions.get(selectedStyleId) ?? null;
  return null;
}

function resolveServerDiagnosisSnapshotRef(path: { learnerStateRef?: unknown; inputSnapshot?: unknown }): string | null {
  const inputSnapshot = readRecord(path.inputSnapshot);
  const candidates = [
    path.learnerStateRef,
    inputSnapshot.diagnosisSnapshotRef,
    inputSnapshot.diagnosisReportSnapshotId,
    inputSnapshot.snapshotId,
    readRecord(inputSnapshot.diagnosisReportSnapshot).id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function readNumberRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(readRecord(value)).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function compactRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => {
    if (Array.isArray(entry)) return entry.length > 0;
    if (entry && typeof entry === 'object') return Object.keys(entry).length > 0;
    return entry !== null && entry !== undefined;
  }));
}
