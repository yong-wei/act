# Developer OSS Runtime 诊断与恢复（消费可读性门禁）

Issue #1713 之后，Developer OSS/Lima bootstrap 在物化视图 select 之后、启动 frontend/worker/scheduler 之前，以与消费者相同的 UID/GID 执行完整文件系统验证：manifest 全量叶节点的相对链接解析、Blob containment、可读打开、大小与（小型文件的）SHA-256，以及 `scripts/runtime-release/developer-oss/runtime_requirements.json` 登记的必需治理工件（当前为微辅导 v2 四件套）。任何失败都会阻止启动并清除消费者验证回执，`/api/readyz` 的 `runtime.filesystem` 投影随之 fail-closed。

## 错误分类（credential-safe）

| failure class | 含义 |
| --- | --- |
| `permission-denied` | Blob 内容或工件对应用用户不可读（本次 EACCES 案例） |
| `artifact-missing` | manifest 叶节点或 registry 要求的治理工件在视图中缺失（如 `micro-tutoring-resource-projection-v2.json`） |
| `link-escape` | 逻辑链接解析后逃出其声明的 Blob 目标 |
| `link-invalid` | manifest 叶节点不是相对 Blob 链接 |
| `size-mismatch` / `digest-mismatch` | 内容与 manifest 声明不一致 |
| `consumer-verification-missing` / `-invalid` / `-identity-drift` | readyz 侧回执缺失、格式非法或 Release 身份漂移（仅 Developer 交付形态参与判定，见下） |
| `consumer-identity-mismatch` | 回执的消费者 UID 与当前应用进程不一致 |
| `required-artifact-unreadable` | readyz 运行中对回执登记的**任一**必需治理工件有界读取失败 |
| `version-drift` | 治理工件声明的 `version` 与 registry 精确合同值不一致 |
| `reference-drift` | 工件间内部引用漂移（如 option attributions 的 `baselineVersion` ≠ 正式 baseline 的 `version`） |

## Developer 交付标志

Developer bootstrap 成功 prepare 后会在 `<checkout>/course-content/` 写出两个文件：

- `.act-runtime-dev-delivery.json`：**Developer 交付标志**，持久存在，readyz 据此区分交付形态；
- `.act-runtime-consumer-verification.json`：消费者验证回执，门禁失败时会被清除。

readyz 判定规则：无标志 = 生产形态（回执不参与判定，保持生产既有语义）；有标志则回执必须有效，缺失（例如复用门禁失败清理后、旧服务仍在运行）一律 fail-closed——"回执被清"绝不会退化为生产语义而误报就绪。

## 诊断步骤

1. 查看 `/api/readyz` 的 `runtime.filesystem.failureClass` 与 `runtime.identity`（保留 pinned Release 身份）。
2. 本地核对选择回执与验证回执：
   - 选择回执：`$(xdg-state)/checkouts/<checkout-id>/selection.json`
   - 验证回执：`<checkout>/course-content/.act-runtime-consumer-verification.json`
3. 复现门禁判定（不启动服务）：

```bash
python3 scripts/runtime-release/developer-oss/cli.py --checkout <checkout> preflight
```

## 修复：checkout 限域 rebuild

```bash
npm run startup:oss-runtime            # 正常启动（内含消费者门禁）
python3 scripts/runtime-release/developer-oss/cli.py repair
```

`repair` 的事务顺序：校验 `selection.json` 所有权 → best-effort 停止本 checkout 消费者 → 按回执卸载 runtime bind、helper bind 与（checkout topology 的）Blob mount → 重新 prepare（物化、消费者门禁、回执全量重跑）→ 重启。共享 mount 仅在无其他 live lease 时释放；所有权或身份不确定时 repair 拒绝执行并保留现场。

## 禁止事项

- 禁止对 `.act-runtime-blobs` 或物化视图手工 `chmod`/`chown` 掩盖权限故障——门禁以消费者身份重新判定。
- 禁止把仓库 `course-content/runtime` 复制进视图或改用仓库文件回退——那会掩盖 OSS 交付故障。
- 禁止改写 OSS 上的不可变 Release 或切换未验证 Release。
- 验证回执不含凭据；发现任何疑似凭据字段立即停止并上报。
