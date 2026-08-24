# instagram-core 包设计与实现方案

## 目标

`instagram-core` 是 Instagram 能力的通用接口包，负责定义账号、资料、媒体互动、内容发布等能力的 TypeScript 类型和 client 接口。

它的目标是让业务包、Cordis 适配包、provider 实现包使用同一套接口，避免具体业务直接绑定 `aiograpi-rest`、官方 API 或 connector。

## 定位

`instagram-core` 属于通用能力接口层。

```text
业务 skill/tool 包
  → instagram-core
  → provider/client 实现包
```

在 `deepseek-harness` 插件底座中：

```text
业务包
  → ctx.instagram
  → instagram-core 定义的 InstagramClient
  → provider 实现
```

在无插件底座中：

```text
普通 skills
  → InstagramClient
  → provider 实现
```

## 职责

* 定义 `InstagramClient` 总接口
* 定义账号、媒体、发布、资料编辑等输入输出类型
* 定义 branded id 构造函数
* 定义 provider 失败时的统一错误类型
* 为 `instagram` 包声明 `ctx.instagram` 提供类型来源
* 为 `instagram-aiograpi-rest` 等 provider 提供实现约束

## 非职责

* 不注册模型可见 tool
* 不声明 `ctx.instagram`
* 不调用 Instagram API
* 不处理 aiograpi-rest、官方 API、connector 的请求细节
* 不生成账号名称、简介、头像、评论或发布内容
* 不做养号阶段判断、任务编排、多账号调度
* 不做复杂风控恢复、重试、降级切换

## 包依赖

### 允许依赖

* TypeScript 标准类型

### 不允许依赖

* `@deepseek-ai/cordis`
* `deepseek-harness` 业务包
* `instagram`
* `instagram-aiograpi-rest`
* `instagram-official-api`
* `instagram-connector`
* HTTP client、浏览器自动化、移动端自动化 SDK

## 包路径建议

采用第三方 monorepo 方式开发，建议放在：

```text
instagram-skills/packages/instagram-core
```

包名建议：

```text
@instagram-skills/instagram-core
```

## 文件结构建议

```text
instagram-skills/packages/instagram-core/
  package.json
  tsconfig.json
  src/
    index.ts
    ids.ts
    account.ts
    profile.ts
    media.ts
    publish.ts
    client.ts
    errors.ts
```

## 模块职责

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 统一导出公开类型 |
| `ids.ts` | 定义账号、媒体、发布任务等 branded id、构造函数和基础空值校验 |
| `account.ts` | 定义账号引用、认证引用等类型 |
| `profile.ts` | 定义资料读取、资料编辑输入输出 |
| `media.ts` | 定义搜索、媒体详情、点赞、评论输入输出 |
| `publish.ts` | 定义 post / story / reel 发布输入输出 |
| `client.ts` | 定义 `InstagramClient` 总接口 |
| `errors.ts` | 定义 provider 统一错误 |

## 核心接口设计

`InstagramClient` 建议按能力分组，不使用大量平铺方法。

```ts
export interface InstagramClient {
  profile: InstagramProfileClient;
  media: InstagramMediaClient;
  publish: InstagramPublishClient;
}
```

调用方使用方式：

```ts
await instagram.profile.updateProfile(request);
await instagram.media.searchVideos(request);
await instagram.publish.publishContent(request);
```

## id 类型

跨包传递的 id 不直接使用裸字符串，建议使用 branded type。对外同时提供同名构造函数，避免业务包和执行层直接写 `as InstagramAccountId`。

```ts
export type Branded<T, Brand extends string> = T & { readonly __brand: Brand };

export type InstagramAccountId = Branded<string, "InstagramAccountId">;
export type InstagramMediaId = Branded<string, "InstagramMediaId">;
export type InstagramPublishId = Branded<string, "InstagramPublishId">;
export type InstagramSessionRef = Branded<string, "InstagramSessionRef">;

function createBrandedString<T>(value: string, name: string): T {
  if (!value || !value.trim()) {
    throw new TypeError(`${name} cannot be empty`);
  }
  return value as T;
}

export function InstagramAccountId(value: string): InstagramAccountId {
  return createBrandedString<InstagramAccountId>(value, "InstagramAccountId");
}

export function InstagramMediaId(value: string): InstagramMediaId {
  return createBrandedString<InstagramMediaId>(value, "InstagramMediaId");
}

export function InstagramPublishId(value: string): InstagramPublishId {
  return createBrandedString<InstagramPublishId>(value, "InstagramPublishId");
}

export function InstagramSessionRef(value: string): InstagramSessionRef {
  return createBrandedString<InstagramSessionRef>(value, "InstagramSessionRef");
}
```

说明：

* `InstagramAccountId` 表示业务系统内的 Instagram 账号
* `InstagramMediaId` 表示 Instagram 媒体对象
* `InstagramPublishId` 表示发布任务或已发布内容
* `InstagramSessionRef` 表示 provider 可识别的登录态引用

边界规则：

* tool / HTTP / MCP 输入仍使用普通 `string`
* 进入 TS `InstagramClient` 执行层前，统一调用 core 构造函数转换 branded type
* `as InstagramAccountId` 这类类型断言只允许出现在 `instagram-core` 内部
* 构造函数只做空值校验，不校验 provider 专属格式

## 账号类型

`instagram-core` 不直接保存 access token 或 session 内容，只接收 provider 可识别的引用。

```ts
export interface InstagramAccountRef {
  accountId: InstagramAccountId;
  sessionRef: InstagramSessionRef;
}
```

从 JSON 边界进入 TS `InstagramClient` 时，执行层应显式构造账号引用：

```ts
const account: InstagramAccountRef = {
  accountId: InstagramAccountId(request.accountId),
  sessionRef: InstagramSessionRef(request.sessionRef),
};
```

sessionRef 由 provider 解析，必须绑定该用户稳定的登录态、设备信息和网络出口。
这样可以让 `aiograpi-rest`、官方 API、connector 各自决定如何管理真实凭证。

## 资料能力

用于 `instagram-profile-setup` 包。

```ts
export interface InstagramProfileClient {
  updateProfile(request: InstagramUpdateProfileRequest): Promise<InstagramUpdateProfileResult>;
}

export interface InstagramUpdateProfileRequest {
  account: InstagramAccountRef;
  username?: string;
  displayName?: string;
  biography?: string;
  avatarAsset?: InstagramAssetRef;
}

export interface InstagramUpdateProfileResult {
  accountId: InstagramAccountId;
  updatedAt: string;
}
```

第一期只需要支持资料编辑，不提前扩展完整资料读取、联系人、隐私设置等能力。

## 媒体互动能力

用于 `instagram-video-interaction` 包。

```ts
export interface InstagramMediaClient {
  searchVideos(request: InstagramSearchVideosRequest): Promise<InstagramSearchVideosResult>;
  getMedia(request: InstagramGetMediaRequest): Promise<InstagramMediaItem>;
  likeMedia(request: InstagramLikeMediaRequest): Promise<InstagramActionResult>;
  commentMedia(request: InstagramCommentMediaRequest): Promise<InstagramActionResult>;
}

export interface InstagramSearchVideosRequest {
  account: InstagramAccountRef;
  keyword: string;
  limit: number;
}

export interface InstagramSearchVideosResult {
  items: InstagramMediaItem[];
}

export interface InstagramGetMediaRequest {
  account: InstagramAccountRef;
  mediaId: InstagramMediaId;
}

export interface InstagramMediaItem {
  mediaId: InstagramMediaId;
  url?: string;
  caption?: string;
  authorUsername?: string;
}

export interface InstagramLikeMediaRequest {
  account: InstagramAccountRef;
  mediaId: InstagramMediaId;
}

export interface InstagramCommentMediaRequest {
  account: InstagramAccountRef;
  mediaId: InstagramMediaId;
  text: string;
}

export interface InstagramActionResult {
  mediaId: InstagramMediaId;
  actedAt: string;
}
```

视频内容是否符合目标、是否应该点赞、是否应该评论，属于业务包的 AI 判断，不放进 `instagram-core`。

## 发布能力

用于 `instagram-content-publish` 包。

```ts
export interface InstagramPublishClient {
  publishContent(request: InstagramPublishContentRequest): Promise<InstagramPublishResult>;
  getPublishStatus(request: InstagramPublishStatusRequest): Promise<InstagramPublishStatusResult>;
}

export type InstagramPublishType = "post" | "story" | "reel";

export interface InstagramPublishContentRequest {
  account: InstagramAccountRef;
  type: InstagramPublishType;
  caption?: string;
  tags?: string[];
  assets: InstagramAssetRef[];
  scheduledAt?: string;
}

export interface InstagramPublishResult {
  publishId: InstagramPublishId;
  status: InstagramPublishStatus;
  submittedAt: string;
}

export interface InstagramPublishStatusRequest {
  account: InstagramAccountRef;
  publishId: InstagramPublishId;
}

export interface InstagramPublishStatusResult {
  publishId: InstagramPublishId;
  status: InstagramPublishStatus;
  mediaId?: InstagramMediaId;
  checkedAt: string;
}

export type InstagramPublishStatus = "submitted" | "published" | "failed";
```

第一期只保留发布和状态查询，不实现内容审批流和内容日历。

## 素材引用

资料头像、发布图片、发布视频都使用统一素材引用。

```ts
export interface InstagramAssetRef {
  uri: string;
  mediaType: "image" | "video";
}
```

`uri` 可以是本地路径、对象存储地址或 provider 可访问的资源地址。`instagram-core` 不判断资源是否存在，资源校验由 provider 或业务包在系统边界处理。

## 错误类型

provider 调用失败时直接抛出统一错误。

```ts
export class InstagramProviderError extends Error {
  constructor(
    public readonly code: InstagramProviderErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type InstagramProviderErrorCode =
  | "auth_required"
  | "rate_limited"
  | "unsupported_operation"
  | "provider_request_failed";
```

`instagram-core` 只定义错误类型，不实现重试、换 provider、自动恢复。

## 实现步骤

1. 新建 `@instagram-skills/instagram-core` 包。
2. 配置 ESM、strict TypeScript、workspace tsconfig。
3. 在 `src/ids.ts` 定义 branded id、构造函数和基础空值校验。
4. 在 `src/account.ts` 定义账号引用和 session 引用。
5. 在 `src/profile.ts`、`src/media.ts`、`src/publish.ts` 定义分组能力类型。
6. 在 `src/client.ts` 汇总 `InstagramClient`。
7. 在 `src/errors.ts` 定义统一错误类型。
8. 在 `src/index.ts` 导出全部公开类型和 id 构造函数。
9. 增加类型级单测或最小编译测试，验证 provider mock 能完整实现 `InstagramClient`。
10. 增加 id 构造函数测试，验证合法 string 可转换、空字符串会失败、不同 branded id 不能误传。

## 验证标准

* `instagram-core` 不依赖 Cordis 或任何 provider 包
* `InstagramClient` 覆盖资料编辑、视频搜索、点赞、评论、发布、状态查询
* `instagram-aiograpi-rest` 可以基于该接口实现 provider
* `instagram` 包可以把该接口声明为 `ctx.instagram`
* 三个业务能力包可以只依赖该接口描述 Instagram 操作
* id 构造函数可以把 JSON 边界传入的合法 string 转成 branded type
* 业务包和执行层不需要使用 `as InstagramAccountId` 这类类型断言
* 空字符串或全空白字符串会在构造函数处失败
* 外部调用失败时由 provider 抛出 `InstagramProviderError`，不返回假成功

## 第一版不做

* 不做多账号调度
* 不做账号风控策略
* 不做 provider 自动切换
* 不做登录、Challenge、Proxy 管理
* 不做图片、视频、评论、正文生成
* 不做 Instagram 官方 API 和 Private API 字段全集映射

## 兼容说明

当前方案以 TypeScript 包为主，Python agent 不能直接复用 `instagram-core`。后续如需跨语言兼容，建议新增 `instagram-protocol`，用 OpenAPI/JSON Schema 固化请求、响应和错误码。

## 测试方案

| 场景 | 用例 | 预期情况 |
| --- | --- | --- |
| 依赖边界验收 | 安装并编译 `@instagram-skills/instagram-core` | 编译通过；不依赖 Cordis、provider、HTTP client、业务 skill 包 |
| `InstagramClient` 实现验收 | 写一个 mock provider，实现 `profile / media / publish` 三组接口 | mock provider 能完整实现 `InstagramClient`，TypeScript 不报缺失方法 |
| 业务调用验收 | 模拟业务包调用 `instagram.profile.updateProfile(request)` | 调用代码只依赖 `InstagramClient`，不需要知道 aiograpi-rest 或具体 provider |
| 账号引用验收 | 构造 `InstagramAccountRef { accountId, sessionRef }` 并传入资料、互动、发布请求 | 三类能力都能复用同一个账号引用；真实 session 不暴露给业务层 |
| 资料编辑验收 | 调用 `updateProfile`，输入 `username / displayName / biography / avatarAsset` | 返回 `accountId` 和 `updatedAt`；接口不关心 provider 如何上传头像 |
| 媒体互动验收 | 调用 `searchVideos` 获取 `mediaId`，再调用 `likeMedia`、`commentMedia` | 搜索结果可直接作为点赞、评论输入；返回 `mediaId` 和 `actedAt` |
| 发布能力验收 | 调用 `publishContent` 发布 `post / story / reel`，再调用 `getPublishStatus` | 返回 `publishId / status / submittedAt`；状态查询可返回 `published / failed` |
| 错误传播验收 | mock provider 抛出 `InstagramProviderError("auth_required")` | 错误向上抛出；core 不吞错、不重试、不返回假成功 |
| branded type 验收 | 尝试把 `InstagramMediaId` 传给需要 `InstagramAccountId` 的字段 | TypeScript 编译失败，防止不同 id 类型误传 |
| id 构造函数验收 | 调用 `InstagramAccountId("acct_1")`、`InstagramSessionRef("session_1")` 并构造 `InstagramAccountRef` | 编译通过，可传入 `InstagramClient` 请求 |
| 空 id 验收 | 调用 `InstagramAccountId("")` 或 `InstagramSessionRef("   ")` | 抛出明确错误，不生成 branded id |
| 类型断言边界验收 | 在业务包或执行层搜索 `as InstagramAccountId` | 不应出现；外部统一调用 core 构造函数 |
