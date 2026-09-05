## ADDED Requirements

### Requirement: Consumer enforcement does not retain a test-only registry

Control Engine SHALL 删除无生产消费者的 `server-consumers.ts` 登记表、对应公开导出和仅验证该表的源码扫描测试。生产消费者 SHALL 继续直接使用现有 server façade；现有 generated-import 检查与实际执行测试 SHALL 保持有效。

#### Scenario: A registry is referenced only by its own test

- **WHEN** 登记表仅被测试和过期文档引用，生产代码不读取它
- **THEN** 登记表、对应测试、导出及过期文档说明 SHALL 一起删除或修订
- **AND** 系统 SHALL NOT 为保留该测试而恢复登记表或新建替代清单

#### Scenario: Current numerical and authority behavior is verified

- **WHEN** 删除完成后运行 façade、simulation、Practice、Odyssey 和 Arena 相关测试
- **THEN** 服务端数值执行、客户端伪造结果拒绝、预览持久化及官方评分隔离 SHALL 保持
- **AND** 生成包过期时 SHALL 修复测试环境或报告失败，不得跳过身份校验
