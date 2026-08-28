# Eligibility producer/caller denominator

捕获修订：`12c9150dcef2a6bfee374fe2c8c0884fa209364a`

## 七维现状

| 维度 | 现有 owner / 证据 | 本 change 读法 |
| --- | --- | --- |
| retrieval readiness | RegistryIndex `descriptor.availability` | `observeBrowseEligibility` / `observeRecommendEligibility` |
| path eligibility | ResourceNode 登记 / `full-resource-path-readiness-gate.ts` | 仅 `sourceKind=resource-node` 视为已审计；合成 `registry:` 引用不算 path |
| formal binding | `canonical-resource-binding`、`formal-runtime-atomic-resource-binding` | 读 `formalBindingIds`/`canonicalIds`；Teaching mode / inventory disposition 经 `owners.ts` 映射；`OPTIONAL`/`NONE` 不能闭合 |
| launch availability | 源属 launcher + `resolveIndexedResource` 授权 | `observeLaunchEligibility` |
| formal release qualification | Teaching Projection / Runtime Release 包门 | `observationFromFormalReleaseQualification`；不写指针 |
| Teaching Projection activation | `src/lib/teaching-projection/activation.ts` | `observationFromTeachingProjectionConsumer` |
| consumer activation | `versioned-knowledge-activation/readiness.ts` | `observationFromConsumerActivation` |

## 代表调用方

| 上下文 | 调用方 | 处理 |
| --- | --- | --- |
| browse | `resource-index/student-read.ts` `projectStudentReadFromIndex`、`/api/resources/[id]` | 读 browse snapshot；该接口同时返回启动配置，因此仍要求 launch 维独立合格 |
| recommend | `observeRecommendEligibility` | 只回答可否纳入推荐，不排序、不选择 |
| path | `observePathEligibility` | 规划摘要仍由既有 gate 拥有；删除候选交给 R4 |
| launch | `projectStudentLaunchFromIndex` / `resolveStudentLaunchableIndexedResource` | 独立 launch purpose；不把教师可见写成学生可启动 |
| formal | `observeFormalBindEligibility` + owner observation | 不替换 canonical/formal writer |

反向/动态 caller 以静态 import 与测试清单为准。本 change 不新增 HTTP 写路由。
