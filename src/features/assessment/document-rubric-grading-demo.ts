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
        id: 'model-assumptions',
        label: '模型假设',
        weight: 0.2,
        evidenceRequirement: 'damping ratio',
        goalDimension: 'controlModeling',
        levels: [
          { id: 'novice', label: '待改进', score: 1, description: '模型假设缺失或无法支撑控制设计' },
          { id: 'proficient', label: '达标', score: 3, description: '说明了主要模型假设' },
          { id: 'advanced', label: '优秀', score: 4, description: '模型假设、阻尼语义和适用边界清晰' },
        ],
      },
      {
        id: 'target-specification',
        label: '目标指标',
        weight: 0.2,
        evidenceRequirement: 'Target specification',
        goalDimension: 'parameterDesign',
        levels: [
          { id: 'novice', label: '待改进', score: 1, description: '缺少可检验目标' },
          { id: 'proficient', label: '达标', score: 3, description: '给出基本时域或频域目标' },
          { id: 'advanced', label: '优秀', score: 4, description: '目标、容许边界和工程权衡明确' },
        ],
      },
      {
        id: 'compensator-design',
        label: '校正方案',
        weight: 0.2,
        evidenceRequirement: 'Compensator design',
        goalDimension: 'parameterDesign',
        levels: [
          { id: 'novice', label: '待改进', score: 1, description: '方案与目标脱节' },
          { id: 'proficient', label: '达标', score: 3, description: '校正结构基本合理' },
          { id: 'advanced', label: '优秀', score: 4, description: '校正结构、参数和极点移动逻辑一致' },
        ],
      },
      {
        id: 'simulation-evidence',
        label: '仿真验证',
        weight: 0.2,
        evidenceRequirement: 'Simulation validation',
        goalDimension: 'parameterDesign',
        levels: [
          { id: 'novice', label: '待改进', score: 1, description: '缺少验证' },
          { id: 'proficient', label: '达标', score: 3, description: '有基本验证' },
          { id: 'advanced', label: '优秀', score: 4, description: '验证充分' },
        ],
      },
      {
        id: 'engineering-rationale',
        label: '工程论证',
        weight: 0.2,
        evidenceRequirement: 'engineering tradeoffs',
        goalDimension: 'engineeringDecision',
        levels: [
          { id: 'novice', label: '待改进', score: 1, description: '缺少工程取舍说明' },
          { id: 'proficient', label: '达标', score: 3, description: '能说明主要取舍' },
          { id: 'advanced', label: '优秀', score: 4, description: '论证能连接设计目标、控制代价和工程约束' },
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
      'Target specification states overshoot below ten percent and settling time under four seconds.',
      'Compensator design uses a lead network to shift the dominant poles.',
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
    criterionId: 'simulation-evidence',
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
