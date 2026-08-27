import type { ZernioInstagramAccount } from "@instagram-skills/instagram-official-api";
import type { SqliteInstagramSessionStore } from "@instagram-skills/instagram-session-store-sqlite";

export interface SaveAiograpiSessionInput {
  store: SqliteInstagramSessionStore;
  sessionRef: string;
  accountId: string;
  aiograpiSessionId: string;
  baseUrl: string;
  settingsCiphertext: string;
  lastLoginAt?: string;
  lastRefreshAt?: string;
  now: string;
}

export interface SaveOfficialSessionInput {
  store: SqliteInstagramSessionStore;
  sessionRef: string;
  accountId: string;
  selectedAccount: ZernioInstagramAccount;
  accessTokenCiphertext: string;
  scopes?: string;
  expiresAt?: string;
  now: string;
}

/**
 * 输入：aiograpi-rest 登录结果和加密 settings。
 * 输出：无。
 * 作用：写入业务 sessionRef registry 和 aiograpi provider 专属 session。
 */
export function saveAiograpiSession(input: SaveAiograpiSessionInput): void {
  input.store.upsertRegistry({
    sessionRef: input.sessionRef,
    accountId: input.accountId,
    providerId: "aiograpi-rest",
    sessionType: "aiograpi_session",
    status: "active",
    createdAt: input.now,
    updatedAt: input.now
  });
  input.store.upsertAiograpiSession({
    sessionRef: input.sessionRef,
    aiograpiSessionId: input.aiograpiSessionId,
    baseUrl: input.baseUrl,
    settingsCiphertext: input.settingsCiphertext,
    ...(input.lastLoginAt === undefined ? {} : { lastLoginAt: input.lastLoginAt }),
    ...(input.lastRefreshAt === undefined ? {} : { lastRefreshAt: input.lastRefreshAt }),
    createdAt: input.now,
    updatedAt: input.now
  });
}

/**
 * 输入：Zernio 账号选择结果和业务 sessionRef。
 * 输出：无。
 * 作用：写入业务 sessionRef registry 和 official-api provider 专属 session。
 */
export function saveOfficialSession(input: SaveOfficialSessionInput): void {
  input.store.upsertRegistry({
    sessionRef: input.sessionRef,
    accountId: input.accountId,
    providerId: "official-api",
    sessionType: "zernio_connected_account",
    status: "active",
    createdAt: input.now,
    updatedAt: input.now
  });
  input.store.upsertOfficialApiSession({
    sessionRef: input.sessionRef,
    igUserId: input.selectedAccount.accountId,
    accessTokenCiphertext: input.accessTokenCiphertext,
    ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
    ...(input.scopes === undefined ? {} : { scopes: input.scopes }),
    createdAt: input.now,
    updatedAt: input.now
  });
}
