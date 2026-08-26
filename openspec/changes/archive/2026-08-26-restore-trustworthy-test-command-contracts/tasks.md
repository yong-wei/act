## Hard Dependencies

`capture-modular-monolith-refactor-baseline` 与已 qualified 的 `establish-modular-monolith-refactor-charter` 必须同时满足；charter 是 baseline 之外的独立 hard prerequisite。任一前置 drift、缺失或分母不完整时保持 blocked。

## 1. Characterization and input contracts

- [x] 1.1 读取并核对 `capture-modular-monolith-refactor-baseline` 与已 qualified 的 `establish-modular-monolith-refactor-charter` 的 source revision/tree、测试分母、失败 fingerprint、CI 观察、owner 和限制；发现任一 drift 时停止写 qualified receipt。
- [x] 1.2 Characterize `package.json` scripts、`vitest.config.ts`、其他 Vitest configs、`tests/`、领域 `__tests__`、发布资格脚本和当前 workflow 的实际 scope；先按版本控制命名约定/显式排除规则独立枚举全仓 test universe，再反向核对声明测试根与分类。
- [x] 1.3 建立测试命令矩阵和领域 owner lookup 的 characterization fixtures，覆盖新增测试、未分类测试、显式排除和 run-specific evidence。

## 2. Implement command and discovery contracts

- [x] 2.1 定义 `npm test`、`test:unit`、`test:contract`、`test:integration`、`test:e2e:critical`、`test:release`、`test:nightly` 的 scope、输入、退出条件和 receipt schema。
- [x] 2.2 实现基于版本控制文件集合、命名约定和显式排除规则的独立 test universe 枚举，再反向核对声明测试根、owner/charter 分类，输出 discovered/classified/excluded/unresolved 分母和稳定测试身份；新目录中的未登记 test 文件必须进入 denominator 并失败。
- [x] 2.3 实现 deterministic result 与 environment-sensitive measurement receipt 的分离，绑定 revision/tree、command、scope、工具版本、退出状态、计数和安全 fingerprint。
- [x] 2.4 为未处理异常、未登记 skip、失败、分母缺口、evidence 漂移和 accepted failure 增加 fail-closed contract tests。
- [x] 2.5 为 `test:release` 实现显式 qualification manifest 输入校验，禁止默认产品测试隐式读取 run-specific evidence。

## 3. Remove or replace old authorities

- [x] 3.1 将 `npm test` 从历史专项脚本集合迁移为 PR 默认合同，并为旧专项脚本标注保留的领域/发布 owner。
- [x] 3.2 删除或降级人工 Vitest include 表作为完整发现权威；配置只保留必要执行约束，不能静默排除声明范围内测试。
- [x] 3.3 移除默认命令对 run-specific commercial UI、runtime、知识图谱和 OSS evidence 文件的隐式依赖，并登记后续 release-input 路径。
- [x] 3.4 清理本 change 新增的未使用 facade、重复命令和未绑定 owner 的排除规则。

## 4. Targeted and domain verification

- [x] 4.1 运行 discovery/receipt/命令合同测试，验证独立 test universe 与声明 roots/classifications 双向闭合，同一 source revision 的 deterministic manifest 可重复生成，变量 measurement 只通过 receipt 引用。
- [x] 4.2 运行受影响领域单元、契约、集成和关键 E2E 命令；记录现有红测但不将其写成 accepted failure。
- [x] 4.3 运行 `rtk openspec validate restore-trustworthy-test-command-contracts --type change --strict` 和 `git diff --check`。

## 5. Documentation and receipt handoff

- [x] 5.1 更新测试命令说明、CI command mapping 和 receipt schema 文档，注明当前观察值必须通过 revision-bound receipt 获取。
- [x] 5.2 记录当前命令/发现 baseline receipt、qualified charter identity 及其环境限制，向 `eliminate-accepted-red-test-baseline`、`split-production-tooling-test-typescript-graphs` 和 CI change 提供稳定输入。
- [x] 5.3 明确剩余未分类、红色或受外部限制的项目及 owner/change，不 claim 默认门禁已恢复绿色。
