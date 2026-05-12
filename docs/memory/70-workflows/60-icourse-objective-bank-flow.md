# iCourse 客观题落库流程

状态: active
最后更新: 2026-03-28
摘要: 记录 `iCourse163 bankType=4` 客观题从网页导出到 `objective-bank` 纯文本题库的稳定处理链路；当前正式制品已落在 `course-content/questions/objective-bank/icourse-bank-bankType4.*`，统计为 `226` 题（单选 `96`、多选 `129`、填空 `1`）。
上游:
- [00-index.md](00-index.md)
下游: []
相关:
- [../../course-content/questions/README.md](../../../course-content/questions/README.md)
- [../../course-content/questions/scripts/build_icourse_objective_bank.py](../../../course-content/questions/scripts/build_icourse_objective_bank.py)
- [../../course-content/questions/objective-bank/icourse-bank-bankType4.index.json](../../../course-content/questions/objective-bank/icourse-bank-bankType4.index.json)

## 固定产物

- 原始接口导出：`tmp/icourse-question-bank-bankType4.json`
- repair pack：`tmp/icourse-question-bank-repair/`
- 公式映射：`tmp/icourse-formula-map.complete.json`
- 正式制品：
  - `course-content/questions/objective-bank/icourse-bank-bankType4.jsonl`
  - `course-content/questions/objective-bank/icourse-bank-bankType4.index.json`
  - `course-content/questions/objective-bank/icourse-bank-bankType4.overview.md`
  - `course-content/questions/objective-bank/icourse-bank-bankType4.errors.json`

## 处理原则

1. 客观题单独落到 `objective-bank/`，不要污染 `questions/AC-Q-*.json` 解析题库。
2. 只纳入 `single / multiple / fill_blank`，排除主观题。
3. 题型以 `correct_answers` 数量重标，不盲信源平台题型。
4. 平台里的公式图全部回填为纯文本或 LaTeX；最终题库不依赖外挂图片。
5. 结构以“检索与自适应推荐”为主，不强行复用解析题的字段设计。

## 稳定执行顺序

1. 准备或更新 `tmp/icourse-question-bank-repair/`，确保每题 manifest 与公式图已拆出。
2. 在 `tmp/icourse-formula-map.complete.json` 中人工修正公式图哈希到文本/LaTeX 的映射。
3. 运行：

```bash
python3 course-content/questions/scripts/build_icourse_objective_bank.py \
  --repair-root tmp/icourse-question-bank-repair \
  --formula-map tmp/icourse-formula-map.complete.json \
  --output-root tmp/icourse-objective-bank-complete \
  --bank-slug icourse-bank-bankType4
```

4. 用异常扫描确认导出结果中不再残留 `[FORMULA:]`、`\begin{array}`、`\hat{}`、`\tilde{}`、Unicode `Γ` 等 OCR 脏串。
5. 将通过校验的导出结果复制到 `course-content/questions/objective-bank/`。
6. 至少运行：

```bash
python3 -m pytest course-content/tests/test_prepare_icourse_question_bank_repair.py \
  course-content/tests/test_build_icourse_objective_bank.py -q
```

## 当前统计口径

- 总题数：`226`
- 单选：`96`
- 多选：`129`
- 填空：`1`
- 主观题排除数：`53`

## 易错点

- 结构图题与反馈图题的 stem 不能直接保留图片链接；应改写成纯文本结构描述。
- 频域/离散系统题常见脏串是 `\ ` 伪空格、Unicode `Γ_φ`、`t_v/t_p` 混淆、`10/16` 误识、以及 `c_h/e_h` 误识。
- 对 `objective-bank` 的修正应优先改 `formula-map.complete.json`，再统一重建，不要手改最终 `jsonl`。
