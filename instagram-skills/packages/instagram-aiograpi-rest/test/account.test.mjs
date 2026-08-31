import assert from "node:assert/strict";
import test from "node:test";
import { InstagramProviderError } from "../dist/index.js";
import { createAiograpiRestAccountClient } from "../dist/index.js";

/**
 * 输入：mock 响应列表。
 * 输出：mock fetch 和请求记录。
 * 作用：模拟 aiograpi-rest HTTP 服务并记录账号 client 发出的请求。
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

test("getCurrentAccount reads /account with session header", async () => {
  const mock = createMockFetch([{ status: 200, body: { pk: "25025320", username: "instagram" } }]);
  const client = createAiograpiRestAccountClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  const result = await client.getCurrentAccount({ aiograpiSessionId: "sid_001" });

  assert.equal(result.pk, "25025320");
  assert.equal(mock.requests[0].url, "https://aiograpi.example/account");
  assert.equal(mock.requests[0].init.method, "GET");
  assert.equal(mock.requests[0].init.headers["X-Session-ID"], "sid_001");
});

test("getCurrentAccountAbout reads current account then /user/about", async () => {
  const mock = createMockFetch([
    { status: 200, body: { pk: "25025320", username: "instagram" } },
    { status: 200, body: { username: "instagram", date: "February 2012" } }
  ]);
  const client = createAiograpiRestAccountClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  const result = await client.getCurrentAccountAbout({ aiograpiSessionId: "sid_001" });

  assert.equal(result.date, "February 2012");
  assert.equal(mock.requests[0].url, "https://aiograpi.example/account");
  assert.equal(mock.requests[1].url, "https://aiograpi.example/user/about?user_id=25025320");
  assert.equal(mock.requests[1].init.headers["X-Session-ID"], "sid_001");
});

test("getCurrentAccountAbout can use explicit user id", async () => {
  const mock = createMockFetch([{ status: 200, body: { username: "instagram", date: "February 2012" } }]);
  const client = createAiograpiRestAccountClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  const result = await client.getCurrentAccountAbout({ aiograpiSessionId: "sid_001", userId: "25025320" });

  assert.equal(result.date, "February 2012");
  assert.equal(mock.requests.length, 1);
  assert.equal(mock.requests[0].url, "https://aiograpi.example/user/about?user_id=25025320");
});

test("getCurrentAccountAbout requires pk from current account response", async () => {
  const mock = createMockFetch([{ status: 200, body: { username: "instagram" } }]);
  const client = createAiograpiRestAccountClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  await assert.rejects(
    () => client.getCurrentAccountAbout({ aiograpiSessionId: "sid_001" }),
    (error) => error instanceof InstagramProviderError && error.code === "provider_request_failed"
  );
});
