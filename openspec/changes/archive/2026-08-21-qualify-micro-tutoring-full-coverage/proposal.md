## Why

静态目录配置完成并不能证明学生端闭环或生产发布可靠。#1390 需要一个同时绑定 54/108 严格覆盖、真实交互、持久化、发布修订和生产候选身份的最终资格门禁。

## What Changes

- 将 54 道 practice 题、108 个错误选项的严格覆盖审计纳入稳定验证入口。
- 补齐归因、目标节点、资源、验证题、授权、漂移、幂等和持久化的单元与集成测试。
- 用 Playwright 验证成功、失败、不可用、重新编排、常规练习恢复及代表性响应式状态。
- 生成不可变生产资格回执，绑定应用 commit/镜像、治理工件哈希、数据库投影捕获修订和审计/浏览器证据哈希。
- 定义功能开关、canary、监测和回滚门禁；资格通过不自动授权生产激活。

## Capabilities

### New Capabilities

- `micro-tutoring-production-qualification`: 定义全题覆盖、真实学生闭环、发布身份、可观测性、canary 和回滚的生产资格合同。

### Modified Capabilities

- `micro-tutoring-coverage-audit`: 严格报告必须可被生产资格回执按内容身份引用，并拒绝混合 Git/DB/发布输入。

## Impact

- 影响微辅导测试、Playwright 证据、发布验证脚本、运行时监测和功能开关。
- 不执行生产部署，不降低现有授权、隐私、内容治理或 fail-closed 规则。
