import { prisma } from '@/lib/prisma';

export async function persistDiagnosisReport(params: {
  scopeType: string;
  scopeId: string;
  userId: string;
  reportBody: Record<string, unknown>;
  riskSummary?: Record<string, unknown> | null;
}) {
  return prisma.diagnosisReport.create({
    data: {
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      userId: params.userId,
      reportBody: params.reportBody,
      riskSummary: params.riskSummary ?? undefined,
    },
  });
}

// Call from /api/ai/chat after teacher-diagnosis mode completes:
// if (modeId === 'teacher-diagnosis') {
//   await persistDiagnosisReport({ scopeType: 'class', scopeId, userId, reportBody });
// }
