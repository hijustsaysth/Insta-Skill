import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  SqliteInstagramSessionStore,
  createSqliteInstagramSessionStore
} from "../dist/index.js";
import { InstagramProviderError } from "@instagram-skills/instagram-core";

const now = "2026-08-24T00:00:00.000Z";

/**
 * 输入：测试回调。
 * 输出：测试回调返回值。
 * 作用：为每个用例创建独立 SQLite 文件，并在用例结束后清理。
 */
async function withStore(callback) {
  const dir = await mkdtemp(join(tmpdir(), "instagram-session-store-"));
  const databasePath = join(dir, "session_store.sqlite");
  const store = createSqliteInstagramSessionStore({ databasePath });

  store.initializeSchema();

  try {
    return await callback(store, databasePath);
  } finally {
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test("registry routes sessionRef to provider", async () => {
  await withStore(async (store) => {
    store.upsertRegistry({
      sessionRef: "sess_aiograpi_001",
      accountId: "acct_001",
      providerId: "aiograpi-rest",
      sessionType: "api_session",
      status: "active",
      createdAt: now,
      updatedAt: now
    });

    const registry = await store.getRegistry("sess_aiograpi_001");

    assert.deepEqual(registry, {
      sessionRef: "sess_aiograpi_001",
      accountId: "acct_001",
      providerId: "aiograpi-rest",
      sessionType: "api_session",
      status: "active"
    });
  });
});

test("aiograpi session resolves provider-specific session id", async () => {
  await withStore(async (store) => {
    store.upsertRegistry({
      sessionRef: "sess_aiograpi_001",
      accountId: "acct_001",
      providerId: "aiograpi-rest",
      sessionType: "api_session",
      status: "active",
      createdAt: now,
      updatedAt: now
    });
    store.upsertAiograpiSession({
      sessionRef: "sess_aiograpi_001",
      aiograpiSessionId: "aiograpi_session_001",
      baseUrl: "http://127.0.0.1:8000",
      createdAt: now,
      updatedAt: now
    });

    const session = await store.resolveAiograpi("sess_aiograpi_001");

    assert.deepEqual(session, {
      sessionRef: "sess_aiograpi_001",
      aiograpiSessionId: "aiograpi_session_001",
      baseUrl: "http://127.0.0.1:8000"
    });
  });
});

test("official api session resolves token reference and IG user id", async () => {
  await withStore(async (store) => {
    store.upsertRegistry({
      sessionRef: "sess_official_001",
      accountId: "acct_002",
      providerId: "official-api",
      sessionType: "official_auth",
      status: "active",
      createdAt: now,
      updatedAt: now
    });
    store.upsertOfficialApiSession({
      sessionRef: "sess_official_001",
      igUserId: "17890000000000000",
      accessTokenCiphertext: "ciphertext-token",
      expiresAt: "2026-09-24T00:00:00.000Z",
      scopes: "instagram_basic,instagram_content_publish",
      createdAt: now,
      updatedAt: now
    });

    const session = await store.resolveOfficialApi("sess_official_001");

    assert.deepEqual(session, {
      sessionRef: "sess_official_001",
      igUserId: "17890000000000000",
      accessTokenCiphertext: "ciphertext-token",
      expiresAt: "2026-09-24T00:00:00.000Z",
      scopes: "instagram_basic,instagram_content_publish"
    });
  });
});

test("connector session resolves runtime configuration", async () => {
  await withStore(async (store) => {
    store.upsertRegistry({
      sessionRef: "sess_connector_001",
      accountId: "acct_003",
      providerId: "connector",
      sessionType: "mobile_runtime",
      status: "active",
      createdAt: now,
      updatedAt: now
    });
    store.upsertConnectorRuntimeSession({
      sessionRef: "sess_connector_001",
      adbSerial: "emulator-5554",
      runtimeHost: "http://127.0.0.1:3000",
      artifactDir: "F:/tmp/connector-artifacts",
      deviceLabel: "local-emulator",
      createdAt: now,
      updatedAt: now
    });

    const session = await store.resolveConnectorRuntime("sess_connector_001");

    assert.deepEqual(session, {
      sessionRef: "sess_connector_001",
      adbSerial: "emulator-5554",
      runtimeHost: "http://127.0.0.1:3000",
      artifactDir: "F:/tmp/connector-artifacts",
      deviceLabel: "local-emulator"
    });
  });
});

test("unified route resolves session by registry provider", async () => {
  await withStore(async (store) => {
    store.upsertRegistry({
      sessionRef: "sess_route_aiograpi_001",
      accountId: "acct_006",
      providerId: "aiograpi-rest",
      sessionType: "api_session",
      status: "active",
      createdAt: now,
      updatedAt: now
    });
    store.upsertAiograpiSession({
      sessionRef: "sess_route_aiograpi_001",
      aiograpiSessionId: "aiograpi_session_routed",
      createdAt: now,
      updatedAt: now
    });

    const resolved = await store.resolveSession("sess_route_aiograpi_001");

    assert.equal(resolved.providerId, "aiograpi-rest");
    assert.equal(resolved.registry.providerId, "aiograpi-rest");
    assert.equal(resolved.session.sessionRef, "sess_route_aiograpi_001");
    assert.equal(resolved.session.aiograpiSessionId, "aiograpi_session_routed");
  });
});

test("successful unified route writes structured resolution log", async () => {
  await withStore(async (store) => {
    store.upsertRegistry({
      sessionRef: "sess_log_success_001",
      accountId: "acct_007",
      providerId: "official-api",
      sessionType: "official_auth",
      status: "active",
      createdAt: now,
      updatedAt: now
    });
    store.upsertOfficialApiSession({
      sessionRef: "sess_log_success_001",
      igUserId: "17890000000000001",
      accessTokenCiphertext: "secret-ciphertext",
      createdAt: now,
      updatedAt: now
    });

    await store.resolveSession("sess_log_success_001");

    const logs = store.listSessionResolutionLogs("sess_log_success_001");
    const serializedLogs = JSON.stringify(logs);

    assert.equal(logs.length, 1);
    assert.equal(logs[0].sessionRef, "sess_log_success_001");
    assert.equal(logs[0].providerId, "official-api");
    assert.equal(logs[0].sessionType, "official_auth");
    assert.equal(logs[0].resolutionStatus, "success");
    assert.equal(logs[0].errorCode, undefined);
    assert.equal(serializedLogs.includes("secret-ciphertext"), false);
    assert.equal(serializedLogs.includes("17890000000000001"), false);
  });
});

test("missing sessionRef fails fast", async () => {
  await withStore(async (store) => {
    await assert.rejects(
      () => store.getRegistry("missing_session"),
      (error) => error instanceof InstagramProviderError && error.code === "SESSION_REF_NOT_FOUND"
    );
  });
});

test("missing sessionRef writes failed structured resolution log", async () => {
  await withStore(async (store) => {
    await assert.rejects(
      () => store.resolveSession("missing_session"),
      (error) => error instanceof InstagramProviderError && error.code === "SESSION_REF_NOT_FOUND"
    );

    const logs = store.listSessionResolutionLogs("missing_session");

    assert.equal(logs.length, 1);
    assert.equal(logs[0].sessionRef, "missing_session");
    assert.equal(logs[0].providerId, undefined);
    assert.equal(logs[0].resolutionStatus, "failed");
    assert.equal(logs[0].errorCode, "SESSION_REF_NOT_FOUND");
  });
});

test("disabled or expired session fails as not active", async () => {
  await withStore(async (store) => {
    store.upsertRegistry({
      sessionRef: "sess_disabled_001",
      accountId: "acct_004",
      providerId: "aiograpi-rest",
      sessionType: "api_session",
      status: "disabled",
      createdAt: now,
      updatedAt: now
    });

    await assert.rejects(
      () => store.resolveAiograpi("sess_disabled_001"),
      (error) => error instanceof InstagramProviderError && error.code === "SESSION_NOT_ACTIVE"
    );
  });
});

test("inactive session writes provider-aware failed resolution log", async () => {
  await withStore(async (store) => {
    store.upsertRegistry({
      sessionRef: "sess_expired_001",
      accountId: "acct_008",
      providerId: "connector",
      sessionType: "mobile_runtime",
      status: "expired",
      createdAt: now,
      updatedAt: now
    });

    await assert.rejects(
      () => store.resolveSession("sess_expired_001"),
      (error) => error instanceof InstagramProviderError && error.code === "SESSION_NOT_ACTIVE"
    );

    const logs = store.listSessionResolutionLogs("sess_expired_001");

    assert.equal(logs.length, 1);
    assert.equal(logs[0].providerId, "connector");
    assert.equal(logs[0].sessionType, "mobile_runtime");
    assert.equal(logs[0].resolutionStatus, "failed");
    assert.equal(logs[0].errorCode, "SESSION_NOT_ACTIVE");
  });
});

test("registry without provider detail fails fast", async () => {
  await withStore(async (store) => {
    store.upsertRegistry({
      sessionRef: "sess_missing_detail_001",
      accountId: "acct_005",
      providerId: "connector",
      sessionType: "mobile_runtime",
      status: "active",
      createdAt: now,
      updatedAt: now
    });

    await assert.rejects(
      () => store.resolveConnectorRuntime("sess_missing_detail_001"),
      (error) => error instanceof InstagramProviderError && error.code === "SESSION_DETAIL_NOT_FOUND"
    );
  });
});

test("manual structured logs can be listed globally and by sessionRef", async () => {
  await withStore(async (store) => {
    store.recordSessionResolutionLog({
      sessionRef: "sess_manual_001",
      providerId: "connector",
      sessionType: "mobile_runtime",
      resolutionStatus: "success",
      message: "manual log",
      createdAt: now
    });
    store.recordSessionResolutionLog({
      sessionRef: "sess_manual_002",
      resolutionStatus: "failed",
      errorCode: "SESSION_REF_NOT_FOUND",
      message: "missing",
      createdAt: now
    });

    const allLogs = store.listSessionResolutionLogs();
    const filteredLogs = store.listSessionResolutionLogs("sess_manual_001");

    assert.equal(allLogs.length, 2);
    assert.equal(filteredLogs.length, 1);
    assert.equal(filteredLogs[0].sessionRef, "sess_manual_001");
    assert.equal(filteredLogs[0].providerId, "connector");
    assert.equal(filteredLogs[0].resolutionStatus, "success");
  });
});

test("database rejects unsupported provider and status values", async () => {
  await withStore(async (store) => {
    assert.throws(() =>
      store.upsertRegistry({
        sessionRef: "sess_invalid_provider_001",
        accountId: "acct_010",
        providerId: "unsupported-provider",
        sessionType: "api_session",
        status: "active",
        createdAt: now,
        updatedAt: now
      })
    );

    assert.throws(() =>
      store.upsertRegistry({
        sessionRef: "sess_invalid_status_001",
        accountId: "acct_010",
        providerId: "aiograpi-rest",
        sessionType: "api_session",
        status: "paused",
        createdAt: now,
        updatedAt: now
      })
    );
  });
});

test("database rejects blank required text fields", async () => {
  await withStore(async (store) => {
    assert.throws(() =>
      store.upsertRegistry({
        sessionRef: " ",
        accountId: "acct_011",
        providerId: "aiograpi-rest",
        sessionType: "api_session",
        status: "active",
        createdAt: now,
        updatedAt: now
      })
    );

    store.upsertRegistry({
      sessionRef: "sess_blank_detail_001",
      accountId: "acct_011",
      providerId: "aiograpi-rest",
      sessionType: "api_session",
      status: "active",
      createdAt: now,
      updatedAt: now
    });

    assert.throws(() =>
      store.upsertAiograpiSession({
        sessionRef: "sess_blank_detail_001",
        aiograpiSessionId: " ",
        createdAt: now,
        updatedAt: now
      })
    );
  });
});

test("database rejects invalid structured log values", async () => {
  await withStore(async (store) => {
    assert.throws(() =>
      store.recordSessionResolutionLog({
        sessionRef: "sess_bad_log_001",
        resolutionStatus: "pending",
        createdAt: now
      })
    );

    assert.throws(() =>
      store.recordSessionResolutionLog({
        sessionRef: "sess_bad_log_002",
        providerId: "unsupported-provider",
        resolutionStatus: "failed",
        createdAt: now
      })
    );
  });
});

test("provider detail rows are removed when registry row is deleted", async () => {
  await withStore(async (store, databasePath) => {
    store.upsertRegistry({
      sessionRef: "sess_cascade_001",
      accountId: "acct_012",
      providerId: "connector",
      sessionType: "mobile_runtime",
      status: "active",
      createdAt: now,
      updatedAt: now
    });
    store.upsertConnectorRuntimeSession({
      sessionRef: "sess_cascade_001",
      adbSerial: "emulator-5554",
      createdAt: now,
      updatedAt: now
    });

    const database = new DatabaseSync(databasePath);
    database.exec("PRAGMA foreign_keys = ON;");

    try {
      database.prepare("DELETE FROM session_refs WHERE session_ref = ?").run("sess_cascade_001");
      const row = database
        .prepare("SELECT session_ref FROM connector_runtime_sessions WHERE session_ref = ?")
        .get("sess_cascade_001");

      assert.equal(row, undefined);
    } finally {
      database.close();
    }
  });
});
