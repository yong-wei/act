# Wolfram 公式计算运行时

`calc.wls` 由共享执行器通过 `wolframscript -file` 调用。共享执行器保持 JSON 请求/响应契约；Windows 下将请求作为脚本命令行参数传入，避免 `wolframscript` 的 `-file` 模式吞掉标准输入。

## Windows 安装

1. 从 [Wolfram Engine](https://www.wolfram.com/engine/) 下载并安装免费运行时；已有 Mathematica 桌面版可跳过此安装。
2. 使用 Wolfram 账号为执行应用的 Windows 账户激活运行时。
3. 将安装目录加入 `PATH`。常见位置为：

   ```text
   C:\Program Files\Wolfram Research\Wolfram Engine\14.x\wolframscript.exe
   ```

4. 验证命令和真实脚本：

   ```powershell
   wolframscript --version
   node scripts/tests/test-math-calc-wolfram.mjs
   ```

## Linux / 容器部署

生产 runner 由 `Dockerfile` 从 `wolframresearch/wolframengine:15.0` 复制 Wolfram Engine 可执行运行时，不把激活凭据写入镜像。部署环境只需在运行时提供以下任一种激活材料：

- 预激活的 `Licensing` 目录，挂载到 `$HOME/.WolframEngine/Licensing`（容器内为 `/home/nextjs/.WolframEngine/Licensing`）；
- 运行环境 secret：`WOLFRAM_ACTIVATION_EMAIL` 与 `WOLFRAM_ACTIVATION_PASSWORD`，entrypoint 首次启动时自动执行 `wolframscript -activate`；
- on-demand entitlement：运行环境 secret `WOLFRAMSCRIPT_ENTITLEMENTID`。

`docker-entrypoint.sh` 在启动迁移前调用 `scripts/math-calc/check-wolfram-ready.sh`：命令缺失、未激活或无法执行 `calc.wls` 时输出错误并 `exit 1`，容器不会进入“部署成功但计算不可用”的状态。

部署验证命令：

```bash
npm run test:docker-migration-readiness
npm run test:math-calc-wolfram
npm run test:konling-math-real-smoke
```

需要真实生产等价镜像时：

```bash
MATH_CALC_TEST_IMAGE=<production-image> \
  WOLFRAM_ACTIVATION_EMAIL=<secret> \
  WOLFRAM_ACTIVATION_PASSWORD=<secret> \
  npm run test:docker-migration-readiness
```

个人/教学用途可使用免费 Wolfram Engine；商用部署需要匹配的 Wolfram 授权。不得把个人激活凭据提交到仓库或写入容器镜像。
