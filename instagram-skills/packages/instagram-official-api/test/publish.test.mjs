import assert from "node:assert/strict";
import test from "node:test";
import { InstagramProviderError } from "@instagram-skills/instagram-core";
import { createInstagramOfficialApiClient } from "../dist/index.js";

const account = {
  accountId: "core_account_001",
  sessionRef: "zernio_account_001"
};

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

function createClient(mock) {
  return createInstagramOfficialApiClient({
    zernioBaseUrl: "https://zernio.example/api/v1",
    apiKey: "zernio_key",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });
}

function readBody(request) {
  return request.init.body === undefined ? undefined : JSON.parse(request.init.body);
}

test("feed image publish sends Zernio create post request", async () => {
  const mock = createMockFetch([
    {
      status: 201,
      body: {
        post: {
          _id: "post_001",
          status: "published",
          createdAt: "2026-08-25T00:00:00.000Z"
        }
      }
    }
  ]);
  const client = createClient(mock);

  const result = await client.publish.publishContent({
    account,
    type: "post",
    caption: "hello instagram",
    tags: ["launch"],
    assets: [
      {
        uri: "https://cdn.example/post.jpg",
        mediaType: "image",
        sizeBytes: 1024,
        aspectRatio: 1,
        mimeType: "image/jpeg"
      }
    ]
  });

  assert.equal(result.publishId, "post_001");
  assert.equal(result.status, "published");
  assert.equal(result.submittedAt, "2026-08-25T00:00:00.000Z");
  assert.equal(mock.requests[0].url, "https://zernio.example/api/v1/posts");
  assert.equal(mock.requests[0].init.method, "POST");
  assert.equal(mock.requests[0].init.headers.authorization, "Bearer zernio_key");
  assert.deepEqual(readBody(mock.requests[0]), {
    content: "hello instagram",
    mediaItems: [
      {
        type: "image",
        url: "https://cdn.example/post.jpg",
        size: 1024,
        mimeType: "image/jpeg"
      }
    ],
    platforms: [
      {
        platform: "instagram",
        accountId: "zernio_account_001",
        platformSpecificData: {}
      }
    ],
    publishNow: true
  });
});

test("scheduled story publish maps contentType story and scheduledFor", async () => {
  const mock = createMockFetch([
    {
      status: 201,
      body: {
        post: {
          _id: "post_story_001",
          status: "scheduled",
          scheduledFor: "2026-08-26T08:00:00.000Z",
          platforms: [{ platform: "instagram", status: "pending" }]
        }
      }
    }
  ]);
  const client = createClient(mock);

  const result = await client.publish.publishContent({
    account,
    type: "story",
    scheduledAt: "2026-08-26T08:00:00.000Z",
    assets: [
      {
        uri: "https://cdn.example/story.jpg",
        mediaType: "image",
        sizeBytes: 1024,
        mimeType: "image/png"
      }
    ]
  });

  assert.equal(result.publishId, "post_story_001");
  assert.equal(result.status, "submitted");
  assert.deepEqual(readBody(mock.requests[0]), {
    mediaItems: [
      {
        type: "image",
        url: "https://cdn.example/story.jpg",
        size: 1024,
        mimeType: "image/png"
      }
    ],
    platforms: [
      {
        platform: "instagram",
        accountId: "zernio_account_001",
        platformSpecificData: { contentType: "story" }
      }
    ],
    scheduledFor: "2026-08-26T08:00:00.000Z",
    publishNow: false
  });
});

test("reel publish sends single video with shareToFeed", async () => {
  const mock = createMockFetch([
    {
      status: 201,
      body: {
        post: {
          _id: "post_reel_001",
          status: "publishing",
          platforms: [{ platform: "instagram", status: "publishing" }]
        }
      }
    }
  ]);
  const client = createClient(mock);

  const result = await client.publish.publishContent({
    account,
    type: "reel",
    caption: "new reel",
    assets: [
      {
        uri: "https://cdn.example/reel.mp4",
        mediaType: "video",
        durationSeconds: 30,
        sizeBytes: 10 * 1024 * 1024,
        mimeType: "video/mp4"
      }
    ]
  });

  assert.equal(result.status, "submitted");
  assert.equal(readBody(mock.requests[0]).platforms[0].platformSpecificData.shareToFeed, true);
});

test("carousel publish accepts up to ten post assets", async () => {
  const mock = createMockFetch([
    {
      status: 201,
      body: {
        post: {
          _id: "post_carousel_001",
          status: "published",
          platforms: [{ platform: "instagram", status: "published" }]
        }
      }
    }
  ]);
  const client = createClient(mock);

  await client.publish.publishContent({
    account,
    type: "post",
    caption: "carousel",
    assets: [
      { uri: "https://cdn.example/1.jpg", mediaType: "image", mimeType: "image/jpeg" },
      { uri: "https://cdn.example/2.jpg", mediaType: "image", mimeType: "image/png" }
    ]
  });

  assert.equal(readBody(mock.requests[0]).mediaItems.length, 2);
});

test("publish status fetches Zernio post and maps platform post id", async () => {
  const mock = createMockFetch([
    {
      status: 200,
      body: {
        post: {
          _id: "post_001",
          status: "published",
          platforms: [
            {
              platform: "instagram",
              status: "published",
              platformPostId: "ig_media_001",
              platformPostUrl: "https://instagram.com/p/abc"
            }
          ]
        }
      }
    }
  ]);
  const client = createClient(mock);

  const result = await client.publish.getPublishStatus({
    account,
    publishId: "post_001"
  });

  assert.equal(result.publishId, "post_001");
  assert.equal(result.status, "published");
  assert.equal(result.mediaId, "ig_media_001");
  assert.equal(mock.requests[0].url, "https://zernio.example/api/v1/posts/post_001");
  assert.equal(mock.requests[0].init.method, "GET");
});

test("local validation rejects unsupported media before HTTP request", async () => {
  const cases = [
    {
      type: "post",
      assets: [{ uri: "F:/media/post.jpg", mediaType: "image" }]
    },
    {
      type: "post",
      assets: [{ uri: "https://drive.google.com/file/d/abc", mediaType: "image" }]
    },
    {
      type: "post",
      assets: [{ uri: "https://cdn.example/post.gif", mediaType: "image", mimeType: "image/gif" }]
    },
    {
      type: "reel",
      assets: [{ uri: "https://cdn.example/post.jpg", mediaType: "image" }]
    },
    {
      type: "story",
      caption: "caption is not allowed",
      assets: [{ uri: "https://cdn.example/story.jpg", mediaType: "image" }]
    }
  ];

  for (const item of cases) {
    const mock = createMockFetch([]);
    const client = createClient(mock);

    await assert.rejects(
      () =>
        client.publish.publishContent({
          account,
          type: item.type,
          caption: item.caption,
          assets: item.assets
        }),
      (error) => error instanceof InstagramProviderError && error.code === "unsupported_operation"
    );
    assert.equal(mock.requests.length, 0);
  }
});

test("Zernio errors map to core provider errors", async () => {
  const mock = createMockFetch([
    { status: 429, body: { error: "rate limited" } },
    { status: 409, body: { error: "duplicate content" } }
  ]);
  const client = createClient(mock);
  const request = {
    account,
    type: "post",
    assets: [{ uri: "https://cdn.example/post.jpg", mediaType: "image" }]
  };

  await assert.rejects(
    () => client.publish.publishContent(request),
    (error) => error instanceof InstagramProviderError && error.code === "rate_limited"
  );
  await assert.rejects(
    () => client.publish.publishContent(request),
    (error) => error instanceof InstagramProviderError && error.code === "provider_request_failed"
  );
});

test("unsupported official-api capabilities fail explicitly", async () => {
  const mock = createMockFetch([]);
  const client = createClient(mock);

  await assert.rejects(
    () => client.profile.updateProfile({ account, username: "new_name" }),
    (error) => error instanceof InstagramProviderError && error.code === "unsupported_operation"
  );
  await assert.rejects(
    () => client.media.likeMedia({ account, mediaId: "media_001" }),
    (error) => error instanceof InstagramProviderError && error.code === "unsupported_operation"
  );
});
