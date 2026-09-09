## 1. Receive

- [x] 1.1 接收脚本改为读取 `act-ship-release/1`
- [x] 1.2 接收七船当前版本，退役并删除旧目录与旧描述符
- [x] 1.3 更新海报为 `evidence/hero.png`

## 2. Descriptors and mount

- [x] 2.1 描述符与激活指针切到新版本，写入 `modelToSceneMatrix`
- [x] 2.2 挂载应用矩阵，版本化路径禁止 bbox 居中

## 3. OSS default

- [x] 3.1 运行时包 LOD 候选：同源 → ESA → registry 单文件
- [x] 3.2 首页预览与海报识别 OSS URL

## 4. Verify

- [x] 4.1 更新 fleet / rollout 测试
- [x] 4.2 跑针对性 vitest 与 OpenSpec strict
- [x] 4.3 本机浏览器抽检场景请求顺序
