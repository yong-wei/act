# 3-3 互动实现对照表

## 本轮范围

- 目标：按当前 15 步作者态真源回修 `unit-3-3-root-locus-rules`，重点整改 `step-05/06/08/09/11`。
- 边界：不回改 `interactive-page.md` 与 `interactive-contract.yaml`；本轮只修实现、共享分析出口与实现对照文件。
- 共享基线：曲线类页面统一走 `useControlEngine -> RootLocusPanel -> Rust/WASM compute_analysis`，不再保留 3-3 私有手写根轨迹图层。

## 设计稿到实现稿对照

| 步骤 | 双轨要求 | 当前实现落点 | 本轮状态 | 验证 |
| --- | --- | --- | --- | --- |
| `step-05` | 顶部常显两大条件；下方左图右参数；拖动 `s_0` 即时回算资格与增益 | `step-panels.tsx` 的 `ConditionWorkspacePanel` + `unit-3-3-request-builder.ts` + `unit-3-3-fixtures.ts` | 已改为统一根轨迹面板，支持沿轨迹吸附拖动 | `unit-3-3-course.test.ts` |
| `step-06` | 例题 1 对象与讲义一致；使用统一面板；删去下方重复步骤 | `step-panels.tsx` 的 `SkeletonRuleWorkspace` | 已改为 `G(s)H(s)=K/[s(s+2)(s+4)]` 的统一根轨迹面板 | `unit-3-3-course.test.ts` |
| `step-08` | 完整呈现分离点推导链与虚轴交点链，按顺序排布并去重 | `step-panels.tsx` 的 `KeypointMethodBoard` | 已补齐四步分离点显影和四步虚轴交点顺序 | `unit-3-3-course.test.ts` |
| `step-09` | 例题 2 两条求解链完整展开 | `step-panels.tsx` 的 `WorkedExampleRevealBoard('step-09')` | 已补齐 `dK/ds`、真实分离点、`K≈0.3849`、`K=6`、`±j√2`、`0<K<6` | `unit-3-3-course.test.ts` |
| `step-11` | 例题 3 先出射角，再共轭对称，再根之和复核 | `step-panels.tsx` 的 `WorkedExampleRevealBoard('step-11')` | 已补齐 `26.565°`、共轭对称、`根之和 = -4` | `unit-3-3-course.test.ts` |

## 本轮新增的共享实现事实

1. `src/resources/control-system/analysis/types.ts` 已把根轨迹采样点升级为 `RootLocusSamplePoint`，可携带 `gain` 元数据。
2. `src/resources/control-system/charts/control-analysis-panels.tsx` 的根轨迹 tooltip 已显示 `Gain K`，为上层吸附拖动提供统一读数出口。
3. 3-3 新增 `unit-3-3-request-builder.ts` 与 `unit-3-3-fixtures.ts`，不再把 3-3 的根轨迹对象、fallback 数据和页面逻辑揉在同一个组件文件里。

## 当前仍保持不动的部分

- 学生页与教师页壳层继续沿用隐藏式 AI 上下文注入，不新增页内 AI。
- `step-07/09/11` 的学生作答卡结构保持双栏，不回退成统一大表单。
- runtime 媒体路径继续从 `/course-runtime/lessons/3-3/media/...` 读取。
