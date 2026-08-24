import { DatabaseSync } from "node:sqlite";
import {
  InstagramProviderError,
  type AiograpiSession,
  type ConnectorRuntimeSession,
  type InstagramProviderId,
  type InstagramProviderErrorCode,
  type InstagramSessionStore,
  type OfficialApiSession,
  type SessionRegistryRecord
} from "@instagram-skills/instagram-core";
import { SESSION_STORE_SCHEMA } from "./schema.js";

export interface SqliteInstagramSessionStoreOptions {
  databasePath: string;
}

export interface UpsertSessionRegistryInput {
  sessionRef: string;
  accountId: string;
  providerId: InstagramProviderId;
  sessionType: string;
  status: "active" | "disabled" | "expired";
  createdAt: string;
  updatedAt: string;
}

export interface UpsertAiograpiSessionInput {
  sessionRef: string;
  aiograpiSessionId: string;
  baseUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertOfficialApiSessionInput {
  sessionRef: string;
  igUserId: string;
  accessTokenCiphertext: string;
  expiresAt?: string;
  scopes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertConnectorRuntimeSessionInput {
  sessionRef: string;
  adbSerial?: string;
  runtimeHost?: string;
  artifactDir?: string;
  deviceLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export type ResolvedInstagramSession =
  | {
      providerId: "aiograpi-rest";
      registry: SessionRegistryRecord;
      session: AiograpiSession;
    }
  | {
      providerId: "official-api";
      registry: SessionRegistryRecord;
      session: OfficialApiSession;
    }
  | {
      providerId: "connector";
      registry: SessionRegistryRecord;
      session: ConnectorRuntimeSession;
    };

export type SessionResolutionStatus = "success" | "failed";

export interface SessionResolutionLogInput {
  sessionRef: string;
  providerId?: InstagramProviderId;
  sessionType?: string;
  resolutionStatus: SessionResolutionStatus;
  errorCode?: InstagramProviderErrorCode;
  message?: string;
  createdAt: string;
}

export interface SessionResolutionLogRecord extends SessionResolutionLogInput {
  id: number;
}

interface SessionRegistryRow {
  session_ref: string;
  account_id: string;
  provider_id: string;
  session_type: string;
  status: string;
}

interface AiograpiSessionRow {
  session_ref: string;
  aiograpi_session_id: string;
  base_url: string | null;
}

interface OfficialApiSessionRow {
  session_ref: string;
  ig_user_id: string;
  access_token_ciphertext: string;
  expires_at: string | null;
  scopes: string | null;
}

interface ConnectorRuntimeSessionRow {
  session_ref: string;
  adb_serial: string | null;
  runtime_host: string | null;
  artifact_dir: string | null;
  device_label: string | null;
}

interface SessionResolutionLogRow {
  id: number;
  session_ref: string;
  provider_id: string | null;
  session_type: string | null;
  resolution_status: string;
  error_code: string | null;
  message: string | null;
  created_at: string;
}

/**
 * 输入：SQLite 数据库路径。
 * 输出：SqliteInstagramSessionStore 实例。
 * 作用：创建基于 SQLite 的 sessionRef 存储和解析器。
 */
export function createSqliteInstagramSessionStore(
  options: SqliteInstagramSessionStoreOptions
): SqliteInstagramSessionStore {
  return new SqliteInstagramSessionStore(options);
}

export class SqliteInstagramSessionStore implements InstagramSessionStore {
  private readonly database: DatabaseSync;

  /**
   * 输入：SQLite 数据库路径配置。
   * 输出：SqliteInstagramSessionStore 实例。
   * 作用：打开 SQLite 数据库并启用外键约束。
   */
  constructor(options: SqliteInstagramSessionStoreOptions) {
    if (options.databasePath.trim().length === 0) {
      throw new Error("SQLITE_DATABASE_PATH_REQUIRED");
    }

    this.database = new DatabaseSync(options.databasePath);
    this.database.exec("PRAGMA foreign_keys = ON;");
  }

  /**
   * 输入：无。
   * 输出：无。
   * 作用：创建 sessionRef registry 表和 provider 专属表。
   */
  initializeSchema(): void {
    this.database.exec(SESSION_STORE_SCHEMA);
  }

  /**
   * 输入：session registry 记录。
   * 输出：无。
   * 作用：写入或更新 sessionRef 到 provider 的路由记录。
   */
  upsertRegistry(input: UpsertSessionRegistryInput): void {
    this.database
      .prepare(
        `
        INSERT INTO session_refs (
          session_ref,
          account_id,
          provider_id,
          session_type,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_ref) DO UPDATE SET
          account_id = excluded.account_id,
          provider_id = excluded.provider_id,
          session_type = excluded.session_type,
          status = excluded.status,
          updated_at = excluded.updated_at
        `
      )
      .run(
        input.sessionRef,
        input.accountId,
        input.providerId,
        input.sessionType,
        input.status,
        input.createdAt,
        input.updatedAt
      );
  }

  /**
   * 输入：aiograpi-rest session 记录。
   * 输出：无。
   * 作用：写入或更新 aiograpi-rest provider 所需 session 字段。
   */
  upsertAiograpiSession(input: UpsertAiograpiSessionInput): void {
    this.database
      .prepare(
        `
        INSERT INTO aiograpi_sessions (
          session_ref,
          aiograpi_session_id,
          base_url,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(session_ref) DO UPDATE SET
          aiograpi_session_id = excluded.aiograpi_session_id,
          base_url = excluded.base_url,
          updated_at = excluded.updated_at
        `
      )
      .run(input.sessionRef, input.aiograpiSessionId, input.baseUrl ?? null, input.createdAt, input.updatedAt);
  }

  /**
   * 输入：official-api session 记录。
   * 输出：无。
   * 作用：写入或更新官方 API provider 所需授权引用字段。
   */
  upsertOfficialApiSession(input: UpsertOfficialApiSessionInput): void {
    this.database
      .prepare(
        `
        INSERT INTO official_api_sessions (
          session_ref,
          ig_user_id,
          access_token_ciphertext,
          expires_at,
          scopes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_ref) DO UPDATE SET
          ig_user_id = excluded.ig_user_id,
          access_token_ciphertext = excluded.access_token_ciphertext,
          expires_at = excluded.expires_at,
          scopes = excluded.scopes,
          updated_at = excluded.updated_at
        `
      )
      .run(
        input.sessionRef,
        input.igUserId,
        input.accessTokenCiphertext,
        input.expiresAt ?? null,
        input.scopes ?? null,
        input.createdAt,
        input.updatedAt
      );
  }

  /**
   * 输入：connector runtime session 记录。
   * 输出：无。
   * 作用：写入或更新移动端 connector 所需 runtime 字段。
   */
  upsertConnectorRuntimeSession(input: UpsertConnectorRuntimeSessionInput): void {
    this.database
      .prepare(
        `
        INSERT INTO connector_runtime_sessions (
          session_ref,
          adb_serial,
          runtime_host,
          artifact_dir,
          device_label,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_ref) DO UPDATE SET
          adb_serial = excluded.adb_serial,
          runtime_host = excluded.runtime_host,
          artifact_dir = excluded.artifact_dir,
          device_label = excluded.device_label,
          updated_at = excluded.updated_at
        `
      )
      .run(
        input.sessionRef,
        input.adbSerial ?? null,
        input.runtimeHost ?? null,
        input.artifactDir ?? null,
        input.deviceLabel ?? null,
        input.createdAt,
        input.updatedAt
      );
  }

  /**
   * 输入：sessionRef。
   * 输出：带 provider 类型的 session 解析结果。
   * 作用：按 registry 自动路由到 provider 专属解析方法，并记录结构化解析日志。
   */
  async resolveSession(sessionRef: string): Promise<ResolvedInstagramSession> {
    let registry: SessionRegistryRecord | undefined;

    try {
      registry = await this.getRegistry(sessionRef);

      if (registry.status !== "active") {
        throw new InstagramProviderError("SESSION_NOT_ACTIVE", `sessionRef is not active: ${sessionRef}`);
      }

      switch (registry.providerId) {
        case "aiograpi-rest": {
          const session = this.readAiograpiSessionDetail(sessionRef);
          this.recordSessionResolutionLog({
            sessionRef,
            providerId: registry.providerId,
            sessionType: registry.sessionType,
            resolutionStatus: "success",
            message: "session resolved",
            createdAt: new Date().toISOString()
          });
          return { providerId: registry.providerId, registry, session };
        }
        case "official-api": {
          const session = this.readOfficialApiSessionDetail(sessionRef);
          this.recordSessionResolutionLog({
            sessionRef,
            providerId: registry.providerId,
            sessionType: registry.sessionType,
            resolutionStatus: "success",
            message: "session resolved",
            createdAt: new Date().toISOString()
          });
          return { providerId: registry.providerId, registry, session };
        }
        case "connector": {
          const session = this.readConnectorRuntimeSessionDetail(sessionRef);
          this.recordSessionResolutionLog({
            sessionRef,
            providerId: registry.providerId,
            sessionType: registry.sessionType,
            resolutionStatus: "success",
            message: "session resolved",
            createdAt: new Date().toISOString()
          });
          return { providerId: registry.providerId, registry, session };
        }
      }
    } catch (error) {
      this.recordSessionResolutionLog({
        sessionRef,
        ...(registry
          ? {
              providerId: registry.providerId,
              sessionType: registry.sessionType
            }
          : {}),
        resolutionStatus: "failed",
        ...(error instanceof InstagramProviderError ? { errorCode: error.code } : {}),
        message: error instanceof Error ? error.message : "session resolution failed",
        createdAt: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * 输入：结构化解析日志。
   * 输出：无。
   * 作用：写入不包含真实凭证和运行态细节的 sessionRef 解析日志。
   */
  recordSessionResolutionLog(input: SessionResolutionLogInput): void {
    this.database
      .prepare(
        `
        INSERT INTO session_resolution_logs (
          session_ref,
          provider_id,
          session_type,
          resolution_status,
          error_code,
          message,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        input.sessionRef,
        input.providerId ?? null,
        input.sessionType ?? null,
        input.resolutionStatus,
        input.errorCode ?? null,
        input.message ?? null,
        input.createdAt
      );
  }

  /**
   * 输入：可选 sessionRef。
   * 输出：结构化解析日志列表。
   * 作用：读取 sessionRef 解析日志，供 agent 服务写 benchmark 或 eval 数据。
   */
  listSessionResolutionLogs(sessionRef?: string): SessionResolutionLogRecord[] {
    const rows = (
      sessionRef
        ? this.database
            .prepare(
              `
              SELECT id, session_ref, provider_id, session_type, resolution_status, error_code, message, created_at
              FROM session_resolution_logs
              WHERE session_ref = ?
              ORDER BY id ASC
              `
            )
            .all(sessionRef)
        : this.database
            .prepare(
              `
              SELECT id, session_ref, provider_id, session_type, resolution_status, error_code, message, created_at
              FROM session_resolution_logs
              ORDER BY id ASC
              `
            )
            .all()
    ) as unknown as SessionResolutionLogRow[];

    return rows.map((row) => {
      const record: SessionResolutionLogRecord = {
        id: row.id,
        sessionRef: row.session_ref,
        resolutionStatus: this.toResolutionStatus(row.resolution_status),
        createdAt: row.created_at
      };

      if (row.provider_id !== null && this.isProviderId(row.provider_id)) {
        record.providerId = row.provider_id;
      }

      if (row.session_type !== null) {
        record.sessionType = row.session_type;
      }

      if (row.error_code !== null && this.isProviderErrorCode(row.error_code)) {
        record.errorCode = row.error_code;
      }

      if (row.message !== null) {
        record.message = row.message;
      }

      return record;
    });
  }

  /**
   * 输入：sessionRef。
   * 输出：registry 路由记录。
   * 作用：查询 sessionRef 对应的 provider、session 类型和状态。
   */
  async getRegistry(sessionRef: string): Promise<SessionRegistryRecord> {
    const row = this.database
      .prepare("SELECT session_ref, account_id, provider_id, session_type, status FROM session_refs WHERE session_ref = ?")
      .get(sessionRef) as SessionRegistryRow | undefined;

    if (!row) {
      throw new InstagramProviderError("SESSION_REF_NOT_FOUND", `sessionRef not found: ${sessionRef}`);
    }

    if (!this.isProviderId(row.provider_id)) {
      throw new InstagramProviderError("SESSION_DETAIL_NOT_FOUND", `unsupported provider id: ${row.provider_id}`);
    }

    if (!this.isSessionStatus(row.status)) {
      throw new InstagramProviderError("SESSION_DETAIL_NOT_FOUND", `unsupported session status: ${row.status}`);
    }

    return {
      sessionRef: row.session_ref,
      accountId: row.account_id,
      providerId: row.provider_id,
      sessionType: row.session_type,
      status: row.status
    };
  }

  /**
   * 输入：sessionRef。
   * 输出：aiograpi-rest session。
   * 作用：解析 aiograpi-rest provider 执行所需 session 字段。
   */
  async resolveAiograpi(sessionRef: string): Promise<AiograpiSession> {
    await this.assertActiveProvider(sessionRef, "aiograpi-rest");

    return this.readAiograpiSessionDetail(sessionRef);
  }

  /**
   * 输入：sessionRef。
   * 输出：aiograpi-rest session。
   * 作用：只读取 aiograpi-rest 明细，不重复校验 registry。
   */
  private readAiograpiSessionDetail(sessionRef: string): AiograpiSession {
    const row = this.database
      .prepare("SELECT session_ref, aiograpi_session_id, base_url FROM aiograpi_sessions WHERE session_ref = ?")
      .get(sessionRef) as AiograpiSessionRow | undefined;

    if (!row) {
      throw new InstagramProviderError("SESSION_DETAIL_NOT_FOUND", `aiograpi session not found: ${sessionRef}`);
    }

    const session: AiograpiSession = {
      sessionRef: row.session_ref,
      aiograpiSessionId: row.aiograpi_session_id
    };

    if (row.base_url !== null) {
      session.baseUrl = row.base_url;
    }

    return session;
  }

  /**
   * 输入：sessionRef。
   * 输出：official-api session。
   * 作用：解析官方 API provider 执行所需授权字段。
   */
  async resolveOfficialApi(sessionRef: string): Promise<OfficialApiSession> {
    await this.assertActiveProvider(sessionRef, "official-api");

    return this.readOfficialApiSessionDetail(sessionRef);
  }

  /**
   * 输入：sessionRef。
   * 输出：official-api session。
   * 作用：只读取官方 API 授权明细，不重复校验 registry。
   */
  private readOfficialApiSessionDetail(sessionRef: string): OfficialApiSession {
    const row = this.database
      .prepare(
        "SELECT session_ref, ig_user_id, access_token_ciphertext, expires_at, scopes FROM official_api_sessions WHERE session_ref = ?"
      )
      .get(sessionRef) as OfficialApiSessionRow | undefined;

    if (!row) {
      throw new InstagramProviderError("SESSION_DETAIL_NOT_FOUND", `official api session not found: ${sessionRef}`);
    }

    const session: OfficialApiSession = {
      sessionRef: row.session_ref,
      igUserId: row.ig_user_id,
      accessTokenCiphertext: row.access_token_ciphertext
    };

    if (row.expires_at !== null) {
      session.expiresAt = row.expires_at;
    }

    if (row.scopes !== null) {
      session.scopes = row.scopes;
    }

    return session;
  }

  /**
   * 输入：sessionRef。
   * 输出：connector runtime session。
   * 作用：解析移动端 connector 执行所需 runtime 字段。
   */
  async resolveConnectorRuntime(sessionRef: string): Promise<ConnectorRuntimeSession> {
    await this.assertActiveProvider(sessionRef, "connector");

    return this.readConnectorRuntimeSessionDetail(sessionRef);
  }

  /**
   * 输入：sessionRef。
   * 输出：connector runtime session。
   * 作用：只读取移动端 connector runtime 明细，不重复校验 registry。
   */
  private readConnectorRuntimeSessionDetail(sessionRef: string): ConnectorRuntimeSession {
    const row = this.database
      .prepare(
        "SELECT session_ref, adb_serial, runtime_host, artifact_dir, device_label FROM connector_runtime_sessions WHERE session_ref = ?"
      )
      .get(sessionRef) as ConnectorRuntimeSessionRow | undefined;

    if (!row) {
      throw new InstagramProviderError("SESSION_DETAIL_NOT_FOUND", `connector runtime session not found: ${sessionRef}`);
    }

    const session: ConnectorRuntimeSession = {
      sessionRef: row.session_ref
    };

    if (row.adb_serial !== null) {
      session.adbSerial = row.adb_serial;
    }

    if (row.runtime_host !== null) {
      session.runtimeHost = row.runtime_host;
    }

    if (row.artifact_dir !== null) {
      session.artifactDir = row.artifact_dir;
    }

    if (row.device_label !== null) {
      session.deviceLabel = row.device_label;
    }

    return session;
  }

  /**
   * 输入：无。
   * 输出：无。
   * 作用：关闭 SQLite 数据库连接。
   */
  close(): void {
    this.database.close();
  }

  /**
   * 输入：sessionRef 和期望 provider。
   * 输出：无。
   * 作用：确认 sessionRef 存在、状态 active，且路由到期望 provider。
   */
  private async assertActiveProvider(sessionRef: string, providerId: InstagramProviderId): Promise<void> {
    const registry = await this.getRegistry(sessionRef);

    if (registry.status !== "active") {
      throw new InstagramProviderError("SESSION_NOT_ACTIVE", `sessionRef is not active: ${sessionRef}`);
    }

    if (registry.providerId !== providerId) {
      throw new InstagramProviderError(
        "SESSION_DETAIL_NOT_FOUND",
        `sessionRef ${sessionRef} is routed to ${registry.providerId}, not ${providerId}`
      );
    }
  }

  /**
   * 输入：provider id 字符串。
   * 输出：是否为已支持 provider id。
   * 作用：把 SQLite 文本字段收窄为 InstagramProviderId。
   */
  private isProviderId(value: string): value is InstagramProviderId {
    return value === "aiograpi-rest" || value === "official-api" || value === "connector";
  }

  /**
   * 输入：session 状态字符串。
   * 输出：是否为已支持 session 状态。
   * 作用：把 SQLite 文本字段收窄为 SessionRegistryRecord.status。
   */
  private isSessionStatus(value: string): value is SessionRegistryRecord["status"] {
    return value === "active" || value === "disabled" || value === "expired";
  }

  /**
   * 输入：解析状态字符串。
   * 输出：解析状态。
   * 作用：把 SQLite 文本字段收窄为 SessionResolutionStatus。
   */
  private toResolutionStatus(value: string): SessionResolutionStatus {
    if (value === "success" || value === "failed") {
      return value;
    }

    throw new InstagramProviderError("SESSION_DETAIL_NOT_FOUND", `unsupported resolution status: ${value}`);
  }

  /**
   * 输入：provider 错误码字符串。
   * 输出：是否为已支持 provider 错误码。
   * 作用：把 SQLite 文本字段收窄为 InstagramProviderErrorCode。
   */
  private isProviderErrorCode(value: string): value is InstagramProviderErrorCode {
    return (
      value === "auth_required" ||
      value === "rate_limited" ||
      value === "unsupported_operation" ||
      value === "provider_request_failed" ||
      value === "NOT_IMPLEMENTED" ||
      value === "SESSION_REF_NOT_FOUND" ||
      value === "SESSION_NOT_ACTIVE" ||
      value === "SESSION_DETAIL_NOT_FOUND" ||
      value === "provider_validation_failed"
    );
  }
}
