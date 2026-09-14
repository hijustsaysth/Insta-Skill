---
name: instagram-aiograpi-rest
description: 通过 aiograpi-rest HTTP 服务复用 aiograpi session 执行 Instagram 认证、当前账号资料读取和资料修改；TS provider 还支持媒体互动和发布。
---

# instagram-aiograpi-rest

通过 CLI 调用 aiograpi-rest HTTP 服务并用 `X-Session-ID` 复用 session；源码 TS/Node 可用 `createAiograpiRestClient`、`createAiograpiRestAuthClient`。本 skill 不制定策略、生成内容或绕过认证/验证/限流/风控，也不用于 Official API、Android 自动化、资料/养号计划或多账号调度。

```ts
import { createAiograpiRestAuthClient, createAiograpiRestClient } from "@instagram-skills/instagram-aiograpi-rest";
```

## CLI

```powershell
node .\dist\cli.bundle.js list-tools
node .\dist\cli.bundle.js invoke --action auth.login --input-json -
node .\dist\cli.bundle.js invoke --action account.about --session-cache runtime-data/aiograpi-rest-session.json
.\scripts\instagram-aiograpi-rest.ps1 invoke --action profile.update --confirm-mutation --input-json profile-update.json
```

Actions：`auth.login`、`auth.loginBySessionId`、`auth.relogin`、`auth.settings`、`account.get`、`account.about`、`profile.update`。别名：`login`、`login-sessionid`、`relogin`、`settings`、`account`、`about`、`account-about`、`update-profile`。

`--input-json` 支持内联 JSON、文件、stdin `-`；密码、`sessionid`、验证码、settings 优先走文件/stdin。

## 输入与配置

- `auth.login`：`username`、`password`；可选 `verificationCode`、`proxy`、`locale`、`timezone`、`accountId`。
- `auth.loginBySessionId`：`sessionid`；可选 `proxy`、`locale`、`timezone`、`accountId`、`username`。
- `auth.relogin`/`auth.settings`/`account.get`/`account.about`：可选 `aiograpiSessionId`（有 `--session-cache` 时可省）及 `userId`（仅 about）；`sessionRef` 可替代 session id。
- `profile.update`：可选 `accountId`、`aiograpiSessionId`、`username`、`displayName`（别名 `fullName`/`fullname`）、`biography`、`avatarPath`、`avatarAsset:{uri,mediaType:"image"}`、`confirmMutation:true`。

`profile.update` 必须由 `--confirm-mutation`、`AIOGRAPI_CONFIRM_MUTATION=1` 或 JSON `confirmMutation:true` 确认。

配置：`baseUrl`、正数 `requestTimeoutMs`、可注入 `fetch`、`defaultSessionHeaderName`（默认 `X-Session-ID`）。CLI 来源：`--base-url`/`AIOGRAPI_REST_BASE_URL`（默认 `http://localhost:8005`）；`--timeout-ms`/`AIOGRAPI_REST_REQUEST_TIMEOUT_MS`（30000）；`--session-header`/`AIOGRAPI_REST_SESSION_HEADER`；`--session-cache`/`AIOGRAPI_SESSION_CACHE_PATH`；确认参数/变量同上。

传稳定 `accountId`：密码登录前服务会恢复历史 `uuids/device_settings/user_agent`；sessionid 导入后也会建立 settings 索引，避免反复生成设备身份。

`account.get` 直读 `/account`，不是 `InstagramClient` core 标准方法。`account.about` 封装 `/user/about`；无 `userId` 先读当前 `pk`。其 `date` 是注册日期（不是出生日期），可能为自然语言，传 warmup 前由 agent 归一化为 `YYYY-MM-DD`。

## Session 与请求规则

业务操作优先复用 `aiograpiSessionId`（作为 `account.sessionRef` 或认证输入），认证成功后存入上层 session store；持久 settings 用 `exportSettings` 并由上层加密。CLI 的 `--session-cache` 可写入并供 relogin/settings/account/profile 复用。

仅首次认证、确认 session 无效、`LoginRequired`/重新认证、2FA/challenge 时登录；不得因请求失败、超时、限流、`ChallengeRequired`、`FeedbackRequired` 反复登录。

只发送任务所需请求，不用 Timeline/Feed/Explore/Followers/Stories 作通用 health check。文本资料尽量一次更新；别名均映射 `full_name`。头像单独 multipart，`avatarAsset`/`avatarPath` 必须是本地文件。仅确需验收时读一次最终状态，不轮询。

资料/头像修改、点赞、评论、发布必须获明确授权；状态已存在不重复写，前次结果未知先确认。禁止为模拟人工而执行无关浏览/互动。

返回信息必须完整展示真实值，不得只写“已读取到”等状态描述。

## 错误处理

HTTP 映射：`401`/`403` -> `auth_required`；`429` -> `rate_limited`；`400`/`422`/`501` -> `unsupported_operation`；超时/其他 -> `provider_request_failed`。还须检查消息和 `causeDetail` 中的 provider 细节：

- `LoginRequired`：停止，session 作废，正常重认证。
- `TwoFactorRequired`：停止并索取验证码，以 `auth.login.verificationCode` 延续同一意图，不并行登录。
- `ChallengeRequired`：停止业务并进入验证；CLI 不暴露 `auth.resolveChallenge`，交 TS auth client/上层，禁止 login-retry 循环。
- `rate_limited`/`PleaseWaitFewMinutes`/429：停止连续请求，等待后再试，不重新登录。
- `FeedbackRequired`：停止写操作并上报，不换 session 继续。
- 临时网络/timeout：仅有限重试；参数错误/`unsupported_operation`：直接返回，不猜参数。

认证和平台限制优先于普通重试。

## 能力限制

CLI 仅暴露上述 7 actions。TS auth client：`login`、`loginBySessionId`、`relogin`、`resolveChallenge`、`exportSettings`。TS 业务 client：`profile.updateProfile`、`media.searchVideos`、`media.getMedia`、`media.likeMedia`、`media.commentMedia`、`publish.publishContent`。媒体互动/发布仅走 TS client 或 Cordis provider；发布仅立即执行，不支持 `scheduledAt`；`publish.getPublishStatus` 返回 `unsupported_operation`。

本地 smoke：`pnpm --filter @instagram-skills/instagram-aiograpi-rest smoke:local`。真实请求前确认服务、session、网络出口和授权，并遵守复用、最小请求、错误停止规则。
