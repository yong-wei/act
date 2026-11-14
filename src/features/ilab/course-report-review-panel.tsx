'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { VESSEL_COURSES } from '@/resources/simulations/experiments/course-catalog';
import { VESSEL_REPORT_SECTION_LABELS } from './course-artifact-contract';
import { VESSEL_REPORT_STATUSES, summarizeVesselReview, vesselStepReviewLimits, type VesselStepReview } from './course-report-review-contract';
import { ModelComparisonCurve } from '@/resources/simulations/experiments/model-comparison-curve';
import type { VesselModelComparison } from '@/resources/simulations/experiments/student-analysis';
import type { readVesselReportEvidence } from './course-report-review';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';

type Evidence = Awaited<ReturnType<typeof readVesselReportEvidence>>;
interface ReportRow {id:string;title:string;studentName:string|null;status:string;classId:string|null;score:number|null;maxScore:number}
const inputClass = 'rounded-md border border-platform-border bg-platform-surface px-3 py-2 text-sm text-platform-fg-primary';
const statusLabel = (status:string) => VESSEL_REPORT_STATUSES[status as keyof typeof VESSEL_REPORT_STATUSES] ?? status;
const attemptStatusLabels:Record<string,string> = {submitted:'已提交',invalid_run:'运行证据无效',model_mismatch:'模型或必要证据待补充',below_target:'性能目标尚未达到',scored:'已评分'};

async function readJson<T>(url:string, init?:RequestInit):Promise<T> {
  const response = await fetch(url,init);
  const result = await response.json() as T & {error?:string};
  if (!response.ok) throw new Error(result.error ?? '暂时无法读取实验记录。');
  return result;
}

export function VesselCourseReportReviewPanel() {
  const [classes,setClasses] = useState<Array<{id:string;name:string}>>([]);
  const [classId,setClassId] = useState('');
  const [courseKey,setCourseKey] = useState('');
  const [status,setStatus] = useState('');
  const [reports,setReports] = useState<ReportRow[]>([]);
  const [nextCursor,setNextCursor] = useState<string|null>(null);
  const [evidence,setEvidence] = useState<Evidence|null>(null);
  const [steps,setSteps] = useState<VesselStepReview[]>([]);
  const [feedback,setFeedback] = useState('');
  const [work,setWork] = useState<{answers?:Record<string,string>;validationFeedback?:string|null;outcome?:string}|null>(null);
  const [comparison,setComparison] = useState<VesselModelComparison|null>(null);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);

  const reload = useCallback(async (cursor?:string) => {
    const query = new URLSearchParams({classId,courseKey,status,...(cursor ? {cursor} : {})});
    const result = await readJson<{classes:typeof classes;reports:ReportRow[];nextCursor:string|null}>(`/api/teacher/experiment-reports?${query}`);
    setClasses(result.classes); setNextCursor(result.nextCursor);
    setReports((previous)=>cursor ? [...previous,...result.reports.filter((row)=>!previous.some((item)=>item.id === row.id))] : result.reports);
  },[classId,courseKey,status]);
  useEffect(()=>{void reload().catch((error:unknown)=>setMessage(error instanceof Error ? error.message : '报告列表读取失败。'));},[reload]);

  async function openReport(id:string) {
    setBusy(true); setMessage(''); setWork(null); setComparison(null);
    try {
      const result = await readJson<Evidence>(`/api/ilab/experiment-reports/${id}`);
      setEvidence(result); setFeedback(result.report.teacherFeedback ?? '');
      const saved = (result.report.rubric as {steps?:VesselStepReview[]}|null)?.steps;
      setSteps(Array.from({length:20},(_,index)=>saved?.find((step)=>step.stepSequence === index+1) ?? {
        stepSequence:index+1,attemptId:result.attempts.filter((attempt)=>attempt.stepKey.endsWith(`-step-${index+1}`)).at(-1)?.id ?? '',
        prediction:null,operation:null,performance:index >= 8 ? null : 0,interpretation:null,feedback:'',
      }));
    } catch (error) {setMessage(error instanceof Error ? error.message : '报告读取失败。');}
    finally {setBusy(false);}
  }

  async function review(action:'start'|'review'|'return'|'finalize') {
    if (!evidence) return;
    setBusy(true); setMessage('');
    try {
      await readJson(`/api/ilab/experiment-reports/${evidence.report.id}`,{method:'PATCH',headers:{'content-type':'application/json'},
        body:JSON.stringify({expectedRevision:evidence.report.revision,action,feedback,steps})});
      await openReport(evidence.report.id); await reload();
      setMessage(action === 'return' ? '报告已退回，原始尝试与教师意见已保留。' : '教师复核状态已保存。');
    } catch (error) {setMessage(error instanceof Error ? error.message : '复核保存失败。');}
    finally {setBusy(false);}
  }

  async function openWork(kind:'attempt'|'comparison'|'trace',id:string) {
    if (!evidence) return;
    try {
      const raw = await readJson<Record<string,unknown>>(`/api/ilab/experiment-reports/${evidence.report.id}?kind=${kind}&workId=${encodeURIComponent(id)}`);
      if (kind === 'attempt') setWork(raw as {answers:Record<string,string>});
      else if (kind === 'comparison') setComparison({...raw,id:raw.clientRef,scopeKey:'review',modelId:raw.modelClientRef,
        actuatorModelId:raw.actuatorModelClientRef,runId:raw.runRef,serverId:id} as unknown as VesselModelComparison);
      else {
        const url = URL.createObjectURL(new Blob([JSON.stringify(raw)],{type:'application/json'}));
        const link = document.createElement('a'); link.href = url; link.download = '实验原始采样.json'; link.click();
        window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
    } catch (error) {setMessage(error instanceof Error ? error.message : '原始证据读取失败。');}
  }

  const reviewSummary = summarizeVesselReview(steps);
  return <main className="space-y-6 px-6 py-8">
    <h1 className="text-2xl font-semibold text-platform-fg-primary">仿真实验复核</h1>
    <div className="flex flex-wrap gap-3">
      <select aria-label="筛选班级" className={inputClass} value={classId} onChange={(event)=>setClassId(event.target.value)}><option value="">全部班级</option>{classes.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <select aria-label="筛选实验" className={inputClass} value={courseKey} onChange={(event)=>setCourseKey(event.target.value)}><option value="">全部实验</option>{Object.values(VESSEL_COURSES).map((course)=><option key={course.key} value={course.key}>{course.title}</option>)}</select>
      <select aria-label="筛选复核状态" className={inputClass} value={status} onChange={(event)=>setStatus(event.target.value)}><option value="">全部状态</option>{Object.entries(VESSEL_REPORT_STATUSES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
      <Button variant="outline" disabled={busy} onClick={()=>{void reload().catch((error:unknown)=>setMessage(String(error)));}}>刷新报告</Button>
    </div>
    {message ? <p role="status" className="text-sm text-platform-fg-secondary">{message}</p> : null}
    <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <section className="space-y-2" aria-label="实验报告列表">
        {reports.map((report)=><button type="button" key={report.id} onClick={()=>{void openReport(report.id);}}
          className="block w-full rounded-lg border border-platform-border bg-platform-surface p-3 text-left text-sm">
          <span className="block font-medium text-platform-fg-primary">{report.studentName ?? '未填写姓名'} · {report.title}</span>
          <span className="text-platform-fg-secondary">{statusLabel(report.status)}{report.score !== null ? ` · ${report.score}/${report.maxScore}分` : ' · 待评分'}</span>
        </button>)}
        {!reports.length ? <p className="text-sm text-platform-fg-secondary">当前筛选下暂无实验报告。</p> : null}
        {nextCursor ? <Button variant="outline" onClick={()=>{void reload(nextCursor).catch((error:unknown)=>setMessage(String(error)));}}>加载更多</Button> : null}
      </section>
      {evidence ? <article className="min-w-0 space-y-5 rounded-xl border border-platform-border p-5">
        <h2 className="text-lg font-semibold">{evidence.report.title} · {statusLabel(evidence.report.status)}</h2>
        {Object.entries(VESSEL_REPORT_SECTION_LABELS).map(([key,label])=><section key={key}>
          <h3 className="font-medium">{label}</h3><p className="whitespace-pre-wrap text-sm text-platform-fg-secondary">{(evidence.report.sections as Record<string,string>)?.[key] || '尚未填写'}</p>
        </section>)}
        <details><summary>运行与确定性指标</summary><div className="space-y-3 py-3">
          {evidence.runs.map((run)=>{
            const metrics = (run.summary as {metrics?:Record<string,number|null>}).metrics;
            const fine = (run.summary as {fineStepMetrics?:VesselSessionFrame['fineStepMetrics']}).fineStepMetrics;
            return <section key={run.runRef} className="rounded border border-platform-border p-3 text-sm">
              <h4>第{run.stepSequence}步 · {run.timeS.toFixed(1)}s · {run.status === 'failed' ? '数值运行中断' : run.status === 'running' ? '采集中' : '已结束'}</h4>
              <p>20Hz航向RMSE {metrics?.headingRmseDeg?.toFixed(3) ?? '缺少有效量测'}° · 末120s平均绝对误差 {metrics?.final120sHeadingMaeDeg?.toFixed(3) ?? '不适用'}°</p>
              <p>调节时间 {metrics?.settlingTimeS === null || metrics?.settlingTimeS === undefined ? '末段尚未持续保持60s' : `${metrics.settlingTimeS.toFixed(2)}s`} · 20Hz最大横摇 {metrics?.maximumRollDeg?.toFixed(2) ?? '待核验'}°</p>
              {fine ? <div className="space-y-1">
                <p>120Hz物理细步最大横摇 {fine.values.maximumRollDeg.toFixed(3)}° · 超过{fine.rollWarningDeg}°累计 {fine.values.rollWarningDurationS.toFixed(3)}s</p>
                <p>最大舵速 {fine.values.maximumSurfaceRateDegS.toFixed(3)}°/s · 单轴功率峰值 {(fine.values.maximumShaftPowerW/1e6).toFixed(3)}MW · 正机械功 {(fine.values.positiveMotorWorkJ/1e6).toFixed(3)}MJ</p>
                <p>约束违反持续时间，舵角 {fine.values.surfaceAngleViolationS.toFixed(4)}s，舵速 {fine.values.surfaceRateViolationS.toFixed(4)}s，轴速 {fine.values.shaftSpeedViolationS.toFixed(4)}s，单轴功率 {fine.values.shaftPowerViolationS.toFixed(4)}s，系统功率 {fine.values.systemPowerViolationS.toFixed(4)}s</p>
                <p>原始分块含事件前后各1s的120Hz窗口，重叠区间合并保留。</p>
              </div> : null}
              <details><summary>原始采样分块</summary>{run.traces.map((trace)=><Button key={trace.id} size="sm" variant="outline" onClick={()=>{void openWork('trace',trace.id);}}>下载第{(trace.chunkIndex ?? 0)+1}段 · {trace.sampleCount}个控制样本</Button>)}</details>
            </section>;
          })}
        </div></details>
        <details><summary>冻结模型与独立对照</summary><div className="space-y-2 py-3">
          {evidence.models.map((model)=><pre key={model.id} className="overflow-x-auto rounded bg-platform-surface p-2 text-xs">{model.lineageKey} · 版本{model.version}{'\n'}{JSON.stringify(model.structure,null,2)}{'\n'}训练窗口 {JSON.stringify(model.trainingRuns)}</pre>)}
          {evidence.comparisons.map((item,index)=><Button key={item.id} size="sm" variant="outline" onClick={()=>{void openWork('comparison',item.id);}}>查看独立对照 {index+1}</Button>)}
          {comparison ? <ModelComparisonCurve comparison={comparison} /> : null}
        </div></details>
        <details><summary>全部尝试与原始作品</summary><div className="flex flex-wrap gap-2 py-3">
          {evidence.attempts.map((attempt)=><Button key={attempt.id} size="sm" variant="outline" onClick={()=>{void openWork('attempt',attempt.id);}}>第{attempt.stepKey.split('-step-').at(-1)}步 · 第{attempt.attemptSeq}次</Button>)}
        </div>{work ? <div className="space-y-2">
          <p className="text-sm">本次证据状态 {attemptStatusLabels[work.outcome ?? 'submitted'] ?? '待复核'}</p>
          {work.validationFeedback ? <p>{work.validationFeedback}</p> : null}
          {Object.entries(work.answers ?? {}).map(([key,value])=>key === 'sketchImage'
            ? <Image key={key} src={value} alt="学生保存的原始手绘" width={800} height={480} unoptimized className="h-auto max-w-full" />
            : <p key={key} className="whitespace-pre-wrap text-sm text-platform-fg-secondary">{value}</p>)}
        </div> : null}</details>
        <section className="space-y-3">
          <h3 className="font-medium">固定量规评分</h3>
          <p className="text-sm text-platform-fg-secondary">已评 {reviewSummary.earned}分 · {reviewSummary.complete ? '全部评分项已填写' : '仍有待评分项'}</p>
          <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th>步骤与选定尝试</th><th>预测／模型</th><th>证据／验证</th><th>性能／比较</th><th>解释／边界</th><th>评语</th></tr></thead><tbody>
            {steps.map((step,index)=>{
              const limits = vesselStepReviewLimits(step.stepSequence,step.stepSequence >= 9 && step.stepSequence < 20);
              return <tr key={step.stepSequence}><td className="py-2"><select aria-label={`第${step.stepSequence}步选定尝试`} className={inputClass} value={step.attemptId} onChange={(event)=>setSteps((previous)=>previous.map((item,i)=>i === index ? {...item,attemptId:event.target.value} : item))}>
                <option value="">选择第{step.stepSequence}步尝试</option>{evidence.attempts.filter((attempt)=>attempt.stepKey.endsWith(`-step-${step.stepSequence}`)).map((attempt)=><option key={attempt.id} value={attempt.id}>第{step.stepSequence}步 · 第{attempt.attemptSeq}次</option>)}
              </select></td>{(['prediction','operation','performance','interpretation'] as const).map((key)=><td key={key}><input type="number" aria-label={`第${step.stepSequence}步${key}评分`} min={0} max={limits[key]} step={.01} className={`${inputClass} w-24`} value={step[key] ?? ''} placeholder={`待评/${limits[key]}`} disabled={busy || evidence.report.status === 'finalized'}
                onChange={(event)=>{const value = event.target.value === '' ? null : Number(event.target.value);setSteps((previous)=>previous.map((item,i)=>i === index ? {...item,[key]:value} : item));}} /></td>)}<td><input aria-label={`第${step.stepSequence}步评语`} className={inputClass} value={step.feedback} onChange={(event)=>setSteps((previous)=>previous.map((item,i)=>i === index ? {...item,feedback:event.target.value} : item))} /></td></tr>;
            })}
          </tbody></table></div>
          <label className="block space-y-1 text-sm">综合评语与证据标注<textarea aria-label="教师综合评语" className={`${inputClass} block w-full`} rows={4} value={feedback} onChange={(event)=>setFeedback(event.target.value)} /></label>
          <div className="flex flex-wrap gap-2">
            {evidence.report.status === 'submitted' ? <Button disabled={busy} onClick={()=>{void review('start');}}>开始复核</Button> : null}
            <Button disabled={busy || !['submitted','pending-review','reviewed'].includes(evidence.report.status)} onClick={()=>{void review('review');}}>保存已评部分</Button>
            <Button variant="outline" disabled={busy || !['submitted','pending-review','reviewed'].includes(evidence.report.status)} onClick={()=>{void review('return');}}>退回修改</Button>
            <Button disabled={busy || evidence.report.status !== 'reviewed'} onClick={()=>{void review('finalize');}}>确认最终成绩</Button>
          </div>
        </section>
      </article> : <p className="text-sm text-platform-fg-secondary">选择报告以查看原始证据并复核。</p>}
    </div>
  </main>;
}
