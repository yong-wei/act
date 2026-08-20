## Context

统一教材阅读器通过服务端 v2 runtime index 加载结构单元，并已拥有 `bookId`、`edition`、`sourceRevision`、稳定 `unitId`、单元 Markdown 的 SHA-256 `contentHash`，以及公式、图和表的稳定 fragment anchor。`CitationAddress` 已携带 server-owned href、locator 和 content hash；reader 对有效 fragment 精确聚焦，对失效 fragment 显示 bounded unavailable state。

现有 lesson-engine `resource-coach` 入口只把 `TeachingResource.id` 和 `registryId` 写入客户端 page context。服务端 `resolveResourceCoachModeContext` 仅按 id 重读资源类型和 `teacherOnly`，没有版本、正文哈希、单元或锚点合同。客户端选区、当前 URL 或标题因此不能证明模型上下文与回答引用来自同一资源版本。

## Goals / Non-Goals

**Goals:**

- 在一个身份合同成熟的受治理页面完成“阅读位置 → 提问 → 服务端重读 → 带引用回答 → 精确回跳”的闭环。
- 每轮按当前主体权限读取固定版本的教材单元或已登记 fragment，并限制进入模型的正文范围。
- 让会话上下文、引用地址和 reader 聚焦共享同一资源身份。
- 对版本漂移、锚点失效、权限变化和伪造客户端上下文失败关闭。
- 在打开、关闭和引用导航过程中保持可测试的阅读位置、焦点和可访问性状态。

**Non-Goals:**

- 不接入 lesson-engine `TeachingResource`、`SimpleMarkdown`、KnowledgeCard 或 `/knowledge` ResourcePanel。
- 不支持任意段落 offset、PDF 页码、视频时间轴、外部网页或客户端上传正文。
- 不修改 structured textbook export、Source Pack 排序、CitationAddress 基础格式或通用步骤级问答合同。
- 不保证旧 runtime revision 永久保留；不可读取时安全终止资源上下文。
- 不新增对话系统、向量数据库、教材存储或资源权限模型。

## Decisions

### 1. 首个适配器固定 unified textbook reader runtime v2

首个入口只接受 server-resolved textbook structure unit。规范身份为：

- `resourceKind: structured-textbook-unit`；
- `resourceId`，等于当前投影的稳定 unit resource identity；
- `bookId`、`edition`、`sourceRevision`、`unitId`；
- 当前单元 Markdown 的 `contentHash`；
- 可选 `anchorId`，仅允许当前单元已登记的 formula/figure/table fragment。

首个适配器将 owner 所称的 `blockId` 明确定义为稳定 `unitId`，不创建第二套 block identity。普通段落没有已登记稳定 anchor 时，提问只绑定单元级上下文。选区可帮助表达问题，但回答不得宣称存在精确段落引用。此边界避免在首个 PR 中另造基于 DOM offset、行号或正文片段的脆弱身份。

### 2. 客户端只提交身份声明和提示，服务端重建可信上下文

reader 可以把规范身份声明、当前 fragment 和经长度限制的选区提示送入请求，但不得提交可信正文或可执行引用 URL。服务端每轮执行：

1. 从认证会话解析主体和课程权限；
2. 按 `bookId`、`edition`、`sourceRevision` 和 `unitId` 读取指定 runtime identity；
3. 重新计算或核对 `contentHash`；
4. 验证 `resourceId` 与 unit projection 一致；
5. 若有 `anchorId`，确认它属于该单元；
6. 构造有界的单元或 fragment 上下文和 server-assigned citation ids。

客户端篡改任何身份字段、正文、URL、offset 或选区时，都不能扩大正文、权限或引用范围。选区仅在服务端已验证内容范围内作为问题提示使用，不成为 source of record。

### 3. 会话固定完整资源身份并逐轮复核

首次资源提问验证通过后，服务端必须在生成回答前把完整规范身份原子写入现有会话持久化状态；客户端重放或修改身份不能建立或替换固定状态。后续轮次不得根据当前活动 release、页面新 URL 或同名资源自动升级到新 revision。

- 固定 revision 仍可读取且 hash/anchor 相符时，会话继续使用原身份；
- 当前活动 revision 更新但旧 revision 可验证时，不改变已有会话；
- 固定 revision 不可读取、hash 不符、资源映射变化或 anchor 消失时，资源上下文进入显式 unavailable 状态；
- 权限在会话中途撤销时，下一轮立即拒绝并且不返回正文或引用 metadata。

不存在旧版本时允许会话提前不可用，但不得回退到最新版本、整本教材、邻近单元或同名锚点。

### 4. 引用与回答上下文使用同一资源身份

模型只看到服务端分配的 citation ids。最终可点击引用必须由 Citation Hydrator 从 server-owned `CitationAddress` 生成，并校验 `resourceId`、`sourceRevision`、`unitId`、`contentHash` 和可选 `anchorId` 与会话一致。

现有不含 revision/hash 的活动 reader URL 不能作为固定旧版本会话的充分地址。水合器必须生成 same-origin、server-issued 的版本绑定导航句柄或等价地址；点击时服务端再次鉴权并把该地址精确解析为句柄中的 revision、unit、hash 和 anchor。只有 exact-version reader projection 可用时才导航：

- 单元级回答可打开该固定版本的结构单元；
- fragment 级回答只有在固定版本锚点验证通过时才可打开带 fragment 的目标；
- 若当前活动 runtime 已变化，但固定版本仍可读取却不能由 reader 精确呈现，则引用降级为不可点击的定位不可用状态；
- 模型自写 URL、未知 id、被篡改/过期的导航句柄、跨资源/跨版本地址、hash 不匹配或失效锚点均不得成为可点击引用。

因此点击行为不会把“回答依据是 R1”的引用交给只会打开活动 R2 的普通 reader URL。界面显示“引用未能核验”“版本已变化”或“定位不可用”等受限状态，并保持当前阅读位置。

### 5. 阅读位置由 reader 持有，面板不重建正文

控灵面板以 overlay 或并列面板接入 reader，reader 保持当前单元组件实例和滚动容器，并持续记录最新有效的 unit、fragment、scroll position 与阅读焦点。打开时的快照只用于纠正面板布局自身造成的非用户位移，不是关闭时无条件恢复的真源：

- 用户在面板打开期间直接滚动、切换单元或改变 fragment 时，reader 更新 live reading state；关闭面板保留这一最新位置；
- 用户跟随已验证引用时，reader 聚焦 exact-version 单元/fragment，并把它记录为新的 live reading state；
- 若打开/关闭布局造成位移且期间没有用户阅读位置事件，才恢复打开前快照；
- 引用不可定位时不改变当前 reader 位置；
- 关闭后焦点回到当前阅读位置对应的面板触发器或显式引用目标，重开面板继续显示固定资源会话，除非用户明确新建当前版本会话。

### 6. 验证覆盖身份、权限、漂移、引用和 UI 生命周期

纯函数/服务端测试覆盖身份 canonicalization、字段篡改、逐轮授权、固定 revision、hash/anchor 漂移、原子会话绑定和 bounded context。运行时测试覆盖 resource-coach readiness、会话 metadata 与 CitationAddress 同身份。双 revision fixture 必须证明 R1 会话在 R2 激活后只能打开可验证的 R1 projection，不能做到时明确拒绝且保持当前位置。浏览器验收覆盖单元提问、公式/图/表代表 fragment、面板打开期间直接滚动或切换位置后关闭、无用户位移的布局恢复、显式引用导航、不可定位不跳转和 320px/键盘操作。

范围隔离测试确认 lesson-engine ResourceRenderer、STATIC_TEXT、KnowledgeCard、`/knowledge`、PDF、视频和外部网页没有新增入口或行为变化。

## Risks / Trade-offs

- [旧 runtime revision 的保留期短于会话寿命] → 旧版本不可读时显式终止资源上下文；不在本变更扩展为存储迁移或永久保留策略。
- [普通段落缺少稳定 anchor] → 首版仅提供单元级可信上下文；选区只作提示，不伪造精确段落引用。
- [会话和当前页面版本不同] → 面板显示固定版本身份；需要当前版本时由用户明确新建会话，不自动串版。
- [活动 reader URL 把旧引用打开到新版] → 只生成服务端版本绑定导航句柄；exact-version projection 不可呈现时引用不可点击。
- [关闭面板覆盖面板打开期间的新阅读位置] → reader 的 live reading state 为真源；旧快照只纠正没有用户位置事件的布局位移。
- [通用问答 change 与本入口重叠] → 复用其回答/引用呈现，不修改问题分类和步骤级回答结构。

## Migration Plan

该变更只增加 textbook reader adapter、资源会话 metadata 和运行时校验，不迁移数据库或教材 runtime。上线时先启用身份解析与服务端失败关闭，再接入 reader 入口和引用导航。回滚时移除入口与 adapter；既有教材阅读、通用控灵、CitationAddress 和 runtime v2 保持不变。

## Open Questions

无。旧 revision 的可读取期限作为显式运行限制处理，不扩大本次存储范围。
