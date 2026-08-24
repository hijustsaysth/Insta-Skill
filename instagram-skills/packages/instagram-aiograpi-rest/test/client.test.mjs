import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { InstagramProviderError } from "@instagram-skills/instagram-core";
import { createAiograpiRestClient } from "../dist/index.js";

const account = {
  accountId: "acct_001",
  sessionRef: "session_001"
};

/**
 * 输入：mock 响应列表。
 * 输出：mock fetch 和请求记录。
 * 作用：模拟 aiograpi-rest HTTP 服务并记录 client 发出的请求。
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
 * 输出：JSON 请求体。
 * 作用：解析 mock fetch 收到的 JSON body。
 */
function readBody(request) {
  return request.init.body === undefined ? undefined : JSON.parse(request.init.body);
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

test("profile update sends session header and maps response", async () => {
  const mock = createMockFetch([
    {
      status: 200,
      body: {
        pk: "acct_001",
        username: "new_name"
      }
    }
  ]);
  const client = createAiograpiRestClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  const result = await client.profile.updateProfile({
    account,
    username: "new_name",
    biography: "hello"
  });

  assert.equal(result.accountId, "acct_001");
  assert.equal(typeof result.updatedAt, "string");
  assert.equal(mock.requests[0].url, "https://aiograpi.example/account");
  assert.equal(mock.requests[0].init.method, "PATCH");
  assert.equal(mock.requests[0].init.headers["X-Session-ID"], "session_001");
  assert.equal(mock.requests[0].init.headers["content-type"], "application/x-www-form-urlencoded");
  assert.equal(readForm(mock.requests[0]).get("username"), "new_name");
  assert.equal(readForm(mock.requests[0]).get("biography"), "hello");
});

test("search videos maps media items", async () => {
  const mock = createMockFetch([
    {
      status: 200,
      body: {
        items: [
          {
            media_id: "media_001",
            url: "https://example.test/reel/1",
            caption: "caption",
            author_username: "author"
          }
        ]
      }
    }
  ]);
  const client = createAiograpiRestClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    defaultSessionHeaderName: "X-Test-Session",
    fetch: mock.fetch
  });

  const result = await client.media.searchVideos({
    account,
    keyword: "coffee",
    limit: 5
  });

  assert.deepEqual(result, {
    items: [
      {
        mediaId: "media_001",
        url: "https://example.test/reel/1",
        caption: "caption",
        authorUsername: "author"
      }
    ]
  });
  assert.equal(mock.requests[0].url, "https://aiograpi.example/search/reels?query=coffee");
  assert.equal(mock.requests[0].init.method, "GET");
  assert.equal(mock.requests[0].init.headers["X-Test-Session"], "session_001");
});

test("media actions call like and comment routes", async () => {
  const mock = createMockFetch([
    { status: 200, body: { media_id: "media_001", acted_at: "2026-08-25T00:01:00.000Z" } },
    { status: 200, body: { media_id: "media_001", acted_at: "2026-08-25T00:02:00.000Z" } }
  ]);
  const client = createAiograpiRestClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  const like = await client.media.likeMedia({ account, mediaId: "media_001" });
  const comment = await client.media.commentMedia({ account, mediaId: "media_001", text: "nice" });

  assert.deepEqual(like, { mediaId: "media_001", actedAt: "2026-08-25T00:01:00.000Z" });
  assert.deepEqual(comment, { mediaId: "media_001", actedAt: "2026-08-25T00:02:00.000Z" });
  assert.equal(mock.requests[0].url, "https://aiograpi.example/media/like");
  assert.equal(mock.requests[1].url, "https://aiograpi.example/media/comment");
  assert.equal(readForm(mock.requests[0]).get("media_id"), "media_001");
  assert.equal(readForm(mock.requests[1]).get("media_id"), "media_001");
  assert.equal(readForm(mock.requests[1]).get("text"), "nice");
});

test("publish supports post story and reel routes", async () => {
  const mock = createMockFetch([
    { status: 200, body: { id: "pub_post", taken_at: "2026-08-25T00:00:00.000Z" } },
    { status: 200, body: { id: "pub_story", taken_at: "2026-08-25T00:01:00.000Z" } },
    { status: 200, body: { id: "pub_reel", taken_at: "2026-08-25T00:02:00.000Z" } }
  ]);
  const client = createAiograpiRestClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  const post = await client.publish.publishContent({
    account,
    type: "post",
    caption: "post",
    assets: [{ uri: "https://cdn.example/post.jpg", mediaType: "image", sizeBytes: 1024, aspectRatio: 1, mimeType: "image/jpeg" }]
  });
  const story = await client.publish.publishContent({
    account,
    type: "story",
    assets: [{ uri: "https://cdn.example/story.mp4", mediaType: "video", durationSeconds: 15, sizeBytes: 1024 }]
  });
  const reel = await client.publish.publishContent({
    account,
    type: "reel",
    assets: [{ uri: "https://cdn.example/reel.mp4", mediaType: "video", durationSeconds: 30, sizeBytes: 1024 }]
  });

  assert.equal(post.publishId, "pub_post");
  assert.equal(story.publishId, "pub_story");
  assert.equal(reel.publishId, "pub_reel");
  assert.equal(post.status, "published");
  assert.equal(mock.requests[0].url, "https://aiograpi.example/photo/upload/by/url");
  assert.equal(mock.requests[1].url, "https://aiograpi.example/story/upload/by/url");
  assert.equal(mock.requests[2].url, "https://aiograpi.example/clip/upload/by/url");
  assert.equal(mock.requests[0].init.headers["content-type"], "application/x-www-form-urlencoded");
  assert.equal(mock.requests[1].init.headers["content-type"], "application/x-www-form-urlencoded");
  assert.equal(mock.requests[2].init.headers["content-type"], undefined);
  assert.equal(readForm(mock.requests[0]).get("url"), "https://cdn.example/post.jpg");
  assert.equal(readForm(mock.requests[1]).get("as_video"), "true");
  assert.equal(mock.requests[2].init.body instanceof FormData, true);
});

test("publish local file uses multipart route without json content-type", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "aiograpi-rest-test-"));
  const filePath = join(tempDir, "post.jpg");

  try {
    await writeFile(filePath, "fake-image");
    const mock = createMockFetch([
      { status: 200, body: { id: "pub_file", taken_at: "2026-08-25T00:04:00.000Z" } }
    ]);
    const client = createAiograpiRestClient({
      baseUrl: "https://aiograpi.example",
      requestTimeoutMs: 30000,
      fetch: mock.fetch
    });

    const result = await client.publish.publishContent({
      account,
      type: "post",
      assets: [{ uri: filePath, mediaType: "image", sizeBytes: 1024, aspectRatio: 1, mimeType: "image/jpeg" }]
    });

    assert.equal(result.publishId, "pub_file");
    assert.equal(mock.requests[0].url, "https://aiograpi.example/photo/upload");
    assert.equal(mock.requests[0].init.headers["content-type"], undefined);
    assert.equal(mock.requests[0].init.body instanceof FormData, true);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test("publish validates unsupported asset metadata before HTTP request", async () => {
  const mock = createMockFetch([]);
  const client = createAiograpiRestClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  await assert.rejects(
    () =>
      client.publish.publishContent({
        account,
        type: "post",
        assets: [{ uri: "file:///too-large.jpg", mediaType: "image", sizeBytes: 9 * 1024 * 1024 }]
      }),
    (error) => error instanceof InstagramProviderError && error.code === "unsupported_operation"
  );
  assert.equal(mock.requests.length, 0);
});

test("publish status is explicit unsupported because aiograpi-rest has no status endpoint", async () => {
  const mock = createMockFetch([]);
  const client = createAiograpiRestClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  await assert.rejects(
    () => client.publish.getPublishStatus({ account, publishId: "pub_002" }),
    (error) => error instanceof InstagramProviderError && error.code === "unsupported_operation"
  );
  assert.equal(mock.requests.length, 0);
});

test("http errors are mapped to provider errors", async () => {
  const mock = createMockFetch([
    { status: 401, body: { message: "login required" } },
    { status: 429, body: { message: "rate limited" } },
    { status: 500, body: { message: "server failed" } }
  ]);
  const client = createAiograpiRestClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  await assert.rejects(
    () => client.media.getMedia({ account, mediaId: "media_auth" }),
    (error) => error instanceof InstagramProviderError && error.code === "auth_required"
  );
  await assert.rejects(
    () => client.media.getMedia({ account, mediaId: "media_rate" }),
    (error) => error instanceof InstagramProviderError && error.code === "rate_limited"
  );
  await assert.rejects(
    () => client.media.getMedia({ account, mediaId: "media_failed" }),
    (error) => error instanceof InstagramProviderError && error.code === "provider_request_failed"
  );
});

test("timeout aborts request and maps to provider error", async () => {
  const client = createAiograpiRestClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 1,
    fetch: async (_url, init) =>
      new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        setTimeout(() => resolve({ ok: true, status: 200, text: async () => "{}" }), 50);
      })
  });

  await assert.rejects(
    () => client.media.getMedia({ account, mediaId: "media_timeout" }),
    (error) => error instanceof InstagramProviderError && error.code === "provider_request_failed"
  );
});

test("invalid provider response fields map to provider errors", async () => {
  const missingFieldMock = createMockFetch([{ status: 200, body: { status: "submitted" } }]);
  const missingFieldClient = createAiograpiRestClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: missingFieldMock.fetch
  });

  await assert.rejects(
    () => missingFieldClient.publish.publishContent({ account, type: "post", assets: [{ uri: "https://cdn.example/post.jpg", mediaType: "image" }] }),
    (error) => error instanceof InstagramProviderError && error.code === "provider_request_failed"
  );

  const unknownStatusMock = createMockFetch([
    { status: 200, body: { publish_id: "pub_unknown", status: "queued", submitted_at: "2026-08-25T00:05:00.000Z" } }
  ]);
  const unknownStatusClient = createAiograpiRestClient({
    baseUrl: "https://aiograpi.example",
    requestTimeoutMs: 30000,
    fetch: unknownStatusMock.fetch
  });

  await assert.rejects(
    () => unknownStatusClient.publish.publishContent({ account, type: "post", assets: [{ uri: "https://cdn.example/post.jpg", mediaType: "image" }] }),
    (error) => error instanceof InstagramProviderError && error.code === "provider_request_failed"
  );
});
