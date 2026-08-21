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

部署环境必须在应用运行账户下完成相同的安装与激活。不得把个人激活凭据提交到仓库或写入容器镜像。
