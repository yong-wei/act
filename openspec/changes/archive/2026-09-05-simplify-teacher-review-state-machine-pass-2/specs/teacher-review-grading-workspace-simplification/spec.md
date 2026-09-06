## ADDED Requirements

### Requirement: Review adapters consume actual API projections

批阅客户端 SHALL 以当前读取、打开、保存和队列接口的真实投影为输入，删除无生产来源的备用数据形状和字段别名。接口实际支持的历史快照、可空值、角色安全投影及错误恢复 SHALL 保持。

#### Scenario: Only a test constructs an alternate payload

- **WHEN** 某备用字段仅由测试构造，当前生产接口及受支持历史读取均不输出该形状
- **THEN** 实现和对应旧 fixture SHALL 一起删除或改用真实投影
- **AND** 测试引用 SHALL NOT 成为保留该兼容分支的理由

#### Scenario: A review is saved before approval

- **WHEN** 教师批准已编辑的批阅
- **THEN** 系统 SHALL 先保存并使用返回版本批准，保持现有幂等键和冲突恢复行为
- **AND** 保存冲突时 SHALL 保留本地编辑且不继续批准

### Requirement: Review simplification removes implementation-bound tests and code

重构 SHALL 删除无价值的源码语法断言和重复状态同步；仍有效的业务、安全与可访问性要求 SHALL 由行为测试覆盖。workspace、contracts、queue 及接收其抽取逻辑的生产代码总量 SHALL 少于调查基线 83,947 bytes，文件移动或格式压缩 SHALL NOT 单独算作化简。

#### Scenario: The review refactor is completed

- **WHEN** 变更请求完成
- **THEN** 完成说明 SHALL 列出实际删除的输入分支、重复更新和测试，以及前后生产代码总量
- **AND** 队列导航、评分上下界、保存冲突、教师批准、原件访问及反馈隐私的相关测试 SHALL 通过
