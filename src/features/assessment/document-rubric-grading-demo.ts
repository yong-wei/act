import {
  approveGradingRun,
  buildStudentGradingFeedbackView,
  buildTeacherGradingWorkbenchView,
  convertSubmissionDocument,
  createDraftRubricGrading,
  createMarkItDownConversionAdapter,
  createSubmissionAsset,
  editCriterionGrade,
  textFixtureMarkItDownRunner,
  type RubricDefinition,
} from '@/lib/data-governance/document-rubric-grading-workbench';

export function demoDocumentRubric() {
  return {
    id: 'rubric-control-report',
    title: '控制设计报告评分量规',
    version: '2026.06',
    maxScore: 4,
    criteria: [
      {
        id: 'modeling',
        label: '模型与指标表达',
        weight: 0.4,
        evidenceRequirement: 'damping ratio',
        goalDimension: 'controlModeling',
        levels: [
          { id: 'novice', label: '待改进', score: 1, description: '指标缺失' },
          { id: 'proficient', label: '达标', score: 3, description: '指标基本完整' },
          { id: 'advanced', label: '优秀', score: 4, description: '指标和权衡清晰' },
        ],
      },
      {
        id: 'validation',
        label: '仿真验证',
        weight: 0.6,
        evidenceRequirement: 'Simulation validation',
        goalDimension: 'parameterDesign',
        levels: [
          { id: 'novice', label: '待改进', score: 1, description: '缺少验证' },
          { id: 'proficient', label: '达标', score: 3, description: '有基本验证' },
          { id: 'advanced', label: '优秀', score: 4, description: '验证充分' },
        ],
      },
    ],
  } satisfies RubricDefinition;
}

export async function buildDocumentRubricDemoViews(input: { studentId?: string; viewerStudentId?: string } = {}) {
  const now = new Date('2026-06-04T08:00:00.000Z');
  const asset = createSubmissionAsset({
    id: 'asset-demo-report',
    studentId: input.studentId ?? 'student-demo',
    classId: 'class-demo',
    assignmentId: 'report-control-design',
    fileName: 'root-locus-report.pdf',
    mimeType: 'application/pdf',
    bytes: [
      'Root locus design explains damping ratio and settling time.',
      'Simulation validation shows overshoot below the target.',
      'Reflection connects controller gain with engineering tradeoffs.',
    ].join('\n'),
    uploadedAt: now.toISOString(),
  });
  const rubric = demoDocumentRubric();
  const convertedDocument = await convertSubmissionDocument({
    asset,
    adapter: createMarkItDownConversionAdapter({
      now,
      preserveSpanMapping: false,
      runner: (submission) => textFixtureMarkItDownRunner(submission, false),
    }),
    now,
  });
  const draft = createDraftRubricGrading({ convertedDocument, rubric, now });
  const edited = editCriterionGrade(draft, {
    criterionId: 'validation',
    levelId: 'advanced',
    score: 4,
    comment: '验证过程充分，图表与结论一致。',
    reviewerId: 'teacher-demo',
    now,
  });
  const approved = approveGradingRun(edited, {
    reviewerId: 'teacher-demo',
    decision: 'approved',
    notes: '可以返回学生。',
    now,
  });

  return {
    teacherView: buildTeacherGradingWorkbenchView({
      asset,
      convertedDocument,
      rubric,
      run: edited,
    }),
    studentView: buildStudentGradingFeedbackView({
      asset,
      convertedDocument,
      rubric,
      run: approved,
      viewerStudentId: input.viewerStudentId ?? asset.studentId,
    }),
  };
}
