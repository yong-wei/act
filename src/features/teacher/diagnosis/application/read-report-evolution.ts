import type {
  DiagnosisEvolutionPayload,
  ReadTeacherDiagnosisEvolutionInput,
} from '../public-api';
import type { TeacherDiagnosisEvolutionReader } from '../ports/evolution-reader';

export async function readTeacherDiagnosisReportEvolution(input: {
  reader: TeacherDiagnosisEvolutionReader;
} & ReadTeacherDiagnosisEvolutionInput): Promise<DiagnosisEvolutionPayload> {
  const rows = await input.reader.read({
    teacherId: input.teacherId,
    classId: input.classId,
    limit: input.limit,
  });
  return {
    reports: rows.map((row) => ({
      id: row.id,
      scopeType: row.scopeType,
      scopeId: row.scopeId,
      evidenceCutoff: row.evidenceCutoff.toISOString(),
      generatedAt: row.generatedAt.toISOString(),
      metricSnapshot: row.metricSnapshot
        ? {
            id: row.metricSnapshot.id,
            schemaVersion: row.metricSnapshot.schemaVersion,
            computationVersion: row.metricSnapshot.computationVersion,
            scopeType: row.metricSnapshot.scopeType,
            scopeId: row.metricSnapshot.scopeId,
            memberSetFingerprint: row.metricSnapshot.memberSetFingerprint,
            evidenceCutoff: row.metricSnapshot.evidenceCutoff.toISOString(),
            metrics: row.metricSnapshot.metrics,
            generatedAt: row.metricSnapshot.generatedAt.toISOString(),
          }
        : null,
    })),
  };
}
