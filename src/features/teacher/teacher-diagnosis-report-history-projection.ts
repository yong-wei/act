import type { DiagnosisReportApiItem } from '@/features/teacher/diagnosis/public-api';
import {
  detectOverallSubgroupPseudoConflict,
  diagnosisClauseDeclaresConflict,
  splitDiagnosisClauses,
} from '@/lib/diagnosis-pseudo-conflict';

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

export function findingRequiresKnowledgeNodeAttribution(
  finding: Pick<DiagnosisReportApiItem['reportBody']['findings'][number], 'evidenceRefs'>,
) {
  return finding.evidenceRefs.some((reference) => reference.startsWith('knowledge-progress:'));
}

export function projectReportHistoryCard(
  report: DiagnosisReportApiItem,
  adjacentOlderReport?: DiagnosisReportApiItem,
): ReportHistoryCardProjection {
  const evidenceGroups = buildEvidenceGroups(report);
  const attributionLimited = report.reportBody.findings.some(
    (finding) => findingRequiresKnowledgeNodeAttribution(finding) && !finding.knowledgeNodeId,
  );
  const declaredLimitations = report.reportBody.limitations.map(formatLimitation);
  const confidenceReasons = buildConfidenceReasons(report, evidenceGroups, attributionLimited);
  // 归因受限是唯一置信原因 = 所有证据组均完整可用且无声明限制，仅知识点发现缺节点归因
  // （Issue #1712）。行为组 partial（coverage<1）不产生置信原因，必须用证据组状态单独排除；
  // LIMITATION_LABELS 之外的自定义限制文本不进入 confidenceReasons，同样单独排除。
  const attributionOnly = attributionLimited
    && confidenceReasons.length === 1
    && report.reportBody.limitations.length === 0
    && evidenceGroups.every((group) => group.state === 'available');

  return {
    scopeLabel: report.scopeType === 'student' ? '学生范围' : '班级范围',
    includedStudentsLabel: includedStudentsLabel(report),
    evidenceCutoffLabel: formatShortDate(report.evidenceCutoff),
    generationReason: formatGenerationReason(report),
    mainWeaknessLabel: mainWeaknessLabel(report),
    availability: buildAvailability(report, confidenceReasons, attributionOnly, evidenceGroups),
    evidenceGroups,
    confidenceReasons,
    comparison: compareAdjacentReports(report, adjacentOlderReport),
    declaredLimitations,
    attributionLimited,
  };
}

function formatGenerationReason(report: DiagnosisReportApiItem) {
  switch (report.generationReason) {
    case 'first-generation':
      return '首次形成该范围的正式诊断';
    case 'new-evidence':
      return '受治理诊断依据发生有效变化';
    case 'version-change':
      return '生成器或确定性预检规则升级后重新生成';
    case 'teacher-forced':
      return report.forceReason
        ? `教师强制生成：${report.forceReason}`
        : '教师填写理由后强制生成';
    default:
      return '教师请求后，按固定证据快照生成';
  }
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
    outcomeEvidenceGroup('assignment', '作业', coverage.assignment, report.evidenceCutoff),
    outcomeEvidenceGroup('assessment', '测验', coverage.assessment, report.evidenceCutoff),
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

function outcomeEvidenceGroup(
  id: Extract<EvidenceGroupId, 'assignment' | 'assessment'>,
  label: string,
  coverage: { includedStudents: number; missingStudents: number; evidenceCount: number; scoredCount: number } | undefined,
  evidenceCutoff: string,
): EvidenceCoverageGroup {
  if (!coverage) {
    return {
      id,
      label,
      state: 'unavailable',
      includedLabel: '未提供',
      missingLabel: '未提供',
      detailSources: [],
      explanation: `当前诊断结构没有纳入${label}证据，不能据此推断${label}覆盖或得分；报告证据截止于 ${formatShortDate(evidenceCutoff)}。`,
    };
  }
  const state = coverage.missingStudents > 0 ? 'partial' : 'available';
  return {
    id,
    label,
    state,
    includedLabel: `${coverage.includedStudents} 人`,
    missingLabel: `${coverage.missingStudents} 人`,
    detailSources: [`${coverage.evidenceCount} 份结果`, `${coverage.scoredCount} 份已评分结果`],
    explanation: `已纳入截止时刻前的${label}结果；报告证据截止于 ${formatShortDate(evidenceCutoff)}。`,
  };
}

function evidenceCoverageComplete(
  report: DiagnosisReportApiItem,
  evidenceGroups: EvidenceCoverageGroup[],
) {
  const coverage = report.reportBody.sourceCoverage;
  // 要求显式完整覆盖信号（Issue #1755 review）：可选字段缺省不得当作完整。
  const membershipComplete = typeof coverage.classMembers === 'number'
    && typeof coverage.includedStudents === 'number'
    && coverage.includedStudents >= coverage.classMembers;
  return coverage.coverage === 1
    && membershipComplete
    && evidenceGroups.every((group) => group.state === 'available');
}

// 声明限制确含跨来源冲突语义时才允许"证据存在冲突"表述（Issue #1755 review）。
const EVIDENCE_CONFLICT_WORDING = /冲突|矛盾|不一致/;

function buildConfidenceReasons(
  report: DiagnosisReportApiItem,
  evidenceGroups: EvidenceCoverageGroup[],
  attributionLimited: boolean,
): ConfidenceReason[] {
  const reasons: ConfidenceReason[] = [];
  const behavior = evidenceGroups.find((group) => group.id === 'learning-behavior');
  const coverage = report.reportBody.sourceCoverage;

  for (const group of evidenceGroups.filter((item) => item.id === 'assignment' || item.id === 'assessment')) {
    if (group.state === 'unavailable') {
      reasons.push({
        reason: `当前报告尚未纳入${group.label}证据。`,
        recoveryAction: `补充${group.label}事件接入后，重新生成诊断。`,
      });
    } else if (group.state === 'partial') {
      reasons.push({
        reason: `${group.label}仅纳入${group.includedLabel}，仍有${group.missingLabel}未纳入。`,
        recoveryAction: `补齐未纳入学生的${group.label}结果后，重新生成诊断。`,
      });
    }
  }
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
  // 覆盖完整时，模型声明的自定义限制（如跨来源证据冲突）就是真实降级原因，
  // 如实展示并指向教师复核，不得回退为笼统的"补充证据"（Issue #1755）。
  const coverageComplete = evidenceCoverageComplete(report, evidenceGroups);
  for (const limitation of report.reportBody.limitations) {
    const formatted = formatLimitation(limitation);
    if (formatted !== limitation) {
      reasons.push({
        reason: formatted,
        recoveryAction: '等待对应数据恢复完整后，重新生成诊断。',
      });
    } else if (coverageComplete) {
      reasons.push({
        reason: `报告声明了影响结论强度的判断边界：${limitation}`,
        recoveryAction: '教师复核声明的判断边界；如需更新结论，重新生成诊断。',
      });
    }
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
  attributionOnly: boolean,
  evidenceGroups: EvidenceCoverageGroup[],
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
  if (report.reportBody.confidence === 'medium' && evidenceCoverageComplete(report, evidenceGroups)) {
    // 总体—子群伪冲突（Issue #1872）：历史报告不可变，但不得把班级总体
    // 与部分学生的不可比信号继续显示为证据冲突，标注需重新生成；检测
    // 独立进行，summary 内的伪冲突声明同样覆盖。
    if (detectOverallSubgroupPseudoConflict(report.reportBody).length > 0) {
      return {
        label: '报告需重新生成',
        description: '该报告把班级总体表现与部分学生进度表述为证据冲突；两者学生范围不同、可以同时成立，不属于可比证据冲突。',
        recoveryAction: '重新生成诊断以获得可比证据冲突判定。',
      };
    }
    // 显式完整覆盖且声明限制确含冲突语义：如实表述为证据冲突并指向教师
    // 复核；缺省可选覆盖字段或非冲突限制不得套用该状态（Issue #1755 review）。
    const conflictDeclared = [
      report.reportBody.summary,
      ...report.reportBody.limitations,
    ].some((text) => splitDiagnosisClauses(text).some(diagnosisClauseDeclaresConflict));
    if (conflictDeclared) {
      return {
        label: '证据存在冲突',
        description: '各来源证据覆盖完整，但报告声明了影响结论强度的来源间冲突。',
        recoveryAction: confidenceReasons[0]?.recoveryAction ?? '教师复核声明的证据冲突；如需更新结论，重新生成诊断。',
      };
    }
  }
  if (report.reportBody.confidence === 'medium') {
    return {
      label: '证据部分可用',
      description: '已有可用证据，但覆盖或归因仍不完整。',
      recoveryAction: confidenceReasons[0]?.recoveryAction ?? '补充证据后重新生成诊断。',
    };
  }
  // 数据覆盖完整、仅知识节点无法归因：如实表述为归因问题，不再称"覆盖受限"（Issue #1712）。
  if (attributionOnly) {
    return {
      label: '知识节点归因受限',
      description: '学习数据覆盖完整，但部分知识点发现尚无可核验的知识节点映射。',
      recoveryAction: '补全题目、错因与知识节点映射后，重新生成诊断。',
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
  return report.reportBody.findings[0]?.title ?? '未发现明确薄弱节点';
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
