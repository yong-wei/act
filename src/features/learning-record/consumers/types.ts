import type {
  ProjectionStatus,
  SafeFeatureRead,
  StudentProjectionRead,
  TeacherClassProjectionRead,
} from '@/features/learning-record/projections/types';
import type {
  CumulativeClassPortraitReadModel,
  CumulativePortraitReadModel,
} from '@/lib/data-governance/cumulative-portrait-read-model';
import type { PortraitV2Consumer } from '@/lib/data-governance/portrait-v2-model';

export interface StudentEvidencePortResult {
  status: ProjectionStatus;
  reason: string | null;
  knownZero: boolean;
  subjectRef: string;
  read: StudentProjectionRead;
  portrait: CumulativePortraitReadModel;
}

export interface TeacherClassEvidencePortResult {
  classPortrait: CumulativeClassPortraitReadModel;
  learnerPortraits: Map<string, CumulativePortraitReadModel>;
  classRead: TeacherClassProjectionRead;
  studentReads: Map<string, StudentProjectionRead>;
}

export interface TeacherStudentEvidencePortResult {
  student: StudentEvidencePortResult;
  classPortrait: CumulativeClassPortraitReadModel;
  classRead: TeacherClassProjectionRead;
}

export interface SafeConsumerRead {
  feature: SafeFeatureRead;
  portrait: CumulativePortraitReadModel;
  knownZero: boolean;
}

export type ConsumerPortraitKind = PortraitV2Consumer;
