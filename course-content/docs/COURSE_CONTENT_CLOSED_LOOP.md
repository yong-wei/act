# course-content 闭环说明

## 1. 目标

`course-content/` 作为课程内容统一管理目录后，需要形成一条明确的闭环链路：

1. Claude 只在作者态目录中生成和维护原始产物
2. Codex 负责把作者态产物整理、校验并导出为平台可读取的运行态产物
3. 平台运行时只读取 `runtime/`，不直接读取作者态目录

这样可以把“课程制作”与“平台运行”解耦，避免制作过程中的半成品直接进入线上系统。

## 2. 职责边界

### 2.1 Claude 的职责

Claude 在 `course-content/` 下的工作边界收敛为作者态内容生产，不负责平台接线。

Claude 允许修改的重点目录：

- `authoring/lessons/<lesson>/design/`
- `authoring/lessons/<lesson>/graph/`
- `authoring/lessons/<lesson>/cards/`
- `authoring/lessons/<lesson>/media/raw/`
- `authoring/lessons/<lesson>/media/processed/`
- `authoring/lessons/<lesson>/notes/`
- `authoring/knowledge/overlays/<lesson>/`
- `authoring/knowledge/cards/`
- `docs/`
- `.claude/`

Claude 不应直接承担的工作：

- 平台运行 JSON 结构生成
- 与主项目 `src/`、接口、资源注册表的接线
- 部署目录组织
- 线上运行资源同步

### 2.2 Codex 的职责

Codex 负责作者态到运行态的打通，并对接主项目平台链路。

Codex 负责的重点事项：

- 完成 `course-content/scripts/export-runtime.sh`
- 根据 `authoring/lessons/<lesson>/manifest.json` 导出 `runtime/`
- 合并知识图谱底座与课次 overlay
- 将媒体发布产物整理到 `runtime/lessons/<lesson>/media/`
- 生成平台实际读取的 `lesson.json`、索引和图谱运行文件
- 在主项目中接通 `runtime/` 的读取与部署同步机制

结论：`export-runtime.sh` 以后由 Codex 完成，Claude 只负责原始产物生成。

## 3. 真源目录定义

为了避免后续出现“双份文档、双份图谱、双份卡片”并行维护，必须明确单一真源。

### 3.1 作者态真源

以下目录是课程制作的唯一真源：

- `authoring/lessons/`
- `authoring/knowledge/`
- `authoring/shared/`
- `docs/`
- `.claude/`

### 3.2 运行态真源

以下目录是平台读取的唯一真源：

- `runtime/`

平台后续只应读取 `runtime/`，而不应直接读取 `authoring/`。

## 4. 过时目录处理原则

迁移完成后，旧结构中与新真源重复的目录应及时删除，避免 Claude 或人工维护时改错位置。

### 4.1 已判定为过时的目录

- `notes/lessons/`
  - 原因：课次设计文档已经迁移到 `authoring/lessons/<lesson>/design/`
- `skills/`
  - 原因：实际生效的技能已迁移到隐藏目录 `.claude/skills/`

### 4.1.1 当前仍存在的过渡目录

- `data/`
  - 当前状态：仍保留部分旧式图谱、卡片和课次数据
  - 判定：迁移过渡层，不应继续作为作者态真源
  - 后续原则：当 `export-runtime.sh` 与平台链路打通后，应逐步停止对该目录写入，并迁移或清理

### 4.2 保留的目录

- `docs/`
  - 用途：面向 Claude 的规范、迁移、制作、参考文档
- `.claude/`
  - 用途：Claude 在本内容项目中的本地配置和专用技能
- `notes/`
  - 仅保留尚未迁移的过程记录或讨论记录
  - 若某类内容已在 `authoring/` 或 `docs/` 中形成稳定归宿，应继续逐步清理

## 5. 媒体目录约定

每课次下的 `media/` 采用两层结构：

- `media/raw/`
  - 存放原始素材
  - 例如原始视频、录屏母版、PPT 导出源图、拍摄照片、原始音频
  - 目标是保留高质量可回溯源文件，不要求可直接上线
- `media/processed/`
  - 存放处理后的发布候选文件
  - 例如压缩后的视频、裁剪后的图片、统一规格的封面图、网页可直接引用的媒体资源
  - 后续导出脚本优先从这里提取运行时媒体

这层划分的意义：

- 避免重复找原始素材
- 让导出脚本有明确输入边界
- 保证作者态资源能复用和重处理
- 使运行态构建过程更稳定

## 6. 闭环流程

课程内容的标准闭环如下：

1. Claude 在 `authoring/lessons/<lesson>/` 下完成设计文档、图谱增量、卡片编排和媒体整理
2. Claude 在 `docs/` 中维护必要的面向制作流程的说明文档
3. Codex 读取 `manifest.json`，执行 `scripts/export-runtime.sh`
4. Codex 生成该课次在 `runtime/lessons/<lesson>/` 下的发布产物
5. 主项目运行时从 `runtime/` 加载课程内容
6. 部署时同步系统代码与 `runtime/` 内容，而不是同步整个作者态目录

## 7. 当前执行结论

基于本轮目录收敛，后续应遵守以下规则：

- 课次设计稿统一进入 `authoring/lessons/<lesson>/design/`
- 根目录旧式 `notes/lessons/` 不再继续使用
- 根目录旧式 `skills/` 不再继续使用
- 根目录旧式 `data/` 暂作为过渡兼容层，不再作为长期真源继续扩张
- `docs/` 保留，作为面向 Claude 的文档层
- `.claude/skills/` 保留，作为本项目实际生效的技能层
- `export-runtime.sh` 由 Codex 在平台打通阶段实现
