# Instagram 养号 skills 三天实现计划

## 目标

3 天内尽量完成方案中除 Python 兼容外的全部内容。

范围包括：

* TS monorepo 包结构
* `instagram-core`
* `instagram-cordis`
* `instagram-aiograpi-rest`
* `instagram-official-api`
* `instagram-connector`
* `sessionRef`
* 四个业务 skill 包
* 结构化日志
* benchmark / agent eval 基础能力

不把 Python agent 直接复用 TS API provider 作为本轮目标。Python 兼容后续通过 `instagram-protocol`、OpenAPI / JSON Schema、HTTP 或 MCP 服务适配层解决。

## 当前关键调整

* `instagram` 包已明确为 Cordis 适配层，后续统一称为 `instagram-cordis`。
* `instagram-aiograpi-rest` 对齐本地 `aiograpi-rest 6.0.0`，服务地址为 `http://localhost:8005`，并保留 OpenAPI smoke test。
* `instagram-official-api` 不再是直连 Meta Graph API 包，而是通过 Zernio API 使用 Instagram 官方授权发布能力。
* `instagram-official-api` 不再只是占位包，三天内应尽量完成 Zernio 发布 provider 的主要实现。
* 定时发布由 Zernio 路线承接；业务 skill 只生成定时发布计划，是否调用 Zernio provider 由 agent 服务决定。

## 总体原则

业务 skill 只负责生成计划、内容、决策、参数草案或汇总结果。

正式执行、循环、等待、超时、中断、重试、状态管理、provider 选择和工具调用顺序由 agent 服务负责。

## Day 1：底层能力与 provider 基座成型

目标：把所有非业务 skill 的基础包完成到可被调用，并完成两条 API provider 路线的核心骨架。

| 模块 | 实现内容 | 交付物 |
| --- | --- | --- |
| monorepo | 建包、workspace 配置、统一 tsconfig、test 脚本 | 可安装、可编译、可运行测试的 workspace |
| `instagram-core` | 完成接口、类型、错误码、branded id 构造函数 | 通用 `InstagramClient` 接口和公共类型 |
| `sessionRef` | 完成 SQLite schema、resolver、provider session 表、结构化解析日志 | `SqliteInstagramSessionStore` 和 provider 路由能力 |
| `instagram-cordis` | 完成 Cordis `ctx.instagram` 声明、provider 注册接口 | 可注册和读取 `ctx.instagram` |
| `instagram-aiograpi-rest` | 对齐真实 aiograpi-rest OpenAPI 路由、请求映射、错误映射、素材规格校验、`./plugin` 入口、local smoke | 普通 client 入口、Cordis 插件入口、OpenAPI smoke test |
| `instagram-official-api` | 按 Zernio API 改造配置、HTTP client、发布 payload、素材限制、错误映射、`./plugin` 入口 | Zernio 官方发布 provider 骨架和 mock 测试 |
| `instagram-connector` | 完成 MCP server 骨架、sessionRef runtime 解析、工具 schema | MCP tools 可被 agent 底座发现和调用 |

Day 1 验收：

* 所有底层包可编译
* API provider 和 MCP connector 都有可调用入口
* `sessionRef` 可路由到 provider 专属表
* `instagram-aiograpi-rest` 主入口不依赖 Cordis
* `instagram-official-api` 主入口不依赖 Cordis
* Cordis 插件入口只从 `./plugin` 子路径导出
* aiograpi-rest local smoke 能验证本地服务 OpenAPI 关键路径
* Zernio provider 能生成 `POST /posts` 请求草案并通过 mock 测试

## Day 2：业务 skills 全量落地

目标：把四个业务 skill 都做到计划型工具可用，并严格不执行 Instagram 动作。

| 模块 | 实现内容 | 交付物 |
| --- | --- | --- |
| `instagram-profile-setup` | `SKILL.md`、名字/头像/简介生成、资料编辑计划、审批校验、空更新失败 | 资料方案生成和编辑计划工具 |
| `instagram-content-publish` | `SKILL.md`、文案/图片/视频提示词、内容草稿、即时发布计划、定时发布计划、状态查询计划 | 内容草稿、发布计划和状态查询计划工具 |
| `instagram-video-interaction` | `SKILL.md`、互动计划、视频判断、评论生成、日志汇总、无视觉模型降级 | 互动计划和单条视频决策工具 |
| `instagram-warmup-orchestrator` | `SKILL.md`、养号阶段判断、今日任务计划、工具参数草案、执行日志汇总 | 今日养号总计划和结果汇总工具 |
| 结构化输出 | 统一计划字段、`logFields`、`evaluationTags`、失败原因字段 | 可被 agent 服务记录和评测的稳定输出 |

发布计划的 provider 倾向：

| 场景 | 推荐执行路线 |
| --- | --- |
| 普通账号 / 私有 API 路线 | `instagram-aiograpi-rest` |
| Business / Creator 官方发布路线 | `instagram-official-api` / Zernio |
| 定时发布 | 优先 `instagram-official-api` / Zernio |
| API 不可用或账号类型不支持 | agent 服务可选择 `instagram-connector` 兜底 |

Day 2 验收：

* 四个业务 skill 均可注册和调用
* 四个业务 skill 均有职责明确的 `SKILL.md`
* 业务 skill 不直接调用 provider、MCP 或 `ctx.instagram`
* 业务 skill 只输出计划、内容、决策、参数草案或汇总结果
* `instagram-content-publish` 能区分即时发布和定时发布计划
* `instagram-content-publish` 输出稳定 `logFields`
* `instagram-video-interaction` 在无视觉模型时可降级为文本 / OCR 判断

## Day 3：执行集成、兜底策略、测试与评测

目标：把 agent 服务侧执行路径、connector 真实兜底、测试验收和 eval 基础都补齐。

| 模块 | 实现内容 | 交付物 |
| --- | --- | --- |
| agent 执行层 | 读取 skill 计划，选择 aiograpi-rest、Zernio official-api 或 MCP connector 执行 | 计划到执行的统一入口 |
| `sessionRef` 集成 | 执行前解析 session，记录 provider id、解析状态、执行状态 | 执行层 session 解析链路 |
| connector 兜底 | XML 节点执行、有限次重试、截图坐标兜底一次、失败返回 `DEGRADED` | 可审计的移动端动作兜底策略 |
| 结构化日志 | 统一记录 plan、tool choice、requestDraft、provider result、error、fallback | 可回放的执行日志 |
| benchmark | 覆盖计划生成、职责边界、sessionRef 路由、provider 调用、MCP 调用 | 基础 benchmark 用例 |
| agent eval | 检查 agent 是否按计划选择工具、是否越权执行、是否正确处理降级 | 基础 agent eval 用例 |
| 文档收口 | 更新 README、运行说明、验收清单、已知限制 | 可交接的开发说明 |

Day 3 验收：

* 除 Python 兼容外，方案中的主要能力均有实现或明确占位
* 可跑自动化测试
* 可演示一条资料 / 发布 API 路线
* 可演示一条 Zernio 官方发布请求构造路线
* 可演示一条视频互动 MCP 路线
* 结构化日志能记录计划、工具选择、执行结果和失败原因
* benchmark / agent eval 能覆盖核心职责边界

## 三天内不做

* Python agent 直接复用 TS API provider
* `instagram-protocol` 真实实现
* Zernio account connect / OAuth 授权页面
* Meta Graph API 直连接入
* Zernio media upload endpoint
* 生产级多账号调度
* 完整素材库后台
* 自动审批系统 UI
* 复杂风控恢复系统

## 最终完成标准

```text
完成除 Python 兼容协议层外的第一版工程实现：
所有 TS 包、业务 skill、API provider、MCP connector、sessionRef、结构化日志、基础 benchmark / eval 均可运行或有明确 NOT_IMPLEMENTED 占位。
```
