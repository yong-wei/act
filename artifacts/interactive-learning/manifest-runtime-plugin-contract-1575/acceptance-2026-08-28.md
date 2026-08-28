# Issue #1575 本地验收证据（pilot compute.panel / static-surface-3d）

日期：2026-08-28 · dev server http://localhost:3002 · 基线 04dd724e4

## 渲染管线验收（真实 1-2 runtime manifest）

测试：`src/features/interactive/__tests__/real-manifest-static-surface-plugin.test.tsx`（4/4 PASS）

1. 真实 `course-content/runtime/lessons/1-2/interactive-manifest.json` 归一化成功；step-09 声明 `compute.panel` + `capabilityRef: static-surface-3d`（module `magnitude-surface`）。
2. 完整渲染管线（`createManifestContentModuleRegistry` → `renderInteractiveManifestStep`）输出 `data-static-surface-3d-panel="magnitude-surface"`、viewport 标记，且无 `manifest-plugin-missing:compute.panel:static-surface-3d` —— pilot 由 owned plugin 渲染，非中心分支。
3. 学生/教师投影逐字节一致，无 referenceAnswer/teacherOnly/diagnostic 字段泄漏。
4. 未迁移 capability（control-workbench、interactive-figure）保持 `unclaimed` 走中心既有路径；`static-surface-3d` 精确命中插件——同一 `compute.panel` 下三种 capability 独立可选。

## 合同与中心缩减验收

测试：`src/features/interactive/__tests__/manifest-runtime-plugin-registry.test.ts`（12/12 PASS）

- 重复复合键拒绝并命名双方 owner；未知 category / 空 capabilityRef / 缺 contractVersion / 缺 owner 拒绝。
- 声明域内无插件 → 显式 missing（required + 机器可读 marker），绝不静默 SummaryCard。
- 中心 `content-renderers.tsx` 源码断言：无 `StaticSurface3DPanel` import、无 `'static-surface-3d'` 字符串比较、capabilityRef 以未解析原值传入 `lookupModule`。

## 回归等价

既有 `interactive-manifest-runtime.test.tsx`（58/58 PASS）在迁移后不变通过——pilot 渲染标记（panel/viewport/auto-rotate/重置视角/静态图回退）与特征化一致。

## HTTP 冒烟

`GET /interactive-learning/courses/unit-1-2-modeling-from-object-to-system` → 200（页面脚手架正常；step-09 为客户端路由步进，其渲染等价性由上面的真实 manifest 管线测试证明）。

## 已知无关失败（基线既有）

- `unit-5-5-course.test.ts` 静态断言 `compute_rl_training`：PR #1646 WASM 外观重命名后未同步该断言（stash 本改动后同样失败，非本次引入）。
- `npm run lint` 唯一错误在 `scripts/knowledge-cutover/verify-actkg-v018-host-shadow.ts`（PR #1634 既有，本次未触碰；manifest-runtime 域 ESLint 0 问题）。
