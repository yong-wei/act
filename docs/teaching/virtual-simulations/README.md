# 七船仿真实验教学材料

课程版本为 `seven-vessel-2026.11.14`，指导书版本为 `2026.11.16`。七个实验分别完成二十步与100分评价。目录页面和原实验面板沿用既有指导书入口。

## 内容来源与生成

课程步骤沿用 `src/resources/simulations/experiments/*-course.ts`，量规沿用 `course-report-review-contract.ts`，课程卡与公开参考资料位于 `experiments/catalog/teaching-cards.json`。各实验目录保存生成的课程卡、完整指导书、目标对齐表、评分量规与一组精简曲线示例。`compilation.md` 为同源汇编，通用操作说明的作者源为 `platform-operation-manual.source.md`。

生成与检查在仓库根目录执行。

```bash
rtk npx tsx scripts/simulations/generate-teaching-guides.mts --pdf
rtk npx tsx scripts/simulations/generate-teaching-guides.mts --check
rtk npx vitest run src/resources/simulations/__tests__/simulation-teaching-guides.test.ts src/resources/simulations/__tests__/course-report.test.ts
```

PDF生成需要本机Chrome与`pdftotext`。脚本按实际排页生成目录，并将九份文件写入 `public/supporting/2026.11.16/` 及既有稳定文件名。`public/supporting/teaching-guides.json` 保存来源文件哈希、PDF字节数、页数与哈希。检查模式核对文本、图例、来源与两个PDF入口。

`examples.json` 只保留各船一组同版本软件验收对照，每组最多400点。量测、观测估计与本人预测按图例区分，预测残差保留。公开文件包含单位、模型、指标和来源摘要，不包含账号、原始答案或私有记录引用。默认教学入口按需读取代表记录，完整历史记录继续保存在原私有证据链。

## 版本与迁移

新版报告固定引用带版本目录的指导书。既有报告HTML继续保留其原内容。后续材料改版应采用新的指导书版本目录，并继续保留已被报告引用的目录。旧版PDF可从`v0.7.46`及更早发布标签恢复。

各册末尾保存旧二十步与新二十步的位置映射。旧版读数、操作与控制背景可用于预习，新版依据本人模型、独立预测、约束与未见工况形成证据。旧分数保留原版本，教师按新量规分别复核新提交。

## 软件验收与教学记录

软件验收记录、数据库聚合盘点与正式试教学证据分别登记在[教学证据索引](teaching-evidence-index.md)。设计用时由课程卡明确列出，实际课时与学习效果由后续试教学记录核验。
