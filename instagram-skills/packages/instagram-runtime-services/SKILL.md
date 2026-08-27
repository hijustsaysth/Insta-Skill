---
name: instagram-runtime-services
description: 说明 Instagram 执行侧包、account-access 统一入口、provider 配置、MCP connector 和真实验收方式。
---

# Instagram Runtime Services

当用户需要接入、调用、调试或验收 `instagram-skills` 的执行侧能力时，使用这个 skill。

本 skill 是执行侧接入手册，不是业务规划 skill。它用于指导 agent 如何把业务 skill 生成的计划落到 CLI、Cordis service、provider client、MCP server 或验收脚本上。

## 覆盖范围

本 skill 覆盖三个 provider/connector 执行包，以及一个统一账号接入入口：

- `@instagram-skills/instagram-aiograpi-rest`
- `@instagram-skills/instagram-official-api`
- `@instagram-skills/instagram-connector`
- `@instagram-skills/instagram-account-access`

其中：

- `instagram-aiograpi-rest`、`instagram-official-api`、`instagram-connector` 提供真实执行能力。
- `instagram-account-access` 是账号登录、绑定、刷新、写 SQLite 的统一门面。
- 业务 skill 只生成计划、内容、判断或参数草案。
- 真实登录、绑定、发布、查询、移动端操作、循环、等待、重试和中断由 agent 服务决定并执行。

不要把 provider/client 包当作自动可调用的 Codex tool。大多数 agent 无法直接导入 TS 执行层，只能通过 shell/CLI、MCP、Cordis 插件、HTTP 服务或项目脚本间接调用。

## 全局前置条件

进入 monorepo：

```powershell
cd instagram-skills
```

开发验收：

```powershell
pnpm install
pnpm build
pnpm test
```

只检查 skill frontmatter：

```powershell
pnpm validate:skills
```

默认 SQLite session store 路径：

```text
instagram-session-store.sqlite
```

这是 CLI 在当前工作目录下的默认路径。真实验收建议显式传入 `INSTAGRAM_SESSION_STORE_SQLITE_PATH`，避免不同启动目录写到不同数据库。

真实执行前必须确认：

- provider 服务可达。
- 必要配置已提供。
- 敏感输入来自安全输入通道。
- 用户已确认会产生副作用的动作。

## account-access 统一入口

包路径：

```text
packages/instagram-account-access
```

适用场景：

- Instagram 账号密码登录。
- Instagram cookie `sessionid` 登录。
- challenge 继续验证。
- aiograpi session 刷新。
- aiograpi settings 导出并写入 SQLite。
- Zernio profile 创建和 Instagram 专业账号绑定。

TS service 入口：

```ts
import { createInstagramAccountAccessService } from "@instagram-skills/instagram-account-access";
```

Cordis plugin 入口：

```ts
import { apply } from "@instagram-skills/instagram-account-access/plugin";
```

注册后由 agent 服务调用：

```text
ctx.instagramAccountAccess
```

CLI 入口：

```powershell
instagram-account-access plan --input-json '{"action":"aiograpi_login_with_password"}'
instagram-account-access login --input-json -
instagram-account-access login-with-sessionid --input-json -
instagram-account-access continue-challenge --input-json -
instagram-account-access refresh --input-json '{"sessionRef":"sess_xxx"}'
instagram-account-access export-settings --input-json '{"sessionRef":"sess_xxx"}'
instagram-account-access bind --zernio-config api.yml --input-json -
```

如果 workspace 下 `instagram-account-access` bin 没有被 `pnpm exec` 暴露，本地开发可直接调用编译后的 CLI：

```powershell
node packages/instagram-account-access/dist/cli.js plan --input-json '{"action":"aiograpi_login_with_password"}'
node packages/instagram-account-access/dist/cli.js login --input-json login.json
```

CLI 规则：

- `plan` 只生成计划，不初始化 SQLite，不加载 provider service。
- 执行命令通过 `AccountAccessService` 调用 provider 并写入 SQLite。
- 输出必须是结构化 JSON。
- 错误输出必须脱敏。
- 非插件式底座优先通过 CLI 调用账号接入能力。

CLI 常用环境变量：

```text
INSTAGRAM_AIOGRAPI_REST_BASE_URL=http://127.0.0.1:8005
INSTAGRAM_AIOGRAPI_REST_TIMEOUT_MS=30000
INSTAGRAM_SESSION_STORE_SQLITE_PATH=instagram-session-store.sqlite
INSTAGRAM_SKILLS_SECRET_KEY=<secret>
INSTAGRAM_OFFICIAL_API_CONFIG_PATH=../api.yml
ZERNIO_API_KEY=<api-key>
ZERNIO_BASE_URL=https://zernio.com/api/v1
```

敏感登录输入第一版统一使用当前工作目录下的 `login.json` 文件传入 CLI，例如：

```powershell
node packages/instagram-account-access/dist/cli.js login --input-json login.json
```

不要把密码、验证码或 `sessionid` 写进命令行参数、聊天内容、普通日志或提交文件。

本地调试如需跳过真实加密，必须显式设置：

```text
INSECURE_PLAINTEXT_SECRET_ALLOWED=true
```

正式验收不应使用明文 secret 存储。

## aiograpi-rest Provider

包路径：

```text
packages/instagram-aiograpi-rest
```

适用场景：

- 个人账号或专业账号的普通登录路线。
- 密码登录、`sessionid` 登录、challenge 继续验证、relogin、settings 导出。
- aiograpi-rest 已支持的资料编辑、Reel 搜索、媒体读取、点赞、评论和上传等 API。

配置：

```text
INSTAGRAM_AIOGRAPI_REST_BASE_URL=http://127.0.0.1:8005
session header=X-Session-ID
```

TS client 入口：

```ts
import {
  createAiograpiRestAuthClient,
  createAiograpiRestClient
} from "@instagram-skills/instagram-aiograpi-rest";
```

Cordis plugin 入口：

```ts
import { apply } from "@instagram-skills/instagram-aiograpi-rest/plugin";
```

该 plugin 会通过 `instagram-cordis` 注册：

```text
ctx.instagram provider id = aiograpi-rest
```

本地 smoke：

```powershell
pnpm --filter @instagram-skills/instagram-aiograpi-rest smoke:local
```

真实登录优先走 `instagram-account-access` CLI/service，不建议让 agent 直接散调 provider auth client。

## official-api Provider

包路径：

```text
packages/instagram-official-api
```

适用场景：

- 专业账号官方授权路线。
- 通过 Zernio API 创建 profile。
- 生成 Instagram 授权链接。
- 完成 OAuth callback。
- Facebook Login 场景下选择账号。
- 检查账号健康状态。
- 通过官方授权能力进行 feed、carousel、story、reel 发布或定时发布。

配置方式：

- CLI 可通过 `--zernio-config api.yml` 显式传入。
- 也可通过 `INSTAGRAM_OFFICIAL_API_CONFIG_PATH` 指定。
- 如果当前工作目录存在 `api.yml`，`account-access` CLI 的 official 执行命令会自动发现。
- 也可直接使用 `ZERNIO_API_KEY`、`ZERNIO_BASE_URL` 环境变量。

配置文件示例：

```yaml
zernioBaseUrl: https://zernio.com/api/v1
apiKey: ${ZERNIO_API_KEY}
requestTimeoutMs: 30000
```

包内模板：

```text
packages/instagram-official-api/api.example.yml
```

TS client 入口：

```ts
import { createInstagramOfficialApiClient } from "@instagram-skills/instagram-official-api";
import { loadInstagramOfficialApiConfig } from "@instagram-skills/instagram-official-api/config-file";
```

Cordis plugin 入口：

```ts
import { apply } from "@instagram-skills/instagram-official-api/plugin";
```

该 plugin 会通过 `instagram-cordis` 注册：

```text
ctx.instagram provider id = official-api
```

不要提交真实 `api.yml` 或 Zernio token。`api.yml` 应使用 `${ZERNIO_API_KEY}` 引用环境变量，或只存在于本地未提交路径。

## connector MCP Adapter

包路径：

```text
packages/instagram-connector
```

适用场景：

- 通过已登录 Instagram App 的移动端运行环境执行 UI 自动化。
- API 路线不可用、账号类型不支持或接口能力不足时，作为 MCP 移动端操作路线。
- 为外部 `instagram-runtime-mcp-server` 提供 tool schema、side-effect 标记、runtime env 和 MCP stdio 启动配置。

当前状态：

- `instagram-connector` 不是账号登录 provider。
- `instagram-connector` 没有 CLI 入口。
- agent 服务应通过 MCP server 调用 connector tools。
- `instagram-video-interaction` 只生成互动计划和判断，不直接调用 connector。

TS 入口：

```ts
import {
  connectorTools,
  createInstagramConnectorMcpLaunchConfig,
  isConnectorSideEffectTool
} from "@instagram-skills/instagram-connector";
```

外部 MCP Server 默认位置：

```text
F:\facebook-connector-intern-source-0.3.28\artifacts\facebook-connector-intern-source-0.3.28
```

外部 MCP Server 构建和启动：

```powershell
cd F:\facebook-connector-intern-source-0.3.28\artifacts\facebook-connector-intern-source-0.3.28
.\gradlew.bat :instagram-runtime-mcp-server:installDist
powershell -NoProfile -ExecutionPolicy Bypass -File .\instagram-runtime-mcp-server\build\install\instagram-runtime-mcp-server\bin\instagram-runtime-mcp-server.ps1
```

常用运行环境变量：

```text
INSTAGRAM_MCP_ADB_SERIAL=emulator-5554
INSTAGRAM_MCP_ADB_PATH=<adb path>
INSTAGRAM_MCP_ARTIFACT_DIR=<artifact dir>
INSTAGRAM_MCP_COMMAND_TIMEOUT_MS=15000
INSTAGRAM_MCP_WAIT_TIMEOUT_MS=8000
INSTAGRAM_MCP_DEADLINE_MS=120000
```

当前 connector tools：

```text
instagram.app.open
instagram.debug.snapshot
instagram.debug.ocr
instagram.search.open
instagram.search.input
instagram.search.open_first_reel
instagram.reel.inspect
instagram.reel.collect_signals
instagram.reel.like
instagram.reel.comment
instagram.reel.next
```

`instagram.reel.like` 和 `instagram.reel.comment` 是副作用工具。agent 服务调用前必须取得明确确认。

connector 执行策略：

- 优先使用 XML 组件节点执行。
- XML 节点执行有限次重试失败后，使用截图识别推测坐标执行一次。
- 坐标兜底仍失败后，才声明降级结果。
- 如果 XML/可访问性节点与截图显示的页面状态冲突，agent 服务不应继续信任 XML 状态，应停止当前动作或改用截图/人工确认后的坐标兜底。

## 业务 skill 与执行侧关系

业务 skill 不直接执行 provider 或 connector：

```text
business SKILL.md
  -> 生成计划 / 参数草案 / 判断结果
  -> agent 服务决定是否执行
  -> account-access CLI、Cordis service、provider client 或 connector MCP
  -> provider / MCP 返回真实结果
  -> agent 服务写结构化日志和 eval 数据
```

典型对应关系：

- 账号登录/绑定：`instagram-account-access` skill 生成计划，执行走 `account-access` CLI/service。
- 资料设置：`instagram-profile-setup` 生成资料方案和编辑计划，执行由 agent 调 provider。
- 内容发布：`instagram-content-publish` 生成内容草稿和发布计划，执行由 agent 调 provider。
- 视频互动：`instagram-video-interaction` 生成互动计划、判断和评论草案，执行由 agent 调 connector MCP。
- 养号编排：`instagram-warmup-orchestrator` 生成总计划和汇总，不执行半小时 runner。

## 敏感信息规则

禁止在可见输出、普通日志、命令历史或提交文件中包含：

- Instagram 密码。
- 验证码。
- Instagram cookie `sessionid`。
- aiograpi settings。
- Zernio API key。
- OAuth code、access token、refresh token。
- cookie 或 authorization header。

真实执行应使用 `INSTAGRAM_SKILLS_SECRET_KEY` 加密落库。只有本地调试可显式开启 `INSECURE_PLAINTEXT_SECRET_ALLOWED=true`。

## 验收顺序

开发验收：

1. `pnpm validate:skills`
2. `pnpm build`
3. `pnpm test`

provider live 验收：

1. 确认 aiograpi-rest 服务已启动。
2. 运行 `pnpm --filter @instagram-skills/instagram-aiograpi-rest smoke:local`。
3. 确认 Zernio `api.yml` 或环境变量可用。
4. 使用 official-api 只读查询或账号绑定链路验收 Zernio。
5. 确认 connector MCP server 可构建、可启动、可暴露 tools。

account-access live 验收：

1. 先用 `instagram-account-access plan` 验证计划输出。
2. 再由 agent 服务在具备用户确认和安全凭据后调用执行命令。
3. 验证 SQLite 中写入 `session_refs` 和 provider 专属 session 表。
4. 验证输出和日志不泄露敏感字段。

如果用户只要求生成计划，不执行真实动作；如果用户要求真实调用，先确认所需服务、环境变量、SQLite 路径和敏感输入通道已经就绪。
