# PDF 选择题题库提取与自适应整合 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `course-content/questions/source/单元测验*.pdf` 中的选择题抽取为结构化题库，并把它们作为项目原生基础题型接入数据库驱动的自适应练习与推荐链路。

**Architecture:** 继续以 `course-content/questions/` 作为题库源数据仓，但新增一条面向 PDF 选择题的 objective-question 抽取支路；随后把 `prisma.Question / UserAnswer` 从“统计占位表”升级为“可渲染、可单选/多选、可追踪学习事实”的正式题表，并将 `src/features/assessment/adaptive-engine.ts` 改为 DB-backed 服务。页面继续消费统一的 `PublicQuestion` 契约，但题目来源从进程内存迁移到 Prisma，答题后同时写入 `UserAnswer` 与 `LearningFact`。

**Tech Stack:** Python 3 (`pdfinfo`, `pdftoppm`, 现有 `course-content/questions/scripts/*`), Prisma/PostgreSQL, Next.js 14 Route Handlers, React/TypeScript, 项目现有 `npm run lint` / `npm run test` / `npm run build`

## Current-State Findings

- `course-content/questions/` 已有稳定的结构化题库目录、schema、索引与脚本，但当前只覆盖 DOCX 解析题，不覆盖 PDF 选择题。
- `course-content/questions/source/` 下现有 `23` 份 `单元测验*.pdf`；样本页确认它们不是普通扫描件，而是网页导出的测验查看页，题干、选项与“正确答案/错误答案”标签都在视觉层稳定可见。
- 这些 PDF 的文本层质量较差，`pdftotext` 不能稳定还原中文题干与公式；当前本机 `tesseract` 也缺少 `chi_sim` 中文语言包，因此抽取设计不能依赖本地 OCR 单点成功。
- 当前自适应练习真实后端是 [`src/features/assessment/adaptive-engine.ts`](/Users/YW/Documents/Site/act.just.edu.cn/src/features/assessment/adaptive-engine.ts) + [`src/features/assessment/adaptive-question-bank.ts`](/Users/YW/Documents/Site/act.just.edu.cn/src/features/assessment/adaptive-question-bank.ts)，题目与答题记录都保存在进程内存中，服务重启即丢失。
- 数据库里虽然已有 [`Question` / `UserAnswer` 模型](/Users/YW/Documents/Site/act.just.edu.cn/prisma/schema.prisma)，但当前 `Question` 不存选项文本，`correctAnswer` 只有单字符串，`UserAnswer.answerGiven` 也只有单字符串，尚不足以作为“原生单选/多选题库”正式承载层。
- 学生画像页会读取 `adaptive-engine` 的能力结果，但“最近活动”依赖 `LearningFact`；当前自适应练习没有把答题沉淀为 `LearningFact`，因此画像与推荐链路存在断层。

## Recommended Direction

1. 结构化题库层继续保留文件制品，作为“可审校、可重建”的源真相。
2. PDF 选择题抽取采用“视觉解析优先、文本 OCR 仅做辅助、低置信度进入人工复核队列”的两阶段流水线。
3. 项目内正式运行的自适应练习改为数据库驱动；内存 `PRESET_QUESTIONS` 仅保留为 demo/fallback。
4. `Question`/`UserAnswer` 需要原生支持 `options + correctAnswers + single/multiple`，不能只在 `aiMetadata` 里塞隐式结构。
5. 自适应练习提交后必须同时更新 `UserAnswer`、题目统计字段，并写入 `LearningFact(moduleId='adaptive-practice')`，否则推荐与画像不会闭环。

---

### Task 1: 锁定 PDF 选择题的数据契约

**Files:**
- Modify: `course-content/questions/schemas/question.schema.json`
- Modify: `course-content/questions/schemas/index-entry.schema.json`
- Modify: `course-content/questions/README.md`
- Modify: `docs/ProjectDescription.md`

**Step 1: 扩展单题 schema，兼容 objective-choice**

将现有单题 JSON 从“解析题通用结构”扩展为“解析题 + 选择题”共存结构。选择题至少新增以下字段：

```json
{
  "question_kind": "objective_choice",
  "choice_mode": "single",
  "options": [
    { "key": "A", "text": "开环控制方式", "is_correct": false },
    { "key": "B", "text": "闭环控制方式", "is_correct": true }
  ],
  "correct_answers": ["B"],
  "source_bundle": {
    "kind": "pdf",
    "file": "单元测验1.pdf",
    "unit": 1,
    "page": 1,
    "question_index_on_page": 1
  },
  "review_status": "extracted",
  "adaptive_metadata": {
    "domains": ["time"],
    "difficulty_seed": 0.3
  }
}
```

**Step 2: 明确题型判定规则**

- `choice_mode = single` 当且仅当 `correct_answers.length === 1`
- `choice_mode = multiple` 当且仅当 `correct_answers.length > 1`
- 若视觉层控件形状与答案数量冲突，抽取脚本必须将题目标为 `review_status=needs_review`

**Step 3: 扩展索引条目**

`index-entry.schema.json` 新增：

- `question_kind`
- `choice_mode`
- `correct_answer_count`
- `review_status`
- `unit`

**Step 4: 记录源文件与审校规则**

在 `README.md` 里写清：

- PDF 选择题与 DOCX 解析题共用 `questions/` 与 `indexes/`
- 所有新题仍沿用 `AC-Q-*.json` / `AC-Q-*.md`
- `source_bundle.kind = pdf` 作为来源区分
- `usage_status` 继续保留，新增 `review_status` 专门描述抽取置信度和人工复核状态

**Step 5: 验证 schema 变更**

Run:

```bash
python3 course-content/questions/scripts/build_question_indexes.py
```

Expected:

- 现有 DOCX 题库索引仍能成功生成
- 不会因为新字段是 optional/union 而破坏旧题兼容性

---

### Task 2: 实现 PDF 选择题抽取流水线

**Files:**
- Create: `course-content/questions/scripts/extract_pdf_choice_bank.py`
- Create: `course-content/questions/reports/pdf-choice-extraction-report.json`
- Create: `course-content/questions/reports/pdf-choice-review-queue.json`
- Modify: `course-content/questions/README.md`

**Step 1: 构建页面渲染器**

脚本入口先枚举：

```python
sorted((root / "source").glob("单元测验*.pdf"))
```

使用：

```bash
pdftoppm -f 1 -l 1 source.pdf tmp/pdfs/unit1
```

把每页转成图片，再做题块切分。中间文件统一落在 `tmp/pdfs/`。

**Step 2: 采用“视觉抽取优先”的解析器接口**

实现一个后端抽象：

```python
class ChoiceExtractorBackend(Protocol):
    def extract_question_blocks(self, image_path: Path) -> list[dict]: ...
```

推荐默认实现顺序：

1. `vision_llm`：面向页面图像直接产出结构化 JSON
2. `ocr_assisted`：`pdftotext`/`tesseract` 辅助提取纯文本片段
3. `manual_stub`：提取题块图片并放入复核队列

说明：

- 当前本机中文 OCR 不可用，不能把 `tesseract` 当作主路径
- 选择题页面里“正确答案/错误答案”标签非常稳定，视觉模型更适合

**Step 3: 生成题目 JSON/Markdown**

每道题输出：

- `questions/AC-Q-xxxx.json`
- `questions/AC-Q-xxxx.md`
- 如有必要的整页或题块截图，放到 `assets/AC-Q-xxxx/`

Markdown 的 `## 答案解析` 对选择题先使用：

```md
正确答案：B、D

来源 PDF 中仅包含答案标签，暂无独立解析。
```

**Step 4: 计算题型与答案**

从 `options[*].is_correct` 派生：

```python
correct_answers = [opt["key"] for opt in options if opt["is_correct"]]
choice_mode = "single" if len(correct_answers) == 1 else "multiple"
```

**Step 5: 输出低置信度报告**

报告至少列出：

- 未识别出题号的题块
- 选项数不是 4 的题
- 没有识别到任何正确答案标签的题
- `correct_answers` 与视觉控件形状冲突的题
- 含复杂公式/图形、需人工复核的题

**Step 6: 运行脚本并建立初始产物**

Run:

```bash
python3 course-content/questions/scripts/extract_pdf_choice_bank.py
python3 course-content/questions/scripts/build_question_indexes.py
```

Expected:

- `23` 份 PDF 均进入处理队列
- 每道题都有稳定 `question_id`
- `reports/pdf-choice-review-queue.json` 可直接交给人工二次审校

---

### Task 3: 建立标签与自适应元数据补全规则

**Files:**
- Create: `course-content/questions/indexes/pdf-unit-taxonomy.json`
- Modify: `course-content/questions/scripts/build_question_indexes.py`
- Create: `course-content/questions/scripts/enrich_objective_question_tags.py`

**Step 1: 固定“单元 -> 章节/知识点”映射**

建立手工维护映射，例如：

```json
{
  "1": {
    "chapter": 1,
    "section": "自动控制的一般概念",
    "default_tags": ["自动控制的一般概念", "闭环系统", "开环系统"],
    "default_domains": ["time"]
  }
}
```

理由：

- 仅靠 PDF 页面文本无法稳定恢复课程语义边界
- 单元号是比 OCR 更稳定的元数据

**Step 2: 叠加关键词补标**

通过题干关键词对 `knowledge_tags` 做二次补充，例如：

- “根轨迹” -> `['root-locus', 'complex']`
- “Nyquist” -> `['nyquist', 'frequency']`
- “稳定裕度” -> `['phase-margin', 'gain-margin', 'frequency']`

**Step 3: 生成自适应初始难度**

抽取期先给 `difficulty_seed`：

- 基础概念定义题：`0.25-0.4`
- 判别/读图题：`0.4-0.6`
- 综合公式/非线性题：`0.6-0.8`

上线后再用 `Question.correctRate` 与 `UserAnswer` 数据回写真实难度。

**Step 4: 更新索引全文检索字段**

`search_text` 需要拼接：

- `stem_md`
- `options[].text`
- `knowledge_tags`
- `choice_mode`
- `source_bundle.file`

**Step 5: 验证补标结果**

Run:

```bash
python3 course-content/questions/scripts/enrich_objective_question_tags.py
python3 course-content/questions/scripts/query_question_bank.py --query "闭环系统 正确答案" --limit 5
```

Expected:

- 能按知识标签或概念词检索到新导入的 PDF 选择题

---

### Task 4: 将 Question/UserAnswer 升级为原生题库持久层

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_upgrade_native_objective_question_bank/migration.sql`
- Modify: `scripts/db/seed-semester-usage-for-test-students.mjs`
- Create: `scripts/db/import-question-bank-to-prisma.mjs`

**Step 1: 扩展 Question 模型**

在保持兼容的前提下，新增正式字段：

```prisma
model Question {
  id               String   @id @default(cuid())
  sourceQuestionId String?  @unique
  questionKind     String   @default("objective_choice")
  choiceMode       String?
  options          Json?
  correctAnswers   String[]
  sourceBundle     Json?
  reviewStatus     String?  @default("approved")
  adaptiveMetadata Json?
  // 保留 existing fields 供过渡期使用
}
```

注意：

- 暂时不要直接删除 `correctAnswer`，先做兼容迁移
- 旧 seed 数据可把 `correctAnswers=[correctAnswer]`

**Step 2: 扩展 UserAnswer 模型**

新增：

```prisma
model UserAnswer {
  selectedAnswers Json?
  score           Float?
}
```

过渡规则：

- 单选题兼容写入 `answerGiven="B"`
- 多选题写入 `selectedAnswers=["A","C"]`

**Step 3: 写入导入脚本**

脚本读取 `course-content/questions/questions/*.json` 中的 objective-choice 题，upsert 到 `Question`：

- `source='pdf-choice-bank'`
- `validationStatus` 与 `reviewStatus` 对齐
- `options` 直接保存 JSON 数组

**Step 4: 执行迁移与导入 smoke test**

Run:

```bash
npx prisma migrate dev --name upgrade_native_objective_question_bank
npx tsx scripts/db/import-question-bank-to-prisma.mjs --source course-content/questions/questions
```

Expected:

- `Question` 表里能查到 PDF 选择题
- 旧 `semester-usage-seed` 与 `extracurricular-showcase-seed` 数据不被破坏

**Step 5: 回填种子脚本**

更新 `scripts/db/seed-semester-usage-for-test-students.mjs`，确保种子题也写入：

- `choiceMode`
- `options`
- `correctAnswers`

---

### Task 5: 把自适应练习改为数据库驱动

**Files:**
- Create: `src/features/assessment/question-repository.ts`
- Modify: `src/features/assessment/adaptive-engine.ts`
- Modify: `src/features/assessment/adaptive-question-bank.ts`
- Modify: `src/app/api/assessment/next-question/route.ts`
- Modify: `src/app/api/assessment/submit-answer/route.ts`
- Modify: `src/app/api/assessment/diagnostic/route.ts`
- Modify: `src/app/api/assessment/generate-question/route.ts`
- Modify: `src/app/assessment/adaptive-practice/page.tsx`
- Test: `src/features/assessment/__tests__/adaptive-engine.test.ts`

**Step 1: 提取统一题库仓储层**

新增 `question-repository.ts`，统一负责：

- 从 Prisma 读取 `validationStatus='approved'` 的基础题
- 读取 `source='pdf-choice-bank'` 与其它可用题源
- 输出前端所需 `PublicQuestion`

**Step 2: 把 in-memory store 改为 persistence-first**

`adaptive-engine.ts` 中：

- `selectNextQuestion()` 从 DB 候选池选题
- `getDiagnostic()` / `getAbilityReport()` 从 `UserAnswer` 计算
- `generatedQuestions` 仅作为 AI 临时题缓存，不再承载主题库

**Step 3: 支持多选提交**

前端与 API 请求体改为：

```ts
{
  sessionId: string;
  questionId: string;
  selectedOptions: string[];
  timeSpent: number;
}
```

判题逻辑：

```ts
const isCorrect =
  selected.sort().join('|') === correctAnswers.sort().join('|');
```

**Step 4: 提交后写入 UserAnswer 与 Question 统计**

每次提交后：

- 新增 `UserAnswer`
- 更新 `Question.timesUsed / correctRate / avgTimeSpent`
- 保持旧能力估计输出格式不变，减少页面改动面

**Step 5: 沉淀 LearningFact**

提交后新增：

```ts
await prisma.learningFact.create({
  data: {
    userId,
    factType: 'question',
    moduleId: 'adaptive-practice',
    sessionId,
    outcome: isCorrect ? 'success' : 'failure',
    score: isCorrect ? 1 : 0,
    startedAt,
    finishedAt,
    timeSpent,
    competencyContribution: mappedContribution
  }
})
```

这样个人中心、推荐、数据治理链路才会真正看到自适应练习结果。

**Step 6: 保留 demo/fallback**

`adaptive-question-bank.ts` 的 `PRESET_QUESTIONS` 保留，但只用于：

- `demo=1`
- 数据库为空时的 fallback

---

### Task 6: 验证、回归与上线准备

**Files:**
- Modify: `docs/ProjectDescription.md`
- Test: `src/lib/data-governance/__tests__/profile-route.test.ts`
- Test: `src/features/assessment/__tests__/adaptive-engine.test.ts`
- Test: `src/app/api/assessment/__tests__/submit-answer.route.test.ts`

**Step 1: 写测试**

至少补三类：

1. 单选题提交正确/错误
2. 多选题“全对才得分”
3. 提交后 `UserAnswer`、`Question` 统计、`LearningFact` 同步落库

**Step 2: 跑抽取与导入回归**

Run:

```bash
python3 course-content/questions/scripts/extract_pdf_choice_bank.py
python3 course-content/questions/scripts/build_question_indexes.py
npx tsx scripts/db/import-question-bank-to-prisma.mjs --source course-content/questions/questions
```

Expected:

- 新题数与索引数一致
- 没有空 `options`
- 没有 `correctAnswers=[]`

**Step 3: 跑项目验证**

Run:

```bash
npm run lint
npm run test
npm run build
```

Expected:

- 三项全部通过

**Step 4: UI 手工验收**

手工检查：

- `/assessment/adaptive-practice` 能显示单选与多选
- 提交多选题时，未全选正确项不会误判为正确
- `/profile` 中出现自适应练习活动
- 推荐焦点会随着错题标签变化

**Step 5: 更新文档与项目状态**

完成实现后同步更新：

- `docs/ProjectDescription.md`
- 如形成稳定流程，再更新 `.codex/memory/`

---

## Suggested Execution Order

1. Task 1 锁定 schema
2. Task 2 先抽 2 份 PDF 做小样本验证
3. Task 3 固化标签与难度补全规则
4. Task 4 做 Prisma 迁移
5. Task 5 切自适应练习到 DB-backed
6. Task 6 全量导入、回归和文档收尾

## Acceptance Criteria

- `23` 份 PDF 全部进入结构化题库目录
- 每道题都具备 `choice_mode`、`options`、`correct_answers`、`knowledge_tags`
- 自适应练习页面原生支持单选与多选
- 题目、答题记录、学习事实全部持久化
- 个人中心与推荐链路能消费这些新题的作答结果
- `npm run lint`、`npm run test`、`npm run build` 全通过
