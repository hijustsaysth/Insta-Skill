import assert from "node:assert/strict";
import test from "node:test";
import { InstagramProviderError } from "@instagram-skills/instagram-core";
import { createAiograpiRestAuthClient } from "../dist/index.js";

/**
 * 输入：mock 响应列表。
 * 输出：mock fetch 和请求记录。
 * 作用：模拟 aiograpi-rest HTTP 服务并记录认证 client 发出的请求。
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
 * 输入：请求记录。
 * 输出：URLSearchParams 请求体。
 * 作用：解析 mock fetch 收到的 form-urlencoded body。
 */
function readForm(request) {
  assert.equal(request.init.body instanceof URLSearchParams, true);
  return request.init.body;
}

test("login sends credentials without session header and returns aiograpi session id", async () => {
  const mock = createMockFetch([{ status: 200, body: "aiograpi_session_001" }]);
  const client = createAiograpiRestAuthClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  const result = await client.login({
    username: "user_001",
    password: "password_001",
    verificationCode: "123456",
    proxy: "http://127.0.0.1:8080",
    locale: "en_US",
    timezone: "28800"
  });

  assert.deepEqual(result, { aiograpiSessionId: "aiograpi_session_001" });
  assert.equal(mock.requests[0].url, "https://aiograpi.example/auth/login");
  assert.equal(mock.requests[0].init.method, "POST");
  assert.equal(mock.requests[0].init.headers["X-Session-ID"], undefined);
  assert.equal(mock.requests[0].init.headers["content-type"], "application/x-www-form-urlencoded");
  assert.equal(readForm(mock.requests[0]).get("username"), "user_001");
  assert.equal(readForm(mock.requests[0]).get("verification_code"), "123456");
});

test("loginBySessionId sends existing Instagram sessionid without session header", async () => {
  const mock = createMockFetch([{ status: 200, body: "aiograpi_session_cookie_001" }]);
  const client = createAiograpiRestAuthClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  const result = await client.loginBySessionId({
    sessionid: "instagram_cookie_sessionid",
    locale: "en_US"
  });

  assert.deepEqual(result, { aiograpiSessionId: "aiograpi_session_cookie_001" });
  assert.equal(mock.requests[0].url, "https://aiograpi.example/auth/login/by/sessionid");
  assert.equal(mock.requests[0].init.headers["X-Session-ID"], undefined);
  assert.equal(readForm(mock.requests[0]).get("sessionid"), "instagram_cookie_sessionid");
});

test("relogin refreshes existing aiograpi session with session header", async () => {
  const mock = createMockFetch([{ status: 200, body: true }]);
  const client = createAiograpiRestAuthClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  const result = await client.relogin({ aiograpiSessionId: "aiograpi_session_001" });

  assert.deepEqual(result, { refreshed: true });
  assert.equal(mock.requests[0].url, "https://aiograpi.example/auth/relogin");
  assert.equal(mock.requests[0].init.method, "PATCH");
  assert.equal(mock.requests[0].init.headers["X-Session-ID"], "aiograpi_session_001");
});

test("resolveChallenge continues challenge flow with last_json and security_code", async () => {
  const mock = createMockFetch([{ status: 200, body: true }]);
  const client = createAiograpiRestAuthClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  const result = await client.resolveChallenge({
    aiograpiSessionId: "aiograpi_session_001",
    lastJson: "{\"challenge\":true}",
    securityCode: "654321"
  });

  assert.deepEqual(result, { resolved: true });
  assert.equal(mock.requests[0].url, "https://aiograpi.example/auth/challenge/resolve");
  assert.equal(mock.requests[0].init.headers["X-Session-ID"], "aiograpi_session_001");
  assert.equal(readForm(mock.requests[0]).get("last_json"), "{\"challenge\":true}");
  assert.equal(readForm(mock.requests[0]).get("security_code"), "654321");
});

test("exportSettings returns saved aiograpi settings string", async () => {
  const mock = createMockFetch([{ status: 200, body: "{\"cookies\":{}}" }]);
  const client = createAiograpiRestAuthClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  const result = await client.exportSettings({ aiograpiSessionId: "aiograpi_session_001" });

  assert.deepEqual(result, { settings: "{\"cookies\":{}}" });
  assert.equal(mock.requests[0].url, "https://aiograpi.example/auth/settings");
  assert.equal(mock.requests[0].init.method, "GET");
  assert.equal(mock.requests[0].init.headers["X-Session-ID"], "aiograpi_session_001");
});

test("exportSettings serializes aiograpi settings object", async () => {
  const mock = createMockFetch([{ status: 200, body: { cookies: {}, device_settings: { app_version: "1" } } }]);
  const client = createAiograpiRestAuthClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  const result = await client.exportSettings({ aiograpiSessionId: "aiograpi_session_001" });

  assert.deepEqual(result, { settings: "{\"cookies\":{},\"device_settings\":{\"app_version\":\"1\"}}" });
});

test("login requires stable string session id from aiograpi-rest", async () => {
  const trueMock = createMockFetch([{ status: 200, body: true }]);
  const trueClient = createAiograpiRestAuthClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: trueMock.fetch
  });

  await assert.rejects(
    () => trueClient.login({ username: "user_001", password: "password_001" }),
    (error) => error instanceof InstagramProviderError && error.code === "provider_request_failed"
  );

  const falseMock = createMockFetch([{ status: 200, body: false }]);
  const falseClient = createAiograpiRestAuthClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: falseMock.fetch
  });

  await assert.rejects(
    () => falseClient.login({ username: "user_001", password: "password_001" }),
    (error) => error instanceof InstagramProviderError && error.code === "auth_required"
  );
});
