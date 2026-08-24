# instagram-aiograpi-rest 包设计与实现方案

## 目标

`instagram-aiograpi-rest` 是第一期优先实现的 Instagram provider/client 包，负责把 `instagram-core` 中定义的 `InstagramClient` 请求转换为 aiograpi-rest HTTP 调用，并返回统一结构化结果。

它的目标是跑通第一期真实执行路线：

```text
业务 skill/tool 包
  → InstagramClient
  → instagram-aiograpi-rest
  → aiograpi-rest HTTP 服务
```

在 Cordis 插件底座中，`plugin.ts` 子路径负责把创建好的 client 通过 `instagram` 包注册到 `ctx.instagram`。主入口只提供普通 TS client，不依赖 Cordis。

## 定位

`instagram-aiograpi-rest` 属于 provider/client 实现层。

```text
instagram-core
  → instagram-aiograpi-rest
  → aiograpi-rest 服务
```

在插件底座中：

```text
instagram-aiograpi-rest
  → provideInstagram(ctx, { id: "aiograpi-rest", client })
  → ctx.instagram
```

在无插件底座中：

```text
createAiograpiRestClient(config)
  → InstagramClient
```

## 职责

* 实现 `instagram-core` 的 `InstagramClient`
* 封装 aiograpi-rest HTTP 请求
* 将 `InstagramAccountRef.sessionRef` 转换为 aiograpi-rest 的会话标识
* 将 aiograpi-rest 响应转换为 `instagram-core` 的结果类型
* 将 HTTP/API 失败转换为 `InstagramProviderError`
* 在 `plugin.ts` 子路径中提供 Cordis provider 注册入口

## 非职责

* 不注册模型可见 tool
* 不生成账号名称、简介、头像、评论或发布内容
* 不做养号阶段判断或任务编排
* 不做多账号调度
* 不做 provider 自动切换
* 不做复杂风控恢复
* 不直接保存用户真实密码、Instagram cookie 或 access token

## 包依赖

### 允许依赖

* `@instagram-skills/instagram-core`
* `fetch` 或项目统一 HTTP client

### 插件子路径允许依赖

仅 `plugin.ts` / `./plugin` 子路径允许依赖：

* `@instagram-skills/instagram`
* Cordis 类型包

### 不允许依赖

* `instagram-profile-setup`
* `instagram-video-interaction`
* `instagram-content-publish`
* `instagram-warmup-orchestrator`
* `instagram-official-api`
* `instagram-connector`
* 浏览器自动化、移动端自动化 SDK

## 包路径建议

采用第三方 monorepo 方式开发，建议放在：

```text
instagram-skills/packages/instagram-aiograpi-rest
```

包名建议：

```text
@instagram-skills/instagram-aiograpi-rest
```

## 文件结构建议

```text
instagram-skills/packages/instagram-aiograpi-rest/
  package.json
  tsconfig.json
  src/
    index.ts
    config.ts
    client.ts
    http.ts
    mapper.ts
    plugin.ts
    errors.ts
```

## 模块职责

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 只导出 `createAiograpiRestClient`、配置类型和公开 client 类型，不导出插件入口，不依赖 Cordis 或 `@instagram-skills/instagram` |
| `config.ts` | 定义 aiograpi-rest 地址、超时等配置 |
| `client.ts` | 实现 `InstagramClient` |
| `http.ts` | 封装 HTTP 请求、Header、错误响应处理 |
| `mapper.ts` | 转换 core 请求/响应和 aiograpi-rest 字段 |
| `plugin.ts` | Cordis 插件入口，创建 client 并注册到 `ctx.instagram`，必须作为独立子路径导出 |
| `errors.ts` | 将 HTTP/API 错误映射为 `InstagramProviderError` |

## 导出边界

第一版明确拆分主入口和插件入口：

```text
@instagram-skills/instagram-aiograpi-rest
  → src/index.ts
  → createAiograpiRestClient / AiograpiRestConfig / public types
  → 不依赖 Cordis

@instagram-skills/instagram-aiograpi-rest/plugin
  → src/plugin.ts
  → apply(ctx, config)
  → 允许依赖 @instagram-skills/instagram 和 Cordis 类型
```

`index.ts` 不 re-export `plugin.ts`，避免普通 TS/Node agent 或无插件底座被 Cordis 依赖污染。

`package.json` exports 建议：

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./plugin": "./dist/plugin.js"
  }
}
```

## 配置设计

```ts
export interface AiograpiRestConfig {
  baseUrl: string;
  requestTimeoutMs: number;
}
```

第一版只保留必要配置：

* `baseUrl` 指向 aiograpi-rest 服务
* `requestTimeoutMs` 控制单次 HTTP 调用超时

不在第一版加入 provider 优先级、账号池、proxy 池、自动重试策略。

## session 设计

`instagram-core` 中的账号引用：

```ts
export interface InstagramAccountRef {
  accountId: InstagramAccountId;
  sessionRef: InstagramSessionRef;
}
```

在本包中，`sessionRef` 默认作为 aiograpi-rest 的 session id 使用，并通过 `X-Session-ID` 发送。

```text
InstagramAccountRef.sessionRef
  → X-Session-ID
  → aiograpi-rest
```

如果后续需要隐藏真实 session id，可以在本包内部增加映射：

```text
业务 sessionRef
  → provider 本地 session id
  → X-Session-ID
```

第一版不实现映射表，只要求调用方传入 provider 可识别的 `sessionRef`。

## 网络身份说明

用户稳定地址、设备信息、proxy、locale、timezone 应由 aiograpi-rest 服务侧或其运维初始化流程维护。

本包只负责携带 `sessionRef` 调用接口，不负责分配 proxy、不负责切换网络出口、不负责重新登录。

## client 创建方式

无插件底座直接创建 client。

```ts
import { createAiograpiRestClient } from "@instagram-skills/instagram-aiograpi-rest";

const instagram = createAiograpiRestClient({
  baseUrl: "http://localhost:8000",
  requestTimeoutMs: 30000,
});
```

该主入口不得引入 `plugin.ts`，因此不要求运行环境安装 Cordis 或 `@instagram-skills/instagram`。

## Cordis 插件入口

插件底座通过 `apply` 创建 client，并注册为默认 Instagram provider。

使用方只从 `./plugin` 子路径导入插件入口：

```ts
import { apply } from "@instagram-skills/instagram-aiograpi-rest/plugin";
```

`plugin.ts` 内部实现：

```ts
import type { Context } from "@deepseek-ai/cordis";
import { createAiograpiRestClient } from "@instagram-skills/instagram-aiograpi-rest";
import type { AiograpiRestConfig } from "@instagram-skills/instagram-aiograpi-rest";
import { provideInstagram } from "@instagram-skills/instagram";

export function apply(ctx: Context, config: AiograpiRestConfig): void {
  const client = createAiograpiRestClient(config);
  provideInstagram(ctx, {
    id: "aiograpi-rest",
    client,
  });
}
```

## 能力映射

第一版只实现 `instagram-core` 已定义的最小能力。

| core 能力 | aiograpi-rest 职责 | 说明 |
| --- | --- | --- |
| `profile.updateProfile` | 调用账号资料更新相关 HTTP 路由 | 具体字段以 aiograpi-rest OpenAPI 为准 |
| `media.searchVideos` | 调用搜索 / Reels 相关 HTTP 路由 | 返回结果映射为 `InstagramMediaItem[]` |
| `media.getMedia` | 调用媒体详情相关 HTTP 路由 | 缺失字段保持可选 |
| `media.likeMedia` | 调用点赞相关 HTTP 路由 | 成功后返回 `mediaId` 和 `actedAt` |
| `media.commentMedia` | 调用评论相关 HTTP 路由 | 成功后返回 `mediaId` 和 `actedAt` |
| `publish.publishContent` | 调用 photo / video / story / clip 上传路由 | `post / story / reel` 映射到对应上传能力 |
| `publish.getPublishStatus` | 调用媒体详情或发布结果查询路由 | 若 aiograpi-rest 无直接状态接口，第一版可返回 `unsupported_operation` |

具体 endpoint 不在方案文档中写死，开发时以 aiograpi-rest `/openapi.json` 为准。

## 素材处理

`InstagramAssetRef` 的 `uri` 第一版支持两类：

| `uri` 类型 | 处理方式 |
| --- | --- |
| HTTP/HTTPS URL | 优先调用 by URL 上传路由 |
| 本地文件路径 | 使用 multipart/form-data 上传 |

如果某种发布类型不支持当前素材组合，直接抛出 `InstagramProviderError("unsupported_operation")`。

## 素材规格校验

本包负责在调用 aiograpi-rest 上传或发布前，对可获取元数据的素材执行规格校验。无法在本包读取的素材元数据，由 aiograpi-rest 或 Instagram 返回错误后再映射为 `InstagramProviderError`。

第一版按发布类型校验以下规则：

| 类型 | 校验规则 |
| --- | --- |
| Post 图片 | 图片不超过 8MB；比例 4:5 到 1.91:1；JPEG 为官方 API 主要支持格式 |
| Post 视频 | 3 到 60 秒；不超过 100MB；比例 4:5 到 1.91:1 |
| Reels | 3 秒到 15 分钟；通常不超过 300MB；推荐 9:16；MP4/MOV，H.264/HEVC |
| Story 图片 | 图片不超过 8MB；推荐 9:16 |
| Story 视频 | 3 到 60 秒/条；不超过 100MB；推荐 9:16 |

本包本地校验发现素材规格不支持时，抛出 `InstagramProviderError("unsupported_operation")`。aiograpi-rest 或 Instagram 返回上传失败时，映射为 `InstagramProviderError("provider_request_failed")`。

## 错误处理

本包只做错误转换，不做恢复。

| 来源 | 映射结果 |
| --- | --- |
| 401 / session 无效 | `auth_required` |
| 429 / 限流 | `rate_limited` |
| endpoint 或能力缺失 | `unsupported_operation` |
| 本地素材规格不支持 | `unsupported_operation` |
| aiograpi-rest / Instagram 上传失败 | `provider_request_failed` |
| 其他 HTTP 或服务错误 | `provider_request_failed` |

错误向上抛给业务包或 agent，由上层决定是否停止、提示人工处理或稍后重试。

## 实现步骤

1. 新建 `@instagram-skills/instagram-aiograpi-rest` 包。
2. 定义 `AiograpiRestConfig`。
3. 实现 `requestAiograpiRest`，统一处理 `baseUrl`、`X-Session-ID`、超时和错误。
4. 实现 `createAiograpiRestClient(config): InstagramClient`。
5. 按 `profile / media / publish` 分组实现 core 接口。
6. 实现响应 mapper，把 aiograpi-rest 字段转成 core 类型。
7. 在 `src/plugin.ts` 实现 Cordis `apply(ctx, config)`，调用 `provideInstagram`。
8. 配置 package exports：主入口指向 `src/index.ts`，`./plugin` 子路径指向 `src/plugin.ts`。
9. 确认 `src/index.ts` 不 re-export `plugin.ts`。
10. 增加 mock HTTP 测试，覆盖成功、失败、能力不支持。
11. 增加可选本地 smoke 测试，连接本地 aiograpi-rest 服务验证最小读写链路。

## 验收场景

| 场景 | 用例 | 预期 |
| --- | --- | --- |
| client 创建 | 调用 `createAiograpiRestClient(config)` | 返回完整 `InstagramClient` |
| session 透传 | 调用任意能力并传入 `sessionRef` | HTTP 请求携带 `X-Session-ID` |
| 资料编辑 | 调用 `profile.updateProfile` | 请求发送到资料更新路由，返回 `accountId / updatedAt` |
| 视频搜索 | 调用 `media.searchVideos` | 返回 `InstagramMediaItem[]` |
| 点赞 | 调用 `media.likeMedia` | 成功返回 `mediaId / actedAt` |
| 评论 | 调用 `media.commentMedia` | 成功返回 `mediaId / actedAt` |
| 发布 post | 调用 `publish.publishContent({ type: "post" })` | 返回 `publishId / status / submittedAt` |
| 发布 story | 调用 `publish.publishContent({ type: "story" })` | 返回 `publishId / status / submittedAt` |
| 发布 reel | 调用 `publish.publishContent({ type: "reel" })` | 返回 `publishId / status / submittedAt` |
| 素材规格本地校验 | 上传前发现素材大小、时长、格式或比例不支持 | 抛出 `unsupported_operation` |
| 素材上传失败 | aiograpi-rest 或 Instagram 返回上传失败 | 抛出 `provider_request_failed` |
| 状态查询 | 调用 `publish.getPublishStatus` | 能查询则返回状态；不能查询则抛 `unsupported_operation` |
| 错误映射 | mock HTTP 返回 401 / 429 / 500 | 分别映射为 core 错误码 |
| 主入口导入 | 从 `@instagram-skills/instagram-aiograpi-rest` 导入 `createAiograpiRestClient` | 可创建 client，不加载 Cordis 或 `@instagram-skills/instagram` |
| Cordis 子路径导入 | 从 `@instagram-skills/instagram-aiograpi-rest/plugin` 导入 `apply` | 可启动插件入口并注册 `ctx.instagram` |
| Cordis 注册 | 启动 `./plugin` 插件入口 | `ctx.instagram` 指向 aiograpi-rest client |
| 依赖边界 | 编译本包 | 不依赖业务 skill 包或其他 provider |

## 验证标准

* 本包能完整实现 `InstagramClient`
* 本包可独立创建普通 `InstagramClient`
* 主入口不依赖 Cordis 或 `@instagram-skills/instagram`
* Cordis 插件入口只从 `./plugin` 子路径导出
* 本包可通过 `./plugin` 在 Cordis 中注册为 `ctx.instagram`
* 所有请求都通过 `sessionRef` 对应的 aiograpi-rest session 调用
* 发布素材规格由本包或 aiograpi-rest / Instagram 执行校验
* HTTP/API 失败时抛出 `InstagramProviderError`，不返回假成功
* 业务包不需要知道 aiograpi-rest endpoint 细节

## 第一版不做

* 不做登录 tool
* 不做 session 创建和导入界面
* 不做多账号调度
* 不做 proxy 池管理
* 不做自动重试和 Challenge 自动恢复
* 不做 provider fallback
* 不做 aiograpi-rest 全量 endpoint 封装

## 兼容说明

当前包是 TypeScript client/provider 包，适合 TS/Node agent 和 Cordis 插件底座。Python agent 不需要使用本包，可直接调用 aiograpi-rest HTTP 服务；后续如需统一跨语言协议，应新增 `instagram-protocol`。

## 参考来源

* aiograpi-rest README：https://github.com/subzeroid/aiograpi-rest/blob/main/README.md
* aiograpi-rest OpenAPI 入口：`/openapi.json`
