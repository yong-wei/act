# Task: Restore Simplified Chinese teacher diagnosis report content

## 1. 生成契约

- [x] 1.1 system prompt 增加简体中文输出要求（自然语言字段为简体中文，技术值豁免）。
- [x] 1.2 新增确定性语言校验：`summary`、`findings[].title`、`findings[].summary`、`limitations[]` 必须含中文字符且中文字符数 ≥ 拉丁字母数；失败抛出独立错误类型。
- [x] 1.3 worker 失败分类接入：`diagnosis-provider-language-mismatch` 归入可重试（`validation: false`），耗尽预算后任务失败并呈现中文失败信息。

## 2. 交付面文案

- [x] 2.1 `diagnosis-report-delivery-view.tsx` 眉题 "Fixed governed report" 改为简体中文文案，排版不变。

## 3. 测试与验证

- [x] 3.1 语言校验单元测试：中文通过、英文字段拒绝、混排按占比判定、空 findings 合法。
- [x] 3.2 worker 失败分类断言：语言失败可重试、错误码与中文消息正确。
- [x] 3.3 交付视图断言：眉题为中文、不再出现 "Fixed governed report"。
- [x] 3.4 `npm run typecheck`、相关 Vitest 套件、`npm run lint`（改动文件）通过。
