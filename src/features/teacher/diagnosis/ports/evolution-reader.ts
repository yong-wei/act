import type { ReadTeacherDiagnosisEvolutionInput } from '../public-api';

export interface TeacherDiagnosisMetricSnapshotRecord {
  id: string;
  schemaVersion: string;
  computationVersion: string;
  scopeType: string;
  scopeId: string;
  memberSetFingerprint: string;
  evidenceCutoff: Date;
  metrics: unknown;
  generatedAt: Date;
}

export interface TeacherDiagnosisEvolutionRecord {
  id: string;
  scopeType: 'class';
  scopeId: string;
  evidenceCutoff: Date;
  generatedAt: Date;
  metricSnapshot: TeacherDiagnosisMetricSnapshotRecord | null;
}

export interface TeacherDiagnosisEvolutionReader {
  read(input: ReadTeacherDiagnosisEvolutionInput): Promise<TeacherDiagnosisEvolutionRecord[]>;
}
