import { prisma } from '@/lib/prisma';
import type { ModelMessage } from 'ai';
import { readSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import { SIMULATION_COURSE_AI_CONTEXTS, resolveSimulationCourseKeyForAI, resolveSimulationVesselIdForCourse } from '@/resources/simulations/experiments/simulation-ai-contexts';
import { parseStepDrafts } from './ilab-session-lifecycle';
import { VESSEL_EVIDENCE_DOMAIN } from '../course-evidence-service';
import type { VesselTraceChunk } from '../course-evidence-contract';
import {DREDGER_MODE_LABELS} from '@/resources/simulations/experiments/dredger-experiment';

const uploadStatusDescriptions: Record<string, string> = {
  pending: '成绩回传尚未确认完成，报告附件回传尚未确认完成。',
  failed: '成绩回传尚未确认成功，报告附件回传尚未确认完成，可重试。',
  'score-uploaded': '成绩回传已确认，报告附件回传尚未确认完成，可继续补传。',
  uploaded: '成绩回传已确认，报告附件回传已确认。',
  'local-only': '本轮结果保存在平台内。',
  skipped: '本轮采用演示回传。',
};

const measurements = [
  ['Heading', '航向', '°'], ['YawRate', '转艏角速度', '°/s'],
  ['North', '北向位置', 'm'], ['East', '东向位置', 'm'], ['SpeedLog', '对水航速', 'm/s'],
  ['RollRate', '横摇角速度', '°/s'], ['WindSpeed', '相对风速', 'm/s'], ['WindDirection', '相对风向', '°'],
  ['DredgerDepth', '刀位包络深度', 'm'], ['DredgerSwaySpeed', '刀位横移速度', 'm/s'],
  ['DredgerCutterRpm', '绞刀转速', 'r/min'], ['DredgerCableTension0', '左锚缆张力', 'N'],
  ['DredgerCableTension1', '右锚缆张力', 'N'], ['DredgerSpudForce', '钢桩反力', 'N'],
] as const;

const pageObservationFields = [
  ['loadingRatio', '装载率', ''], ['effectiveGmM', '有效横稳心高', 'm'],
  ['windSideAreaM2', '侧向风面积', 'm²'], ['headingDeg', '航向量测', '°'],
  ['waterSpeedMps', '对水航速量测', 'm/s'], ['northM', '北向位置量测', 'm'], ['eastM', '东向位置量测', 'm'],
  ['dredgerDepthM', '刀位包络深度量测', 'm'], ['dredgerSwayMps', '刀位横移速度量测', 'm/s'],
  ['dredgerCutterRpm', '绞刀转速量测', 'r/min'], ['dredgerPortTensionN', '左锚缆张力量测', 'N'],
  ['dredgerStarboardTensionN', '右锚缆张力量测', 'N'], ['dredgerSpudForceN', '钢桩反力量测', 'N'],
] as const;

/** 浏览器只能补充有界数值观察，来源说明与系统指令由服务端固定。 */
export function formatSimulationPageObservation(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const observation = value as Record<string, unknown>;
  const time = observation.timeS;
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time > 86400) return '';
  const readings = pageObservationFields.flatMap(([key, label, unit]) => {
    const reading = observation[key];
    return typeof reading === 'number' && Number.isFinite(reading) && Math.abs(reading) <= 1e9
      ? [`${label}${reading.toFixed(4)}${unit}。`] : [];
  });
  if (typeof observation.dredgerMode === 'string' && Object.hasOwn(DREDGER_MODE_LABELS, observation.dredgerMode)) {
    readings.push(`当前模式为${DREDGER_MODE_LABELS[observation.dredgerMode as keyof typeof DREDGER_MODE_LABELS]}。`);
  }
  return readings.length ? `[浏览器当前页面观察]\n页面报告实验时刻${time.toFixed(2)}s，以下数值尚未由服务端复算，仅用于讨论当前观察。\n${readings.join('\n')}` : '';
}

/** 将服务端页面资料附于本次模型请求，避免历史对话中的步骤指代覆盖当前页面。 */
export function attachSimulationKonlingContext(messages: ModelMessage[], context: string, observation?: unknown): ModelMessage[] {
  if (!context) return messages;
  const lastUserIndex = messages.map((message) => message.role).lastIndexOf('user');
  const pageObservation = formatSimulationPageObservation(observation);
  return messages.map((message, index) => {
    if (index !== lastUserIndex || message.role !== 'user') return message;
    const content = typeof message.content === 'string'
      ? [{ type: 'text' as const, text: message.content }]
      : message.content;
    return {
      ...message,
      content: [...content, {
        type: 'text' as const,
        text: `[服务端当前实验页面资料]\n当前船型、提问步骤和已保存进度以本条资料为准。涉及历史对话时注明其当时的船型和步骤。回答进度问题时分别引用运行记录数、有效步骤提交数、教师终审和回传状态。\n${context}`,
      }, ...(pageObservation ? [{ type: 'text' as const, text: pageObservation }] : [])],
    };
  });
}

export function formatSimulationKonlingEvidence(point: VesselTraceChunk['points'][number]): string {
  const lines = [`采样时刻为实验时间${point.timeS.toFixed(2)}s，航向指令${point.command.headingDeg.toFixed(3)}°。`];
  for (const [key, label, unit] of measurements) {
    const reading = point.measurements[key];
    if (!reading) continue;
    lines.push(reading.quality === 'Good' && reading.value !== null && Number.isFinite(reading.value)
      ? `${label}量测${reading.value.toFixed(4)}${unit}，采样时刻${reading.sampledAtS.toFixed(2)}s。`
      : `${label}量测当前缺测或未定义。`);
  }
  lines.push(`低频估计的北向位置${point.estimate.northM.toFixed(3)}m，东向位置${point.estimate.eastM.toFixed(3)}m，航向${point.estimate.headingDeg.toFixed(3)}°。`);
  if (point.dp) lines.push(`定位参考北/东${point.dp.targetPositionM.map((value) => value.toFixed(3)).join('/')}m，参考航向${point.dp.targetHeadingDeg.toFixed(3)}°，${point.dp.navigationGood ? '导航量测可用' : '导航量测缺失'}，${point.dp.integralFrozen ? '积分已冻结' : '积分正常更新'}。`);
  if (point.container) lines.push(`受限航速参考${point.container.slewedReferenceMps.toFixed(3)}m/s，轴速指令${point.container.commandRpm.toFixed(3)}r/min，${point.container.outsideIdentifiedDomain ? '已经超出本人模型工作域' : '处于本人模型工作域'}。`);
  if (point.cruise) lines.push(`减摇鳍请求/已分配横摇力矩${point.cruise.requestedMomentNm.toFixed(1)}/${point.cruise.allocatedMomentNm.toFixed(1)}N·m，${point.cruise.lowSpeedAuthority ? '当前低来流下鳍控制能力不足' : '当前来流达到常规鳍控制范围'}。`);
  if (point.dredger) {
    const dredger = point.dredger;
    lines.push(`当前作业模式为${DREDGER_MODE_LABELS[dredger.mode]}，横移参考${dredger.referenceMps.toFixed(4)}m/s，`
      + `目标深度${dredger.commands.depthReferenceM.toFixed(3)}m，${dredger.integralFrozen ? '积分已冻结' : '积分正常更新'}。`);
    lines.push(`实际机构账本累计新移除体积${dredger.observation.productionM3.toFixed(4)}m³，`
      + `左/右锚缆${dredger.cableBroken.map((broken) => broken ? '已断开' : '保持连接').join('/')}。`);
  }
  return lines.join('\n');
}

function formatSavedParameters(summary: unknown): string {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return '';
  const parameters = (summary as { parameters?: Record<string, unknown> }).parameters;
  if (!parameters || typeof parameters !== 'object') return '';
  const areas = parameters.windAreasM2 as { lateral?: unknown } | undefined;
  const readings = [
    ['质量', parameters.massKg, 'kg'], ['吃水', parameters.draftM, 'm'],
    ['有效横稳心高', parameters.effectiveGmTransverseM, 'm'], ['侧向风面积', areas?.lateral, 'm²'],
  ].flatMap(([label, value, unit]) => typeof value === 'number' && Number.isFinite(value)
    ? [`${label}${value.toFixed(4)}${unit}。`] : []);
  const state = (summary as { evidenceVerification?: { status?: string } }).evidenceVerification?.status;
  const source = state && state !== 'verified'
    ? '以下参数来自服务端建立的运行初态或最近一次完整核验。'
    : '以下参数来自本步已保存运行的服务端恢复点。';
  return readings.length ? `${source}\n${readings.join('\n')}` : '';
}

function formatEvidenceVerification(summary: unknown): string {
  const state = (summary as { evidenceVerification?: { status?: string } } | null)?.evidenceVerification?.status;
  if (!state) return '';
  if (state === 'verified') return '当前保存前缀已通过服务端完整证据核验。';
  const status = state === 'verifying' ? '正在核验' : state === 'failed' ? '本次核验未通过' : '等待结束或提交时核验';
  return `原始记录与恢复进度已保存，完整证据${status}。以下已保存采样可用于教学观察，正式评分须使用核验通过的证据。`;
}

/** 只读取当前账号、当前实验轮次的已提交采样，不使用浏览器自由文本建立实验事实。 */
export async function loadSimulationKonlingEvidence(userId: string, courseId: string, stepId?: string | null, originId?: string): Promise<string> {
  const courseKey = resolveSimulationCourseKeyForAI(courseId);
  const vesselId = resolveSimulationVesselIdForCourse(courseId);
  const sequence = Number(/-step-(\d+)$/.exec(stepId ?? '')?.[1]);
  if (!courseKey || !vesselId || !Number.isInteger(sequence) || sequence < 1 || sequence > 20) return '';
  const session = await prisma.ilabExperimentRun.findFirst({ where: { userId, vesselId, ...(originId ? { originId } : {}) },
    orderBy: [{ startTimeMs: 'desc' }, { id: 'desc' }],
    select: { stepDrafts: true, reportId: true, uploadStatus: true } });
  const draft = parseStepDrafts(session?.stepDrafts);
  const reportClientRef = typeof draft.courseState?.reportClientRef === 'string' ? draft.courseState.reportClientRef : undefined;
  const report = session?.reportId ? await prisma.virtualSimulationReport.findFirst({
    where: { userId, id: session.reportId, experimentKey: courseKey },
    select: { id: true, clientRef: true, status: true, finalizedAt: true },
  }) : reportClientRef ? await prisma.virtualSimulationReport.findFirst({
    where: { userId, clientRef: reportClientRef, experimentKey: courseKey },
    select: { id: true, clientRef: true, status: true, finalizedAt: true },
  }) : null;
  const stepContext = SIMULATION_COURSE_AI_CONTEXTS[courseId]?.getStepContext(stepId ?? '');
  const heading = [
    `当前学习目标是本页船舶实验第${sequence}步，请围绕本步操作、响应和因果关系指导。`,
    stepContext?.systemPromptExtension,
    draft.activeSeq === undefined
      ? '服务端尚未保存当前操作步骤。'
      : `服务端保存的当前操作步骤为第${draft.activeSeq}步。`,
  ].filter(Boolean).join('\n');
  if (!report?.clientRef) return `${heading}\n本轮尚无已保存的服务端实验证据，请依据步骤目标指导观察。`;
  const [attempts, runCount, run] = await Promise.all([
    prisma.stepSubmissionAttempt.findMany({ where: { userId, experimentKey: `${courseKey}:${report.clientRef}`,
      status: { notIn: ['invalid_run', 'model_mismatch'] } }, select: { stepKey: true }, distinct: ['stepKey'] }),
    prisma.simulationRun.count({ where: { ownerUserId: userId, sourceDomain: VESSEL_EVIDENCE_DOMAIN,
      summary: { path: ['reportId'], equals: report.id } } }),
    prisma.simulationRun.findFirst({ where: { ownerUserId: userId, sourceDomain: VESSEL_EVIDENCE_DOMAIN,
      AND: [{ summary: { path: ['reportId'], equals: report.id } }, { summary: { path: ['stepSequence'], equals: sequence } }] },
      orderBy: { updatedAt: 'desc' }, select: { summary: true,
        traces: { orderBy: { chunkIndex: 'desc' }, take: 1, select: { sampleStorageUri: true } } } }),
  ]);
  const progress = [heading, `本轮服务端已保存${runCount}次运行记录。`, `本轮已保存${attempts.length}步有效提交。`,
    report.status === 'finalized' && report.finalizedAt ? '本轮教师终审已完成。' : '本轮教师终审尚未完成。',
    uploadStatusDescriptions[session?.uploadStatus ?? ''] ?? '本轮回传状态尚未确认。',
    formatEvidenceVerification(run?.summary),
    formatSavedParameters(run?.summary)].filter(Boolean).join('\n');
  const reference = run?.traces[0]?.sampleStorageUri;
  if (!reference) return `${progress}\n当前提问步骤尚无服务端采样，先引导学生完成运行和保存。`;
  try {
    const chunk = await readSimulationTraceChunk<VesselTraceChunk>(reference);
    const point = chunk.points.at(-1);
    return point ? `${progress}\n以下观察来自服务端已保存的本人20Hz记录，可能落后于浏览器正在运行的时刻。\n${formatSimulationKonlingEvidence(point)}` : progress;
  } catch {
    return `${progress}\n本步采样暂时无法读取，当前可依据步骤目标与学生自行提供的观察继续分析。`;
  }
}
