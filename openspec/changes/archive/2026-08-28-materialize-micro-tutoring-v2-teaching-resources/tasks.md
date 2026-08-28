## 1. 同步合同

- [x] 1.1 从 v2 投影派生 TeachingResource 物化计划：唯一 `registryId`、规范节点、错因、revision 与捕获修订。
- [x] 1.2 对缺失、重复身份、未知 registry、`teacherOnly` 撤销和不洁净 Git 返回稳定失败，不创建新的 `kn:` 图节点。

## 2. 数据库应用

- [x] 2.1 按 `registryId` 幂等创建或合并 TeachingResource，写入 `config.remediation`，保留无关 config。
- [x] 2.2 提供本地/测试/生产复用的 CLI；创建缺失记录时使用 `id=registryId`。

## 3. 编排与审计路径

- [x] 3.1 保持现有编排查询与 `parseResource` fail-closed，不放宽条件。
- [x] 3.2 证明复现错因解析到 `lesson11-graphical-thinking-workshop`，且 9 组资源都能被数据库路径找到。

## 4. 验证与交付

- [x] 4.1 增加缺失、关系缺失、正确映射、授权撤销和幂等同步测试；覆盖审计在权威行下 `RESOURCE_UNAVAILABLE=0`。
- [x] 4.2 运行相关测试、typecheck 与 `openspec validate --strict`，归档后提交关联 #1618 的 PR。
