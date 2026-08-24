# instagram-official-api 包设计与实现方案

## 目标

`instagram-official-api` 是官方 Instagram API provider/client 包，负责把 `instagram-core` 中定义的 `InstagramClient` 请求转换为 Meta / Instagram 官方 API 调用。

它的目标是为专业账号提供更低风险的官方发布路线。

```text
业务 skill/tool 包
  → InstagramClient
  → instagram-official-api
  → Meta / Instagram 官方 API
```

在 Cordis 插件底座中，它可以通过 `instagram` 包注册到 `ctx.instagram`。

## 定位

`instagram-official-api` 属于 provider/client 实现层。

```text
instagram-core
  → instagram-official-api
  → Meta / Instagram 官方 API
```

在插件底座中：

```text
instagram-official-api
  → provideInstagram(ctx, { id: "official-api", client })
  → ctx.instagram
```

在无插件底座中：

```text
createInstagramOfficialApiClient(config)
  → InstagramClient
```

## 职责

* 实现 `instagram-core` 的 `InstagramClient`
* 封装 Meta / Instagram 官方 API 请求
* 将 `InstagramAccountRef.sessionRef` 解析为官方 API 可用的授权信息
* 将官方 API 响应转换为 `instagram-core` 的结果类型
* 将官方 API 错误转换为 `InstagramProviderError`
* 在 Cordis 场景下调用 `provideInstagram` 注册 provider
* 对官方 API 发布素材规格执行 provider 层校验

## 非职责

* 不注册模型可见 tool
* 不生成账号名称、简介、头像、评论或发布内容
* 不做养号阶段判断或任务编排
* 不做普通个人账号能力兜底
* 不做搜索同类型视频、点赞、评论等养号互动路线
* 不做 provider 自动切换
* 不做完整 OAuth 授权页面
* 不直接保存用户真实密码

## 包依赖

### 允许依赖

* `@instagram-skills/instagram-core`
* `@instagram-skills/instagram`
* `fetch` 或项目统一 HTTP client
* Cordis 类型包，仅用于插件注册入口

### 不允许依赖

* `instagram-profile-setup`
* `instagram-video-interaction`
* `instagram-content-publish`
* `instagram-warmup-orchestrator`
* `instagram-aiograpi-rest`
* `instagram-connector`
* 浏览器自动化、移动端自动化 SDK

## 包路径建议

采用第三方 monorepo 方式开发，建议放在：

```text
instagram-skills/packages/instagram-official-api
```

包名建议：

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
    auth.ts
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
| `index.ts` | 导出 client 创建函数和配置类型，不依赖 Cordis 或 `@instagram-skills/instagram` |
| `config.ts` | 定义 Graph API 版本、请求超时等配置 |
| `client.ts` | 实现 `InstagramClient` |
| `auth.ts` | 根据 `sessionRef` 获取 access token 和 IG user id |
| `http.ts` | 封装官方 API 请求、超时、错误响应处理 |
| `mapper.ts` | 转换 core 请求/响应和官方 API 字段 |
| `publish.ts` | 实现官方 API 发布流程 |
| `limits.ts` | 定义官方 API 发布素材限制 |
| `plugin.ts` | Cordis 插件入口，必须作为独立子路径导出 |
| `errors.ts` | 将官方 API 错误映射为 `InstagramProviderError` |

## 配置设计

```ts
export interface InstagramOfficialApiConfig {
  graphBaseUrl: string;
  apiVersion: string;
  requestTimeoutMs: number;
}
```

第一版只保留必要配置：

* `graphBaseUrl` 默认指向 Meta Graph API
* `apiVersion` 固定使用部署时验证过的官方 API 版本
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

在本包中，`sessionRef` 表示官方 API 授权引用。provider 通过 `sessionRef` 解析：

```text
InstagramAccountRef.sessionRef
  → access token
  → IG user id
  → Meta / Instagram 官方 API
```

第一版不实现完整 OAuth 授权页面，只要求外部系统已完成授权，并能通过 `sessionRef` 提供有效 token 和 IG user id。

## 账号限制

官方 API 只服务 Instagram 专业账号场景。普通个人账号不由本包解决。

需要满足：

* Instagram 专业账号，通常是 Business 或 Creator
* Meta Developer App 已配置 Instagram API
* 授权用户已完成对应权限授权
* 生产环境使用前需要完成 Meta App Review

如果账号类型、授权或权限不满足要求，本包抛出 `InstagramProviderError("auth_required")` 或 `InstagramProviderError("unsupported_operation")`。

## 权限范围

第一版只围绕内容发布能力设计。

| 能力 | 所需权限方向 |
| --- | --- |
| 基础账号信息 | `instagram_business_basic` |
| 内容发布 | `instagram_business_content_publish` |
| 评论管理，后续可选 | `instagram_business_manage_comments` 或官方当前要求的评论权限 |

权限命名和授权方式以 Meta 官方文档和当前 App Review 要求为准。

## client 创建方式

无插件底座直接创建 client。

```ts
import { createInstagramOfficialApiClient } from "@instagram-skills/instagram-official-api";

const instagram = createInstagramOfficialApiClient({
  graphBaseUrl: "https://graph.facebook.com",
  apiVersion: "v24.0",
  requestTimeoutMs: 30000,
});
```

## Cordis 插件入口

插件底座通过 `apply` 创建 client，并注册为官方 API provider。

```ts
import type { Context } from "@deepseek-ai/cordis";
import { provideInstagram } from "@instagram-skills/instagram";

export function apply(ctx: Context, config: InstagramOfficialApiConfig): void {
  const client = createInstagramOfficialApiClient(config);
  provideInstagram(ctx, {
    id: "official-api",
    client,
  });
}
```

## 能力映射

第一版只稳定实现官方 API 覆盖明确的发布能力。`InstagramClient` 中官方 API 不覆盖的能力需要实现为明确失败。

| core 能力 | 官方 API 职责 | 第一版处理 |
| --- | --- | --- |
| `profile.updateProfile` | 官方 API 不作为账号资料编辑主路线 | 抛出 `unsupported_operation` |
| `media.searchVideos` | 官方 API 不支持任意关键词搜索同类型视频 | 抛出 `unsupported_operation` |
| `media.getMedia` | 读取授权账号可访问的媒体详情 | 可选实现 |
| `media.likeMedia` | 官方 API 不作为养号点赞路线 | 抛出 `unsupported_operation` |
| `media.commentMedia` | 评论能力受账号、媒体归属和权限限制 | 第一版默认抛出 `unsupported_operation` |
| `publish.publishContent` | 创建 media container 并 publish | 第一版重点实现 |
| `publish.getPublishStatus` | 查询 container 或 media 状态 | 第一版实现 |

## 发布流程

官方 API 发布采用 container 模型。

```text
1. 根据发布类型创建 media container
2. 对视频 / Reels 轮询 container 处理状态
3. container 可发布后调用 media_publish
4. 返回发布结果
```

第一版支持：

| 类型 | 处理方式 |
| --- | --- |
| `post` 图片 | 创建图片 container 后发布 |
| `post` 视频 | 创建视频 container，等待处理完成后发布 |
| `story` 图片 / 视频 | 创建 story container 后发布 |
| `reel` 视频 | 创建 Reels container，等待处理完成后发布 |

第一版不做 carousel。

## 素材处理

官方 API 标准发布流程通常要求 Meta 服务器可访问素材 URL。

| `uri` 类型 | 第一版处理 |
| --- | --- |
| HTTP/HTTPS URL | 直接作为官方 API 可拉取素材 URL |
| 本地文件路径 | 抛出 `unsupported_operation`，由上层先上传到可公开访问的对象存储 |

本包不负责对象存储上传。

## 素材规格校验

本包负责在调用官方 API 前，对可获取元数据的素材执行规格校验。无法在本包读取的素材元数据，由官方 API 返回错误后再映射为 `InstagramProviderError`。

第一版按官方 API 发布限制校验以下规则：

| 类型 | 校验规则 |
| --- | --- |
| Post 图片 | 图片不超过 8MB；比例 4:5 到 1.91:1；优先 JPEG |
| Post 视频 | 3 到 60 秒；不超过 100MB；比例 4:5 到 1.91:1 |
| Reels | 3 秒到 15 分钟；通常不超过 300MB；推荐 9:16；MP4/MOV，H.264/HEVC |
| Story 图片 | 图片不超过 8MB；推荐 9:16 |
| Story 视频 | 3 到 60 秒/条；不超过 100MB；推荐 9:16 |

本包本地校验发现素材规格不支持时，抛出 `InstagramProviderError("unsupported_operation")`。官方 API 返回上传或发布失败时，映射为 `InstagramProviderError("provider_request_failed")`。

## 状态查询

`publish.getPublishStatus` 第一版只用于查询官方 API container 或已发布 media 的状态。

状态映射：

| 官方状态 | core 状态 |
| --- | --- |
| processing / in progress | `submitted` |
| finished / published | `published` |
| error / expired | `failed` |

如果官方 API 当前 endpoint 不支持所需状态查询，抛出 `InstagramProviderError("unsupported_operation")`。

## 错误处理

本包只做错误转换，不做恢复。

| 来源 | 映射结果 |
| --- | --- |
| token 缺失、过期、权限不足 | `auth_required` |
| rate limit / API quota | `rate_limited` |
| 账号类型不支持 | `unsupported_operation` |
| 本地素材规格不支持 | `unsupported_operation` |
| 本地文件路径无法直发 | `unsupported_operation` |
| 官方 API 上传或发布失败 | `provider_request_failed` |
| 其他 HTTP 或服务错误 | `provider_request_failed` |

错误向上抛给业务包或 agent，由上层决定是否停止、提示人工授权、切换 provider 或稍后重试。

## 实现步骤

1. 新建 `@instagram-skills/instagram-official-api` 包。
2. 定义 `InstagramOfficialApiConfig`。
3. 定义授权解析接口，根据 `sessionRef` 获取 token 和 IG user id。
4. 实现 `requestInstagramOfficialApi`，统一处理 API 版本、token、超时和错误。
5. 实现 `createInstagramOfficialApiClient(config): InstagramClient`。
6. 优先实现 `publish.publishContent` 和 `publish.getPublishStatus`。
7. 对不支持的 core 能力返回 `unsupported_operation`。
8. 实现官方 API 响应 mapper。
9. 实现 Cordis `apply(ctx, config)`，调用 `provideInstagram`。
10. 增加 mock HTTP 测试，覆盖发布成功、状态查询、权限失败、素材规格失败。

## 验收场景

| 场景 | 用例 | 预期 |
| --- | --- | --- |
| client 创建 | 调用 `createInstagramOfficialApiClient(config)` | 返回完整 `InstagramClient` |
| session 解析 | 调用发布能力并传入 `sessionRef` | 能解析 access token 和 IG user id |
| post 图片发布 | 发布 HTTP 图片素材 | 返回 `publishId / status / submittedAt` |
| post 视频发布 | 发布 HTTP 视频素材 | 创建 container、等待处理、发布 |
| story 发布 | 发布 story 图片或视频素材 | 返回发布结果 |
| reel 发布 | 发布 HTTP 视频素材为 Reels | 返回发布结果 |
| 本地文件拒绝 | 传入本地文件路径 | 抛出 `unsupported_operation` |
| 素材规格本地校验 | 上传前发现素材大小、时长、格式或比例不支持 | 抛出 `unsupported_operation` |
| 官方 API 发布失败 | 官方 API 返回发布失败 | 抛出 `provider_request_failed` |
| 状态查询 | 输入 `publishId` | 返回 core 发布状态 |
| 不支持能力 | 调用 `profile.updateProfile` 或 `media.likeMedia` | 抛出 `unsupported_operation` |
| Cordis 注册 | 启动插件入口 | `ctx.instagram` 指向 official-api client |
| 依赖边界 | 编译本包 | 不依赖业务 skill 包或其他 provider |

## 验证标准

* 本包能完整实现 `InstagramClient` 类型
* 本包可独立创建普通 `InstagramClient`
* 本包可在 Cordis 中注册为 `ctx.instagram`
* 发布能力只通过官方 API 调用
* 不支持的 core 能力明确抛出 `unsupported_operation`
* 授权失败、权限不足、rate limit、发布失败能映射为 core 错误码
* 业务包不需要知道官方 API endpoint 细节

## 第一版不做

* 不做完整 OAuth 授权页面
* 不做 token 存储系统
* 不做对象存储上传
* 不做 carousel
* 不做账号资料编辑
* 不做搜索、点赞、养号互动
* 不做评论管理
* 不做 provider fallback
* 不做官方 API 全量 endpoint 封装

## 兼容说明

当前包是 TypeScript client/provider 包，适合 TS/Node agent 和 Cordis 插件底座。Python agent 不需要直接使用本包；后续如需跨语言复用，应通过 `instagram-protocol` 和 `instagram-skills-server` 暴露官方 API provider 能力。

## 参考来源

* Meta Instagram Platform Overview：https://developers.facebook.com/documentation/instagram-platform/overview
* Meta Instagram API with Instagram Login：https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login
* Meta Content Publishing：https://developers.facebook.com/documentation/instagram-platform/content-publishing
* Meta Permissions Reference：https://developers.facebook.com/docs/permissions/
