# UI Evidence: Path Execution 409 Error Display (Issue #995)

## Tested on Commit

`794a076159802dac97ac496f1f04a3d25e4591fc` (see `capture-manifest.json` for SHA binding)

## Verification Script

Run in local dev environment:

```bash
ADAPTIVE_PATH_QA_BASE_URL=http://localhost:3000 node \
  scripts/tests/capture-path-execution-409-error.mjs
```

## Expected Screenshots

| State | Viewport | Content | Acceptance |
|-------|----------|---------|------------|
| `path-execution-409-desktop` | 1280×900 | 路径模块加载错误状态：“路径操作未能完成”+ 错误原因 + 刷新路径状态按钮 | 错误展示不遮挡路径节点操作；刷新按钮可点击 |
| `path-execution-409-mobile` | 320×812 | 同上，移动端布局 | 无溢出；错误文案完整可见 |
| `path-refresh-success` | 1280×900 | 点击刷新后错误区域消失，路径节点正常展示 | 错误状态完全消除 |
| `path-nodes-visible` | 1280×900 | 路径节点操作（开始学习、跳过、查看证据）不被错误区域遮挡 | 所有action按钮可点击 |

## Data Attributes Used

- `data-adaptive-path-execution-error="visible"` — 路径执行错误容器
- `data-adaptive-path-node-actions="attached"` — 路径节点操作按钮组
- `data-adaptive-path-execution-surface="active-route"` — 当前路径执行区域
- `data-adaptive-practice-error-state="recoverable"` — 练习错误区域（不应与路径错误冲突）

## git diff --check Result

```text
src/features/assessment/__tests__/adaptive-practice-page.test.ts
  — trailing whitespace on every line: pre-existing pattern from integration branch
  — not introduced by this change

No whitespace errors in modified src/app/assessment/adaptive-practice/page.tsx.
```

## npm run typecheck

Pass (exit code 0, no errors).

## npm run test:unit (adaptive-practice-page.test.ts)

14/14 test cases passed, including:
- `declares a separate pathExecutionError state`
- `uses setPathExecutionError for path execution actions`
- `shows path execution error display in the current-path module`
- All 10 pre-existing tests continue to pass
