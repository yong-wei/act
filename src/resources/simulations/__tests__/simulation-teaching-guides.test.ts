import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {parse} from 'yaml';
import {VESSEL_COURSES, VESSEL_GUIDE_EDITION, VESSEL_TEACHING_CARDS} from '../experiments/course-catalog';
import {VESSEL_COURSE_VERSION} from '../experiments/destroyer-course';
import {vesselCourseStepReviewLimits} from '@/features/ilab/course-report-review-contract';
import manifest from '../../../../public/supporting/teaching-guides.json';
import examples from '../../../../docs/teaching/virtual-simulations/examples.json';

const root = process.cwd();
const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const read = (file: string) => readFileSync(path.join(root, file));

describe('同版本七船教学材料', () => {
  it('七份课程卡、对齐表与量规均覆盖20步和100分', () => {
    expect(Object.keys(VESSEL_TEACHING_CARDS)).toEqual(Object.keys(VESSEL_COURSES));
    for (const course of Object.values(VESSEL_COURSES)) {
      const directory = `docs/teaching/virtual-simulations/${course.experimentId}`;
      const alignment = parse(read(`${directory}/alignment.yaml`).toString());
      const rubric = parse(read(`${directory}/rubric.yaml`).toString());
      expect(alignment).toMatchObject({courseVersion: VESSEL_COURSE_VERSION, guideEdition: VESSEL_GUIDE_EDITION,
        experimentId: course.experimentId, title: course.title});
      expect(alignment.steps).toHaveLength(20);
      expect(rubric).toMatchObject({courseVersion: VESSEL_COURSE_VERSION, total: 100});
      expect(rubric.steps).toHaveLength(20);
      for (let index = 0; index < 20; index++) {
        const step = alignment.steps[index];
        expect(step.sequence).toBe(index + 1);
        expect(step.objectiveRefs.length).toBeGreaterThan(0);
        expect(rubric.steps[index]).toMatchObject(vesselCourseStepReviewLimits(course.key, index + 1));
      }
      expect(read(`${directory}/guide.md`).toString().match(/### 第\d+步 /g)).toHaveLength(20);
    }
  });

  it('只发布一组精简的软件验收示例并保留真实预测差异', () => {
    for (const key of Object.keys(VESSEL_COURSES) as Array<keyof typeof examples>) {
      const example = examples[key];
      expect(example.courseVersion).toBe(VESSEL_COURSE_VERSION);
      expect(example.sourceKind).toContain('acceptance');
      expect(example.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
      expect(example.timeS.length).toBeGreaterThan(1);
      expect(example.timeS.length).toBeLessThanOrEqual(400);
      expect(example.measured).toHaveLength(example.timeS.length);
      expect(example.predicted).toHaveLength(example.timeS.length);
      expect(example.measured).not.toEqual(example.predicted);
      expect(Object.keys(example).filter((field) => ['userId', 'name', 'email', 'rawAnswer'].includes(field))).toEqual([]);
    }
  });

  it('生成输入与九份PDF的固定版本、稳定入口保持一致', () => {
    expect(manifest).toMatchObject({courseVersion: VESSEL_COURSE_VERSION, edition: VESSEL_GUIDE_EDITION});
    expect(manifest.files).toHaveLength(9);
    for (const [file, hash] of Object.entries(manifest.inputFiles)) expect(sha256(read(file))).toBe(hash);
    expect(sha256(JSON.stringify(manifest.inputFiles))).toBe(manifest.inputHash);
    for (const file of manifest.files) {
      const stable = read(`public/supporting/${file.name}`);
      expect(stable.byteLength).toBe(file.bytes);
      expect(sha256(stable)).toBe(file.sha256);
      expect(sha256(read(`public/supporting/${manifest.edition}/${file.name}`))).toBe(file.sha256);
      expect(stable.subarray(0, 5).toString()).toBe('%PDF-');
      expect(file.pages).toBeGreaterThan(0);
    }
  });
});
