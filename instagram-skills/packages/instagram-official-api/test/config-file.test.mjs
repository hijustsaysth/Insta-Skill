import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_ZERNIO_BASE_URL,
  loadInstagramOfficialApiConfig
} from "../dist/index.js";

function withConfigFile(content, callback) {
  const dir = mkdtempSync(join(tmpdir(), "zernio-config-"));
  const configPath = join(dir, "api.yml");

  writeFileSync(configPath, content, "utf8");

  try {
    return callback(configPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("loads Zernio config from yaml with env interpolation", () => {
  withConfigFile(
    [
      "zernioBaseUrl: https://zernio.example/api/v1",
      "apiKey: ${ZERNIO_API_KEY}",
      "requestTimeoutMs: 45000"
    ].join("\n"),
    (configPath) => {
      const config = loadInstagramOfficialApiConfig(configPath, {
        env: { ZERNIO_API_KEY: "zernio_key" }
      });

      assert.deepEqual(config, {
        zernioBaseUrl: "https://zernio.example/api/v1",
        apiKey: "zernio_key",
        requestTimeoutMs: 45000
      });
    }
  );
});

test("uses official-api defaults when optional yaml fields are omitted", () => {
  withConfigFile("apiKey: zernio_key\n", (configPath) => {
    const config = loadInstagramOfficialApiConfig(configPath, { env: {} });

    assert.equal(config.zernioBaseUrl, DEFAULT_ZERNIO_BASE_URL);
    assert.equal(config.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS);
  });
});

test("rejects missing env placeholder value", () => {
  withConfigFile("apiKey: ${ZERNIO_API_KEY}\n", (configPath) => {
    assert.throws(
      () => loadInstagramOfficialApiConfig(configPath, { env: {} }),
      /ZERNIO_CONFIG_ENV_REQUIRED: ZERNIO_API_KEY/
    );
  });
});

test("rejects unknown yaml fields", () => {
  withConfigFile("apiKey: zernio_key\nbaseURL: https://zernio.example/api/v1\n", (configPath) => {
    assert.throws(() => loadInstagramOfficialApiConfig(configPath, { env: {} }), /ZERNIO_CONFIG_UNKNOWN_FIELD: baseURL/);
  });
});

test("rejects empty api key", () => {
  withConfigFile("apiKey: ''\n", (configPath) => {
    assert.throws(() => loadInstagramOfficialApiConfig(configPath, { env: {} }), /ZERNIO_API_KEY_REQUIRED/);
  });
});

test("rejects invalid request timeout", () => {
  withConfigFile("apiKey: zernio_key\nrequestTimeoutMs: 0\n", (configPath) => {
    assert.throws(() => loadInstagramOfficialApiConfig(configPath, { env: {} }), /ZERNIO_REQUEST_TIMEOUT_MS_INVALID/);
  });
});
