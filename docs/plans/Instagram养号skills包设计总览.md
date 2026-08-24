# Instagram养号skills包设计总览

## 目标

本期目标是把 `Instagram养号skills.md` 中的总编排能力和三个具体能力拆成可开发的包结构，同时保留对两类 agent 底座的兼容：

* 支持插件机制的底座，例如 `deepseek-harness`
* 不支持插件机制、只能把业务说明作为普通 skills 使用的底座

设计原则是：业务 skill 只负责理解任务、生成计划/内容/决策、给出工具和参数、汇总结果；实际执行、循环、等待、超时、中断和状态管理由 agent 服务负责。

## 总体分层

```text
业务 skill/tool 层
  ├── instagram-warmup-orchestrator
  ├── instagram-profile-setup
  ├── instagram-video-interaction
  └── instagram-content-publish

底座适配层
  └── instagram

通用能力接口层
  └── instagram-core

provider/client 实现层
  ├── instagram-aiograpi-rest
  ├── instagram-official-api
  └── instagram-connector
```

当前存在两条执行路线：

```text
API provider 路线
  → instagram-core
  → instagram / ctx.instagram
  → instagram-aiograpi-rest 或 instagram-official-api

MCP connector 路线
  → instagram-connector MCP Server
  → agent 通过 MCP client 调用移动端操作 tools
```

第一期优先实现：

```text
instagram-core
instagram
instagram-aiograpi-rest
instagram-connector
instagram-warmup-orchestrator
instagram-profile-setup
instagram-video-interaction
instagram-content-publish
```

`instagram-official-api` 先保留设计位置，后续专业账号路线再实现。`instagram-connector` 仍然是 API 不可用时的兜底方案；第一版先按 MCP Server 方式服务视频互动。

## 关键横向设计

### sessionRef

`sessionRef` 是业务 skill、agent 服务和 provider 之间传递登录态/运行态引用的统一字段。

* 对业务 skill 始终是普通 `string`
* 业务 skill 只透传 `sessionRef`，不解析、不保存、不打印敏感信息
* agent 服务或 provider 执行层负责根据 `sessionRef` 解析真实 session
* 第一版采用 SQLite：统一 registry 表负责路由，provider 专属表保存各自需要的字段
* 不同 provider 可拥有不同 session 结构，例如 aiograpi session、官方 API token、connector runtime 配置

### connector 兜底策略

`instagram-connector` 的移动端点击类动作采用两级执行策略：

```text
XML 组件节点执行
  → 有限次重试
  → 截图 + 模型识别推测坐标执行一次
  → 仍失败则返回降级结果
```

XML 组件节点执行是主路径；截图坐标只作为节点定位或节点点击失败后的单次兜底，不作为默认执行方式。

### skills 职责边界

业务 skill 只生成计划、内容、决策、参数草案或汇总结果。正式执行、循环、等待、超时、中断、重试、状态管理、provider 选择和工具调用顺序由 agent 服务决定。

### 结构化日志与 agent eval

计划型 tool 的输出需要保留稳定字段，便于 agent 服务写入结构化日志、构建 benchmark、回放任务链路和做 agent eval。skill 不伪造执行结果，只汇总 agent 服务回传的真实执行日志。

## 兼容方式

### 插件底座

在 `deepseek-harness` 中：

```text
instagram-core
  ↓
instagram
  ↓
instagram-aiograpi-rest
  ↓
agent 服务按业务 skill 计划调用 provider 能力
```

`instagram` 包声明 `ctx.instagram`，provider 挂载能力。业务 skill 不直接调用 `ctx.instagram`，而是产出计划、内容、决策或参数草案，由 agent 服务执行。

同时，`deepseek-harness` 可通过 `@deepseek-ai/dsh-mcp-client` 连接 `instagram-connector` MCP Server，把移动端操作能力注册为模型可见 tools。

### 无插件底座

在无插件机制的 agent 底座中：

```text
instagram-core
  ↓
instagram-aiograpi-rest
  ↓
agent 服务按普通 Markdown skills 执行
```

业务 skill 文档仍可复用；执行层通过普通 `InstagramClient`、HTTP 服务或底座已有工具调用 provider/client。

如果无插件底座支持 MCP 协议，也可以直接连接 `instagram-connector` MCP Server；这种场景不需要 Cordis 或 `ctx.instagram`。

## 包设计

### instagram-core

作用：

* 定义通用 Instagram 能力接口
* 定义输入输出类型
* 不依赖 Cordis、`deepseek-harness` 或任何具体 agent 底座

依赖：

* 不依赖业务 skill 包
* 不依赖 provider 实现包

限制：

* 不注册 tool
* 不声明 `ctx.instagram`
* 不处理 aiograpi-rest、官方 API、connector 的具体请求逻辑
* 不包含业务编排规则

### instagram

作用：

* 作为 `deepseek-harness` 的 Cordis 适配层

* 声明 `ctx.instagram` 服务接口

* 把 `instagram-core` 中的通用接口接入插件上下文

依赖：

* 依赖 `instagram-core`

* 依赖 `@deepseek-ai/cordis`

限制：

* 不实现 Instagram 请求

* 不注册模型可见工具

* 不包含账号建设、互动、发布的业务流程

* 只服务于支持插件机制的底座

### instagram-aiograpi-rest

作用：

* 实现 aiograpi-rest 路线
* 作为第一期优先 provider/client
* 为普通 agent 底座提供可直接使用的 client
* 为 `deepseek-harness` 提供可挂载到 `ctx.instagram` 的 provider

依赖：

* 依赖 `instagram-core`
* 在 `deepseek-harness` 场景下依赖 `instagram`
* 依赖 aiograpi-rest HTTP 服务

限制：

* 不做业务编排
* 不注册模型可见工具
* 不生成文案、头像、评论或发布内容
* 只负责把结构化请求转成 aiograpi-rest 调用，并返回结构化结果

### instagram-official-api

作用：

* 预留官方 API provider/client 位置
* 用于专业账号的低风险发布、评论、洞察等能力

依赖：

* 依赖 `instagram-core`
* 在 `deepseek-harness` 场景下依赖 `instagram`
* 依赖 Meta / Instagram 官方 API 授权信息

限制：

* 第一期不实现
* 只支持官方 API 覆盖的能力
* 普通账号能力不由本包解决

### instagram-connector

作用：

* 作为 API 不可用时的 connector 兜底方案
* 通过 MCP Server 暴露移动端 Instagram 操作 tools
* 第一版优先服务 `instagram-video-interaction` 所需的搜索、采集、点赞、评论、滑动能力
* 后续在 API provider 能力不足、账号类型不支持或接口不可用时作为备用执行路线

依赖：

* 不依赖 `instagram-core`
* 不依赖 `instagram`
* 依赖 MCP Server SDK
* 依赖现有 Android Instagram Connector、`connector-sdk` 和 `local-mobile-runtime`

限制：

* 不作为首选路线
* 不承载业务编排，只提供底层动作能力
* 不包装成 `InstagramClient`
* 点击类动作优先使用 XML 组件节点执行，失败后只允许一次截图坐标兜底
* 坐标兜底仍失败时返回降级结果，不继续循环尝试

### instagram-warmup-orchestrator

作用：

* 对应 `养号skill`
* 根据账号注册日期和当前日期识别养号阶段
* 生成今日任务计划
* 指定需要调用的具体能力和工具参数草案
* 汇总 agent 服务回传的执行日志

依赖：

* 不依赖 `instagram-core`
* 不依赖 `ctx.instagram`
* 可依赖 Harness 的 tool 注册能力

注册工具：

| 工具名 | 作用 |
| --- | --- |
| `instagram_warmup_plan` | 根据账号注册日期、当前日期、语言要求、素材库路径生成当前阶段和今日任务计划 |
| `instagram_warmup_result_summarize` | 汇总 agent 服务执行后的任务日志 |

限制：

* 不直接调用 Instagram
* 不直接执行点赞、评论、发帖或资料编辑
* 不直接调用任何 skill tool 或 MCP tool
* 不实现 runner、循环、等待、超时、中断或状态管理
* 必须提供 `SKILL.md`，明确计划职责和执行责任归属

### instagram-profile-setup

作用：

* 对应 `账号基础建设skill`
* 生成账号名字、简介、头像等资料
* 生成账号资料方案和资料编辑计划

依赖：

* 依赖底座已有 LLM 能力
* 可选依赖图片生成能力
* agent 服务执行计划时可调用 `InstagramClient` 或 MCP tools

注册工具：

| 工具名 | 作用 |
| --- | --- |
| `instagram_profile_generate` | 根据提示词和素材生成账号名字、简介、头像引用 |
| `instagram_profile_edit_plan` | 根据人工审批后的资料生成编辑计划和工具参数草案 |

限制：

* 必须提供职责明确的 `SKILL.md`
* 不直接提交资料编辑，正式资料编辑由 agent 服务执行
* 第一期不做完整图片生成系统
* 不管理素材库
* 不处理多账号调度
* 不直接依赖 aiograpi-rest 或 connector

### instagram-video-interaction

作用：

* 对应 `每日自动互动同类型视频skill`
* 生成互动计划
* 根据视频信号判断是否符合目标、是否点赞、是否评论
* 生成评论内容
* 汇总行为日志

依赖：

* 第一版不强依赖 `instagram-core`
* 不依赖 `ctx.instagram`
* 依赖底座已有 LLM 能力
* 可选依赖视觉模型能力

注册工具：

| 工具名 | 作用 |
| --- | --- |
| `instagram_video_interaction_plan` | 根据关键词、互动上限、停留时间生成互动计划 |
| `instagram_video_evaluate` | 根据视频信号判断是否符合目标、是否点赞、是否评论 |
| `instagram_video_comment_generate` | 根据视频信号和评论风格生成评论 |
| `instagram_video_log_summarize` | 汇总观看、点赞、评论、跳过记录 |

限制：

* 不执行搜索、点赞、评论、滑动
* 搜索、采集、点赞、评论、滑动由 `instagram-connector` MCP tools 执行
* 自动半小时循环由 agent 服务执行，不放在 skill 包内
* 必须提供 `SKILL.md`，明确使用流程、工具边界和降级策略
* 第一期不实现复杂行为节奏策略系统
* 不做多账号并发调度
* 视频理解先保持最小可用，不扩展成完整内容分析平台

### instagram-content-publish

作用：

* 对应 `发布内容skill`
* 根据产品素材和说明生成 post / stories / reels 内容
* 生成发布草稿、发布计划和状态查询计划

依赖：

* 依赖底座已有 LLM 能力
* 可选依赖图片/视频生成能力
* agent 服务执行计划时可调用 `InstagramClient`、HTTP provider 或 MCP tools

注册工具：

| 工具名 | 作用 |
| --- | --- |
| `instagram_content_generate` | 根据素材、产品说明、目标市场语言生成正文、tag、图片/视频引用 |
| `instagram_content_publish_plan` | 根据内容草稿和目标类型生成发布计划和工具参数草案 |
| `instagram_publish_status_plan` | 根据发布记录生成状态查询计划和工具参数草案 |

限制：

* 必须提供职责明确的 `SKILL.md`
* 不直接发布内容，正式发布和状态查询由 agent 服务执行
* 第一期不做完整图片/视频生成系统
* 不做内容日历后台
* 不做人工审批工作流系统，只保留工具输入输出位置
* 不直接依赖 aiograpi-rest、official-api 或 connector

## 第一期开工边界

第一期按两条路线推进：

```text
资料 / 发布 API provider 路线
  → instagram-core 接口
  → instagram-aiograpi-rest
  → aiograpi-rest 服务

视频互动 MCP connector 路线
  → instagram-connector MCP Server
  → instagram-video-interaction 决策 tools
  → agent 服务执行计划
```

不在第一期做：

* 官方 API provider
* 完整素材库
* 多账号调度
* 自动审批系统
* skill 包内 runner
* 复杂风控恢复

## 推荐开发顺序

| 优先级 | 包 | 原因 |
| --- | --- | --- |
| P0 | `instagram-core` | 公共接口和类型先稳定，后续包才能统一依赖。 |
| P1 | `instagram` | 接入 `deepseek-harness`，让 `ctx.instagram` 可注入。 |
| P2 | `instagram-aiograpi-rest` | 资料和发布路线的第一期 provider。 |
| P3 | `instagram-connector` | 视频互动依赖 MCP 移动端操作能力。 |
| P4 | `instagram-video-interaction` | 在 connector 信号基础上做互动判断。 |
| P5 | `instagram-profile-setup` | 已按计划型 skill 设计，下一步落地 schema 和实现。 |
| P6 | `instagram-content-publish` | 已按计划型 skill 设计，下一步落地草稿和发布计划实现。 |
| P7 | `instagram-warmup-orchestrator` | 等具体能力计划稳定后，再做总编排。 |
| P8 | `instagram-official-api` | 第一期不实现，后续专业账号路线再接。 |

## 验证标准

验收必查点：

* 业务 skill 包必须有职责明确的 `SKILL.md`
* skills 职责必须符合最新标准：只生成计划、内容、决策、参数草案或汇总结果

其他验证点：

* 执行、循环、等待、超时、中断和状态管理由 agent 服务负责
* `instagram_warmup_plan` 能输出当前阶段、今日任务列表、工具提示和下一次建议执行时间
* `instagram_warmup_result_summarize` 能汇总结构化执行日志
* `instagram-video-interaction` 不执行移动端动作，只输出互动决策
* `instagram-connector` MCP tools 能被支持 MCP 的 agent 底座调用
* `instagram-connector` 在总览中保留为 API 不可用时的兜底路线
* `instagram-core` 不依赖任何 agent 底座
* `instagram` 只负责 `deepseek-harness` 适配
* 外部 API 调用失败时快速失败，不返回假成功

## 兼容说明

当前 API provider 方案以 TypeScript 包为主，Python agent 不能直接复用 `instagram-core`。`instagram-connector` 采用 MCP Server 后，可以被 TS agent、Python agent 或其他支持 MCP 的 agent 底座直接连接。

后续如需同一套能力同时服务 TS agent 和 Python agent，建议新增 `instagram-protocol`，用 OpenAPI/JSON Schema 固化请求、响应、错误码和 MCP tool schema；再按需要新增 HTTP 或 MCP 服务适配层。
