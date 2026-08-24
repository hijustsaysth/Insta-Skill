# Instagram 养号 skills 项目

## 项目目标

本项目用于设计并实现一组 Instagram 养号相关 skills 和 provider 能力。

核心目标是把业务能力拆成可复用的包结构，同时兼容：

* 支持插件机制的 TS agent 底座，例如 `deepseek-harness`
* 不支持插件机制、但可读取普通 Markdown skills 的 agent 底座
* 支持 MCP 协议的 agent 底座

当前重点不包含 Python agent 直接复用 TS API provider。后续如需跨语言复用，计划通过 `instagram-protocol`、OpenAPI / JSON Schema、HTTP 或 MCP 服务适配层解决。

## 当前状态

当前仓库处于方案沉淀和实现准备阶段。

已完成：

* Instagram 养号 skills 包设计总览
* 各包设计与实现方案
* `sessionRef` 设计与实现方案
* 三天实现计划
* 汇报用 HTML 方案页面

待实现：

* monorepo 工程结构
* TS packages
* MCP connector server
* 业务 skill tools
* agent 服务执行层集成
* 结构化日志、benchmark 和 agent eval 基础能力

## 核心设计原则

业务 skill 只负责生成计划、内容、决策、参数草案或汇总结果。

正式执行、循环、等待、超时、中断、重试、状态管理、provider 选择和工具调用顺序由 agent 服务负责。

这条边界是本期验收重点。

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

## 执行路线

### API provider 路线

```text
业务 skill 生成计划
  → agent 服务读取计划
  → agent 服务解析 sessionRef
  → instagram-core / ctx.instagram
  → instagram-aiograpi-rest 或 instagram-official-api
  → 写入结构化日志
```

### MCP connector 路线

```text
业务 skill 生成计划和决策
  → agent 服务执行循环和工具选择
  → instagram-connector MCP Server
  → 移动端 Instagram 操作 tools
  → 写入结构化日志
```

## sessionRef

`sessionRef` 是业务 skill、agent 服务和 provider 之间传递登录态或运行态引用的统一字段。

设计要求：

* 对业务 skill 始终是普通 `string`
* 不包含 access token、cookie、密码、ADB serial 等敏感或运行态细节
* 业务 skill 只透传，不解析、不保存、不打印
* agent 服务或 provider 执行层负责解析
* 第一版使用 SQLite：统一 registry 表负责路由，provider 专属表保存各自字段

## connector 兜底策略

`instagram-connector` 通过 MCP Server 暴露移动端操作 tools。

点击类动作采用两级策略：

```text
XML 组件节点执行
  → 有限次重试
  → 截图 + 模型识别推测坐标执行一次
  → 仍失败则返回 DEGRADED
```

XML 组件节点执行是主路径，截图坐标只作为单次兜底。

## 主要文档

| 文档 | 说明 |
| --- | --- |
| [Instagram养号skills包设计总览.md](docs/plans/Instagram养号skills包设计总览.md) | 总体架构、分层、兼容方式、包职责 |
| [Instagram养号skills三天实现计划.md](docs/Instagram养号skills三天实现计划.md) | 三天分阶段实现计划 |
| [sessionRef设计与实现方案.md](docs/plans/sessionRef设计与实现方案.md) | sessionRef、SQLite registry、provider session 表设计 |
| [instagram-core包设计与实现方案.md](docs/plans/instagram-core包设计与实现方案.md) | 通用接口、类型、branded id 设计 |
| [instagram包设计与实现方案.md](docs/plans/instagram包设计与实现方案.md) | Cordis 适配层设计 |
| [instagram-aiograpi-rest包设计与实现方案.md](docs/plans/instagram-aiograpi-rest包设计与实现方案.md) | aiograpi-rest provider 设计 |
| [instagram-official-api包设计与实现方案.md](docs/plans/instagram-official-api包设计与实现方案.md) | 官方 API provider 预留设计 |
| [instagram-connector包设计与实现方案.md](docs/plans/instagram-connector包设计与实现方案.md) | MCP connector 与移动端兜底策略 |
| [instagram-profile-setup包设计与实现方案.md](docs/plans/instagram-profile-setup包设计与实现方案.md) | 账号资料生成和编辑计划 skill |
| [instagram-content-publish包设计与实现方案.md](docs/plans/instagram-content-publish包设计与实现方案.md) | 内容生成、发布计划、状态查询计划 skill |
| [instagram-video-interaction包设计与实现方案.md](docs/plans/instagram-video-interaction包设计与实现方案.md) | 视频互动计划、判断、评论生成 skill |
| [instagram-warmup-orchestrator包设计与实现方案.md](docs/plans/instagram-warmup-orchestrator包设计与实现方案.md) | 养号总编排 skill |
| [Instagram养号skills设计方案汇报.html](docs/plans/Instagram养号skills设计方案汇报.html) | 汇报用 HTML 方案页 |

## 三天实现目标

3 天内尽量完成除 Python 兼容外的全部内容。

### Day 1

完成底层能力：

* monorepo 包结构
* `instagram-core`
* `sessionRef`
* `instagram`
* `instagram-aiograpi-rest`
* `instagram-official-api` 占位
* `instagram-connector` MCP server 骨架

### Day 2

完成业务 skills：

* `instagram-profile-setup`
* `instagram-content-publish`
* `instagram-video-interaction`
* `instagram-warmup-orchestrator`
* 统一结构化输出字段

### Day 3

完成集成与验收：

* agent 服务侧计划执行入口
* `sessionRef` 执行层集成
* connector XML / 截图坐标兜底
* 结构化日志
* benchmark 基础用例
* agent eval 基础用例
* README、运行说明、验收清单

## 本期不做

* Python agent 直接复用 TS API provider
* `instagram-protocol` 真实实现
* 官方 API 完整 OAuth 授权和真实发布
* 生产级多账号调度
* 完整素材库后台
* 自动审批系统 UI
* 复杂风控恢复系统

## 验收重点

* 业务 skill 包必须有职责明确的 `SKILL.md`
* skills 职责必须符合最新标准：只生成计划、内容、决策、参数草案或汇总结果
* 执行、循环、等待、超时、中断和状态管理由 agent 服务负责
* `sessionRef` 不泄漏真实凭证和运行态细节
* provider / connector 失败时快速失败或返回明确降级结果
* 结构化日志可用于 benchmark 和 agent eval
