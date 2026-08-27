import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { apply } from "../dist/plugin.js";

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

test("plugin entry registers official-api client with binding capability", () => {
  const ctx = createMockContext();

  apply(ctx, {
    zernioBaseUrl: "https://zernio.example/api/v1",
    apiKey: "zernio_key",
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () => "{}"
    })
  });

  assert.equal(typeof ctx.instagram.profile.updateProfile, "function");
  assert.equal(typeof ctx.instagram.publish.publishContent, "function");
  assert.equal(typeof ctx.instagram.connect.createProfileAndStartInstagramBinding, "function");
});

test("plugin entry can load official-api config from api.yml", () => {
  const dir = mkdtempSync(join(tmpdir(), "zernio-plugin-config-"));
  const configPath = join(dir, "api.yml");
  const ctx = createMockContext();

  writeFileSync(configPath, "zernioBaseUrl: https://zernio.example/api/v1\napiKey: zernio_key\n", "utf8");

  try {
    apply(ctx, {
      configPath,
      fetch: async () => ({
        ok: true,
        status: 200,
        text: async () => "{}"
      })
    });

    assert.equal(typeof ctx.instagram.connect.createProfileAndStartInstagramBinding, "function");
    assert.equal(typeof ctx.instagram.publish.publishContent, "function");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
