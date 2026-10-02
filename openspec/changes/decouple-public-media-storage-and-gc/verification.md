# 验证记录

## 本轮范围

代码范围为 `ac699f0957f289d07d8ae48282e3de6482bddf53..63f81b7449aa56f71f6673554f4b26112c9bf575`。前置 v0.7.34 发布、部署及浏览器验收已完成，见 `artifacts/app-releases/v0.7.34/receipt.json`。本轮没有改写历史清单、Runtime或图谱选择器。

## 已通过的本地验证

- `python3 -m unittest scripts.tests.test_publish_runtime scripts.tests.test_runtime_doctor_gc scripts.tests.test_runtime_media_storage`：29项通过，包含真实ossutil单对象响应和字符串大小回归。
- `python3 -m unittest scripts.tests.test_activate_runtime scripts.tests.test_public_teaching_media scripts.tests.test_developer_runtime_gateway`：64项通过。网关HTTP夹具的既有HTTPError清理提示不影响结果。
- 媒体目录、路径、Bound读取、真实SDK适配器、课堂revision和课堂路由六个Vitest文件：71项通过；目录symlink新增回归后该文件7项通过，相关活动清单文件8项通过。未改测试证据复用，合计80项不同测试。
- `npm run typecheck`生产图：web与worker零错误；本次交付提交前收据为`956fee16…` / `041fcd08…`。
- 本轮TypeScript源文件及测试定向ESLint通过；Python编译通过；部署、双helper与配置脚本Shell语法检查通过。
- Docker迁移readiness与remote-deploy脚本回归通过；本change严格OpenSpec验证和 `git diff --check` 通过。

新Python回归覆盖：公开正文直接发布、无变化不重传、Git来源变化复用正文、单文件增量、未接受新图片仍私有、资格漂移与上传失败、GC后旧缓存拒绝及bootstrap、全部保留根、共享正文、范围外模型、坏清单/租约发现、进行中发布与GC互斥、进程中断保留、签名期与时钟倒退、原副本退役、doctor/网关Range读取、恢复副本、旧镜像门禁及损坏目标阻断。

## 只读生产核验

- 生产读取角色为 `act-runtime-oss-read`；开发者网关处于active，持久租约文件存在且schema正确，记录1份租约。未输出令牌或用户标识。
- PostgreSQL实际锁验证：独占锁持有时，同键事务共享锁尝试返回false；释放后返回true。未写入或修改数据库记录。此结果验证锁语义，不代表新代码已部署。
- 现有媒体桶未启用版本控制，Bucket保持私有。来源读取角色对规范媒体对象的Get返回403，需要补足声明前缀的只读权限。
- RAM控制台角色/策略主体加载失败，控制台出现iframe跨域SecurityError；一次重载和同浏览器新页面均未恢复。没有改变云权限、创建凭据、执行正文删除或新Runtime激活。

随后用户批准两份最小RAM策略。经官方OpenAPI创建 `act-canonical-media-runtime-read` 和 `act-runtime-body-maintenance`，分别附加到既有读取角色和本机发布用户；未创建新凭据。原Get403已解决：生产应用使用实际RAM Role完整读取一份845375字节规范对象，SHA和大小一致，返回200。本机发布身份已能认证读取两个桶的版本控制与限定前缀清单，两桶均未启用版本控制。

真实ossutil 2.3.0将单个Contents/Deleted编码为对象，Size编码为字符串。首次清单适配诊断发现该差异；已按此真实契约修正解码并增加回归，避免单对象末页阻断或漏记批量删除结果。

首次`0.7.35`镜像构建在`44c45d09a657ff5fbbb51038acde16be9c2ede98`通过前端编译、容器内TypeScript和静态页生成后，被动态文件追踪门禁拒绝，未产出可部署镜像。原因是`public-teaching-media.ts`对宿主挂载的清单和活动回执执行`stat`时缺少既有`turbopackIgnore`标注；两处调用已按宿主文件边界补齐，保留原构建门禁并重新构建。本机同修订的干净工作树Smoke、Arena及257项课程课件测试通过。CI`37001660597`仍在Smoke执行前以既有`dirty-worktree`失败，Lint和优化模型校验通过。

## 真实生产执行与验收

- `v0.7.35`已正式发布并执行应用部署，冻结来源为`63f81b7449aa56f71f6673554f4b26112c9bf575`。镜像中的12个WASM导出、Chromium无头运行和LibreOffice PDF转换均实际执行通过。原Runtime两指针、图谱选择与活动回执不变，数据库/Redis容器及cutover模式保持。
- 独立媒体FUSE及当前/回退视图的媒体helper为只读挂载；应用和worker均能读取。网关采用当前运维脚本及原Python3.11解释器，升级前后持久租约文件身份相同，匿名访问返回401。
- 全部7,247个规范对象和原副本通过完整SHA校验，当前与回退视图的媒体叶通过读取校验。迁移计划绑定两份保护清单、目录对象和完整目标/原对象快照，原副本正文合计6,320,284,091字节。
- 图片、PDF、MP4及M4A的应用/worker读取、公开固定版本入口与ESA、ESA关闭后的真实RAM Role签名读取及文件读取均通过完整SHA校验。网关临时固定租约的清单、四类正文和Range通过，测试租约及容器均已清理；既有有效租约身份与允许集合保持。
- 原副本存在时，临时v0.7.34容器的真实OSS媒体入口通过四类正文校验。未进行旧应用的实际部署回滚。
- 一份126字节非空图片已真实删除原键、从规范正文恢复、核验完整SHA和OSS可见性，恢复后ETag与原计划一致。该实测不改变清单或选择器。
- 生产`runtime-doctor.py`对当前Runtime全部131,454个文件执行大小审计通过，未切换指针；该次审计未使用`--full`，媒体完整SHA由迁移准备及退役前校验覆盖。
- 整批退役已完成：7,247份原副本、6,320,284,091字节。完整OSS清单确认全部计划原键缺失，全部规范目标ETag与大小保持；目录已标记`legacyCopiesAvailable=false`。
- 删除后再次通过四类媒体的应用/worker、固定入口与ESA、ESA关闭后的RAM Role签名和文件读取、网关及Range校验。旧镜像能力为空时在容器替换前被门禁拒绝，新镜像及只读媒体helper被接受。Runtime两指针、其他选择器/回执、生产消费者和数据容器身份均保持。
- 首次HTTP验收误将教材图片传入只支持课次媒体的入口并得到404，修正测试样本后四类正确入口均通过；该诊断没有修改生产应用代码。
- 当前HEAD的CI`37005261280`仍在Smoke执行前因既有`dirty-worktree`失败；Lint和优化模型验证通过，不能宣称CI全绿。完整正式镜像构建及本机Smoke证据有效。
- 全部生产验收完成后已通过官方CLI退出Docker Desktop；守护进程不可连接，Docker应用进程数为0。

## 风险审查结论

本轮人工审查覆盖规范位置、资格入口、文件/签名/网关消费、发布与GC互斥、引用发现、复制迁移、恢复和旧镜像门禁。实施期间接受并修复：课堂引用在发现与正文删除之间写入的竞争、开发者心跳持久化与GC竞争、存储保留目录被误识别为Release、准备失败造成目录先提交、以及新helper验证晚于容器替换。上述整改都有直接回归或实际锁证据。

本轮增量审查未发现新的 P0/P1 重大问题。生产权限、双FUSE可见性、完整对象迁移、删除后的实际读取、单对象恢复及旧镜像门禁均有真实执行证据。此前接受的问题已解决。未实际回滚旧应用，未执行日常正文GC或新的Runtime发布/激活；CI的既有Smoke入口失败仍未修复。

## 交付证据

迁移计划、逐项退役回执、单对象恢复证明、删除前后真实消费验收、OSS缺失/目标保持证明和doctor输出保存在`artifacts/public-teaching-media/canonical-storage-2026-10-02/`。应用发布证据保存在`artifacts/app-releases/v0.7.35/`。公开证据不包含凭据、签名地址、租约身份或本机绝对路径。
