import { z } from 'zod';
import { comparisonModeSchema, studentModelSaveSchema } from '@/lib/student-model-artifact-contract';

const finite = z.number().finite();
const series = z.array(finite).max(72001);
export const VESSEL_REPORT_SECTION_LABELS = {
  problem: '问题与限制', identification: '局部模型', validation: '独立验证',
  comparison: '控制方案与比较', revision: '修改及迁移', conclusion: '工程结论与边界',
} as const;
export const vesselReportSectionsSchema = z.object({
  problem:z.string().max(20000), identification:z.string().max(20000), validation:z.string().max(20000),
  comparison:z.string().max(20000), revision:z.string().max(20000), conclusion:z.string().max(20000),
});
export type VesselReportSections = z.infer<typeof vesselReportSectionsSchema>;

export const vesselCourseArtifactSchema = z.object({
  reportClientRef:z.string().uuid(),
  courseKey:z.enum(['destroyer','lng','container','cruise','drilling','icebreaker','dredger']),
  courseVersion:z.string().min(1).max(80),
  model:z.object({ clientRef:z.string().uuid(), payload:studentModelSaveSchema }).optional(),
  comparison:z.object({
    clientRef:z.string().uuid(), modelClientRef:z.string().uuid(), actuatorModelClientRef:z.string().uuid().nullable(),
    runRef:z.string().uuid(), mode:comparisonModeSchema, startS:finite.min(0), endS:finite.min(0),
    timeS:series, actual:series, predicted:series, measuredInput:series,
    predictedInput:series.nullable(), metrics:z.record(finite.nullable()),
    outputUnit:z.string().max(40).optional(),actualHeadingDeg:z.array(finite.nullable()).max(72001).optional(),
    predictedHeadingDeg:series.optional(),
    purpose:z.enum(['forecast','validation']), controllerInput:z.record(z.unknown()).optional(),
    createdAtMs:z.number().int().nonnegative(),
  }).refine((value) => value.endS > value.startS && value.timeS.length === value.predicted.length
    && (value.purpose === 'forecast' || value.actual.length === value.timeS.length), {message:'对照窗口或数组长度无效'}).optional(),
  attempt:z.object({
    clientRef:z.string().uuid(), stepSequence:z.number().int().min(1).max(20),
    runRefs:z.array(z.string().uuid()).max(100), modelClientRefs:z.array(z.string().uuid()).max(100),
    comparisonClientRefs:z.array(z.string().uuid()).max(200),
    answers:z.record(z.string().max(3_000_000)).refine((answers)=>!answers.sketchImage
      || /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(answers.sketchImage),{message:'原始手绘需要使用页面保存的图片数据'}),
    validationFeedback:z.string().max(8000).nullable(),
    outcome:z.enum(['submitted','invalid_run','model_mismatch','below_target']),
  }).optional(),
  report:z.object({ sections:vesselReportSectionsSchema, runRefs:z.array(z.string().uuid()).max(100),
    action:z.enum(['save','submit']), expectedRevision:z.number().int().positive().optional() }).optional(),
}).refine((value) => [value.model,value.comparison,value.attempt,value.report].filter(Boolean).length === 1,
{message:'每次保存一个完整工件'});
export type VesselCourseArtifactInput = z.infer<typeof vesselCourseArtifactSchema>;
