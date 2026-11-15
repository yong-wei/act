import { z } from 'zod';
import { STEP_SCORE_DISTRIBUTION } from '@/resources/simulations/contracts/experiment-step';
import { DESTROYER_COURSE_STEPS } from '@/resources/simulations/experiments/destroyer-course';
import { LNG_COURSE_STEPS } from '@/resources/simulations/experiments/lng-course';
import { CONTAINER_COURSE_STEPS } from '@/resources/simulations/experiments/container-course';
import { CRUISE_COURSE_STEPS } from '@/resources/simulations/experiments/cruise-course';

export const VESSEL_REPORT_STATUSES = {
  draft:'草稿', submitted:'已提交', 'pending-review':'复核中', 'revision-requested':'退回修改', reviewed:'已复核', finalized:'已确认最终成绩',
} as const;
export const vesselStepReviewSchema = z.object({
  stepSequence:z.number().int().min(1).max(20), attemptId:z.string().min(1).max(100),
  prediction:z.number().finite().nonnegative().nullable(), operation:z.number().finite().nonnegative().nullable(),
  performance:z.number().finite().nonnegative().nullable(), interpretation:z.number().finite().nonnegative().nullable(),
  feedback:z.string().max(4000),
});
export type VesselStepReview = z.infer<typeof vesselStepReviewSchema>;
export const vesselReportReviewSchema = z.object({
  expectedRevision:z.number().int().positive(),
  action:z.enum(['start','review','return','finalize']),
  feedback:z.string().max(20000),
  steps:z.array(vesselStepReviewSchema).max(20),
});
export type VesselReportReviewInput = z.infer<typeof vesselReportReviewSchema>;

export function vesselStepReviewLimits(sequence:number, design:boolean) {
  if (sequence === 20) return {prediction:3,operation:3,performance:2,interpretation:2};
  const points = STEP_SCORE_DISTRIBUTION[sequence-1];
  const share = (ratio:number) => Math.round(points*ratio*100)/100;
  return {prediction:share(.3),operation:share(design ? .2 : .4),performance:share(design ? .2 : 0),interpretation:share(.3)};
}

export function vesselCourseStepReviewLimits(courseKey: string, sequence: number) {
  const definition = courseKey === 'destroyer' ? DESTROYER_COURSE_STEPS[sequence - 1]
    : courseKey === 'lng' ? LNG_COURSE_STEPS[sequence - 1]
      : courseKey === 'container' ? CONTAINER_COURSE_STEPS[sequence - 1]
        : courseKey === 'cruise' ? CRUISE_COURSE_STEPS[sequence - 1] : undefined;
  return vesselStepReviewLimits(sequence, definition ? definition.rubric.kind === 'design' : sequence >= 9 && sequence < 20);
}

export function summarizeVesselReview(steps:VesselStepReview[]) {
  let earned = 0;
  let complete = steps.length === 20 && new Set(steps.map((step)=>step.stepSequence)).size === 20;
  for (const step of steps) for (const key of ['prediction','operation','performance','interpretation'] as const) {
    if (step[key] === null) complete = false;
    else earned += step[key];
  }
  return {earned:Math.round(earned*100)/100,complete,finalScore:complete ? Math.round(earned) : null};
}
