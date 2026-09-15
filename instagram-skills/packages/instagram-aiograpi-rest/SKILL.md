---
name: instagram-aiograpi-rest
description: 通过 aiograpi-rest HTTP 服务复用 aiograpi session 执行 Instagram 认证、当前账号资料读取和资料修改；TS provider 还支持媒体互动和发布。
---

# instagram-aiograpi-rest

本 skill 说明通过 CLI bundle 调用 aiograpi-rest HTTP 服务、以 `X-Session-ID` 复用 session 的接口和边界；不定义业务策略、生成内容或绕过认证、验证、限流和风控。适用于 aiograpi-rest，不用于 Official API、Android 自动化、内容/资料/养号计划或多账号调度。源码 TS/Node 可导入 `createAiograpiRestClient`、`createAiograpiRestAuthClient`。

## CLI

在当前 skill 目录运行：

```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js invoke --action auth.login --input-json -
node .\dist\cli.bundle.js invoke --action account.get --session-cache runtime-data/aiograpi-rest-session.json
```

也支持 `scripts/instagram-aiograpi-rest.ps1` wrapper。Actions：`auth.login`、`auth.loginBySessionId`、`auth.relogin`、`auth.settings`、`account.get`、`account.about`、`profile.update`；短别名：`login`、`login-sessionid`、`relogin`、`settings`、`account`、`about`、`account-about`、`update-profile`。

`--input-json` 接受内联 JSON、文件或 stdin `-`。密码、`sessionid`、验证码、settings 应用文件/stdin，避免命令历史泄露。

## 输入与配置

* `auth.login`：必填 `username`、`password`；可选 `verificationCode`、`proxy`、`locale`、`timezone`、`accountId`。
* `auth.loginBySessionId`：必填 Instagram cookie 值 `sessionid`；可选 `proxy`、`locale`、`timezone`、`accountId`、`username`。
* `auth.relogin`、`auth.settings`、`account.get`、`account.about`：`aiograpiSessionId` 在提供 `--session-cache` 时可省略，也可用 `sessionRef` 代替；`account.about` 可选 `userId`。
* `profile.update`：可选 `accountId`、`aiograpiSessionId`、`username`、`displayName`（别名 `fullName`、`fullname`）、`biography`、`avatarPath`、`avatarAsset: { uri, mediaType: "image" }`、`confirmMutation`。

稳定的 `accountId` 会让密码登录先恢复历史 `uuids/device_settings/user_agent`；导入 `sessionid` 后也会以该 ID 索引 settings，避免重复生成设备身份。

`profile.update` 必须通过 `--confirm-mutation`、`AIOGRAPI_CONFIRM_MUTATION=1` 或 `confirmMutation: true` 明确确认。

配置字段：`baseUrl`；正数 `requestTimeoutMs`；可注入 `fetch`；`defaultSessionHeaderName`（默认 `X-Session-ID`）。CLI 来源：`--base-url`/`AIOGRAPI_REST_BASE_URL`（默认 `http://localhost:8005`）、`--timeout-ms`/`AIOGRAPI_REST_REQUEST_TIMEOUT_MS`（默认 `30000`）、`--session-header`/`AIOGRAPI_REST_SESSION_HEADER`（默认 `X-Session-ID`）、`--session-cache`/`AIOGRAPI_SESSION_CACHE_PATH`、`--confirm-mutation`/`AIOGRAPI_CONFIRM_MUTATION=1`。

`account.get` 直接读取 `/account`，不是 `InstagramClient` core 标准方法；其 `date` 是注册日期，不是出生日期。`account.about` 封装 `/user/about`；未传 `userId` 时先从 `/account` 取当前账号 `pk`，再请求 `/user/about?user_id={pk}`。返回的 about/join `date` 可作 `registeredAt`，自然语言日期须由 agent 服务归一化为 `YYYY-MM-DD`。

## Session 与请求

普通业务必须复用已认证 `aiograpiSessionId`，作为 `account.sessionRef` 或认证请求字段；不得每次操作前登录。仅账号未认证、session 已确认失效、Instagram 返回 `LoginRequired`/要求重认证、或用户处理 2FA/challenge 时认证。成功后写入上层 session store；session、密码、cookie、token 和持久化 settings 均由上层安全处理，settings 应加密保存 `exportSettings` 结果。`--session-cache` 可保存 session，供 `auth.relogin`、`auth.settings`、`account.get`、`profile.update` 复用。

同账号继续使用相同 `accountId`。不得因单次失败、超时、限流、`ChallengeRequired` 或 `FeedbackRequired` 反复密码登录。

只发当前任务必要请求；不得用 Timeline、Feed、Explore、Followers、Stories 等作例行 health check。直接执行业务请求，遇 `LoginRequired` 再恢复认证。文本资料 `username`、`displayName`、`biography` 尽量合并更新，名称别名均映射为 `full_name`；头像用独立 multipart 请求且必须是本地 `avatarAsset`/`avatarPath`。仅需验收时读取一次最终状态，不轮询重复读取。

## 写操作与展示

修改资料/头像、点赞、评论、发布前必须取得用户或上层 agent 明确授权。目标状态已存在时不重复写；上次结果未知时先确认状态。不得为模拟人工行为额外刷 Feed、主页、Story、点赞、关注或其他无关操作。

返回信息必须完整展示真实值，不得以“已读取到”等状态描述代替，例如头像 URL 应展示完整 URL。

## 错误处理

`InstagramProviderError` 映射：`401`/`403` → `auth_required`，`429` → `rate_limited`，`400`/`422`/`501` → `unsupported_operation`，超时及其他 provider 失败 → `provider_request_failed`。还须检查消息和 `causeDetail` 中的 `LoginRequired`、`ChallengeRequired`、`TwoFactorRequired`、`FeedbackRequired`、`PleaseWaitFewMinutes`，不能只按 HTTP 状态重试。

* `LoginRequired`：停止业务，将 session 置为无效并正常重认证。
* `TwoFactorRequired`：停止并向用户取验证码；通过 `auth.login.verificationCode` 延续同一认证意图，不建并行登录。
* `ChallengeRequired`：停止业务并进入验证；CLI 无 `auth.resolveChallenge`，交给 TS auth client/上层，不做 login-retry 循环。
* `rate_limited`、`PleaseWaitFewMinutes`、HTTP `429`：停止连续请求并等待，不重新登录。
* `FeedbackRequired`：停止相关写操作并返回状态，不切 session 后继续同类写入。
* 临时网络/超时：仅有限重试，禁止无限重试。
* 参数错误或 `unsupported_operation`：直接返回，不猜测参数发送请求。

认证状态和平台限制优先于业务重试。

## 能力限制

CLI 仅暴露上述 7 个 actions。TS auth client：`login`、`loginBySessionId`、`relogin`、`resolveChallenge`、`exportSettings`。TS 业务 client：`profile.updateProfile`、`media.searchVideos`、`media.getMedia`、`media.likeMedia`、`media.commentMedia`、`publish.publishContent`。

`publish.getPublishStatus` 返回 `unsupported_operation`；发布仅支持立即发布，不支持 `scheduledAt`。媒体互动和发布不走 CLI，只通过 TS client 或 Cordis provider。真实请求前确认服务地址、session、网络出口和授权；仍须遵守 session 复用、最小请求和错误停止规则。

本地 smoke：`pnpm --filter @instagram-skills/instagram-aiograpi-rest smoke:local`。
