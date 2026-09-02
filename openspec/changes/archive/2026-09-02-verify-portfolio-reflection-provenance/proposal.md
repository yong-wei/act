## Why

作品集反思候选当前直接从 URL 读取 `source`、`assignment` 和 `intent`，并将它们保存为草稿不可修改的 provenance。API 只校验字符串格式，没有将这些声明绑定到服务端任务、证据或来源身份。学生因此可以构造任意“平台来源”并让它成为后续审计元数据，破坏反思草稿的可追溯性。

## What Changes

- 将平台核验 provenance 改为由服务端根据受限来源身份与当前学生授权派生。
- 仅将 URL 参数视为导航提示，不允许其单独建立平台来源、任务或意图事实。
- 如果支持自由反思，将学生手动填写的标题与描述明确标记为“学生提供”，不得伪装为平台核验证据。
- 保留现有 candidate-only、显式保存、草稿所有权与保存后 provenance 不可修改边界。

## Capabilities

### New Capabilities

- `portfolio-reflection-provenance`: 定义平台核验来源、学生自填标签与反思草稿 provenance 的服务端信任边界。

### Modified Capabilities

None.

## Impact

- Affected navigation and candidate construction: `src/app/ai/copilot/page.tsx`, portfolio reflection page, AI task boundary contracts.
- Affected persistence API: `/api/profile/portfolio-reflection-drafts` create path.
- May require a bounded source identity and additive provenance-kind field or equivalent explicit representation.
- No automatic portfolio publication, LearningFact, learner portrait, score, or conversation persistence change.

