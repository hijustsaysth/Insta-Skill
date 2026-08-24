# instagram-connector 包设计与实现方案

## 目标

`instagram-connector` 是基于现有 Android Instagram Connector 的移动端自动化能力包，负责把真实 Android Connector operation 通过 MCP tools 暴露给 agent 使用。

第一版明确采用 MCP 方案，不设计 `Invoker` 中间层。

目标链路：

```text
TS / Python agent
  → MCP Client
  → instagram-connector MCP Server
  → Android InstagramConnector
  → MobileRuntime / LocalAdbMobileRuntime
  → Android 模拟器或真机
  → Instagram App
```

## 定位

`instagram-connector` 属于 provider/client 实现层中的移动端 UI 自动化路线。

它不是 `aiograpi-rest` 或官方 API 的替代首选路线，而是用于 API 不可用、互动能力需要真实 App UI 时的兜底 provider。

第一版重点服务 `instagram-video-interaction`，不承接资料编辑和内容发布。

移动端动作执行采用两级策略：

```text
XML 组件节点执行
  → 有限次重试仍失败
  → 截图 + 模型识别推测坐标执行一次
  → 仍失败才返回降级结果
```

其中 XML 组件节点执行是主路径；截图推测坐标只作为节点定位或节点点击失败后的兜底路径，不作为默认执行方式。

## 真实实现依据

当前 connector 服务来自：

```text
F:\facebook-connector-intern-source-0.3.28\artifacts\facebook-connector-intern-source-0.3.28
```

核心模块：

| 模块 | 作用 |
| --- | --- |
| `instagram-connector` | Instagram Android Connector 插件，定义并执行 Instagram operation |
| `connector-sdk` | 定义 `AndroidConnectorPlugin`、`MobileRuntime`、`ConnectorResult` 等稳定接口 |
| `local-mobile-runtime` | 本地开发和测试 Runtime，通过 ADB 操作 Android 模拟器 |

现有 `InstagramConnector` 已实现的 operation：

| operation | 作用 |
| --- | --- |
| `instagram.app.open` | 打开 Instagram App |
| `instagram.debug.snapshot` | 返回当前 UI 快照 |
| `instagram.debug.ocr` | 调用 Runtime OCR |
| `instagram.search.open` | 打开搜索页 |
| `instagram.search.input` | 输入关键词并提交搜索 |
| `instagram.search.open_first_reel` | 打开第一个 Reel / Video 搜索结果 |
| `instagram.reel.inspect` | 读取当前 Reel 可见信息 |
| `instagram.reel.collect_signals` | 采集当前 Reel 截图、OCR、可见文本 |
| `instagram.reel.like` | 点赞当前 Reel |
| `instagram.reel.comment` | 评论当前 Reel |
| `instagram.reel.next` | 滚动到下一条 Reel |

## 职责

* 启动 MCP Server
* 注册 Instagram 移动端自动化 tools
* 管理本地或远端 Mobile Runtime session
* 调用现有 Android `InstagramConnector.execute`
* 对可点击动作优先使用 XML 组件节点执行
* 在 XML 组件节点有限次重试失败后，执行一次截图坐标兜底
* 返回标准 MCP tool 结果
* 把 connector 错误码原样暴露给 agent
* 支持本地模拟器测试链路

## 非职责

* 不设计 `Invoker` 抽象层
* 不直接实现 Instagram API 请求
* 不实现 aiograpi-rest 或官方 API 能力
* 不生成文案、头像、图片或视频
* 不做养号总编排
* 不做多账号调度系统
* 不做发布 post / story / reel
* 不做账号资料编辑
* 不绕过 Instagram 登录、验证码或安全验证

## 包依赖

### 允许依赖

* MCP Server SDK
* `connector-sdk`
* `instagram-connector` Android Connector 产物或源码模块
* `local-mobile-runtime`
* Node / Java 进程调用能力，按最终 MCP Server 技术栈确定

### 不允许依赖

* `instagram-aiograpi-rest`
* `instagram-official-api`
* `instagram-profile-setup`
* `instagram-content-publish`
* `instagram-warmup-orchestrator`
* 图片 / 视频生成模型服务

### 可选依赖

* 视觉模型或截图坐标识别服务：仅用于 XML 组件节点执行失败后的单次坐标兜底。

## 包路径建议

采用 monorepo 方式开发，建议放在：

```text
instagram-skills/packages/instagram-connector
```

包名建议：

```text
@instagram-skills/instagram-connector
```

## 文件结构建议

```text
instagram-skills/packages/instagram-connector/
  package.json
  tsconfig.json
  src/
    index.ts
    server.ts
    config.ts
    tools.ts
    runtime-session.ts
    connector-command.ts
    action-executor.ts
    coordinate-fallback.ts
    result.ts
    errors.ts
```

## 模块职责

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 导出 MCP Server 启动入口 |
| `server.ts` | 创建并启动 MCP Server |
| `config.ts` | 定义 connectorId、ADB、serial、artifactDir、超时配置 |
| `tools.ts` | 注册 Instagram MCP tools |
| `runtime-session.ts` | 根据 `sessionRef` 解析当前用户对应的 Runtime 配置 |
| `connector-command.ts` | 直接调用现有 Android Connector 测试命令或 Java 入口 |
| `action-executor.ts` | 封装动作执行顺序：XML 节点执行、有限次重试、截图坐标兜底 |
| `coordinate-fallback.ts` | 处理截图采集、坐标识别请求、坐标点击和兜底结果 |
| `result.ts` | 解析 `ConnectorResult` 输出 |
| `errors.ts` | 统一 MCP tool 失败输出 |

## MCP 工具设计

第一版 MCP tool 名称直接复用现有 connector operation，减少概念转换。

| MCP tool | 输入 | 输出 |
| --- | --- | --- |
| `instagram.app.open` | `{ "sessionRef": "string" }` | connector 原始输出 |
| `instagram.debug.snapshot` | `{ "sessionRef": "string" }` | 当前 UI 快照 |
| `instagram.debug.ocr` | `{ "sessionRef": "string" }` | OCR 结果 |
| `instagram.search.open` | `{ "sessionRef": "string" }` | 搜索页定位结果 |
| `instagram.search.input` | `{ "sessionRef": "string", "keyword": "string" }` | 搜索结果页摘要 |
| `instagram.search.open_first_reel` | `{ "sessionRef": "string" }` | 打开的 Reel 摘要 |
| `instagram.reel.inspect` | `{ "sessionRef": "string" }` | 当前 Reel 可见信息 |
| `instagram.reel.collect_signals` | `{ "sessionRef": "string", "frameCount": 1, "intervalMs": 0, "includeVisibleText": true, "includeOcr": true }` | 截图、OCR、可见文本 |
| `instagram.reel.like` | `{ "sessionRef": "string" }` | 点赞结果 |
| `instagram.reel.comment` | `{ "sessionRef": "string", "commentText": "string" }` | 评论结果 |
| `instagram.reel.next` | `{ "sessionRef": "string" }` | 滚动结果 |

## sessionRef 设计

在 connector 路线中，`sessionRef` 不表示 Instagram access token、cookie 或 aiograpi session id。

它表示当前用户可用的移动端运行环境引用：

```text
sessionRef
  → Runtime session
  → adb serial / Host Runtime / Connector Instance
  → 已登录 Instagram 的 App 环境
```

本地开发时可映射为：

```json
{
  "sessionRef": "local-emulator-5554",
  "adbPath": "C:\\Users\\86131\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe",
  "serial": "emulator-5554",
  "artifactDir": "docs/Instagram/test-runs/artifacts"
}
```

第一版可以用配置文件或环境变量维护 `sessionRef → Runtime 配置` 映射，不做账号池和调度系统。

## 本地 Runtime 接入

本地开发和测试使用现有 `local-mobile-runtime`。

执行链路：

```text
MCP tool call
  → connector-command.ts
  → InstagramLocalRuntimeCommand
  → LocalAdbMobileRuntime
  → adb
  → Android 模拟器
```

`local-mobile-runtime` 已提供：

| 能力 | 实现方式 |
| --- | --- |
| `openApp` | `adb shell monkey -p com.instagram.android 1` |
| `snapshot` | `uiautomator dump` + XML 解析 |
| `query` | 基于 UI XML selector 匹配 |
| `click` | `targetPath → bounds center → adb tap` |
| `input` | 点击输入框后 `adb shell input text` |
| `submit` | `adb shell input keyevent ENTER` |
| `scroll` | `adb shell input swipe` |
| `capture` | `adb shell screencap` 后 pull 到本地 |
| `ocr` | 第一版返回空 OCR lines |

## 动作执行兜底策略

对点赞、评论入口点击、搜索结果打开等需要定位 UI 元素的动作，第一版统一采用以下顺序：

1. 先通过 `uiautomator dump` 获取 XML 快照。
2. 使用现有 selector / query 能力定位组件节点。
3. 命中节点后取 `bounds` 中心点执行点击。
4. 如果节点定位、节点点击或点击后状态确认失败，按配置进行有限次重试。
5. XML 组件节点执行仍失败时，采集当前截图。
6. 调用模型或外部坐标识别服务，根据截图和目标动作推测点击坐标。
7. 只执行一次坐标点击。
8. 如果坐标点击后仍无法确认成功，返回降级结果。

配置建议：

| 配置项 | 作用 |
| --- | --- |
| `xmlRetryLimit` | XML 组件节点执行的最大重试次数 |
| `enableCoordinateFallback` | 是否允许截图坐标兜底 |
| `coordinateFallbackAttemptLimit` | 固定为 1，避免反复盲点 |
| `coordinateResolver` | 截图坐标识别服务配置 |

降级结果必须包含：

| 字段 | 说明 |
| --- | --- |
| `status` | `DEGRADED` |
| `primaryStrategy` | `xml_node` |
| `fallbackStrategy` | `screenshot_coordinate` |
| `xmlAttempts` | XML 组件节点执行次数 |
| `coordinateAttempted` | 是否尝试过截图坐标兜底 |
| `code` | 失败码 |
| `detail` | 失败说明 |

如果未接入视觉模型或坐标识别服务，XML 组件节点执行失败后直接返回降级结果，`coordinateAttempted=false`，错误码为 `INSTAGRAM_COORDINATE_FALLBACK_UNAVAILABLE`。

## 与 skills 的关系

第一版不把 `instagram-connector` 包装成 `InstagramClient`。

业务使用方式：

```text
instagram-video-interaction
  → 调用 MCP tools
  → 完成搜索、采集、点赞、评论
```

`instagram-profile-setup` 和 `instagram-content-publish` 仍优先通过 `aiograpi-rest` 或 `official-api` 路线实现。

如果后续必须让所有业务包都只通过 `InstagramClient` 调用 connector，再单独设计 MCP-backed `InstagramClient` 适配包，不放在第一版。

## 与 protocol 层的关系

后续引入 `instagram-protocol` 时，协议层应作为 schema 源头，MCP 只是协议出口。

推荐关系：

```text
instagram-protocol
  → 定义 tool 输入 / 输出 / 错误码 JSON Schema
  → instagram-connector MCP Server 复用 schema 注册 tools
  → TS / Python agent 通过 MCP 调用
```

第一版可以先手写 MCP tool schema，但字段命名应贴近后续 protocol：

* `sessionRef`
* `operation`
* `status`
* `code`
* `output`
* `detail`

## 错误处理

MCP Server 不吞错、不返回假成功。

| 来源 | MCP 输出 |
| --- | --- |
| connector 返回 `SUCCEEDED` | tool 成功，返回 `output` |
| connector 返回 `FAILED` | tool 失败，返回 connector `code/detail` |
| connector 返回 `CANCELLED` | tool 失败，返回 `CANCELLED` |
| connector 返回 `RETRYABLE` | tool 失败，保留 `RETRYABLE` 状态和原始错误码 |
| XML 节点重试失败且坐标兜底成功 | tool 成功，返回 `fallbackStrategy=screenshot_coordinate` |
| XML 节点重试失败且坐标兜底失败 | tool 降级，返回 `DEGRADED` 和失败原因 |
| 未接入坐标识别服务 | tool 降级，返回 `INSTAGRAM_COORDINATE_FALLBACK_UNAVAILABLE` |
| `sessionRef` 无映射 | tool 失败，返回 `CONNECTOR_SESSION_NOT_FOUND` |
| 本地命令无法启动 | tool 失败，返回 `CONNECTOR_RUNTIME_UNAVAILABLE` |

现有 connector 错误码应原样保留，例如：

* `INSTAGRAM_PACKAGE_DENIED`
* `INSTAGRAM_NOT_ACTIVE`
* `INSTAGRAM_KEYWORD_REQUIRED`
* `INSTAGRAM_COMMENT_TEXT_REQUIRED`
* `INSTAGRAM_VIDEO_RESULT_NOT_FOUND`
* `INSTAGRAM_VISUAL_COORDINATE_UNSUPPORTED`
* `INSTAGRAM_COORDINATE_FALLBACK_UNAVAILABLE`
* `INSTAGRAM_COORDINATE_FALLBACK_FAILED`

## 实现步骤

1. 新建 `@instagram-skills/instagram-connector` 包。
2. 配置 MCP Server 启动入口。
3. 定义 `ConnectorMcpConfig`。
4. 实现 `sessionRef → Runtime 配置` 解析。
5. 实现 `connector-command.ts`，直接调用 `InstagramLocalRuntimeCommand`。
6. 实现 `action-executor.ts`，统一封装 XML 节点执行和有限次重试。
7. 实现 `coordinate-fallback.ts`，支持截图坐标兜底一次。
8. 注册 11 个 MCP tools。
9. 每个 tool 只做输入 schema 校验和 connector operation 调用。
10. 解析 `ConnectorResult`，统一返回 MCP tool 输出。
11. 用本地 Android 模拟器跑通无副作用链路。
12. 将点赞、评论测试放到显式开关下执行。

## 验收场景

| 场景 | 用例 | 预期 |
| --- | --- | --- |
| MCP Server 启动 | 启动 `instagram-connector` MCP Server | 能列出 Instagram tools |
| session 解析 | 输入有效 `sessionRef` | 找到对应 ADB serial / Runtime 配置 |
| session 缺失 | 输入不存在的 `sessionRef` | 返回 `CONNECTOR_SESSION_NOT_FOUND` |
| 打开 App | 调用 `instagram.app.open` | Instagram 被打开，返回 `packageName=com.instagram.android` |
| UI 快照 | 调用 `instagram.debug.snapshot` | 返回 `packageName`、`pageFingerprint`、`visibleText`、`nodes` |
| 搜索链路 | 依次调用 `search.open`、`search.input`、`search.open_first_reel` | 能进入 Reel 页面 |
| 信号采集 | 调用 `reel.collect_signals` | 返回至少一帧截图和可见文本 |
| 下一条 | 调用 `reel.next` | 页面指纹变化 |
| 点赞 | 显式开启副作用测试后调用 `reel.like` | 成功或返回明确失败码 |
| 评论 | 显式开启副作用测试后调用 `reel.comment` | 成功或返回明确失败码 |
| XML 节点成功 | 可点击元素能通过 XML selector 定位 | 使用节点 bounds 中心点执行，不触发截图坐标兜底 |
| XML 节点重试后成功 | 前几次节点定位失败，重试后成功 | 返回成功，并记录 `xmlAttempts` |
| 坐标兜底成功 | XML 节点有限次重试失败，模型返回有效坐标 | 只点击一次，成功结果标记 `fallbackStrategy=screenshot_coordinate` |
| 坐标兜底失败 | XML 节点失败且坐标点击后仍无法确认成功 | 返回 `DEGRADED`，保留失败原因 |
| 无坐标识别服务 | 未配置视觉模型或坐标识别服务 | 返回 `INSTAGRAM_COORDINATE_FALLBACK_UNAVAILABLE` |
| 错误透传 | connector 返回业务错误 | MCP 输出保留原始 `code/detail` |
| 依赖边界 | 编译本包 | 不依赖 aiograpi-rest、official-api、业务 skill 包 |

## 验证标准

* MCP Server 能被 TS / Python agent 作为外部工具服务调用
* MCP tools 与现有 connector operation 一一对应
* 本地模拟器无副作用链路可跑通
* 真实副作用动作需要显式开关
* `sessionRef` 能绑定稳定的移动端运行环境
* 点击类动作优先使用 XML 组件节点执行
* XML 组件节点有限次重试失败后，只允许一次截图坐标兜底
* 坐标兜底仍失败时返回降级结果，不继续循环尝试
* connector 错误不被吞掉或改写成假成功
* 不引入 `Invoker` 中间抽象层

## 第一版不做

* 不做 `InstagramClient` 包装
* 不做 MCP-backed provider 自动注册到 `ctx.instagram`
* 不做 post / story / reel 发布
* 不做账号资料编辑
* 不做多账号调度
* 不做 OCR 引擎接入
* 不做常态化视觉模型坐标点击；截图坐标只作为 XML 组件节点失败后的单次兜底
* 不做 Central / Runtime Host 的完整替代实现
