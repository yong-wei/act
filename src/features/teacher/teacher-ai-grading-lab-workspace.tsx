'use client';

import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

interface Overview {
  datasets: Array<{ datasetId: string; datasetVersion: string; datasetKind: string; sampleCount: number; questionCount: number }>;
  configurations: Array<{ configurationVersion: string; datasetId: string; datasetVersion: string; splitId: string; createdAt: string }>;
  batches: Array<{ evaluationRunId: string; configurationVersion: string; state: string; totalExecutions: number; completedCount: number; failedCount: number; retryableCount: number; hiddenAcceptanceState: string | null; updatedAt: string }>;
  metrics: { completedRate: number | null; meanAbsoluteScoreDifference: number | null; exactScoreRate: number | null; threeRunExactStabilityRate: number | null };
  metricsByRun: Array<{ evaluationRunId: string; configurationVersion: string; splitId: string; partition: string; visibility: string; configurationContentHash: string | null; completedRate: number | null; meanAbsoluteScoreDifference: number | null; exactScoreRate: number | null; threeRunExactStabilityRate: number | null }>;
  executions: Array<{ evaluationRunId: string; sampleId: string; questionId: string; repetitionOrdinal: number; state: string; aiScore: number | null; draftScore: number | null; teacherScore: number | null; scoreDifference: number | null; failureStage: string | null; errorCode: string | null }>;
  pdfVerifications: Array<{ acceptanceId: string; sampleId: string; derivativeId: string; previewHref: string; expectedRevision: number; status: string; blockingDefect: boolean | null }>;
  annotationJudgments: Array<{ sampleId: string; questionId: string; judgmentVersion: string }>;
  pendingBlindAnnotations: Array<{ executionId: string; gradingAnnotationId: string; sampleId: string; questionId: string; excerpt: string; reason: string | null; comment: string; pageNumber: number | null; precision: string }>;
  pendingBlindVisualEvidence: Array<{ executionId: string; visualEvidenceId: string; evidenceContentHash: string; sampleId: string; questionId: string; description: string; pageNumber: number | null; bbox: unknown; confidence: number | null }>;
}

export function TeacherAiGradingLabWorkspace() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const response = await fetch('/api/teacher/ai-grading-lab/overview', { cache: 'no-store' });
      if (!response.ok) throw new Error('overview-unavailable');
      setOverview(await response.json() as Overview);
    } catch { setFailed(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (failed) return <section role="alert" className="border border-rose-300 bg-rose-50 p-5 text-rose-950"><AlertCircle className="mb-2 h-5 w-5" /><p>评测状态暂时无法读取。</p><button type="button" onClick={() => void load()} className="mt-3 inline-flex items-center gap-2 border border-rose-400 px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" />重试</button></section>;
  if (!overview) return <div role="status" aria-label="正在加载评测状态" className="h-44 animate-pulse bg-slate-100" />;
  const runningBatches = overview.batches.filter((item) => !['SUCCEEDED', 'FAILED', 'PARTIAL'].includes(item.state)).length;
  const pendingReviews = overview.pendingBlindAnnotations.length + overview.pendingBlindVisualEvidence.length + overview.pdfVerifications.filter((item) => item.status === 'pending').length;
  return <div className="space-y-8">
    <section aria-label="评测摘要" className="grid gap-3 sm:grid-cols-3">
      <SummaryCard label="数据集" value={overview.datasets.length} />
      <SummaryCard label="运行中批次" value={runningBatches} />
      <SummaryCard label="待人工复核" value={pendingReviews} />
    </section>
    <OverviewTable title="实验指标" empty="尚无可计算的实验指标。" headers={['运行', '分区', '可见性', '处理完成率', '平均绝对分差', '完全一致率', '三次完全稳定率']} rows={overview.metricsByRun.map((metric) => [metric.evaluationRunId, metric.partition, metric.visibility, formatRate(metric.completedRate), formatMetric(metric.meanAbsoluteScoreDifference), formatRate(metric.exactScoreRate), formatRate(metric.threeRunExactStabilityRate)])} />
    <OverviewTable title="数据集" empty="暂无已导入数据集。" headers={['标识', '类型', '样本', '题目']} rows={overview.datasets.map((item) => [`${item.datasetId}@${item.datasetVersion}`, item.datasetKind, item.sampleCount, item.questionCount])} />
    <OverviewTable title="冻结配置" empty="暂无冻结配置。" headers={['配置', '数据集', '划分', '创建时间']} rows={overview.configurations.map((item) => [item.configurationVersion, `${item.datasetId}@${item.datasetVersion}`, item.splitId, formatTime(item.createdAt)])} />
    <OverviewTable title="批次进度" empty="暂无评测批次。" headers={['批次', '状态', '完成', '失败', '可重试', '隐藏验收', '操作']} rows={overview.batches.map((item) => [item.evaluationRunId, item.state, `${item.completedCount}/${item.totalExecutions}`, item.failedCount, item.retryableCount, item.hiddenAcceptanceState ?? '不适用', item.retryableCount > 0 || ['RUNNING', 'PARTIAL', 'FAILED'].includes(item.state) ? <ResumeEvaluationButton key={item.evaluationRunId} evaluationRunId={item.evaluationRunId} onResumed={load} /> : '—'])} />
    <OverviewTable title="逐题三次结果与教师基准" empty="暂无可查看的逐题结果。" headers={['批次', '样本', '题目', '次数', 'AI 分数', '修订草稿', '教师基准', '差异', '状态', '失败阶段']} rows={overview.executions.map((item) => [item.evaluationRunId, item.sampleId, item.questionId, item.repetitionOrdinal, item.aiScore ?? '未生成', item.draftScore ?? '未生成', item.teacherScore ?? '未揭示', formatDifference(item.scoreDifference), reviewState(item), item.failureStage ?? '—'])} />
    <section><OverviewTable title="PDF 核验" empty="暂无已揭示的 PDF 核验项。" headers={['样本', 'PDF', '状态', '阻断缺陷']} rows={overview.pdfVerifications.map((item) => [item.sampleId, <a key={item.derivativeId} href={item.previewHref} target="_blank" rel="noreferrer" className="text-cyan-700 underline">查看 PDF</a>, item.status, item.blockingDefect === null ? '待核验' : item.blockingDefect ? '是' : '否'])} />{overview.pdfVerifications.filter((item) => item.status === 'pending').map((item) => <PdfVerificationForm key={item.derivativeId} item={item} onRecorded={load} />)}</section>
    <section><OverviewTable title="批注盲评" empty="暂无批注盲评记录。" headers={['样本', '题目', '判定版本']} rows={overview.annotationJudgments.map((item) => [item.sampleId, item.questionId, item.judgmentVersion])} />{overview.pendingBlindAnnotations.map((item) => <BlindAnnotationForm key={item.gradingAnnotationId} item={item} onRecorded={load} />)}</section>
    <section><OverviewTable title="视觉证据盲审" empty="暂无待盲审的视觉证据。" headers={['样本', '题目', '页码', '置信度']} rows={overview.pendingBlindVisualEvidence.map((item) => [item.sampleId, item.questionId, item.pageNumber ?? '未定位', item.confidence ?? '未提供'])} />{overview.pendingBlindVisualEvidence.map((item) => <BlindVisualEvidenceForm key={`${item.executionId}:${item.visualEvidenceId}`} item={item} onRecorded={load} />)}</section>
  </div>;
}

function BlindVisualEvidenceForm({ item, onRecorded }: { item: Overview['pendingBlindVisualEvidence'][number]; onRecorded(): Promise<void> }) {
  const [saving, setSaving] = useState(false); const [failed, setFailed] = useState(false); const [judgment, setJudgment] = useState({ faithful: false, sufficientForScoring: false, misattributed: false });
  const submit = async () => { setSaving(true); setFailed(false); try { const response = await fetch('/api/teacher/ai-grading-lab/operations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation: 'record-human-judgment', input: { judgmentKind: 'blind-visual-evidence', executionId: item.executionId, visualEvidenceId: item.visualEvidenceId, evidenceContentHash: item.evidenceContentHash, ...judgment } }) }); if (!response.ok) throw new Error(); await onRecorded(); } catch { setFailed(true); } finally { setSaving(false); } };
  return <ReviewForm tone="violet" title={`${item.sampleId} · ${item.questionId} 的视觉描述`} description={item.description} failed={failed} onSubmit={submit} saving={saving} submitLabel="提交视觉盲审">{Object.entries(judgment).map(([key, value]) => <Check key={key} label={blindVisualCheckLabel(key)} checked={value} onChange={(checked) => setJudgment({ ...judgment, [key]: checked })} />)}</ReviewForm>;
}

function ResumeEvaluationButton({ evaluationRunId, onResumed }: { evaluationRunId: string; onResumed(): Promise<void> }) { const [saving, setSaving] = useState(false); const [failed, setFailed] = useState(false); const resume = async () => { setSaving(true); setFailed(false); try { const response = await fetch('/api/teacher/ai-grading-lab/operations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation: 'resume-evaluation', input: { run: { evaluationRunId } } }) }); if (!response.ok) throw new Error(); await onResumed(); } catch { setFailed(true); } finally { setSaving(false); } }; return <div><button type="button" disabled={saving} onClick={() => void resume()} className="inline-flex min-h-9 items-center border border-cyan-600 px-2 text-xs text-cyan-800 disabled:opacity-60">{saving ? '正在恢复…' : '恢复并重试'}</button>{failed ? <p role="alert" className="mt-1 text-xs text-rose-700">恢复失败，可再次重试。</p> : null}</div>; }

function BlindAnnotationForm({ item, onRecorded }: { item: Overview['pendingBlindAnnotations'][number]; onRecorded(): Promise<void> }) {
  const [saving, setSaving] = useState(false); const [failed, setFailed] = useState(false); const [judgment, setJudgment] = useState({ locationCorrect: false, reasonCorrect: false, suggestionCorrect: false, seriouslyMisleading: false });
  const submit = async () => { setSaving(true); setFailed(false); try { const response = await fetch('/api/teacher/ai-grading-lab/operations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation: 'record-human-judgment', input: { judgmentKind: 'blind-annotation', executionId: item.executionId, gradingAnnotationId: item.gradingAnnotationId, ...judgment } }) }); if (!response.ok) throw new Error(); await onRecorded(); } catch { setFailed(true); } finally { setSaving(false); } };
  return <ReviewForm tone="sky" title={`${item.sampleId} · ${item.questionId} 的批注`} failed={failed} onSubmit={submit} saving={saving} submitLabel="提交批注盲评"><dl className="grid gap-1 text-sm text-slate-700"><div><dt className="font-medium">原文片段</dt><dd className="whitespace-pre-wrap">{item.excerpt}</dd></div><div><dt className="font-medium">扣分原因</dt><dd className="whitespace-pre-wrap">{item.reason ?? '未提供'}</dd></div><div><dt className="font-medium">改正建议</dt><dd className="whitespace-pre-wrap">{item.comment}</dd></div><div><dt className="font-medium">定位</dt><dd>{item.pageNumber ? `第 ${item.pageNumber} 页` : '未定位'} · {item.precision}</dd></div></dl>{Object.entries(judgment).map(([key, value]) => <Check key={key} label={blindCheckLabel(key)} checked={value} onChange={(checked) => setJudgment({ ...judgment, [key]: checked })} />)}</ReviewForm>;
}

function PdfVerificationForm({ item, onRecorded }: { item: Overview['pdfVerifications'][number]; onRecorded(): Promise<void> }) {
  const [saving, setSaving] = useState(false); const [failed, setFailed] = useState(false); const [checks, setChecks] = useState({ originalLayoutComplete: false, pageMarksComplete: false, nativeAnnotationsComplete: false, positioningCorrect: false, summaryPageCorrect: false }); const [blockingDefect, setBlockingDefect] = useState(false);
  const submit = async () => { setSaving(true); setFailed(false); try { const response = await fetch('/api/teacher/ai-grading-lab/operations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation: 'record-human-judgment', input: { judgmentKind: 'pdf-verification', acceptanceId: item.acceptanceId, sampleId: item.sampleId, derivativeId: item.derivativeId, expectedRevision: item.expectedRevision, checks, blockingDefect } }) }); if (!response.ok) throw new Error(); await onRecorded(); } catch { setFailed(true); } finally { setSaving(false); } };
  return <ReviewForm tone="amber" title={`${item.sampleId} 的 PDF 核验`} failed={failed} onSubmit={submit} saving={saving} submitLabel="提交 PDF 核验">{Object.entries(checks).map(([key, value]) => <Check key={key} label={pdfCheckLabel(key)} checked={value} onChange={(checked) => setChecks({ ...checks, [key]: checked })} />)}<Check label="存在阻断缺陷" checked={blockingDefect} onChange={setBlockingDefect} /></ReviewForm>;
}

function ReviewForm({ tone, title, description, children, failed, saving, submitLabel, onSubmit }: { tone: 'violet' | 'sky' | 'amber'; title: string; description?: string; children: React.ReactNode; failed: boolean; saving: boolean; submitLabel: string; onSubmit(): Promise<void> }) {
  const colors = { violet: 'border-violet-300 bg-violet-50', sky: 'border-sky-300 bg-sky-50', amber: 'border-amber-300 bg-amber-50' }[tone];
  return <section className={`mt-4 border p-4 text-sm ${colors}`}><div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" />{title}</div>{description && <p className="mt-2 whitespace-pre-wrap text-slate-800">{description}</p>}<div className="mt-3 grid gap-2">{children}</div><button type="button" disabled={saving} onClick={() => void onSubmit()} className="mt-3 border border-slate-700 px-3 py-2 disabled:opacity-60">{saving ? '正在提交…' : submitLabel}</button>{failed && <p role="alert" className="mt-2 text-rose-700">提交失败，请复核状态后重试。</p>}</section>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange(value: boolean): void }) { return <label className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }
function SummaryCard({ label, value }: { label: string; value: number }) { return <div className="border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></div>; }
function OverviewTable({ title, empty, headers, rows }: { title: string; empty: string; headers: string[]; rows: Array<Array<ReactNode>> }) { return <section><h2 className="text-lg font-semibold text-slate-950">{title}</h2>{rows.length === 0 ? <p className="mt-3 text-sm text-slate-500">{empty}</p> : <div className="mt-3 overflow-x-auto border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-medium">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${title}:${index}`} className="border-t border-slate-200">{row.map((value, cellIndex) => <td key={cellIndex} className="px-4 py-3">{value}</td>)}</tr>)}</tbody></table></div>}</section>; }
function formatTime(value: string) { return new Date(value).toLocaleString('zh-CN'); }
function formatRate(value: number | null) { return value === null ? '未计算' : `${(value * 100).toFixed(1)}%`; }
function formatMetric(value: number | null) { return value === null ? '未计算' : value.toFixed(2); }
export function reviewState(item: Overview['executions'][number]) { if (item.state === 'FAILED' || item.state === 'RETRYABLE') return '待复核'; if (!item.questionId || item.aiScore === null || item.aiScore === undefined) return '待复核'; return '已完成'; }
function formatDifference(value: number | null) { return value === null ? '未计算' : `${value > 0 ? '+' : ''}${value}`; }
function blindCheckLabel(key: string) { return ({ locationCorrect: '定位正确', reasonCorrect: '扣分原因正确', suggestionCorrect: '改正建议正确', seriouslyMisleading: '存在严重误导' } as Record<string, string>)[key] ?? key; }
function blindVisualCheckLabel(key: string) { return ({ faithful: '描述忠实', sufficientForScoring: '足以支持评分', misattributed: '存在错误归属' } as Record<string, string>)[key] ?? key; }
function pdfCheckLabel(key: string) { return ({ originalLayoutComplete: '原版页面完整', pageMarksComplete: '页面标记完整', nativeAnnotationsComplete: '原生注释完整', positioningCorrect: '定位正确', summaryPageCorrect: '汇总页正确' } as Record<string, string>)[key] ?? key; }
