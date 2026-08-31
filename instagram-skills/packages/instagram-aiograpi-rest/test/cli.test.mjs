import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { aiograpiRestCliTools, runAiograpiRestCli } from "../dist/cli.js";

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

function createStdout() {
  const chunks = [];

  return {
    stream: {
      write(chunk) {
        chunks.push(String(chunk));
        return true;
      }
    },
    json() {
      return JSON.parse(chunks.join(""));
    }
  };
}

function readForm(request) {
  assert.equal(request.init.body instanceof URLSearchParams, true);
  return request.init.body;
}

test("list-tools exposes the supported aiograpi-rest CLI actions", async () => {
  const stdout = createStdout();

  const exitCode = await runAiograpiRestCli(["list-tools"], { stdout: stdout.stream, env: {} });

  assert.equal(exitCode, 0);
  assert.deepEqual(
    stdout.json().result.tools.map((tool) => tool.name),
    aiograpiRestCliTools.map((tool) => tool.name)
  );
});

test("auth.login posts credentials and writes session cache", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "aiograpi-rest-cli-test-"));
  const cachePath = join(tempDir, "session.json");

  try {
    const mock = createMockFetch([{ status: 200, body: "sid_login" }]);
    const stdout = createStdout();
    const exitCode = await runAiograpiRestCli(
      [
        "invoke",
        "--action",
        "auth.login",
        "--base-url",
        "https://aiograpi.example",
        "--session-cache",
        cachePath,
        "--compact",
        "--input-json",
        JSON.stringify({
          username: "user_001",
          password: "pass_001",
          verificationCode: "123456",
          proxy: "http://127.0.0.1:8080",
          locale: "en_US",
          timezone: "28800",
          accountId: "acct_001"
        })
      ],
      { stdout: stdout.stream, env: {}, fetch: mock.fetch }
    );

    assert.equal(exitCode, 0);
    assert.deepEqual(stdout.json().result, { aiograpiSessionId: "sid_login" });
    assert.equal(mock.requests[0].url, "https://aiograpi.example/auth/login");
    assert.equal(mock.requests[0].init.headers["X-Session-ID"], undefined);
    assert.equal(readForm(mock.requests[0]).get("username"), "user_001");
    assert.equal(readForm(mock.requests[0]).get("password"), "pass_001");
    assert.equal(readForm(mock.requests[0]).get("verification_code"), "123456");
    assert.equal(readForm(mock.requests[0]).get("account_id"), "acct_001");

    const cache = JSON.parse(await readFile(cachePath, "utf8"));
    assert.equal(cache.aiograpiSessionId, "sid_login");
    assert.equal(cache.accountId, "acct_001");
    assert.equal(cache.username, "user_001");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("auth.relogin and auth.settings reuse cached aiograpi session", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "aiograpi-rest-cli-cache-test-"));
  const cachePath = join(tempDir, "session.json");

  try {
    await writeFile(cachePath, JSON.stringify({ aiograpiSessionId: "sid_cached", accountId: "acct_001" }));
    const mock = createMockFetch([
      { status: 200, body: true },
      { status: 200, body: "{\"cookies\":{}}" }
    ]);
    const reloginOut = createStdout();
    const settingsOut = createStdout();

    assert.equal(
      await runAiograpiRestCli(["invoke", "--action", "auth.relogin", "--session-cache", cachePath], {
        stdout: reloginOut.stream,
        env: {},
        fetch: mock.fetch
      }),
      0
    );
    assert.equal(
      await runAiograpiRestCli(["invoke", "--action", "auth.settings", "--session-cache", cachePath], {
        stdout: settingsOut.stream,
        env: {},
        fetch: mock.fetch
      }),
      0
    );

    assert.deepEqual(reloginOut.json().result, { refreshed: true });
    assert.deepEqual(settingsOut.json().result, { settings: "{\"cookies\":{}}" });
    assert.equal(mock.requests[0].url, "http://localhost:8005/auth/relogin");
    assert.equal(mock.requests[0].init.headers["X-Session-ID"], "sid_cached");
    assert.equal(mock.requests[1].url, "http://localhost:8005/auth/settings");
    assert.equal(mock.requests[1].init.headers["X-Session-ID"], "sid_cached");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("account.get reads the current account profile with the session header", async () => {
  const mock = createMockFetch([{ status: 200, body: { pk: "acct_001", username: "user_001", full_name: "Full" } }]);
  const stdout = createStdout();

  const exitCode = await runAiograpiRestCli(
    ["invoke", "--action", "account.get", "--input-json", JSON.stringify({ sessionRef: "sid_001" })],
    { stdout: stdout.stream, env: {}, fetch: mock.fetch }
  );

  assert.equal(exitCode, 0);
  assert.equal(stdout.json().result.username, "user_001");
  assert.equal(mock.requests[0].url, "http://localhost:8005/account");
  assert.equal(mock.requests[0].init.method, "GET");
  assert.equal(mock.requests[0].init.headers["X-Session-ID"], "sid_001");
});

test("account.about reads current account about details with the session header", async () => {
  const mock = createMockFetch([
    { status: 200, body: { pk: "25025320", username: "instagram" } },
    { status: 200, body: { username: "instagram", date: "February 2012" } }
  ]);
  const stdout = createStdout();

  const exitCode = await runAiograpiRestCli(
    ["invoke", "--action", "account.about", "--input-json", JSON.stringify({ sessionRef: "sid_001" })],
    { stdout: stdout.stream, env: {}, fetch: mock.fetch }
  );

  assert.equal(exitCode, 0);
  assert.equal(stdout.json().result.date, "February 2012");
  assert.equal(mock.requests[0].url, "http://localhost:8005/account");
  assert.equal(mock.requests[1].url, "http://localhost:8005/user/about?user_id=25025320");
  assert.equal(mock.requests[1].init.headers["X-Session-ID"], "sid_001");
});

test("account.about accepts explicit userId", async () => {
  const mock = createMockFetch([{ status: 200, body: { username: "instagram", date: "February 2012" } }]);
  const stdout = createStdout();

  const exitCode = await runAiograpiRestCli(
    ["invoke", "--action", "about", "--input-json", JSON.stringify({ sessionRef: "sid_001", userId: "25025320" })],
    { stdout: stdout.stream, env: {}, fetch: mock.fetch }
  );

  assert.equal(exitCode, 0);
  assert.equal(stdout.json().result.date, "February 2012");
  assert.equal(mock.requests.length, 1);
  assert.equal(mock.requests[0].url, "http://localhost:8005/user/about?user_id=25025320");
});

test("profile.update merges text fields and updates avatar separately", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "aiograpi-rest-cli-avatar-test-"));
  const avatarPath = join(tempDir, "avatar.jpg");

  try {
    await writeFile(avatarPath, "fake-avatar");
    const mock = createMockFetch([
      { status: 200, body: { pk: "acct_001" } },
      { status: 200, body: { pk: "acct_001" } }
    ]);
    const stdout = createStdout();
    const exitCode = await runAiograpiRestCli(
      [
        "invoke",
        "--action",
        "profile.update",
        "--input-json",
        JSON.stringify({
          accountId: "acct_001",
          sessionRef: "sid_001",
          username: "new_username",
          fullname: "New Full Name",
          biography: "hello world",
          avatarPath,
          confirmMutation: true
        })
      ],
      { stdout: stdout.stream, env: {}, fetch: mock.fetch }
    );

    assert.equal(exitCode, 0);
    assert.equal(stdout.json().result.accountId, "acct_001");
    assert.equal(mock.requests.length, 2);
    assert.equal(mock.requests[0].url, "http://localhost:8005/account");
    assert.equal(readForm(mock.requests[0]).get("username"), "new_username");
    assert.equal(readForm(mock.requests[0]).get("full_name"), "New Full Name");
    assert.equal(readForm(mock.requests[0]).get("biography"), "hello world");
    assert.equal(mock.requests[1].url, "http://localhost:8005/account/picture");
    assert.equal(mock.requests[1].init.body instanceof FormData, true);
    assert.notEqual(mock.requests[1].init.body.get("picture"), null);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("profile.update requires explicit mutation confirmation", async () => {
  const mock = createMockFetch([]);
  const stdout = createStdout();

  const exitCode = await runAiograpiRestCli(
    [
      "invoke",
      "--action",
      "profile.update",
      "--input-json",
      JSON.stringify({
        accountId: "acct_001",
        sessionRef: "sid_001",
        biography: "hello world"
      })
    ],
    { stdout: stdout.stream, env: {}, fetch: mock.fetch }
  );

  assert.equal(exitCode, 2);
  assert.equal(stdout.json().ok, false);
  assert.equal(stdout.json().error.message, "AIOGRAPI_REST_CLI_CONFIRM_MUTATION_REQUIRED");
  assert.equal(mock.requests.length, 0);
});
