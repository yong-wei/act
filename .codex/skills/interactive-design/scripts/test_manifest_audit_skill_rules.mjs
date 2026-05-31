import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const interactiveDesign = read('.codex/skills/interactive-design/SKILL.md');
const pageSequenceReference = read(
  '.codex/skills/interactive-design/references/page-sequence-and-activity-controls.md',
);
const implementationSkill = read('.agents/skills/interactive-lesson/SKILL.md');
const manifestRuntimeContract = read(
  '.agents/skills/interactive-lesson/references/manifest-runtime-contract.md',
);
const lessonContentReview = read('.codex/skills/lesson-content-review/SKILL.md');
const reviewScript = read('course-content/scripts/review_lesson_content.py');

assert.equal(
  interactiveDesign.includes('payload.resolver') &&
    interactiveDesign.includes('resolved_content_source') &&
    interactiveDesign.includes('renderer_owner: content'),
  true,
  'interactive-design should require auditable payload sources and renderer ownership',
);

assert.equal(
  pageSequenceReference.includes('payload 解析必须可被脚本审计') &&
    pageSequenceReference.includes('activity_cards[].prompt') &&
    pageSequenceReference.includes('implicit:key_formulas_by_formula_card_order'),
  true,
  'interactive-design reference should define manifest audit fields and implicit resolver rules',
);

assert.equal(
  implementationSkill.includes('`content-renderers.tsx` 与 `activity-renderers.tsx` 的职责必须分离') &&
    implementationSkill.includes('manifest audit') &&
    implementationSkill.includes('activity 模块不进入正文') &&
    implementationSkill.includes('.codex/skills/interactive-design/scripts/audit_interactive_manifest.py'),
  true,
  'interactive implementation skill should require content/activity separation and manifest audit',
);

assert.equal(
  manifestRuntimeContract.includes('活动模块归属 activity runtime，不归 content runtime') &&
    manifestRuntimeContract.includes('Manifest audit 规则') &&
    manifestRuntimeContract.includes('每个 `activity_cards[].prompt` 默认只出现一次') &&
    manifestRuntimeContract.includes('.codex/skills/interactive-design/scripts/audit_interactive_manifest.py'),
  true,
  'manifest runtime contract should classify activity modules and define duplicate-prompt audit rules',
);

assert.equal(
  lessonContentReview.includes('模块消费级') &&
    lessonContentReview.includes('模块消费审计') &&
    lessonContentReview.includes('重复题面') &&
    lessonContentReview.includes('review 技能负责调用、读取和报告审计结果，不重新实现一套平行规则'),
  true,
  'lesson-content-review should require module consumption audit for manifest-first courses',
);

assert.equal(
  reviewScript.includes('MANIFEST_AUDIT_SCRIPT') &&
    reviewScript.includes('run_interactive_manifest_audit') &&
    reviewScript.includes('interactive-manifest-audit.json') &&
    reviewScript.includes('manifest_audit_issues'),
  true,
  'lesson-content-review script should run and persist independent manifest audits as a blocking gate',
);

console.log('manifest audit skill rules test passed');
