# instagram-skills

Instagram 养号 skills 的 TypeScript monorepo。

这个目录只承载可开发、可测试的 TS packages。总体方案、阶段计划和汇报文档放在仓库根目录的 `docs/` 下。

## 设计边界

业务 skill 只负责生成计划、内容、决策、参数草案或汇总结果。

正式执行、循环、等待、超时、中断、重试、状态管理、provider 选择和工具调用顺序由 agent 服务负责。

provider/client 包负责把结构化请求转换为具体 API 或 connector 调用，不包含业务编排。

## 包结构

```text
packages/
  instagram-core
  instagram-cordis
  instagram-session-store-sqlite
  instagram-aiograpi-rest
  instagram-official-api
  instagram-connector
  instagram-profile-setup
  instagram-content-publish
  instagram-video-interaction
  instagram-warmup-orchestrator
```

## 包职责

| 包 | 职责 | 当前状态 |
| --- | --- | --- |
| `instagram-core` | 通用 `InstagramClient` 接口、类型、错误码、branded id 构造函数 | 已实现并有测试 |
| `instagram-cordis` | Cordis `ctx.instagram` 声明和 provider 注册入口 | 已实现并有测试 |
| `instagram-session-store-sqlite` | `sessionRef` SQLite registry、provider session 表、结构化解析日志 | 已实现并有测试 |
| `instagram-aiograpi-rest` | aiograpi-rest provider/client，支持普通入口和 `./plugin` 入口 | 已对齐本地 aiograpi-rest 6.0.0 并有测试 |
| `instagram-official-api` | 基于 Zernio API 的官方发布 provider/client | 方案已更新，代码待实现 |
| `instagram-connector` | MCP connector，提供移动端 Instagram 操作 tools | 骨架阶段 |
| `instagram-profile-setup` | 账号资料生成和编辑计划 skill | 骨架阶段 |
| `instagram-content-publish` | 内容草稿、即时发布计划、定时发布计划、状态查询计划 skill | 骨架阶段 |
| `instagram-video-interaction` | 视频互动计划、判断、评论生成、日志汇总 skill | 骨架阶段 |
| `instagram-warmup-orchestrator` | 养号阶段判断、今日任务计划、执行日志汇总 skill | 骨架阶段 |

## Provider 路线

### aiograpi-rest

用于第一期普通账号 / 私有 API 路线。

当前本地服务配置：

```text
baseUrl: http://localhost:8005
session header: X-Session-ID
```

已对齐的真实路由包括：

* `PATCH /account`
* `PATCH /account/picture`
* `GET /search/reels`
* `GET /media`
* `POST /media/like`
* `POST /media/comment`
* `POST /photo/upload`
* `POST /photo/upload/by/url`
* `POST /video/upload`
* `POST /video/upload/by/url`
* `POST /clip/upload`
* `POST /clip/upload/by/url`
* `POST /story/upload`
* `POST /story/upload/by/url`

### official-api / Zernio

`instagram-official-api` 保留包名，但定位已改为通过 Zernio API 使用 Instagram 官方授权发布能力。

目标路线：

```text
InstagramClient
  → instagram-official-api
  → Zernio API
  → Instagram 官方发布能力
```

第一版重点实现 `POST /posts`，支持 feed、carousel、story、reel 和定时发布计划。

## sessionRef

`sessionRef` 是业务 skill、agent 服务和 provider 之间传递登录态或运行态引用的统一字段。

约束：

* 对业务 skill 始终是普通 `string`
* 不包含 access token、cookie、密码、ADB serial 等敏感细节
* 业务 skill 只透传，不解析、不保存、不打印
* agent 服务或 provider 执行层负责解析
* SQLite registry 表负责路由到 provider 专属 session 表

## 安装与命令

```bash
pnpm install
pnpm typecheck
pnpm test
```

构建全部包：

```bash
pnpm build
```

只测试 aiograpi-rest provider：

```bash
pnpm --filter @instagram-skills/instagram-aiograpi-rest test
```

检查本地 aiograpi-rest OpenAPI：

```bash
pnpm --filter @instagram-skills/instagram-aiograpi-rest smoke:local
```

`smoke:local` 默认访问 `http://localhost:8005`。如需覆盖：

```bash
$env:AIOGRAPI_REST_BASE_URL="http://localhost:8005"
pnpm --filter @instagram-skills/instagram-aiograpi-rest smoke:local
```

## 当前验收重点

* 主入口不依赖 Cordis，Cordis 入口只从 `./plugin` 子路径导出。
* 不支持能力必须明确抛出 `NOT_IMPLEMENTED` 或 `unsupported_operation`，不能返回假成功。
* 业务 skill 包必须提供职责明确的 `SKILL.md`。
* 业务 skill 不直接调用 provider、MCP 或 `ctx.instagram`。
* 结构化输出需要能服务日志、benchmark 和 agent eval。

## 相关文档

| 文档 | 说明 |
| --- | --- |
| `../docs/Instagram养号skills三天实现计划.md` | 三天分阶段实现计划 |
| `../docs/plans/Instagram养号skills包设计总览.md` | 总体分层、兼容方式、包职责 |
| `../docs/plans/sessionRef设计与实现方案.md` | sessionRef 和 SQLite 存储设计 |
| `../docs/plans/instagram-aiograpi-rest包设计与实现方案.md` | aiograpi-rest provider 方案 |
| `../docs/plans/instagram-official-api包设计与实现方案.md` | Zernio 官方发布 provider 方案 |
