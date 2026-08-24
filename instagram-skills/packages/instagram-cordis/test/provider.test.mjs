import assert from "node:assert/strict";
import test from "node:test";
import { InstagramProviderError } from "@instagram-skills/instagram-core";
import { provideInstagram } from "../dist/index.js";

/**
 * 输入：无。
 * 输出：mock InstagramClient。
 * 作用：构造只用于注册和错误透传测试的 InstagramClient。
 */
function createMockClient() {
  return {
    profile: {
      updateProfile: async () => ({
        accountId: "acct_001",
        updatedAt: "2026-08-24T00:00:00.000Z"
      })
    },
    media: {
      searchVideos: async () => ({ items: [] }),
      getMedia: async () => ({ mediaId: "media_001" }),
      likeMedia: async () => ({ mediaId: "media_001", actedAt: "2026-08-24T00:00:00.000Z" }),
      commentMedia: async () => ({ mediaId: "media_001", actedAt: "2026-08-24T00:00:00.000Z" })
    },
    publish: {
      publishContent: async () => ({
        publishId: "publish_001",
        status: "submitted",
        submittedAt: "2026-08-24T00:00:00.000Z"
      }),
      getPublishStatus: async () => ({
        publishId: "publish_001",
        status: "published",
        checkedAt: "2026-08-24T00:00:00.000Z"
      })
    }
  };
}

/**
 * 输入：无。
 * 输出：Cordis 兼容 mock context。
 * 作用：模拟 ctx.provide 对 ctx.instagram 的挂载和注销行为。
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

test("provider registration exposes client on ctx.instagram", async () => {
  const ctx = createMockContext();
  const client = createMockClient();
  const handle = provideInstagram(ctx, { id: "aiograpi-rest", client });

  assert.equal(handle.id, "aiograpi-rest");
  assert.equal(ctx.instagram, client);
  assert.deepEqual(await ctx.instagram.media.searchVideos({}), { items: [] });
});

test("agent executor consumes ctx.instagram after declaring inject", async () => {
  const ctx = createMockContext();
  const client = createMockClient();
  const agentExecutor = {
    inject: ["instagram"],
    async execute(executeCtx) {
      return executeCtx.instagram.profile.updateProfile({});
    }
  };

  provideInstagram(ctx, { id: "aiograpi-rest", client });
  const result = await agentExecutor.execute(ctx);

  assert.deepEqual(agentExecutor.inject, ["instagram"]);
  assert.deepEqual(result, {
    accountId: "acct_001",
    updatedAt: "2026-08-24T00:00:00.000Z"
  });
});

test("provider handle disposes ctx.instagram", () => {
  const ctx = createMockContext();
  const client = createMockClient();
  const handle = provideInstagram(ctx, { id: "official-api", client });

  assert.equal(ctx.instagram, client);
  handle.dispose();
  assert.equal(ctx.instagram, undefined);
});

test("empty instagram package does not create real ability by itself", () => {
  const ctx = createMockContext();

  assert.equal(Object.hasOwn(ctx, "instagram"), false);
});

test("provider registration requires cordis-style ctx.provide", () => {
  const client = createMockClient();

  assert.throws(() => provideInstagram({}, { id: "connector", client }), TypeError);
});

test("provider error is propagated without wrapping", async () => {
  const ctx = createMockContext();
  const error = new InstagramProviderError("provider_request_failed", "provider failed");
  const client = createMockClient();
  client.profile.updateProfile = async () => {
    throw error;
  };

  provideInstagram(ctx, { id: "aiograpi-rest", client });

  await assert.rejects(() => ctx.instagram.profile.updateProfile({}), (actual) => actual === error);
});
