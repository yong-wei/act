## Why

首次 ESA 切换留下约6.32 GB教学媒体副本，但现有 Runtime 读取仍依赖原桶，不能直接删除。后续媒体更新继续先存原桶再复制，分发索引又绑定整个 Runtime，造成不必要的重复存储和发布耦合。

## What Changes

- 保留现有 v2 Runtime 的路径、内容摘要、清单身份和 current/previous 选择方式，独立记录媒体正文的物理存储位置与公开资格。
- 合格公开教学媒体增量发布直接写入既有 `act-course-models/teaching-media/sha256/`；内部内容保留在 `act-course-assets/runtime/blobs/sha256/`。不再为公开正文写入两份副本。
- 按选中清单中的精确摘要解析媒体；无关 Runtime 更新不使已发布媒体失效，固定课堂版本不取同路径最新内容。
- 为文件读取、短时签名、信息图校验、doctor 和开发者网关提供同一正文位置；ESA 停用时仍可读取规范正文。
- 扩展显式 GC：保护 current、previous、课堂固定引用、人工 pin、开发者租约与进行中发布，只有不再被引用的正文才进入删除集合。发布与删除共用既有宿主选择锁。
- 对本次已复制媒体建立迁移与恢复证据，验证所有受保护路径后才删除原桶等字节副本；模型发布目录不在清理范围。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `content-addressed-runtime-release-storage`: 正文位置与逻辑清单解耦、媒体直接发布、受保护引用下的正文回收及迁移恢复。
- `private-runtime-media-delivery`: 精确摘要分发与规范存储回退，支持公开媒体搬迁而不改变版本和权限语义。

## Impact

影响 Runtime 发布、物化、审计、GC、开发者网关、公开媒体解析、OSS读取/签名、只读挂载和相关运维工具及测试。复用现有 OSS、Python、SQLite、宿主锁和应用依赖，不设计新的 Runtime manifest 版本，不修改内容、图谱、学习记录或课堂数据库模型。

用户已授权实施媒体存储解耦与安全回收，并要求先完成集成分支合并、发版部署。前置任务已完成：`v0.7.34` 应用修订 `d2d8ee767731e8e67a81ea9f079607ac2915fbe8` 已部署验收；本变更基线为同步后的 `ac699f0957f289d07d8ae48282e3de6482bddf53`。本次不激活新的 Runtime，不修改历史清单字节，不自动归档其他变更，不扩大云身份的写权限。
