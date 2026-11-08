/**
 * 学生辨识工件与对照工件的共享契约（issue-2152-p1 阶段 1）。
 *
 * 合同：ModelStructure 判别联合与 Rust `control_engine::sixdof::
 * student_model::ModelStructure` 的 serde 输出逐字对齐（snake_case
 * kind 标签）；数值一律拒绝非有限值。本模块为纯 zod，不引
 * node:crypto/Prisma，客户端可直接复用；内容哈希由服务端
 * `server-hash` 计算，客户端不可自报。
 */
import { z } from 'zod';

/** 数值：必须有限（NaN/±Infinity 拒绝）。 */
const finiteNumber = z.number().refine(Number.isFinite, { message: '数值必须有限' });

/** ModelStructure（与 Rust serde 对齐的 kind 判别联合）。 */
export const modelStructureSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('nomoto1'),
    k: finiteNumber,
    t_s: finiteNumber,
  }),
  z.object({
    kind: z.literal('nomoto2'),
    k: finiteNumber,
    t1_s: finiteNumber,
    t2_s: finiteNumber,
  }),
  z.object({
    kind: z.literal('fopdt'),
    k: finiteNumber,
    t_s: finiteNumber,
    delay_s: finiteNumber,
  }),
  z.object({
    kind: z.literal('roll_oscillator'),
    natural_freq_rad_s: finiteNumber,
    damping: finiteNumber,
    control_gain: finiteNumber,
  }),
  z.object({
    kind: z.literal('dp_low_freq3'),
    a: z.array(finiteNumber).length(9),
    b: z.array(finiteNumber).length(9),
  }),
]);

export type ModelStructureValue = z.infer<typeof modelStructureSchema>;

/** 比较 mode（issue-2148 三模式，TS 侧 camelCase 习惯转为下划线存储值）。 */
export const comparisonModeSchema = z.enum([
  'hull_model',
  'command_to_output',
  'independent_closed_loop',
]);
export type ComparisonModeValue = z.infer<typeof comparisonModeSchema>;

/** 对照输入来源标注（A/B 模式必须记录）。 */
export const comparisonInputSourceSchema = z.enum([
  'actuator_measurement',
  'estimated_thrust',
  'command',
]);

/** run 窗口引用：同一 runRef 上起止秒。 */
export const runWindowSchema = z.object({
  runRef: z.string().min(1).max(200),
  startS: finiteNumber,
  endS: finiteNumber,
}).refine((w) => w.endS > w.startS, { message: '窗口结束必须晚于开始' });
export type RunWindow = z.infer<typeof runWindowSchema>;

/** 训练/验证窗口集合：同 runRef 上不得重叠（先冻结再看验证的前提）。 */
function windowsDisjoint(a: RunWindow[], b: RunWindow[]): boolean {
  const overlap = (x: RunWindow, y: RunWindow) =>
    x.runRef === y.runRef && x.startS < y.endS && y.startS < x.endS;
  return !a.some((x) => b.some((y) => overlap(x, y)));
}

/** 辨识元数据（算法/设置/残差/成败/原因）。 */
export const identificationMetaSchema = z.object({
  algorithm: z.string().min(1).max(120),
  settings: z.record(z.union([finiteNumber, z.string(), z.boolean()])),
  identifiedOk: z.boolean(),
  residualRms: finiteNumber.optional(),
  failureReason: z.string().max(400).nullable().optional(),
});

/** 学生辨识工件保存载荷（contentHash 由服务端计算，不接受自报）。 */
export const studentModelSaveSchema = z
  .object({
    experimentKey: z.string().min(1).max(120),
    lineageKey: z.string().min(1).max(160),
    structure: modelStructureSchema,
    ioContract: z.object({
      inputChannel: z.string().min(1).max(120),
      outputChannel: z.string().min(1).max(120),
      inputUnit: z.string().min(1).max(40),
      outputUnit: z.string().min(1).max(40),
    }),
    operatingPoint: z.record(z.union([finiteNumber, z.string(), z.boolean()])),
    identification: identificationMetaSchema,
    trainingRuns: z.array(runWindowSchema).min(1).max(64),
    validationRuns: z.array(runWindowSchema).max(64),
    sampleDt: finiteNumber.refine((v) => v > 0 && v <= 10, { message: '采样周期需在 (0,10] 秒' }),
  })
  .refine((p) => windowsDisjoint(p.trainingRuns, p.validationRuns), {
    message: '同一运行上的训练与验证窗口不得重叠',
    path: ['validationRuns'],
  });

export type StudentModelSaveInput = z.infer<typeof studentModelSaveSchema>;

/** 对照工件保存载荷。 */
export const comparisonSaveSchema = z.object({
  experimentKey: z.string().min(1).max(120),
  stepKey: z.string().min(1).max(160),
  mode: comparisonModeSchema,
  studentModelId: z.string().min(1).max(64),
  physicalRunRef: z.string().min(1).max(200),
  controllerArtifactHash: z.string().length(64).nullable().optional(),
  inputSource: comparisonInputSourceSchema,
  alignmentWindow: z
    .object({ startS: finiteNumber, endS: finiteNumber })
    .refine((w) => w.endS > w.startS, { message: '对照窗口结束必须晚于开始' }),
  factorFlags: z.object({
    physical: z.array(z.string().max(60)).max(32),
    student: z.array(z.string().max(60)).max(32),
    unmodeled: z.array(z.string().max(60)).max(32),
  }),
  metrics: z.record(z.union([finiteNumber, z.string(), z.boolean(), z.null()])),
  curveRefs: z.record(z.union([finiteNumber, z.string(), z.boolean(), z.null()])),
});

export type ComparisonSaveInput = z.infer<typeof comparisonSaveSchema>;

/** 种子：非负十进制数字符串（JSON 不携带 bigint）。 */
const seedString = z
  .string()
  .regex(/^\d{1,20}$/, { message: '种子需为 1-20 位十进制数字' });

/** 生效运行信封载荷（issue-2152 阶段 2a：开启或收口）。 */
export const appliedRunEnvelopeSchema = z.object({
  experimentKey: z.string().min(1).max(120),
  runRef: z.string().min(1).max(200),
  stepKey: z.string().min(1).max(160).nullable().optional(),
  courseVersion: z.string().min(1).max(80),
  modelId: z.string().min(1).max(120),
  modelVersion: z.string().min(1).max(80),
  parameterBundleHash: z.string().max(200).nullable().optional(),
  environmentVersion: z.string().max(80).nullable().optional(),
  sensorVersion: z.string().max(80).nullable().optional(),
  seed: seedString.nullable().optional(),
  substreamIds: z.array(z.string().min(1).max(80)).max(32).nullable().optional(),
  initialState: z.record(z.union([finiteNumber, z.string(), z.boolean()])),
  appliedFactorMask: z.array(z.string().min(1).max(60)).max(32),
  controllerArtifactHash: z.string().length(64).nullable().optional(),
  simulationStartMs: z.number().int().nonnegative(),
  // 收口字段：结束毫秒、终止原因、质量、首采样回执（开启时可缺省）。
  simulationEndMs: z.number().int().nonnegative().nullable().optional(),
  terminationReason: z.string().max(200).nullable().optional(),
  quality: z.record(z.union([finiteNumber, z.string(), z.boolean(), z.null()])).optional(),
  firstSampleReceipt: z.string().max(200).nullable().optional(),
}).refine(
  (e) => e.simulationEndMs === undefined || e.simulationEndMs === null || e.simulationEndMs >= e.simulationStartMs,
  { message: '结束时刻不得早于开始时刻', path: ['simulationEndMs'] },
);

export type AppliedRunEnvelopeInput = z.infer<typeof appliedRunEnvelopeSchema>;

/** 步骤提交尝试状态（issue-2152 §2.D：四类反馈分别记录，不全部叫失败）。 */
export const attemptStatusSchema = z.enum([
  'submitted',
  'scored',
  'invalid_run',
  'model_mismatch',
  'below_target',
]);

/** 步骤提交尝试载荷（阶段 3；只增不删）。 */
export const stepSubmissionAttemptSchema = z.object({
  experimentKey: z.string().min(1).max(120),
  stepKey: z.string().min(1).max(160),
  status: attemptStatusSchema,
  runRefs: z.array(z.string().min(1).max(200)).min(1).max(32),
  studentModelIds: z.array(z.string().min(1).max(64)).max(32).nullable().optional(),
  comparisonIds: z.array(z.string().min(1).max(64)).max(32).nullable().optional(),
  sketchRefs: z.array(z.string().min(1).max(200)).max(32).nullable().optional(),
  explanation: z.string().max(8000).nullable().optional(),
  scoringVersion: z.string().min(1).max(80),
  scoreResult: z
    .record(z.union([finiteNumber, z.string(), z.boolean(), z.null()]))
    .nullable()
    .optional(),
});

export type StepSubmissionAttemptInput = z.infer<typeof stepSubmissionAttemptSchema>;


