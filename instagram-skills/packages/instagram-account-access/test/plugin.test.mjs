import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { apply } from "../dist/plugin.js";

/**
 * 输入：无。
 * 输出：Cordis 兼容 mock context。
 * 作用：模拟 ctx.provide 注册账号接入 service。
 */
function createMockContext() {
  return {
    provide(name, value) {
      this[name] = value;
      return () => {
        delete this[name];
      };
    }
  };
}

test("plugin registers account access service on ctx.instagramAccountAccess", async () => {
  const dir = await mkdtemp(join(tmpdir(), "instagram-account-access-plugin-"));
  const ctx = createMockContext();

  try {
    apply(ctx, {
      aiograpiRest: {
        baseUrl: "https://aiograpi.example",
        requestTimeoutMs: 30000,
        fetch: async () => ({ ok: true, status: 200, text: async () => "{}" })
      },
      officialApi: {
        zernioBaseUrl: "https://zernio.example/api/v1",
        apiKey: "zernio_api_key",
        requestTimeoutMs: 30000,
        fetch: async () => ({ ok: true, status: 200, text: async () => "{}" })
      },
      sessionStore: { databasePath: join(dir, "session_store.sqlite") },
      encryptSecret: (plaintext) => `cipher:${plaintext}`
    });

    assert.equal(typeof ctx.instagramAccountAccess.createPlan, "function");
    assert.equal(typeof ctx.instagramAccountAccess.loginWithPassword, "function");
    ctx.instagramAccountAccess.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
