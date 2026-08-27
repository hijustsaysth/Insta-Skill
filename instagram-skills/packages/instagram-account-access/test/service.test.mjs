import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSqliteInstagramSessionStore } from "@instagram-skills/instagram-session-store-sqlite";
import { createInstagramAccountAccessService } from "../dist/index.js";

const now = new Date("2026-08-25T00:00:00.000Z");

/**
 * 输入：mock 响应列表。
 * 输出：mock fetch 和请求记录。
 * 作用：模拟 provider HTTP 服务并记录请求。
 */
function createMockFetch(responses) {
  const requests = [];

  return {
    requests,
    fetch: async (url, init) => {
      requests.push({ url, init });
      const response = responses.shift() ?? { status: 200, body: {} };

      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        statusText: response.statusText,
        text: async () => JSON.stringify(response.body ?? {})
      };
    }
  };
}

/**
 * 输入：测试回调。
 * 输出：测试回调返回值。
 * 作用：为 account-access service 创建独立 SQLite 文件并清理。
 */
async function withService(callback, aiograpiResponses = [], officialResponses = []) {
  const dir = await mkdtemp(join(tmpdir(), "instagram-account-access-"));
  const databasePath = join(dir, "session_store.sqlite");
  const aiograpi = createMockFetch(aiograpiResponses);
  const official = createMockFetch(officialResponses);
  const service = createInstagramAccountAccessService({
    aiograpiRest: {
      baseUrl: "https://aiograpi.example",
      requestTimeoutMs: 30000,
      fetch: aiograpi.fetch
    },
    officialApi: {
      zernioBaseUrl: "https://zernio.example/api/v1",
      apiKey: "zernio_api_key",
      requestTimeoutMs: 30000,
      fetch: official.fetch
    },
    sessionStore: { databasePath },
    encryptSecret: (plaintext) => `cipher:${plaintext}`,
    now: () => now,
    createSessionRef: () => "sess_generated_001"
  });

  try {
    return await callback({ service, databasePath, aiograpi, official });
  } finally {
    service.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test("loginWithPassword logs in exports settings and writes aiograpi session", async () => {
  await withService(
    async ({ service, databasePath, aiograpi }) => {
      const result = await service.loginWithPassword({
        planId: "plan_login",
        accountId: "acct_001",
        username: "user_001",
        password: "password_001",
        verificationCode: "123456"
      });

      assert.deepEqual(result, {
        planId: "plan_login",
        providerId: "aiograpi-rest",
        action: "aiograpi_login_with_password",
        status: "success",
        sessionRef: "sess_generated_001",
        accountId: "acct_001",
        safeMessage: "aiograpi-rest login saved"
      });
      assert.equal(aiograpi.requests[0].url, "https://aiograpi.example/auth/login");
      assert.equal(aiograpi.requests[0].init.headers["X-Session-ID"], undefined);
      assert.equal(aiograpi.requests[1].url, "https://aiograpi.example/auth/settings");
      assert.equal(aiograpi.requests[1].init.headers["X-Session-ID"], "aiograpi_session_001");

      const store = createSqliteInstagramSessionStore({ databasePath });
      store.initializeSchema();

      try {
        const resolved = await store.resolveAiograpi("sess_generated_001");

        assert.equal(resolved.aiograpiSessionId, "aiograpi_session_001");
        assert.equal(resolved.settingsCiphertext, "cipher:{\"cookies\":{}}");
        assert.equal(resolved.lastLoginAt, "2026-08-25T00:00:00.000Z");
      } finally {
        store.close();
      }
    },
    [
      { status: 200, body: "aiograpi_session_001" },
      { status: 200, body: "{\"cookies\":{}}" }
    ]
  );
});

test("relogin resolves stored session refreshes it and updates settings", async () => {
  await withService(
    async ({ service, databasePath }) => {
      await service.loginWithSessionId({
        accountId: "acct_002",
        sessionRef: "sess_existing_001",
        sessionid: "instagram_sessionid"
      });

      const result = await service.relogin({
        planId: "plan_relogin",
        sessionRef: "sess_existing_001"
      });

      assert.equal(result.status, "success");
      assert.equal(result.sessionRef, "sess_existing_001");

      const store = createSqliteInstagramSessionStore({ databasePath });
      store.initializeSchema();

      try {
        const resolved = await store.resolveAiograpi("sess_existing_001");

        assert.equal(resolved.aiograpiSessionId, "aiograpi_session_cookie_001");
        assert.equal(resolved.settingsCiphertext, "cipher:{\"cookies\":{\"fresh\":true}}");
        assert.equal(resolved.lastRefreshAt, "2026-08-25T00:00:00.000Z");
      } finally {
        store.close();
      }
    },
    [
      { status: 200, body: "aiograpi_session_cookie_001" },
      { status: 200, body: "{\"cookies\":{\"old\":true}}" },
      { status: 200, body: true },
      { status: 200, body: "{\"cookies\":{\"fresh\":true}}" }
    ]
  );
});

test("startOfficialBinding creates profile and returns public auth url", async () => {
  await withService(
    async ({ service, official }) => {
      const result = await service.startOfficialBinding({
        planId: "plan_official",
        profileName: "Brand profile",
        redirectUrl: "https://example.com/callback",
        loginMethod: "instagram_login"
      });

      assert.equal(result.status, "requires_input");
      assert.equal(result.nextStep, "open_auth_url");
      assert.equal(result.publicData.profileId, "profile_001");
      assert.equal(result.publicData.authUrl, "https://zernio.example/auth");
      assert.equal(official.requests[0].url, "https://zernio.example/api/v1/profiles");
      assert.equal(official.requests[1].url.includes("/connect/instagram"), true);
    },
    [],
    [
      { status: 200, body: { profile: { _id: "profile_001", name: "Brand profile" } } },
      { status: 200, body: { authUrl: "https://zernio.example/auth", state: "state_001" } }
    ]
  );
});

test("selectOfficialAccount writes official-api session", async () => {
  await withService(
    async ({ service, databasePath }) => {
      const result = await service.selectOfficialAccount({
        planId: "plan_select",
        profileId: "profile_001",
        pageId: "page_001",
        tempToken: "temp_token",
        scopes: "instagram_business_content_publish"
      });

      assert.equal(result.status, "success");
      assert.equal(result.providerId, "official-api");
      assert.equal(result.sessionRef, "zernio_account_001");

      const store = createSqliteInstagramSessionStore({ databasePath });
      store.initializeSchema();

      try {
        const resolved = await store.resolveOfficialApi("zernio_account_001");

        assert.equal(resolved.igUserId, "zernio_account_001");
        assert.equal(resolved.accessTokenCiphertext, "cipher:zernio_account_001");
        assert.equal(resolved.scopes, "instagram_business_content_publish");
      } finally {
        store.close();
      }
    },
    [],
    [
      {
        status: 200,
        body: {
          account: {
            accountId: "zernio_account_001",
            profileId: "profile_001",
            username: "brand_ig"
          }
        }
      }
    ]
  );
});

test("service rejects plaintext secret encryptor before writing settings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "instagram-account-access-plaintext-"));
  const databasePath = join(dir, "session_store.sqlite");
  const aiograpi = createMockFetch([
    { status: 200, body: "aiograpi_session_001" },
    { status: 200, body: { cookies: { sessionid: "raw-session" } } }
  ]);
  const service = createInstagramAccountAccessService({
    aiograpiRest: {
      baseUrl: "https://aiograpi.example",
      requestTimeoutMs: 30000,
      fetch: aiograpi.fetch
    },
    sessionStore: { databasePath },
    encryptSecret: (plaintext) => plaintext,
    now: () => now,
    createSessionRef: () => "sess_generated_001"
  });

  try {
    await assert.rejects(
      () =>
        service.loginWithPassword({
          accountId: "acct_001",
          username: "user_001",
          password: "password_001"
        }),
      /INSECURE_SECRET_ENCRYPTOR_REJECTED/
    );
  } finally {
    service.close();
    await rm(dir, { recursive: true, force: true });
  }
});
