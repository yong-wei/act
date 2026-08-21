## Why

微辅导已经能够根据错题创建编排任务，但 54 道 practice 基线涉及的规范知识节点尚无完整、可审计的学习资源投影。仅凭 TeachingResource 存在或页面可打开，不能证明资源与错因、节点、版本和学生权限一致，也不能证明任务包含真实学习动作。

## What Changes

- 建立从既有 TeachingResource 与资源注册表派生的微辅导资源治理投影，不复制资源内容或创建第二套资源真源。
- 按规范 `kn:` 节点和受控错因登记可复用资源，绑定资源 revision/hash、`registryId`、学生可见性、先修关系、预计时长和启动地址。
- 定义微辅导学习动作分类与最低质量要求，使每项资源至少提供一个可执行动作，而不是以浏览或占位内容满足覆盖率。
- 将资源动作和实际打开/完成事件写入既有微干预证据链，同时保持“参与不等于掌握”。
- 让覆盖审计在资源退役、权限撤销、地址失效、版本或捕获修订漂移时 fail closed。

## Capabilities

### New Capabilities

- `micro-tutoring-resource-registry`: 定义微辅导资源治理投影、节点/错因匹配、版本身份、可达性和审计边界。
- `micro-tutoring-learning-actions`: 定义资源必须提供的受控学习动作类型、任务时间预算及动作证据语义。

### Modified Capabilities

- `micro-tutoring-coverage-audit`: 完整链路必须消费同一捕获修订上的资源治理投影并验证学生可达动作。
- `micro-intervention-outcomes`: 微干预事件记录稳定资源/动作身份，并区分参与事件与验证性学习证据。

## Impact

- 影响 TeachingResource/资源注册表投影、微辅导编排、学生资源启动、覆盖审计及微干预事件记录。
- 不在运行时生成正式资源，不为每道题复制资源，不改变掌握度或正式学习路径。
