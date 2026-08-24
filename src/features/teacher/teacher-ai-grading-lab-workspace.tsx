'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface Overview {
  datasets: Array<{ datasetId: string; datasetVersion: string; datasetKind: string; sampleCount: number; questionCount: number }>;
  configurations: Array<{ configurationVersion: string; datasetId: string; datasetVersion: string; splitId: string; createdAt: string }>;
  batches: Array<{ evaluationRunId: string; configurationVersion: string; state: string; totalExecutions: number; completedCount: number; failedCount: number; retryableCount: number; hiddenAcceptanceState: string | null; updatedAt: string }>;
  executions: Array<{ evaluationRunId: string; sampleId: string; questionId: string; repetitionOrdinal: number; state: string; aiScore: number | null; teacherScore: number | null; failureStage: string | null; errorCode: string | null }>;
  pdfVerifications: Array<{ acceptanceId: string; sampleId: string; derivativeId: string; expectedRevision: number; status: string; blockingDefect: boolean | null }>;
  annotationJudgments: Array<{ sampleId: string; questionId: string; judgmentVersion: string }>;
  pendingBlindAnnotations: Array<{ executionId: string; gradingAnnotationId: string; sampleId: string; questionId: string }>;
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
  if (failed) return <section role="alert" className="border border-rose-300 bg-rose-50 p-5 text-rose-950"><AlertCircle className="mb-2 h-5 w-5" /><p>评测状态暂时不可读取。</p><button type="button" onClick={() => void load()} className="mt-3 inline-flex items-center gap-2 border border-rose-400 px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" />重试</button></section>;
  if (!overview) return <div role="status" className="h-44 animate-pulse bg-slate-100" />;
  return <div className="space-y-8">
    <OverviewTable title="数据集" empty="尚无已导入评测数据集。" headers={['标识', '类型', '样本', '题目']} rows={overview.datasets.map((item) => [`${item.datasetId}@${item.datasetVersion}`, item.datasetKind, item.sampleCount, item.questionCount])} />
    <OverviewTable title="冻结配置" empty="尚无冻结配置。" headers={['配置', '数据集', '划分', '创建时间']} rows={overview.configurations.map((item) => [item.configurationVersion, `${item.datasetId}@${item.datasetVersion}`, item.splitId, formatTime(item.createdAt)])} />
    <OverviewTable title="批次进度" empty="尚无评测批次。" headers={['批次', '状态', '完成', '失败', '待恢复', '隐藏验收']} rows={overview.batches.map((item) => [item.evaluationRunId, item.state, `${item.completedCount}/${item.totalExecutions}`, item.failedCount, item.retryableCount, item.hiddenAcceptanceState ?? '不适用'])} />
    <OverviewTable title="逐题三次结果与教师基准" empty="尚无可查看的逐题运行结果。" headers={['批次', '样本', '题目', '次数', 'AI 分数', '教师基准', '复核状态', '失败阶段']} rows={overview.executions.map((item) => [item.evaluationRunId, item.sampleId, item.questionId, item.repetitionOrdinal, item.aiScore ?? '无', item.teacherScore ?? '无', reviewState(item), item.failureStage ?? '无'])} />
    <OverviewTable title="PDF 核验" empty="尚无已揭示的 PDF 核验项。" headers={['样本', '状态', '阻断缺陷']} rows={overview.pdfVerifications.map((item) => [item.sampleId, item.status, item.blockingDefect === null ? '待核验' : item.blockingDefect ? '是' : '否'])} />
    {overview.pdfVerifications.filter((item) => item.status === 'pending').map((item) => <PdfVerificationForm key={item.derivativeId} item={item} onRecorded={load} />)}
    <OverviewTable title="批注盲评" empty="尚无已记录的批注盲评。" headers={['样本', '题目', '判定版本']} rows={overview.annotationJudgments.map((item) => [item.sampleId, item.questionId, item.judgmentVersion])} />
    {overview.pendingBlindAnnotations.map((item) => <BlindAnnotationForm key={item.gradingAnnotationId} item={item} onRecorded={load} />)}
    <OverviewTable title="视觉证据盲审" empty="尚无待盲审的视觉证据。" headers={['样本', '题目', '页码', '置信度']} rows={overview.pendingBlindVisualEvidence.map((item) => [item.sampleId, item.questionId, item.pageNumber ?? '未定位', item.confidence ?? '未提供'])} />
    {overview.pendingBlindVisualEvidence.map((item) => <BlindVisualEvidenceForm key={`${item.executionId}:${item.visualEvidenceId}`} item={item} onRecorded={load} />)}
  </div>;
}

function BlindVisualEvidenceForm({ item, onRecorded }: { item: Overview['pendingBlindVisualEvidence'][number]; onRecorded(): Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [judgment, setJudgment] = useState({ faithful: false, sufficientForScoring: false, misattributed: false });
  const submit = async () => {
    setSaving(true); setFailed(false);
    try {
      const response = await fetch('/api/teacher/ai-grading-lab/operations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation: 'record-human-judgment', input: { judgmentKind: 'blind-visual-evidence', executionId: item.executionId, visualEvidenceId: item.visualEvidenceId, evidenceContentHash: item.evidenceContentHash, ...judgment } }) });
      if (!response.ok) throw new Error('blind-visual-evidence-failed');
      await onRecorded();
    } catch { setFailed(true); } finally { setSaving(false); }
  };
  return <section className="border border-violet-300 bg-violet-50 p-4 text-sm"><p>样本 {item.sampleId}，题目 {item.questionId} 的视觉描述待盲审。</p><p className="mt-2 whitespace-pre-wrap text-slate-800">{item.description}</p><p className="mt-2 text-slate-600">页码：{item.pageNumber ?? '未定位'}；位置：{item.bbox ? '已提供区域' : '未提供区域'}；置信度：{item.confidence ?? '未提供'}。</p><div className="mt-3 grid gap-2">{Object.entries(judgment).map(([key, value]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={value} onChange={(event) => setJudgment({ ...judgment, [key]: event.target.checked })} />{blindVisualCheckLabel(key)}</label>)}</div><button type="button" disabled={saving} onClick={() => void submit()} className="mt-3 border border-violet-600 px-3 py-2 disabled:opacity-60">{saving ? '正在提交' : '提交视觉盲审'}</button>{failed && <p role="alert" className="mt-2 text-rose-700">视觉盲审提交失败，请复核后重试。</p>}</section>;
}

function BlindAnnotationForm({ item, onRecorded }: { item: Overview['pendingBlindAnnotations'][number]; onRecorded(): Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [judgment, setJudgment] = useState({ locationCorrect: false, reasonCorrect: false, suggestionCorrect: false, seriouslyMisleading: false });
  const submit = async () => {
    setSaving(true); setFailed(false);
    try {
      const response = await fetch('/api/teacher/ai-grading-lab/operations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation: 'record-human-judgment', input: { judgmentKind: 'blind-annotation', executionId: item.executionId, gradingAnnotationId: item.gradingAnnotationId, ...judgment } }) });
      if (!response.ok) throw new Error('blind-annotation-failed');
      await onRecorded();
    } catch { setFailed(true); } finally { setSaving(false); }
  };
  return <section className="border border-sky-300 bg-sky-50 p-4 text-sm"><p>样本 {item.sampleId}，题目 {item.questionId} 的批注待盲评。</p><div className="mt-3 grid gap-2">{Object.entries(judgment).map(([key, value]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={value} onChange={(event) => setJudgment({ ...judgment, [key]: event.target.checked })} />{blindCheckLabel(key)}</label>)}</div><button type="button" disabled={saving} onClick={() => void submit()} className="mt-3 border border-sky-600 px-3 py-2 disabled:opacity-60">{saving ? '正在提交' : '提交盲评'}</button>{failed && <p role="alert" className="mt-2 text-rose-700">盲评提交失败，请复核后重试。</p>}</section>;
}

function PdfVerificationForm({ item, onRecorded }: { item: Overview['pdfVerifications'][number]; onRecorded(): Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [checks, setChecks] = useState({ originalLayoutComplete: false, pageMarksComplete: false, nativeAnnotationsComplete: false, positioningCorrect: false, summaryPageCorrect: false });
  const [blockingDefect, setBlockingDefect] = useState(false);
  const submit = async () => {
    setSaving(true); setFailed(false);
    try {
      const response = await fetch('/api/teacher/ai-grading-lab/operations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation: 'record-human-judgment', input: { judgmentKind: 'pdf-verification', acceptanceId: item.acceptanceId, sampleId: item.sampleId, derivativeId: item.derivativeId, expectedRevision: item.expectedRevision, checks, blockingDefect } }) });
      if (!response.ok) throw new Error('pdf-verification-failed');
      await onRecorded();
    } catch { setFailed(true); } finally { setSaving(false); }
  };
  return <section className="border border-amber-300 bg-amber-50 p-4 text-sm"><p>样本 {item.sampleId} 的 PDF 核验待负责人确认。</p><div className="mt-3 grid gap-2">{Object.entries(checks).map(([key, value]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={value} onChange={(event) => setChecks({ ...checks, [key]: event.target.checked })} />{pdfCheckLabel(key)}</label>)}<label className="flex items-center gap-2"><input type="checkbox" checked={blockingDefect} onChange={(event) => setBlockingDefect(event.target.checked)} />存在阻断缺陷</label></div><button type="button" disabled={saving} onClick={() => void submit()} className="mt-3 border border-amber-600 px-3 py-2 disabled:opacity-60">{saving ? '正在提交' : '提交 PDF 核验'}</button>{failed && <p role="alert" className="mt-2 text-rose-700">核验提交失败，请复核状态后重试。</p>}</section>;
}

function OverviewTable({ title, empty, headers, rows }: { title: string; empty: string; headers: string[]; rows: Array<Array<string | number>> }) {
  return <section><h2 className="text-lg font-semibold text-slate-950">{title}</h2>{rows.length === 0 ? <p className="mt-3 text-sm text-slate-500">{empty}</p> : <div className="mt-3 overflow-x-auto border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-medium">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${title}:${index}`} className="border-t border-slate-200">{row.map((value, cellIndex) => <td key={cellIndex} className="px-4 py-3">{value}</td>)}</tr>)}</tbody></table></div>}</section>;
}

function formatTime(value: string) { return new Date(value).toLocaleString('zh-CN'); }

function reviewState(item: Overview['executions'][number]) {
  if (item.state === 'FAILED' || item.state === 'RETRYABLE') return '待复核';
  if (!item.questionId || !item.aiScore && item.aiScore !== 0) return '待复核';
  return '已完成';
}

function blindCheckLabel(key: string) { return ({ locationCorrect: '定位正确', reasonCorrect: '扣分原因正确', suggestionCorrect: '改正建议正确', seriouslyMisleading: '严重误导' } as Record<string, string>)[key]; }
function blindVisualCheckLabel(key: string) { return ({ faithful: '描述忠实', sufficientForScoring: '足以支持评分', misattributed: '存在误归属' } as Record<string, string>)[key]; }
function pdfCheckLabel(key: string) { return ({ originalLayoutComplete: '原版面完整', pageMarksComplete: '页面标记完整', nativeAnnotationsComplete: '原生注释完整', positioningCorrect: '定位正确', summaryPageCorrect: '汇总页正确' } as Record<string, string>)[key]; }
