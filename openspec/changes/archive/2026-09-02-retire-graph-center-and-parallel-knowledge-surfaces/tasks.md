## 1. Dependency and characterization

- [x] 1.1 确认 `activate-v037-bilingual-authority-graph`、`consolidate-active-authority-graph-controls`、`render-authority-formulas-on-graph-canvas`、`restore-active-authority-force-runtime-parity`、`verify-active-authority-graph-parity` 和 `adopt-active-authority-knowledge-workspace` 均已完成或由父任务明确解除阻塞。
- [x] 1.2 冻结 `/graph-center`、`/knowledge`、candidate、legacy 的路由/角色/请求 caller 清单，并记录 active selector、shard、schema、hash 和 rollback 身份未被本变更改写。
- [x] 1.3 为 `/knowledge` 的 active 读取、管理员诊断、学生/教师角色隔离和关键 Graph Center 动作建立 characterization；覆盖错误、不可用和权限拒绝语义。

## 2. Canonical surface migration

- [x] 2.1 将仍需保留的节点详情、资源 launch、学习路径或角色动作迁移到 `/knowledge` 或既有角色 owner，并删除重复 payload 组装。
- [x] 2.2 更新平台导航、教师分析、AI context、脚本和深链接 caller；未归属 caller 不能进入删除阶段。
- [x] 2.3 删除 `/graph-center` route、`GraphCenterClient` 及无消费者的 `src/lib/data-governance/graph-center*` 实现。
- [x] 2.4 删除只保护旧 Graph Center 的测试和 fixture，保留 active Authority、candidate policy、resource eligibility、hash/rollback 和角色隔离测试。

## 3. Boundary verification

- [x] 3.1 增加负向检查：学生/教师产品请求不得获得 candidate/legacy 诊断 payload，Graph Center 入口不得成为 active Authority 的别名或第二 runtime。
- [x] 3.2 在 1440px/320px 对学生、教师和管理员验证 `/knowledge` 的可达性、键盘焦点、无横向溢出和错误状态。
- [x] 3.3 检查 diff 未修改任何 Authority selector、domain shard、ActKG schema 或 production Authority 文件。
- [x] 3.4 运行受影响 Vitest/Playwright、`rtk npm run typecheck`、`rtk openspec validate retire-graph-center-and-parallel-knowledge-surfaces --type change --strict` 和 `rtk git diff --check`。
