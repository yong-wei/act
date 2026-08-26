import type { DiagnosisReportsPayload } from '@/features/teacher/diagnosis/public-api';
import type { TeacherStudentInsightsPayload } from '@/app/api/teacher/classes/[classId]/students/[studentId]/insights/route';

export const EVIDENCE_CLASS_ID = 'class-evidence';
export const EVIDENCE_STUDENT_ID = 'student-evidence';
export const PRIVATE_EVIDENCE_MARKERS = ['private-evidence-row-1', 'private-evidence-row-2'];

const generatedAt = '2026-08-01T07:05:00.000Z';
const olderGeneratedAt = '2026-07-25T07:05:00.000Z';
const evidenceCutoff = '2026-08-01T07:00:00.000Z';
const preparationLink = `/teacher/preparation?knowledgeNodeId=node-control-error&classId=${EVIDENCE_CLASS_ID}`;

const readyReport = {
  id: 'report-class-latest',
  scopeType: 'class' as const,
  scopeId: EVIDENCE_CLASS_ID,
  classId: EVIDENCE_CLASS_ID,
  targetUserId: null,
  reportBody: {
    summary: '班级在稳态误差判断上已有稳定证据，仍需区分系统型别与输入类型。',
    findings: [{
      title: '稳态误差判断需要分层复核',
      summary: '部分学习者仍把带宽作为唯一判断依据。',
      knowledgeNodeId: 'node-control-error',
      riskType: 'constraint' as const,
      severity: 'medium' as const,
      evidenceRefs: [`knowledge-progress:${PRIVATE_EVIDENCE_MARKERS[1]}`],
      confidence: 'medium' as const,
      prepLink: preparationLink,
    }],
    evidenceRefs: [`student-competency-snapshot:${PRIVATE_EVIDENCE_MARKERS[0]}`],
    evidenceCutoff,
    sourceCoverage: { classMembers: 30, includedStudents: 24, coverage: 0.8 },
    confidence: 'high' as const,
    limitations: [],
  },
  riskSummary: {
    total: 1,
    byType: { stagnation: 0, constraint: 1, cross_domain: 0 },
    bySeverity: { low: 0, medium: 1, high: 0 },
  },
  evidenceCutoff,
  generatorVersion: 'teacher-diagnosis.v1',
  generatedAt,
};

const olderReport = {
  ...readyReport,
  id: 'report-class-older',
  generatedAt: olderGeneratedAt,
  reportBody: {
    ...readyReport.reportBody,
    summary: '上一周期的班级诊断快照，用于验证只读历史选择。',
    confidence: 'medium' as const,
  },
};

export const classReportsPayload = {
  reports: [readyReport, olderReport],
} satisfies DiagnosisReportsPayload;

export const studentReportsPayload = {
  reports: [{
    ...readyReport,
    id: 'report-student-degraded',
    scopeType: 'student' as const,
    scopeId: EVIDENCE_STUDENT_ID,
    targetUserId: EVIDENCE_STUDENT_ID,
    reportBody: {
      ...readyReport.reportBody,
      summary: '该学生当前证据覆盖有限，结论仅用于备课复核。',
      confidence: 'low' as const,
      limitations: ['当前仅有部分练习形成了可用证据。'],
    },
  }],
} satisfies DiagnosisReportsPayload;

export const classDetailFixture = {
  id: EVIDENCE_CLASS_ID,
  name: '控制工程证据班',
  code: 'EVIDENCE-01',
  description: '商业 UI 证据专用的受控班级投影。',
  year: '2026',
  semester: '秋季',
  isActive: true,
  students: [{
    id: 'profile-evidence',
    studentNumber: 'S-EVIDENCE',
    techScore: 78,
    ethicsScore: 82,
    user: {
      id: EVIDENCE_STUDENT_ID,
      name: '证据学生',
      email: 'evidence-student@example.invalid',
    },
  }],
  _count: { students: 1 },
};

export const studentInsightsFixture = {
  student: {
    id: EVIDENCE_STUDENT_ID,
    name: '证据学生',
    email: 'evidence-student@example.invalid',
    studentNumber: 'S-EVIDENCE',
    classId: EVIDENCE_CLASS_ID,
    className: '控制工程证据班',
  },
  overview: {
    overallScore: 72,
    overallLevel: '发展中',
    evidenceState: 'current',
    availabilityReason: 'available',
    evidenceAsOf: evidenceCutoff,
    generatedAt,
    confidence: 0.58,
    evidencedDimensionCount: 3,
    missingDimensionCount: 4,
    lastTrend: 'stable',
    lastRisk: [{
      type: 'constraint',
      severity: 'medium',
      description: '稳态误差判断仍受单一指标假设限制。',
      occurredAt: evidenceCutoff,
    }],
    strengths: ['闭环结构识别'],
    improvementAreas: ['稳态误差判断'],
  },
  dimensions: [],
  taskAttainment: { personal: null, classAggregate: null },
  classComparison: [],
  growthRecords: [],
  latestActivity: { facts: [], durableSubmissions: [], sessionReports: [] },
  overallDiagnosis: {
    conclusion: '现有证据支持继续练习稳态误差与系统型别的对应关系。',
    strengths: ['闭环结构识别'],
    improvementAreas: ['稳态误差判断'],
    limitations: ['样本覆盖有限'],
  },
  goalSpecificDiagnosis: {
    version: 'role-based-learning-diagnosis.v1',
    view: 'teacher-student',
    goalId: 'control-correction',
    generatedAt,
    materialization: {
      version: 'role-based-learning-diagnosis.v1',
      inputs: ['control-correction-diagnosis-report-snapshot'],
      refresh: 'on-evidence-change-or-request',
    },
    claims: [],
    limitations: [],
    rootCauseClusters: [],
    drilldownRefs: [],
    auditRefs: [],
    redactionPolicy: {
      rawPayloads: 'omitted',
      ordinaryViews: 'redacted-summaries-only',
    },
  },
} satisfies TeacherStudentInsightsPayload;
