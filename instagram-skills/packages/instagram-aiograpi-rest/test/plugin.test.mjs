import assert from "node:assert/strict";
import test from "node:test";
import { apply } from "../dist/plugin.js";

/**
 * 输入：无。
 * 输出：Cordis 兼容 mock context。
 * 作用：模拟 ctx.provide 对 ctx.instagram 的注册行为。
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

test("plugin entry registers aiograpi-rest client on ctx.instagram", () => {
  const ctx = createMockContext();

  apply(ctx, {
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () => "{}"
    })
  });

  assert.equal(typeof ctx.instagram.profile.updateProfile, "function");
  assert.equal(typeof ctx.instagram.media.searchVideos, "function");
  assert.equal(typeof ctx.instagram.publish.publishContent, "function");
});
