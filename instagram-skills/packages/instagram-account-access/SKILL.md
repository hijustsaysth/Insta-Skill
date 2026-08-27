---
name: instagram-account-access
description: 生成 Instagram 账号登录、绑定、刷新和 session 接入计划。
---

# Instagram 账号接入

当用户需要登录 Instagram、绑定 Instagram 账号、刷新已有 session、继续 challenge 验证流程，或导出 aiograpi-rest settings 时，使用这个 skill。

## 职责边界

这个 skill 负责生成 `InstagramAccountAccessPlan`。它不直接执行 provider 调用，不保存凭证，不写入 SQLite，也不注册 Cordis service。agent 服务决定是否通过调用 `InstagramAccountAccessService` 执行该计划。

如果 agent 服务决定执行计划，可以调用统一账号接入入口：

- Cordis 插件式底座：调用 `ctx.instagramAccountAccess` 上对应的 service 方法。
- 非插件式底座或本地验收：调用 `instagram-account-access` CLI。

CLI 只接受 agent 明确传入的动作和参数，并输出结构化 JSON；CLI 不负责自行决定业务目标。

## SQLite 路径

CLI 默认把 SQLite 写到当前工作目录下的 `instagram-session-store.sqlite`。真实验收建议显式传入：

```bash
INSTAGRAM_SESSION_STORE_SQLITE_PATH=instagram-session-store.sqlite
```

agent 服务应在结构化日志中记录实际使用的 SQLite 路径，避免不同启动目录写到不同数据库。

## 账号类型路由

生成登录或绑定计划前，必须知道账号类型。

- 如果不知道用户账号是个人账号还是专业账号，拒绝生成登录执行计划，并要求用户先明确账号类型。
- 个人账号只能使用 `aiograpi-rest` 路线。
- 专业账号可以使用 `aiograpi-rest` 或 `official-api` 路线。
- 如果用户指定的 provider 不符合账号类型限制，拒绝生成该 provider 的登录计划，并说明可用路线。

移动端 connector 不属于账号接入登录能力；它只面向已登录 Instagram App 的运行环境，相关 `sessionRef` 登记和 MCP 启动配置由 `instagram-connector` 包负责。

## Provider 示例步骤

### aiograpi-rest

适用于个人账号和专业账号。

密码登录计划：

1. 收集 `accountId`、`username`、`password`；如果触发二次验证，再收集 `verificationCode`。
2. 将 `password` 和 `verificationCode` 标记为 `sensitiveInputs`。
3. 设置 `providerId=aiograpi-rest`。
4. 设置 `action=aiograpi_login_with_password`。
5. 设置 `nextServiceCall=loginWithPassword`。
6. `verificationCode` 会映射为 provider 的 `verification_code` 表单字段。
7. 在 `sessionStoreActions` 中声明保存 provider 返回的 aiograpi-rest session id、加密保存 settings、写入 `session_refs`。

sessionid 登录计划：

1. 收集 `accountId`、`sessionid`。
2. 将 `sessionid` 标记为 `sensitiveInputs`。
3. 设置 `providerId=aiograpi-rest`。
4. 设置 `action=aiograpi_login_with_sessionid`。
5. 设置 `nextServiceCall=loginWithSessionId`。
6. 明确 `sessionid` 是 Instagram cookie 中的原始 sessionid，保存的是 provider 返回的 aiograpi-rest session id。
7. 在 `sessionStoreActions` 中声明保存 provider 返回的 aiograpi-rest session id、加密保存 settings、写入 `session_refs`。

challenge 继续验证计划：

1. 收集 `sessionRef`、`lastJson`、`securityCode`。
2. 将 `securityCode` 标记为 `sensitiveInputs`。
3. 设置 `providerId=aiograpi-rest`。
4. 设置 `action=aiograpi_resolve_challenge`。
5. 设置 `nextServiceCall=resolveChallenge`。
6. `lastJson` 会映射为 provider 的 `last_json` 表单字段，`securityCode` 会映射为 `security_code` 表单字段。

刷新 session 计划：

1. 收集 `sessionRef`。
2. 设置 `providerId=aiograpi-rest`。
3. 设置 `action=aiograpi_relogin`。
4. 设置 `nextServiceCall=relogin`。

导出 settings 计划：

1. 收集 `sessionRef`。
2. 设置 `providerId=aiograpi-rest`。
3. 设置 `action=aiograpi_export_settings`。
4. 设置 `nextServiceCall=exportSettings`。
5. 在 `sessionStoreActions` 中声明加密保存 settings，不在可见说明中输出 settings 原文。

### official-api

仅适用于专业账号。`accountId` 是 Zernio 绑定成功后的 SocialAccount ID，不是启动绑定前的输入。

启动绑定计划：

1. 收集 `profileName`；按需收集 `description`、`color`、`redirectUrl`、`loginMethod`、`headless`、`idempotencyKey`。
2. 设置 `providerId=official-api`。
3. 设置 `action=official_start_binding`。
4. 设置 `nextServiceCall=startOfficialBinding`。
5. 声明 provider 会先创建 Zernio profile，再请求 `GET /v1/connect/instagram` 生成授权链接。
6. 在 `humanVisibleInstructions` 中说明需要用户打开 `authUrl` 并完成 Instagram/Facebook 授权。
7. 预期返回 `profileId`、`authUrl`，以及可选的 `state` 和 `loginMethod`。

OAuth 回调完成计划：

1. 收集 `profileId`、`code`、`state`。
2. 将 `code` 标记为 `sensitiveInputs`。
3. 设置 `providerId=official-api`。
4. 设置 `action=official_complete_callback`。
5. 设置 `nextServiceCall=completeOfficialCallback`。
6. 声明 provider 会调用 `POST /v1/connect/{platform}`，其中 `platform=instagram`。
7. 如果 `loginMethod=instagram_login`，默认连接流程不需要选择账号；如需确认结果，由 agent 服务继续查询账号或健康状态。

Facebook Login 选择账号计划：

1. 仅当 `loginMethod=facebook_login` 且回调进入 `step=select_account` 时生成该计划。
2. 收集 `profileId`、`tempToken`，并先查询可选 Facebook Page。
3. 用户或 agent 服务选择目标 Page 后，收集 `pageId`。
4. 将 `tempToken` 标记为 `sensitiveInputs`。
5. 设置 `providerId=official-api`。
6. 设置 `action=official_select_account`。
7. 设置 `nextServiceCall=selectOfficialAccount`。
8. 在 `sessionStoreActions` 中声明写入 `session_refs` 和 `official_api_sessions`。

健康检查计划：

1. 按需收集 `profileId`、`status`。
2. 设置 `providerId=official-api`。
3. 设置 `action=official_check_health`。
4. 设置 `nextServiceCall=checkOfficialHealth`。
5. 声明 provider 会调用 `GET /v1/accounts/health`，并固定 `platform=instagram`。

## 输出

返回包含以下字段的结构化 JSON：

- `providerId`
- `action`
- `requiredInputs`
- `optionalInputs`
- `sensitiveInputs`
- `nextServiceCall`
- `sessionStoreActions`
- `humanVisibleInstructions`
- `expectedResult`

禁止在可见说明或普通日志中包含密码、验证码、Instagram sessionid、aiograpi settings、access token 或 cookie 值。

## CLI 调用示例

以下示例只用于 agent 服务已经决定执行计划后的调用建议。第一版统一建议把敏感输入写入本地 `login.json`，再通过 `--input-json login.json` 传给 CLI；不要把密码、验证码或 `sessionid` 直接放进聊天内容、命令行参数、普通日志或提交文件。

`login.json` 只用于本地执行验收，应放在当前工作目录，执行后按需删除；如果需要长期保存登录态，只保存 CLI 写入 SQLite 后返回的 `sessionRef`。

### 生成计划

```bash
instagram-account-access plan --input-json '{"action":"aiograpi_login_with_password"}'
```

### aiograpi-rest 密码登录

```bash
instagram-account-access login --input-json login.json
```

`login.json`：

```json
{
  "accountId": "ig_acc_001",
  "username": "instagram_username",
  "password": "[由用户在本地文件填写]",
  "verificationCode": "[如触发二次验证再填写]"
}
```

本地开发时如果 `instagram-account-access` bin 没有被 workspace 暴露，可以使用：

```bash
node packages/instagram-account-access/dist/cli.js login --input-json login.json
```

### aiograpi-rest sessionid 登录

```bash
instagram-account-access login-with-sessionid --input-json login.json
```

`login.json`：

```json
{
  "accountId": "ig_acc_001",
  "sessionid": "[由用户在本地文件填写]"
}
```

### challenge 继续验证

```bash
instagram-account-access continue-challenge --input-json login.json
```

`login.json`：

```json
{
  "sessionRef": "sess_xxx",
  "lastJson": "{...}",
  "securityCode": "[由用户在本地文件填写]"
}
```

### 刷新 session

```bash
instagram-account-access refresh --input-json '{"sessionRef":"sess_xxx"}'
```

### official-api 启动绑定

```bash
instagram-account-access bind --zernio-config api.yml --input-json -
```

stdin JSON：

```json
{
  "profileName": "Brand profile",
  "redirectUrl": "https://example.com/callback",
  "loginMethod": "instagram_login"
}
```
