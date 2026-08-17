import type { DiagnosisReportApiItem } from '@/app/api/teacher/classes/[classId]/diagnosis-reports/route';

type EvidenceGroupId = 'assignment' | 'assessment' | 'learning-behavior';
type CoverageState = 'available' | 'partial' | 'unavailable';
type ComparisonState = 'ready' | 'no-baseline' | 'scope-mismatch' | 'version-mismatch' | 'insufficient-structure';

export interface EvidenceCoverageGroup {
  id: EvidenceGroupId;
  label: string;
  state: CoverageState;
  includedLabel: string;
  missingLabel: string;
  detailSources: string[];
  explanation: string;
}

export interface ConfidenceReason {
  reason: string;
  recoveryAction: string;
}

export interface ReportAvailability {
  label: string;
  description: string;
  recoveryAction: string;
}

export interface ReportComparison {
  state: ComparisonState;
  description: string;
  additions?: number;
  persistent?: number;
  improved?: number;
  riskEscalated?: number;
  riskDowngraded?: number;
  incomparableSeverityTransitions?: number;
}

export interface ReportHistoryCardProjection {
  scopeLabel: string;
  includedStudentsLabel: string;
  evidenceCutoffLabel: string;
  generationReason: string;
  mainWeaknessLabel: string;
  availability: ReportAvailability;
  evidenceGroups: EvidenceCoverageGroup[];
  confidenceReasons: ConfidenceReason[];
  comparison: ReportComparison;
  declaredLimitations: string[];
  attributionLimited: boolean;
}

const LIMITATION_LABELS: Record<string, string> = {
  'class-members-truncated-at-500': '班级人数超过本次诊断读取上限，结果仅覆盖部分成员。',
  'class-has-no-current-members': '当前班级没有可纳入诊断的在册学生。',
  'knowledge-progress-truncated-at-1000': '学习行为证据达到读取上限，结果仅覆盖部分记录。',
  'no-current-competency-snapshots': '没有可用的能力快照证据。',
  'no-current-governed-risk-flags': '没有可用的当前风险证据。',
  'no-knowledge-progress-evidence': '没有可用的知识点学习进度证据。',
  'risk-flags-truncated-at-500': '风险证据达到读取上限，结果仅覆盖部分记录。',
};

const INTERNAL_SOURCE_LABELS: Record<string, string> = {
  'knowledge-progress': '知识点学习进度',
  'student-competency-snapshot': '能力快照',
  'student-risk-flag': '当前风险标记',
};

const SEVERITY_RANK = { low: 1, medium: 2, high: 3 } as const;

export function projectReportHistoryCard(
  report: DiagnosisReportApiItem,
  adjacentOlderReport?: DiagnosisReportApiItem,
): ReportHistoryCardProjection {
  const evidenceGroups = buildEvidenceGroups(report);
  const attributionLimited = report.reportBody.findings.some((finding) => !finding.knowledgeNodeId);
  const declaredLimitations = report.reportBody.limitations.map(formatLimitation);
  const confidenceReasons = buildConfidenceReasons(report, evidenceGroups, attributionLimited);

  return {
    scopeLabel: report.scopeType === 'student' ? '学生范围' : '班级范围',
    includedStudentsLabel: includedStudentsLabel(report),
    evidenceCutoffLabel: formatShortDate(report.evidenceCutoff),
    generationReason: '教师请求后，按固定证据快照生成',
    mainWeaknessLabel: mainWeaknessLabel(report),
    availability: buildAvailability(report, confidenceReasons),
    evidenceGroups,
    confidenceReasons,
    comparison: compareAdjacentReports(report, adjacentOlderReport),
    declaredLimitations,
    attributionLimited,
  };
}

function buildEvidenceGroups(report: DiagnosisReportApiItem): EvidenceCoverageGroup[] {
  const coverage = report.reportBody.sourceCoverage;
  const sourceKinds = sourceKindsFor(report);
  const classMembers = coverage.classMembers;
  const includedStudents = coverage.includedStudents;
  const missingStudents = typeof classMembers === 'number' && typeof includedStudents === 'number'
    ? Math.max(classMembers - includedStudents, 0)
    : null;
  const behaviorState = sourceKinds.size === 0 || includedStudents === 0
    ? 'unavailable'
    : typeof coverage.coverage === 'number' && coverage.coverage < 1
      ? 'partial'
      : missingStudents !== null && missingStudents > 0
        ? 'partial'
        : 'available';
  const behaviorDetails = [...sourceKinds]
    .map((source) => INTERNAL_SOURCE_LABELS[source] ?? '受治理学习行为来源')
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));

  return [
    {
      id: 'assignment',
      label: '作业',
      state: 'unavailable',
      includedLabel: '未提供',
      missingLabel: '未提供',
      detailSources: [],
      explanation: `当前诊断结构没有纳入作业证据，不能据此推断作业覆盖或得分；报告证据截止于 ${formatShortDate(report.evidenceCutoff)}。`,
    },
    {
      id: 'assessment',
      label: '测验',
      state: 'unavailable',
      includedLabel: '未提供',
      missingLabel: '未提供',
      detailSources: [],
      explanation: `当前诊断结构没有纳入测验证据，不能据此推断测验覆盖或得分；报告证据截止于 ${formatShortDate(report.evidenceCutoff)}。`,
    },
    {
      id: 'learning-behavior',
      label: '学习行为',
      state: behaviorState,
      includedLabel: typeof includedStudents === 'number' ? `${includedStudents} 人` : '未提供',
      missingLabel: missingStudents === null ? '未提供' : `${missingStudents} 人`,
      detailSources: behaviorDetails,
      explanation: behaviorState === 'unavailable'
        ? '当前报告没有可核验的学习行为来源。'
        : `证据截止于 ${formatShortDate(report.evidenceCutoff)}。`,
    },
  ];
}

function buildConfidenceReasons(
  report: DiagnosisReportApiItem,
  evidenceGroups: EvidenceCoverageGroup[],
  attributionLimited: boolean,
): ConfidenceReason[] {
  const reasons: ConfidenceReason[] = [];
  const behavior = evidenceGroups.find((group) => group.id === 'learning-behavior');
  const coverage = report.reportBody.sourceCoverage;

  reasons.push({
    reason: '当前报告尚未纳入作业证据。',
    recoveryAction: '补充作业事件接入后，重新生成诊断。',
  });
  reasons.push({
    reason: '当前报告尚未纳入测验证据。',
    recoveryAction: '补充测验事件接入后，重新生成诊断。',
  });
  if (behavior?.state === 'unavailable') {
    reasons.push({
      reason: '当前报告没有可核验的学习行为来源。',
      recoveryAction: '确认学习行为数据已入库后，重新生成诊断。',
    });
  }
  if (typeof coverage.classMembers === 'number'
    && typeof coverage.includedStudents === 'number'
    && coverage.includedStudents < coverage.classMembers) {
    reasons.push({
      reason: `仅纳入 ${coverage.includedStudents}/${coverage.classMembers} 名学生的可用证据。`,
      recoveryAction: '补齐未纳入学生的学习证据后，重新生成诊断。',
    });
  }
  for (const limitation of report.reportBody.limitations) {
    const formatted = formatLimitation(limitation);
    if (formatted === limitation) continue;
    reasons.push({
      reason: formatted,
      recoveryAction: '等待对应数据恢复完整后，重新生成诊断。',
    });
  }
  if (attributionLimited) {
    reasons.push({
      reason: '部分发现没有可核验的知识节点映射，不能作为精准知识薄弱点。',
      recoveryAction: '补全题目、错因与知识节点映射后，重新生成诊断。',
    });
  }
  if (reasons.length === 0 && report.reportBody.confidence !== 'high') {
    reasons.push({
      reason: '报告没有提供可验证的置信度原因。',
      recoveryAction: '补充可核验证据后，重新生成诊断。',
    });
  }
  return deduplicateReasons(reasons);
}

function buildAvailability(
  report: DiagnosisReportApiItem,
  confidenceReasons: ConfidenceReason[],
): ReportAvailability {
  if (report.reportBody.confidence === 'unavailable') {
    return {
      label: '证据不足',
      description: '当前证据不足以形成可用于教学判断的完整诊断。',
      recoveryAction: confidenceReasons[0]?.recoveryAction ?? '补充证据后重新生成诊断。',
    };
  }
  if (report.reportBody.confidence === 'low') {
    return {
      label: '证据受限',
      description: '可以查看发现项，但需结合判断边界进行人工复核。',
      recoveryAction: confidenceReasons[0]?.recoveryAction ?? '补充证据后重新生成诊断。',
    };
  }
  if (report.reportBody.confidence === 'medium') {
    return {
      label: '证据部分可用',
      description: '已有可用证据，但覆盖或归因仍不完整。',
      recoveryAction: confidenceReasons[0]?.recoveryAction ?? '补充证据后重新生成诊断。',
    };
  }
  return confidenceReasons.length > 0
    ? {
        label: '证据可用，但覆盖受限',
        description: '总体置信度较高，但报告仍保留可见的证据边界。',
        recoveryAction: confidenceReasons[0].recoveryAction,
      }
    : {
        label: '证据较充分',
        description: '当前报告已形成可回看的受治理诊断快照。',
        recoveryAction: '有新证据后可生成新的诊断快照。',
      };
}

export function compareAdjacentReports(
  report: DiagnosisReportApiItem,
  adjacentOlderReport?: DiagnosisReportApiItem,
): ReportComparison {
  if (!adjacentOlderReport) {
    return { state: 'no-baseline', description: '尚无历史比较基线。' };
  }
  if (!sameScope(report, adjacentOlderReport)) {
    return { state: 'scope-mismatch', description: '相邻报告的范围或主体不同，暂不比较。' };
  }
  if (report.generatorVersion !== adjacentOlderReport.generatorVersion) {
    return {
      state: 'version-mismatch',
      description: `诊断结构版本已由 ${adjacentOlderReport.generatorVersion} 变更为 ${report.generatorVersion}，暂不比较。`,
    };
  }

  const current = comparableFindings(report);
  const baseline = comparableFindings(adjacentOlderReport);
  if (current.size === 0 && baseline.size === 0) {
    return {
      state: 'insufficient-structure',
      description: '缺少可稳定匹配的结构化发现，未生成差异判断。',
    };
  }

  let additions = 0;
  let persistent = 0;
  let riskEscalated = 0;
  let riskDowngraded = 0;
  let incomparableSeverityTransitions = 0;
  for (const [key, currentFinding] of current) {
    const baselineFinding = baseline.get(key);
    if (!baselineFinding) {
      additions += 1;
      continue;
    }
    persistent += 1;
    if (currentFinding.severity === null || baselineFinding.severity === null) {
      incomparableSeverityTransitions += 1;
      continue;
    }
    if (currentFinding.severity > baselineFinding.severity) riskEscalated += 1;
    if (currentFinding.severity < baselineFinding.severity) riskDowngraded += 1;
  }

  return {
    state: 'ready',
    description: comparisonDescription(incomparableSeverityTransitions),
    additions,
    persistent,
    improved: riskDowngraded,
    riskEscalated,
    riskDowngraded,
    incomparableSeverityTransitions,
  };
}

function comparableFindings(report: DiagnosisReportApiItem) {
  const findings = new Map<string, { severity: number | null }>();
  for (const finding of report.reportBody.findings) {
    const key = stableFindingKey(finding);
    if (!key) continue;
    const severity = finding.severity ? SEVERITY_RANK[finding.severity] : null;
    const current = findings.get(key);
    if (!current) {
      findings.set(key, { severity });
      continue;
    }
    if (severity === null) {
      current.severity = null;
      continue;
    }
    if (current.severity !== null && severity > current.severity) current.severity = severity;
  }
  return findings;
}

function comparisonDescription(incomparableSeverityTransitions: number) {
  const description = '仅比较同一范围、对象与诊断结构的相邻报告；摘要文字变化不会被视为学情变化。';
  if (incomparableSeverityTransitions === 0) return description;
  return `${description} 其中 ${incomparableSeverityTransitions} 项匹配发现缺少风险等级，未计算风险升级、降级或改善。`;
}

function stableFindingKey(finding: DiagnosisReportApiItem['reportBody']['findings'][number]) {
  if (!finding.riskType) return null;
  if (finding.knowledgeNodeId) return `knowledge-node:${finding.knowledgeNodeId}|risk:${finding.riskType}`;
  const refs = [...new Set(finding.evidenceRefs)].sort();
  return refs.length > 0 ? `evidence:${refs.join('|')}|risk:${finding.riskType}` : null;
}

function sourceKindsFor(report: DiagnosisReportApiItem) {
  const sources = new Set<string>();
  for (const reference of [
    ...report.reportBody.evidenceRefs,
    ...report.reportBody.findings.flatMap((finding) => finding.evidenceRefs),
  ]) {
    const separator = reference.indexOf(':');
    if (separator > 0) sources.add(reference.slice(0, separator));
  }
  return sources;
}

function sameScope(left: DiagnosisReportApiItem, right: DiagnosisReportApiItem) {
  return left.scopeType === right.scopeType
    && left.scopeId === right.scopeId
    && left.classId === right.classId
    && left.targetUserId === right.targetUserId;
}

function includedStudentsLabel(report: DiagnosisReportApiItem) {
  const { classMembers, includedStudents } = report.reportBody.sourceCoverage;
  if (report.scopeType === 'student') return '1 名学生';
  if (typeof classMembers === 'number' && typeof includedStudents === 'number') {
    return `纳入 ${includedStudents}/${classMembers} 人`;
  }
  if (typeof includedStudents === 'number') return `纳入 ${includedStudents} 人`;
  return '纳入人数未提供';
}

function mainWeaknessLabel(report: DiagnosisReportApiItem) {
  return report.reportBody.findings[0]?.title ?? '未形成可稳定识别的主要薄弱点';
}

function formatLimitation(value: string) {
  return LIMITATION_LABELS[value] ?? value;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '时间不可用';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(date);
}

function deduplicateReasons(reasons: ConfidenceReason[]) {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    if (seen.has(reason.reason)) return false;
    seen.add(reason.reason);
    return true;
  });
}
