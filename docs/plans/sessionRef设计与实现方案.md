# sessionRef 设计与实现方案

## 目标

`sessionRef` 是 agent 服务、业务 skill 和 provider 之间传递登录态/运行态引用的统一字段。

它本身必须是 opaque string，不直接暴露 access token、cookie、aiograpi session、ADB serial 或 runtime 配置。

第一版目标：

```text
业务 skill / agent 输入
  → sessionRef
  → agent 服务或 provider 执行层解析
  → 获取 provider 所需真实 session 配置
  → 执行 Instagram 能力
```

## 背景

当前各 provider 对 `sessionRef` 的真实需求不同。

| 路线 | `sessionRef` 解析结果 |
| --- | --- |
| `instagram-aiograpi-rest` | aiograpi-rest session id，用于 `X-Session-ID` |
| `instagram-official-api` | access token、IG user id、过期时间 |
| `instagram-connector` | mobile runtime session，例如 ADB serial、runtime host、artifactDir |

因此不能把 `sessionRef` 设计成固定结构，也不应让业务 skill 理解 provider 内部 session 形态。

## 设计原则

* `sessionRef` 对业务 skill 始终是普通 string
* `sessionRef` 对外保持稳定，不随 provider 内部字段变化而变化
* 真实凭证和运行态配置放在外部存储中
* 业务 skill 只透传 `sessionRef`，不解析、不保存、不打印敏感信息
* agent 服务或 provider 执行层负责解析 `sessionRef`
* 第一版采用 SQLite，不设计复杂存储引擎平台
* provider 可以维护自己的专属表，避免不同 session 结构互相污染

## 总体结构

推荐使用一个 SQLite 数据库，包含一个统一 registry 表和多个 provider 专属表。

```text
session_store.sqlite
  ├── session_refs
  ├── aiograpi_sessions
  ├── official_api_sessions
  └── connector_runtime_sessions
```

查询链路：

```text
sessionRef
  → session_refs 查 provider_id / session_type / status
  → 根据 provider_id 路由到 provider resolver
  → 查询 provider 专属表
  → 返回 provider 所需 session 配置
```

## 表设计

### session_refs

统一 registry 表，负责把 `sessionRef` 路由到具体 provider。

```sql
CREATE TABLE session_refs (
  session_ref TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  session_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `session_ref` | 对外传递的稳定 opaque id |
| `account_id` | 业务系统内账号 id |
| `provider_id` | `aiograpi-rest`、`official-api`、`connector` 等 |
| `session_type` | `api_session`、`official_auth`、`mobile_runtime` 等 |
| `status` | `active`、`disabled`、`expired` |
| `created_at` | 创建时间 |
| `updated_at` | 更新时间 |

### aiograpi_sessions

```sql
CREATE TABLE aiograpi_sessions (
  session_ref TEXT PRIMARY KEY,
  aiograpi_session_id TEXT NOT NULL,
  base_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_ref) REFERENCES session_refs(session_ref)
);
```

用途：

* `instagram-aiograpi-rest` 解析后用于生成 `X-Session-ID`
* `base_url` 可为空，默认使用 provider 配置

### official_api_sessions

```sql
CREATE TABLE official_api_sessions (
  session_ref TEXT PRIMARY KEY,
  ig_user_id TEXT NOT NULL,
  access_token_ciphertext TEXT NOT NULL,
  expires_at TEXT,
  scopes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_ref) REFERENCES session_refs(session_ref)
);
```

用途：

* `instagram-official-api` 解析后获取 access token 和 IG user id
* access token 不应明文保存，第一版至少预留密文字段

### connector_runtime_sessions

```sql
CREATE TABLE connector_runtime_sessions (
  session_ref TEXT PRIMARY KEY,
  adb_serial TEXT,
  runtime_host TEXT,
  artifact_dir TEXT,
  device_label TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_ref) REFERENCES session_refs(session_ref)
);
```

用途：

* `instagram-connector` 解析后获取移动端 runtime 配置
* 本地开发可用 `adb_serial=emulator-5554`

## Resolver 设计

第一版只需要轻量 resolver 抽象，不需要完整存储引擎。

```ts
export type InstagramProviderId =
  | "aiograpi-rest"
  | "official-api"
  | "connector";

export interface SessionRegistryRecord {
  sessionRef: string;
  accountId: string;
  providerId: InstagramProviderId;
  sessionType: string;
  status: "active" | "disabled" | "expired";
}

export interface InstagramSessionResolver<TSession> {
  resolve(sessionRef: string): Promise<TSession>;
}
```

统一解析入口：

```ts
export interface InstagramSessionStore {
  getRegistry(sessionRef: string): Promise<SessionRegistryRecord>;
  resolveAiograpi(sessionRef: string): Promise<AiograpiSession>;
  resolveOfficialApi(sessionRef: string): Promise<OfficialApiSession>;
  resolveConnectorRuntime(sessionRef: string): Promise<ConnectorRuntimeSession>;
}
```

路由逻辑：

```ts
async function resolveSession(store: InstagramSessionStore, sessionRef: string) {
  const registry = await store.getRegistry(sessionRef);

  if (registry.status !== "active") {
    throw new Error("SESSION_NOT_ACTIVE");
  }

  switch (registry.providerId) {
    case "aiograpi-rest":
      return store.resolveAiograpi(sessionRef);
    case "official-api":
      return store.resolveOfficialApi(sessionRef);
    case "connector":
      return store.resolveConnectorRuntime(sessionRef);
  }
}
```

## 各包使用边界

### instagram-core

* 只定义 `InstagramSessionRef` branded type
* 不实现 resolver
* 不依赖 SQLite
* 不保存真实 session 内容

### 业务 skill 包

包括：

* `instagram-warmup-orchestrator`
* `instagram-profile-setup`
* `instagram-video-interaction`
* `instagram-content-publish`

职责：

* 输入/输出中只保留 `sessionRef: string`
* 只透传 `sessionRef`
* 不解析 session
* 不访问 SQLite
* 不打印 token、cookie、ADB serial 等真实配置

### provider / connector 包

| 包 | 解析方式 |
| --- | --- |
| `instagram-aiograpi-rest` | 通过 resolver 获取 aiograpi session id |
| `instagram-official-api` | 通过 resolver 获取 access token 和 IG user id |
| `instagram-connector` | 通过 resolver 获取 runtime host、ADB serial、artifactDir |

provider 可以直接接收已经解析好的 session，也可以由 agent 服务注入 resolver。

第一版推荐由 agent 服务持有 SQLite store，并在创建 provider/client 或调用 MCP tool 前完成解析。

## 执行链路示例

### aiograpi-rest

```text
agent 服务读取发布计划
  → sessionRef=sess_aiograpi_001
  → session_refs.provider_id=aiograpi-rest
  → aiograpi_sessions.aiograpi_session_id
  → 调用 aiograpi-rest，携带 X-Session-ID
```

### official-api

```text
agent 服务读取发布计划
  → sessionRef=sess_official_001
  → session_refs.provider_id=official-api
  → official_api_sessions.access_token_ciphertext / ig_user_id
  → 解密 token
  → 调用 Instagram 官方 API
```

### connector

```text
agent 服务读取视频互动计划
  → sessionRef=sess_connector_001
  → session_refs.provider_id=connector
  → connector_runtime_sessions.adb_serial / runtime_host / artifact_dir
  → 调用 instagram-connector MCP tool
```

## 安全要求

* `sessionRef` 不能包含明文 token、cookie、密码或 ADB 连接细节
* token 类字段必须避免明文输出到日志
* SQLite 文件应放在 agent 服务私有数据目录
* 官方 API token 建议加密后写入 `access_token_ciphertext`
* 业务 skill 的结构化日志只记录 `sessionRef` 和 provider id，不记录真实凭证
* `sessionRef` 不存在、失效或过期时快速失败，不伪造可执行 session

## 第一版实现步骤

1. 新建 SQLite 数据库 `session_store.sqlite`。
2. 创建 `session_refs` registry 表。
3. 创建三个 provider 专属表：`aiograpi_sessions`、`official_api_sessions`、`connector_runtime_sessions`。
4. 实现 `SqliteInstagramSessionStore`。
5. 实现 `getRegistry(sessionRef)`。
6. 实现 provider 专属解析方法。
7. 在 agent 服务或 provider 执行层注入 session store。
8. 在执行 provider 调用或 MCP tool 调用前解析 `sessionRef`。
9. 在结构化日志中记录 `sessionRef`、`providerId`、解析状态和执行结果。

## 验收场景

| 场景 | 用例 | 预期 |
| --- | --- | --- |
| registry 路由 | 输入有效 `sessionRef` | 能从 `session_refs` 查到 `provider_id` |
| aiograpi 解析 | `provider_id=aiograpi-rest` | 返回 aiograpi session id |
| official 解析 | `provider_id=official-api` | 返回 IG user id 和解密后的 access token |
| connector 解析 | `provider_id=connector` | 返回 ADB serial / runtime host / artifactDir |
| session 缺失 | `sessionRef` 不存在 | 返回 `SESSION_REF_NOT_FOUND` |
| session 非 active | `status=disabled` 或 `expired` | 返回 `SESSION_NOT_ACTIVE` |
| provider 表缺失 | registry 存在但 provider 专属表无记录 | 返回 `SESSION_DETAIL_NOT_FOUND` |
| skill 边界 | 业务 skill 生成计划 | 只透传 `sessionRef`，不读取 SQLite |
| 日志安全 | 执行失败后写结构化日志 | 不包含 access token、cookie 或 ADB 细节 |

## 第一版不做

* 不做复杂存储引擎插件系统
* 不做多数据库后端
* 不做账号池调度
* 不做 provider fallback 策略
* 不做 OAuth 授权页面
* 不做 token 自动刷新
* 不做跨机器 runtime 调度

## 后续扩展

后续如需从 SQLite 迁移到 Postgres、Secret Manager 或远端 session 服务，应保持 `InstagramSessionStore` 接口稳定，只替换实现。

如果引入 `instagram-protocol`，应把 `sessionRef`、provider id、错误码和 MCP tool schema 固化到协议层，避免 TS agent 和 Python agent 各自定义一套字段。
