# instagram-official-api 包设计与实现方案

## 目标

`instagram-official-api` 是基于 Zernio API 实现的 Instagram 官方合规发布 provider/client 包，负责把 `instagram-core` 中定义的 `InstagramClient` 请求转换为 Zernio API 调用。

它的目标是为 Instagram Business / Creator 账号提供更低风险、支持定时发布的官方授权发布路线。

```text
业务 skill/tool 包
  → InstagramClient
  → instagram-official-api
  → Zernio API
  → Instagram 官方发布能力
```

在 Cordis 插件底座中，它可以通过 `instagram-cordis` 包注册到 `ctx.instagram`。

## 定位

`instagram-official-api` 属于 provider/client 实现层。

它不直接封装 Meta Graph API 的 container / media_publish 流程，而是通过 Zernio 已封装的官方授权能力完成 Instagram 发布。

包名继续使用 `instagram-official-api`，但语义明确为“通过 Zernio 使用 Instagram 官方授权能力”，不是直连 Meta Graph API provider。

## 职责

* 实现 `instagram-core` 的 `InstagramClient`
* 封装 Zernio API 请求
* 将 `InstagramAccountRef.sessionRef` 解析为 Zernio connected account 引用
* 将 Zernio 响应转换为 `instagram-core` 的结果类型
* 将 Zernio / Instagram 发布错误转换为 `InstagramProviderError`
* 在 `plugin.ts` 子路径中提供 Cordis provider 注册入口
* 对 Zernio 官方发布路线的素材规格执行 provider 层校验

## 非职责

* 不注册模型可见 tool
* 不生成账号名称、简介、头像、评论或发布内容
* 不做养号阶段判断或任务编排
* 不做普通个人账号能力兜底
* 不做搜索同类型视频、点赞等养号互动路线
* 不做 provider 自动切换
* 不做完整 OAuth 授权页面
* 不直接保存用户真实密码、Instagram cookie 或 Meta access token
* 不直接实现 Meta Graph API container / media_publish 细节

## 包依赖

### 允许依赖

* `@instagram-skills/instagram-core`
* `fetch` 或项目统一 HTTP client

### 插件子路径允许依赖

仅 `plugin.ts` / `./plugin` 子路径允许依赖：

* `@instagram-skills/instagram-cordis`
* Cordis 类型包

### 不允许依赖

* `instagram-profile-setup`
* `instagram-video-interaction`
* `instagram-content-publish`
* `instagram-warmup-orchestrator`
* `instagram-aiograpi-rest`
* `instagram-connector`
* 浏览器自动化、移动端自动化 SDK

## 包路径建议

```text
instagram-skills/packages/instagram-official-api
```

包名：

```text
@instagram-skills/instagram-official-api
```

## 文件结构建议

```text
instagram-skills/packages/instagram-official-api/
  package.json
  tsconfig.json
  src/
    index.ts
    config.ts
    client.ts
    account.ts
    http.ts
    mapper.ts
    publish.ts
    limits.ts
    plugin.ts
    errors.ts
```

## 模块职责

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 导出 client 创建函数和配置类型，不依赖 Cordis 或 `@instagram-skills/instagram-cordis` |
| `config.ts` | 定义 Zernio API 地址、API key、请求超时等配置 |
| `client.ts` | 实现 `InstagramClient` |
| `account.ts` | 根据 `sessionRef` 获取 Zernio connected account id |
| `http.ts` | 封装 Zernio API 请求、Authorization、超时和错误响应处理 |
| `mapper.ts` | 转换 core 请求/响应和 Zernio 字段 |
| `publish.ts` | 实现 Zernio 发布和定时发布请求构造 |
| `limits.ts` | 定义 Zernio / Instagram 发布素材限制 |
| `plugin.ts` | Cordis 插件入口，必须作为独立子路径导出 |
| `errors.ts` | 将 Zernio API 错误映射为 `InstagramProviderError` |

## 导出边界

第一版明确拆分主入口和插件入口：

```text
@instagram-skills/instagram-official-api
  → src/index.ts
  → createInstagramOfficialApiClient / config / public types
  → 不依赖 Cordis

@instagram-skills/instagram-official-api/plugin
  → src/plugin.ts
  → apply(ctx, config)
  → 允许依赖 @instagram-skills/instagram-cordis 和 Cordis 类型
```

`index.ts` 不 re-export `plugin.ts`，避免普通 TS/Node agent 或无插件底座被 Cordis 依赖污染。

## 配置设计

```ts
export interface InstagramOfficialApiConfig {
  zernioBaseUrl: string;
  apiKey: string;
  requestTimeoutMs: number;
}
```

第一版只保留必要配置：

* `zernioBaseUrl` 默认指向 `https://zernio.com/api/v1`
* `apiKey` 用于 `Authorization: Bearer <apiKey>`
* `requestTimeoutMs` 控制单次 HTTP 调用超时

不在第一版加入 provider 优先级、账号池、自动重试策略。

## 授权设计

`instagram-core` 中的账号引用：

```ts
export interface InstagramAccountRef {
  accountId: InstagramAccountId;
  sessionRef: InstagramSessionRef;
}
```

在本包中，`sessionRef` 表示 Zernio connected account 引用。provider 通过 `sessionRef` 解析：

```text
InstagramAccountRef.sessionRef
  → Zernio connected account id
  → POST /posts platforms[].accountId
```

Zernio API 请求使用系统级 `apiKey`：

```text
Authorization: Bearer <ZERNIO_API_KEY>
```

Instagram OAuth、Meta access token、token 刷新、账号断连状态由 Zernio 平台维护。本包不直接接触 Meta access token。

第一版可以约定 `sessionRef` 直接等于 Zernio `accountId`；如果后续需要隐藏真实 Zernio account id，再通过 `sessionRef` 存储机制映射。

## 账号限制

Zernio 的 Instagram 官方能力只服务 Instagram Business / Creator 账号。Personal account 不能通过 API 发布。

需要满足：

* Instagram Business 或 Creator 账号
* 账号已通过 Zernio 完成连接
* 授权范围包含发布能力
* 媒体 URL 可被 Zernio / Instagram 服务器公开访问

如果账号类型、授权或权限不满足要求，本包抛出 `InstagramProviderError("auth_required")` 或 `InstagramProviderError("unsupported_operation")`。

## 权限范围

Zernio 支持两类 Instagram 连接方式。

| 连接方式 | 说明 |
| --- | --- |
| Instagram Login | 直接授权 Instagram professional account，使用 `instagram_business_*` 权限族 |
| Facebook Login | 通过 Facebook Page 连接关联 Instagram professional account，使用 `instagram_*` 和 Page 权限 |

第一版只围绕内容发布能力设计。Zernio 侧需要具备：

| 能力 | 权限方向 |
| --- | --- |
| 基础账号信息 | `instagram_business_basic` 或 `instagram_basic` |
| 内容发布 | `instagram_business_content_publish` 或 `instagram_content_publish` |

评论、私信、分析能力由 Zernio 支持，但不纳入第一版 `InstagramClient` provider 实现。

## client 创建方式

无插件底座直接创建 client。

```ts
import { createInstagramOfficialApiClient } from "@instagram-skills/instagram-official-api";

const instagram = createInstagramOfficialApiClient({
  zernioBaseUrl: "https://zernio.com/api/v1",
  apiKey: process.env.ZERNIO_API_KEY!,
  requestTimeoutMs: 30000,
});
```

## Cordis 插件入口

插件底座通过 `apply` 创建 client，并注册为官方发布 provider。

```ts
import type { Context } from "@deepseek-ai/cordis";
import { provideInstagram } from "@instagram-skills/instagram-cordis";

export function apply(ctx: Context, config: InstagramOfficialApiConfig): void {
  const client = createInstagramOfficialApiClient(config);
  provideInstagram(ctx, {
    id: "official-api",
    client,
  });
}
```

## 能力映射

第一版只稳定实现 Zernio 覆盖明确的发布能力。`InstagramClient` 中 Zernio 官方路线不覆盖的能力需要实现为明确失败。

| core 能力 | Zernio 职责 | 第一版处理 |
| --- | --- | --- |
| `profile.updateProfile` | Zernio 文档当前不作为资料编辑主路线 | 抛出 `unsupported_operation` |
| `media.searchVideos` | Zernio 官方发布路线不支持任意关键词搜索同类型视频 | 抛出 `unsupported_operation` |
| `media.getMedia` | 可通过 Zernio post / analytics 方向后续扩展 | 第一版默认抛出 `unsupported_operation` |
| `media.likeMedia` | 官方 API 不作为养号点赞路线 | 抛出 `unsupported_operation` |
| `media.commentMedia` | Zernio 支持评论 / 回复能力，但不作为第一期养号互动路线 | 第一版默认抛出 `unsupported_operation` |
| `publish.publishContent` | 调用 Zernio `POST /posts` 创建即时或定时发布 | 第一版重点实现 |
| `publish.getPublishStatus` | 查询 Zernio post 状态，具体 endpoint 以后续 API Reference 为准 | 第一版可实现；若 endpoint 未确认则抛 `unsupported_operation` |

## 发布流程

Zernio 发布采用统一 post 创建模型。

```text
1. 校验账号引用和素材规格
2. 将 core 请求映射为 Zernio create post payload
3. POST /posts
4. Zernio 负责调用 Instagram 官方发布能力
5. 返回 Zernio post id 和发布状态
```

Zernio 请求核心结构：

```json
{
  "content": "caption text",
  "mediaItems": [
    { "type": "image", "url": "https://cdn.example.com/photo.jpg" }
  ],
  "platforms": [
    {
      "platform": "instagram",
      "accountId": "ZERNIO_ACCOUNT_ID",
      "platformSpecificData": {}
    }
  ],
  "publishNow": true
}
```

第一版支持：

| core 类型 | Zernio 映射 |
| --- | --- |
| `post` + 1 个图片 | Feed image post |
| `post` + 1 个视频 | Feed video post，或 Zernio 默认视频发布行为 |
| `post` + 多个素材 | Carousel，最多 10 个素材 |
| `story` | `platformSpecificData.contentType = "story"` |
| `reel` | 单视频 Reel，`platformSpecificData.shareToFeed` 默认 `true` |

## 定时发布

Zernio 支持 Scheduling，因此本包应实现 `scheduledAt` 映射。

处理规则：

| core 字段 | Zernio 映射 |
| --- | --- |
| `scheduledAt` 为空 | `publishNow: true` |
| `scheduledAt` 有值 | `publishNow: false`，并传入 Zernio 对应计划发布时间字段 |

计划发布时间字段名以后续 Zernio Posts API Reference 为准。实现前需要确认字段名；如果 API Reference 暂不可用，第一版可以先保留 `scheduledAt` 映射 TODO，但不应再声明“定时发布未实现”。

## 素材处理

Zernio 发布要求媒体 URL 可被平台和 Instagram 服务器访问。

| `uri` 类型 | 第一版处理 |
| --- | --- |
| HTTP/HTTPS URL | 直接映射为 Zernio `mediaItems[].url` |
| 本地文件路径 | 抛出 `unsupported_operation`，由上层先上传到可公开访问的对象存储或 Zernio media endpoint |

本包第一版不负责对象存储上传。后续如果接入 Zernio media upload endpoint，可增加：

```text
local file
  → Zernio media upload
  → public/media url
  → POST /posts
```

媒体 URL 必须是公开直链，不能是返回 HTML 页面或需要鉴权的分享链接。

明确不支持作为媒体 URL：

* Google Drive 分享链接
* Dropbox 分享链接
* OneDrive / SharePoint 分享链接
* iCloud 分享链接

## 素材规格校验

本包负责在调用 Zernio 前，对调用方已提供元数据的素材执行规格校验。无法在本包读取的素材元数据，由 Zernio 或 Instagram 返回错误后再映射为 `InstagramProviderError`。

第一版按 Zernio Instagram 发布限制校验以下规则：

| 类型 | 校验规则 |
| --- | --- |
| Feed 图片 | JPEG / PNG；不超过 8MB；比例 4:5 到 1.91:1 |
| Feed 视频 | MP4 / MOV；3 秒到 60 分钟；不超过 300MB；比例 4:5 到 1.91:1 |
| Carousel | 最多 10 个素材；图片 JPEG / PNG；视频 MP4 / MOV；建议素材比例一致 |
| Reels | 单个视频；MP4 / MOV；3 秒到 90 秒；不超过 300MB；推荐 9:16 |
| Story 图片 | JPEG / PNG；不超过 8MB；推荐 9:16 |
| Story 视频 | MP4 / MOV；3 秒到 60 秒；不超过 100MB；推荐 9:16 |

Zernio 文档说明超大媒体可能自动压缩，但本包仍应按明确规格做前置校验，避免无意义请求。

本包本地校验发现素材规格不支持时，抛出 `InstagramProviderError("unsupported_operation")`。Zernio 或 Instagram 返回上传 / 发布失败时，映射为 `InstagramProviderError("provider_request_failed")`。

## 平台特有字段

第一版仅保留必要映射，后续按业务需要扩展。

| Zernio 字段 | 说明 | 第一版处理 |
| --- | --- | --- |
| `contentType` | Story 需要设置为 `"story"` | `type: "story"` 时设置 |
| `shareToFeed` | Reels 是否同时展示到 feed | `type: "reel"` 默认 `true` |
| `isAiGenerated` | AI 生成媒体标签 | 后续可通过扩展字段支持 |
| `firstComment` | Feed / carousel 首条评论 | 后续可支持 |
| `collaborators` | 协作者，最多 3 个 | 后续可支持 |
| `userTags` | 用户标签 | 后续可支持 |
| `audioConfiguration` | Reels 音频配置 | 后续可支持；需要 Facebook Login |

## 状态查询

`publish.getPublishStatus` 第一版用于查询 Zernio post 的发布状态。

状态映射建议：

| Zernio 状态 | core 状态 |
| --- | --- |
| queued / scheduled / processing | `submitted` |
| published / posted | `published` |
| failed / rejected | `failed` |

具体查询 endpoint 以后续 Zernio Posts API Reference 为准。如果当前 endpoint 未确认，`publish.getPublishStatus` 应明确抛出 `InstagramProviderError("unsupported_operation")`，不能返回假成功。

## 错误处理

本包只做错误转换，不做恢复。

| 来源 | 映射结果 |
| --- | --- |
| Zernio API key 缺失、无效 | `auth_required` |
| connected account 断连、token 过期 | `auth_required` |
| rate limit / API quota / 100 posts per 24h | `rate_limited` |
| 账号类型不支持，非 Business / Creator | `unsupported_operation` |
| 本地素材规格不支持 | `unsupported_operation` |
| 本地文件路径无法直发 | `unsupported_operation` |
| 媒体 URL 不可抓取或返回 HTML | `provider_request_failed` |
| Instagram blocked request / duplicate content | `provider_request_failed` |
| Zernio 或 Instagram 发布失败 | `provider_request_failed` |
| 其他 HTTP 或服务错误 | `provider_request_failed` |

错误向上抛给业务包或 agent，由上层决定是否停止、提示人工授权、切换 provider 或稍后重试。

## 实现步骤

1. 更新 `@instagram-skills/instagram-official-api` 包配置类型为 Zernio 配置。
2. 定义 `sessionRef → Zernio accountId` 解析接口。
3. 实现 Zernio HTTP client，统一处理 `baseUrl`、`Authorization`、JSON、超时和错误映射。
4. 实现 `createInstagramOfficialApiClient(config): InstagramClient`。
5. 优先实现 `publish.publishContent`。
6. 实现 `scheduledAt` 到 Zernio 定时发布字段的映射。
7. 对不支持的 core 能力返回 `unsupported_operation`。
8. 实现 Zernio 响应 mapper。
9. 在 `src/plugin.ts` 实现 Cordis `apply(ctx, config)`，调用 `provideInstagram`。
10. 增加 mock HTTP 测试，覆盖即时发布、定时发布、carousel、权限失败、素材规格失败。
11. 增加可选 Zernio API smoke test，确认 API key 和 accountId 可用时能访问真实服务。

## 验收场景

| 场景 | 用例 | 预期 |
| --- | --- | --- |
| client 创建 | 调用 `createInstagramOfficialApiClient(config)` | 返回完整 `InstagramClient` |
| session 解析 | 调用发布能力并传入 `sessionRef` | 能解析 Zernio accountId |
| API 鉴权 | 发起请求 | HTTP 请求携带 `Authorization: Bearer <apiKey>` |
| Feed 图片发布 | 发布 HTTP 图片素材 | 调用 Zernio `POST /posts`，返回 `publishId / status / submittedAt` |
| Feed 视频发布 | 发布 HTTP 视频素材 | 调用 Zernio `POST /posts` |
| Carousel 发布 | `type: "post"` 且多素材 | 映射为 Zernio carousel |
| Story 发布 | `type: "story"` | 设置 `platformSpecificData.contentType = "story"` |
| Reel 发布 | `type: "reel"` | 单视频发布为 Reel |
| 定时发布 | 传入 `scheduledAt` | 映射为 Zernio scheduling 请求 |
| 本地文件拒绝 | 传入本地文件路径 | 抛出 `unsupported_operation` |
| 非直链 URL 风险 | 传入常见网盘分享链接 | 抛出 `unsupported_operation` 或由 Zernio 失败后映射 |
| 素材规格本地校验 | 上传前发现素材大小、时长、格式或比例不支持 | 抛出 `unsupported_operation` |
| Zernio 发布失败 | Zernio 返回发布失败 | 抛出 `provider_request_failed` |
| 状态查询 | 输入 `publishId` | 能查询则返回 core 状态；不能查询则抛 `unsupported_operation` |
| 不支持能力 | 调用 `profile.updateProfile` 或 `media.likeMedia` | 抛出 `unsupported_operation` |
| Cordis 注册 | 启动插件入口 | `ctx.instagram` 指向 official-api client |
| 依赖边界 | 编译本包 | 主入口不依赖业务 skill 包、其他 provider 或 Cordis |

## 验证标准

* 本包能完整实现 `InstagramClient` 类型
* 本包可独立创建普通 `InstagramClient`
* 主入口不依赖 Cordis 或 `@instagram-skills/instagram-cordis`
* 本包可通过 `./plugin` 在 Cordis 中注册为 `ctx.instagram`
* 发布能力只通过 Zernio API 调用
* 不支持的 core 能力明确抛出 `unsupported_operation`
* 授权失败、权限不足、rate limit、发布失败能映射为 core 错误码
* 业务包不需要知道 Zernio endpoint 细节

## 第一版不做

* 不做完整 OAuth 授权页面
* 不做 Zernio account connect 流程
* 不做 token 存储系统
* 不做对象存储上传
* 不做 Zernio media upload endpoint
* 不做账号资料编辑
* 不做搜索、点赞、养号互动
* 不做评论管理
* 不做 inbox / DM
* 不做 analytics
* 不做 provider fallback
* 不做 Zernio 全量 endpoint 封装

## 兼容说明

当前包是 TypeScript client/provider 包，适合 TS/Node agent 和 Cordis 插件底座。Python agent 不需要直接使用本包；后续如需跨语言复用，应通过 `instagram-protocol` 和 `instagram-skills-server` 暴露 official-api provider 能力。

## 参考来源

* Zernio Instagram API Documentation：https://docs.zernio.com
* Zernio API Base URL：`https://zernio.com/api/v1`
