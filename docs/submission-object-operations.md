# 学生作业对象存储运行配置

生产环境必须使用私有 S3/MinIO bucket。应用凭据只允许隔离区写入、HEAD 和授权读取；扫描器凭据必须独立，只允许读取隔离对象并写入 `scan-state` tag；GC 使用第三组仅允许删除的凭据。数据治理 worker 不接收任何对象存储密钥。不得给浏览器任何长期对象存储凭据。

启动前分别运行对象存储和扫描器健康检查。缺少 `SUBMISSION_OBJECT_STORE=s3`、`SUBMISSION_SCANNER_MODE=s3-object-tag`、内容扫描器模式或独立凭据时，相关 worker 会直接失败，文件不会从 `PENDING` 进入可提交状态。

部署前需在私有 bucket 中创建专用 `SUBMISSION_SCANNER_PROBE_KEY` 对象。健康检查读取其当前 tags 并原样写回，用于验证 scanner 身份具有 tag 写权限，不改变业务对象或 probe 内容。

```bash
rtk npm run health:submission-storage
```

扫描 worker：

```bash
rtk npm run worker:submission-scan
```

Podman 部署通过独立 `submission-scanner` 容器持续执行，默认每 15 秒扫描一次。`deploy.sh` 在应用启动前执行健康门禁；外部 ClamAV 或 HTTPS 扫描服务配置缺失时部署直接失败。

支持 `SUBMISSION_CONTENT_SCANNER=clamav-tcp`，或使用 `https` 模式连接具有 `/health`、`/scan` 接口的扫描服务。扫描结果由独立扫描器身份写入 `CLEAN` 或 `UNSAFE` tag；应用上传元数据不能产生可信扫描结论。

隔离区回收 worker：

```bash
rtk npm run worker:submission-gc
```

Podman 部署通过独立 `submission-gc` 容器定时执行，默认间隔 3600 秒；它与既有数据治理 worker 使用不同容器和启动角色。

GC 先在数据库中将资产 CAS 为 `DELETING`，再删除对象并写 tombstone。删除失败会恢复可重试状态。finalize 只接受 `QUARANTINED`，因此与 GC 互斥。

学生下载不返回 S3 URL。服务端签发一次性、用途限定的同源 token，GET 请求重新验证学生、作业、题目和资产关系，再由应用代理对象内容并设置可信 `Content-Type`、附件 disposition、`nosniff` 与 `private, no-store`。
