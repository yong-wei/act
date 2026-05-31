import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const reviewSkillPath = path.join(root, '.codex/skills/lesson-content-review/SKILL.md');
const implementationSkillPath = path.join(
  root,
  '.agents/skills/interactive-lesson/SKILL.md',
);

assert.equal(fs.existsSync(reviewSkillPath), true, '应新增 lesson-content-review 技能');

const reviewSkill = fs.readFileSync(reviewSkillPath, 'utf8');
assert.equal(
  reviewSkill.includes('design/{unit}-handout.md') &&
    reviewSkill.includes('design/{unit}-practice-guide.md') &&
    reviewSkill.includes('design/{unit}-assessment-spec.md'),
  true,
  '课程审查技能应覆盖理论课 handout 与实践课任务书/评估规格审查',
);

assert.equal(
  reviewSkill.includes('design/{unit}-boppps.md') &&
    reviewSkill.includes('覆盖') &&
    reviewSkill.includes('事实'),
  true,
  '课程审查技能应要求检查 BOPPPS 对正文内容的覆盖与事实正确性',
);

assert.equal(
  reviewSkill.includes('knowledge/cards/lessons') &&
    reviewSkill.includes('knowledge/cards/nodes'),
  true,
  '课程审查技能应要求检查课次 sequence 与全局知识卡片节点',
);

assert.equal(
  reviewSkill.includes('media/processed') &&
    reviewSkill.includes('course-content/runtime/lessons') &&
    reviewSkill.includes('review-report.md'),
  true,
  '课程审查技能应要求先生成 processed 媒体，再导出 runtime/review 产物',
);

const implementationSkill = fs.readFileSync(implementationSkillPath, 'utf8');
assert.equal(
  implementationSkill.includes('lesson-content-review') || implementationSkill.includes('课程审查技能'),
  true,
  '课程制作技能应显式依赖新的课程审查技能作为前置',
);

console.log('test-lesson-content-review-skill passed');
