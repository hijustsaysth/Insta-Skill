---
name: instagram-aiograpi-rest
description: 通过 aiograpi-rest HTTP 服务复用 aiograpi session 执行 Instagram 认证、当前账号资料读取和资料修改；TS provider 还支持媒体互动和发布。
---

# instagram-aiograpi-rest

`instagram-aiograpi-rest` 是 aiograpi-rest 的本地执行入口说明。agent 可通过本 skill 内的 CLI bundle 调用 aiograpi-rest HTTP 服务，并通过 `X-Session-ID` 复用 aiograpi 服务侧 session。

本 skill 只说明如何使用该适配包和请求行为边界，不定义业务策略，不生成内容，不绕过 Instagram 认证、验证、限流或风控机制。

## 适用场景

在需要通过 aiograpi-rest 服务执行 Instagram 请求时使用本 skill。优先根据当前运行环境选择入口：

* 需要命令行执行或直接操作本地服务时，使用 CLI。
* 需要在 TS/Node agent 内集成 provider 时，可在源码开发环境使用 `createAiograpiRestClient` 和 `createAiograpiRestAuthClient`。

不要把本包用于 Instagram Official API、Android App 自动化、内容生成、资料生成计划、养号计划或多账号调度。

## 入口

源码开发环境中的 TS/Node agent 可使用：

```ts
import { createAiograpiRestAuthClient, createAiograpiRestClient } from "@instagram-skills/instagram-aiograpi-rest";
```

CLI 执行入口：

在任意 agent 已安装的 skill 目录中，优先直接调用随 skill 发布的 CLI bundle：

```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js invoke --action auth.login --input-json -
node .\dist\cli.bundle.js invoke --action auth.settings --session-cache runtime-data/aiograpi-rest-session.json
node .\dist\cli.bundle.js invoke --action account.get --session-cache runtime-data/aiograpi-rest-session.json
node .\dist\cli.bundle.js invoke --action account.about --session-cache runtime-data/aiograpi-rest-session.json
```

如果环境支持 PowerShell，也可以使用本 skill 自带 wrapper：

```powershell
.\scripts\instagram-aiograpi-rest.ps1 list-tools
.\scripts\instagram-aiograpi-rest.ps1 invoke --action auth.login --input-json -
.\scripts\instagram-aiograpi-rest.ps1 invoke --action auth.settings --session-cache runtime-data/aiograpi-rest-session.json
.\scripts\instagram-aiograpi-rest.ps1 invoke --action account.get --session-cache runtime-data/aiograpi-rest-session.json
.\scripts\instagram-aiograpi-rest.ps1 invoke --action account.about --session-cache runtime-data/aiograpi-rest-session.json
.\scripts\instagram-aiograpi-rest.ps1 invoke --action profile.update --confirm-mutation --input-json profile-update.json
```

CLI 支持的 action：

* `auth.login`
* `auth.loginBySessionId`
* `auth.relogin`
* `auth.settings`
* `account.get`
* `account.about`
* `profile.update`

CLI 也支持短别名：`login`、`login-sessionid`、`relogin`、`settings`、`account`、`about`、`account-about`、`update-profile`。

`--input-json` 支持内联 JSON、文件路径或 `-` 从 stdin 读取。涉及密码、Instagram `sessionid`、验证码或 settings 时，优先使用 stdin 或文件输入，避免把敏感值直接写在命令行历史中。

### CLI 输入

`auth.login`：

```json
{
  "username": "instagram username",
  "password": "instagram password",
  "verificationCode": "optional 2FA code",
  "proxy": "optional stable proxy",
  "locale": "optional locale",
  "timezone": "optional timezone",
  "accountId": "optional local account label"
}
```

`accountId` 不只是本地展示标签。传入后，aiograpi-rest 服务会在账号密码登录前按 `accountId` 查找历史 settings；如果存在，会先恢复旧 `uuids/device_settings/user_agent` 再登录，减少同一账号反复登录时生成新设备身份的风险。

`auth.loginBySessionId`：

```json
{
  "sessionid": "instagram sessionid cookie value",
  "proxy": "optional stable proxy",
  "locale": "optional locale",
  "timezone": "optional timezone",
  "accountId": "optional local account label",
  "username": "optional username label"
}
```

`auth.loginBySessionId` 也应传入稳定的 `accountId`。导入 `sessionid` 成功后，服务会把当前 settings 与该 `accountId` 建立索引，后续账号密码登录可以复用这套设备身份。

`auth.relogin`、`auth.settings`、`account.get`、`account.about`：

```json
{
  "aiograpiSessionId": "optional when --session-cache is provided",
  "userId": "optional for account.about; omit it to read current account pk first"
}
```

也可以传 `sessionRef` 代替 `aiograpiSessionId`。

`profile.update`：

```json
{
  "accountId": "optional local account label",
  "aiograpiSessionId": "optional when --session-cache is provided",
  "username": "optional new username",
  "displayName": "optional new full name",
  "fullName": "optional alias for displayName",
  "fullname": "optional alias for displayName",
  "biography": "optional new biography",
  "avatarPath": "optional local image path",
  "avatarAsset": {
    "uri": "optional local image path",
    "mediaType": "image"
  },
  "confirmMutation": true
}
```

`profile.update` 必须通过 `--confirm-mutation`、`AIOGRAPI_CONFIRM_MUTATION=1` 或输入 JSON 的 `confirmMutation: true` 明确确认。

`account.get` 是 CLI 对 aiograpi-rest `/account` 的直接读取，不是 `InstagramClient` core interface 的标准方法。

`account.about` 是 CLI 对 aiograpi-rest `/user/about` 的只读封装。未传 `userId` 时，会先调用 `/account` 读取当前登录账号 `pk`，再调用 `/user/about?user_id={pk}`。返回字段中的 `date` 是 Instagram about/join date，可作为养号计划的 `registeredAt` 输入。该字段可能是自然语言日期，传给 `instagram-warmup-orchestrator` 前需要由 agent 服务归一化为 `YYYY-MM-DD`。

配置字段：

* `baseUrl`：aiograpi-rest HTTP 服务地址。
* `requestTimeoutMs`：单请求超时时间，必须为正数。
* `fetch`：可选 fetch 实现，测试或自定义运行时可注入。
* `defaultSessionHeaderName`：可选 session header 名，默认 `X-Session-ID`。

CLI 配置来源：

* `--base-url` 或 `AIOGRAPI_REST_BASE_URL`，默认 `http://localhost:8005`。
* `--timeout-ms` 或 `AIOGRAPI_REST_REQUEST_TIMEOUT_MS`，默认 `30000`。
* `--session-header` 或 `AIOGRAPI_REST_SESSION_HEADER`，默认 `X-Session-ID`。
* `--session-cache` 或 `AIOGRAPI_SESSION_CACHE_PATH`，用于读取或写入 `aiograpiSessionId`。
* `--confirm-mutation` 或 `AIOGRAPI_CONFIRM_MUTATION=1`，用于确认 `profile.update` 写操作。

## Session 复用

普通业务操作必须优先复用已有的已认证 `aiograpiSessionId`，并把它作为 `account.sessionRef` 或认证请求的 `aiograpiSessionId` 传入。

不要在每次业务操作前重新登录。登录是认证行为，不是每个 API 请求的前置步骤。

只有在以下情况下才进入登录或重新认证流程：

* 账号从未完成认证。
* 已确认当前 session 无效。
* Instagram 明确返回 LoginRequired 或要求重新认证。
* 用户正在完成 2FA、challenge 等认证流程。

认证成功后，应把返回的 `aiograpiSessionId` 写入上层 session store，并在后续操作复用。需要持久化 aiograpi settings 时，使用 `exportSettings` 读取后由上层加密保存。

CLI 登录时如果提供 `--session-cache`，会把返回的 `aiograpiSessionId` 写入该文件。后续 `auth.relogin`、`auth.settings`、`account.get` 和 `profile.update` 可以通过同一个 `--session-cache` 复用 session。

同一账号再次登录时，应继续传入相同 `accountId`。如果服务端已保存该账号的 settings，账号密码登录会优先复用历史 settings；如果没有历史记录，才会使用 aiograpi 默认设备 settings 初始化新客户端。

不要因为单次请求失败、网络超时、限流、ChallengeRequired 或 FeedbackRequired 直接反复密码登录。

## 请求最小化

发送请求前先确定完成任务所需的最小请求序列，只发送当前任务必要的 Instagram 请求。

不要用 Timeline、Feed、Explore、Followers、Stories 等无关接口作为每次业务操作前的 session health check。优先直接执行当前必要业务请求；如果返回 LoginRequired，再进入认证恢复流程。

资料修改应尽量合并文本字段：`username`、`displayName`、`biography` 可以通过一次 profile 更新请求提交。CLI 接受 `displayName`、`fullName` 或 `fullname`，最终都会映射为 aiograpi-rest 的 `full_name`。头像更新使用单独的 multipart 请求，并且 `avatarAsset` 或 `avatarPath` 必须是本地文件素材。

修改完成后，只有在任务确实需要验收时才读取一次最终状态。不要频繁轮询或重复读取相同结果。

## 写操作约束

以下操作会修改账号或内容状态，调用前必须有用户或上层 agent 的明确授权：

* 修改个人资料。
* 更新头像。
* 点赞。
* 评论。
* 发布内容。

如果目标状态已经存在，不要重复发送相同写请求。如果上一次写请求结果未知，应先确认状态，而不是立即重复提交。

不要为了制造“人工行为”额外刷 Feed、访问主页、看 Story、点赞、关注或执行其他与任务无关的操作。

## 返回信息完整展示
返回的信息必须完整展示，不要使用文字描述、状态描述等。
错误示例：
* 头像URL：已读取到
* 头像URL：scontent 头像链接
正确示例：
* 头像URL：https://scontent-lax3-1.cdninstagram.com/example

### account.get中返回的date字段为注册日期，不要错误理解为出生日期

## 错误处理

本包会把 HTTP 失败映射为 `InstagramProviderError`：

* `401` / `403` 映射为 `auth_required`。
* `429` 映射为 `rate_limited`。
* `400` / `422` / `501` 映射为 `unsupported_operation`。
* 超时和其他 provider 失败映射为 `provider_request_failed`。

aiograpi-rest 有时会在非 401/403 状态中返回 `LoginRequired`、`ChallengeRequired`、`TwoFactorRequired`、`FeedbackRequired`、`PleaseWaitFewMinutes` 等 provider 细节。上层 agent 必须检查错误消息和 `causeDetail`，不要只按 HTTP 状态粗暴重试。

处理规则：

* `LoginRequired`：停止当前业务请求，将当前 session 视为无效，进入正常重新认证流程。
* `TwoFactorRequired`：停止继续登录流程，向用户请求验证码；CLI 可通过 `auth.login` 的 `verificationCode` 继续同一认证意图，不要创建多个并行登录流程。
* `ChallengeRequired`：立即停止当前业务操作，进入 Instagram 要求的验证流程；CLI 当前不暴露 `auth.resolveChallenge`，应交给 TS auth client 或上层认证流程处理，不要 login -> retry 循环。
* `rate_limited`、`PleaseWaitFewMinutes`、HTTP `429`：停止连续请求，等待后再尝试；不要通过重新登录解决限流。
* `FeedbackRequired`：停止相关写操作，并把 provider 状态返回上层；不要切换 session 后继续同类写操作。
* 临时网络错误或 timeout：只允许有限次数重试；禁止无限重试。
* 输入参数错误或 `unsupported_operation`：直接返回错误，不向 Instagram 发送猜测后的参数。

认证状态和平台限制优先于普通业务重试。

## 支持能力和限制

CLI 当前只暴露：

* `auth.login`
* `auth.loginBySessionId`
* `auth.relogin`
* `auth.settings`
* `account.get`
* `account.about`
* `profile.update`

TS 认证 client：

* `login`
* `loginBySessionId`
* `relogin`
* `resolveChallenge`
* `exportSettings`

源码开发环境中的 TS 业务 client：

* `profile.updateProfile`
* `media.searchVideos`
* `media.getMedia`
* `media.likeMedia`
* `media.commentMedia`
* `publish.publishContent`

`publish.getPublishStatus` 不受 aiograpi-rest 当前接口支持，会返回 `unsupported_operation`。

发布接口只支持立即发布，不支持 `scheduledAt`。

媒体互动和发布能力当前不走 CLI，仍通过 TS client 或 Cordis provider 使用。

## 本地验证

本地 smoke 测试通常使用：

```powershell
pnpm --filter @instagram-skills/instagram-aiograpi-rest smoke:local
```

运行真实 Instagram 请求前，确认 aiograpi-rest 服务地址、账号 session、网络出口和用户授权。测试时仍然遵守 session 复用、请求最小化和错误停止规则。
