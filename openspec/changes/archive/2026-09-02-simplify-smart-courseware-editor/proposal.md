## Why

智能课件编辑器同时维护 draft envelope、student preview、generation job、module regeneration、review、publication 和 return-state，多处重复解析相同 revision/hash/source-gap 数据。编辑器的局部状态与 `src/lib/smart-courseware` domain/service、publication API 和既有 preparation document editor 之间存在派生状态，增加了 stale refresh、权限投影和课程发布回归的风险。

本 change 是 M8 的第一项简化（C31），依赖 C28 的 canonical AI runtime。它只删除重复状态、转换和 alias，令既有 smart-courseware owner 与 preparation document editor 继续持有事实和编辑行为；不扩展课件能力，也不改变发布合同。

## What Changes

- 以 `src/lib/smart-courseware` 的 domain/service/publication contracts 作为 draft、job、module、revision、hash、source-gap 和 publication 状态真源。
- 以既有 `src/features/teacher/preparation-document-editor/` 作为文档编辑与冲突/保存协调 owner；`SmartCoursewareEditor` 退化为薄的组合呈现层。
- 删除重复的 envelope/preview/job 派生 state、route-specific mapping 和无调用 alias，保留必要的 student-safe/teacher-safe projection。
- 保留静态验证、source-gap acknowledgement、plan baseline、idempotency、retry/resume、publication revision、classroom binding 和 PDF 约束。
- 保留 teacher/admin authorization、AppShell、SSR/R3F dynamic boundary、AI provider audit/privacy 与学生投影隔离。
- 以 before/after characterization、draft/review/publication/resume 及 1440px/320px UI 回归证明行为等价。

## Capabilities

### New Capabilities

- `smart-courseware-editor-simplification`: 规定课件编辑器的唯一事实/编辑 owner、薄组合层和行为保持边界。

### Modified Capabilities

None. `smart-courseware-publication`、`smart-courseware-pdf-export` 及既有课堂绑定规范继续拥有发布、导出和学生安全语义；本 change 不改其 requirements。

## Impact

- 主要范围：`src/features/teacher/smart-courseware-editor.tsx`、`src/features/teacher/preparation-document-editor/*`、`src/lib/smart-courseware/*`、`src/app/api/teacher/smart-courseware/**` 及对应测试。
- 前置依赖 C28；与 C32 平行，但不得共享新的通用编辑 workspace 或状态层。
- 不改 Prisma schema、courseware/publication data model、PlatformSetting、AI 业务事实、AppShell/角色/SSR/R3F、`verify:commit`/`verify:push`/`typecheck` 或 release/rollback validator。
