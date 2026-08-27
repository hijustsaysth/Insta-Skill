import assert from "node:assert/strict";
import test from "node:test";
import { InstagramProviderError } from "@instagram-skills/instagram-core";
import { createInstagramOfficialApiClient } from "../dist/index.js";

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

function readBody(request) {
  return request.init.body === undefined ? undefined : JSON.parse(request.init.body);
}

test("createProfileAndStartInstagramBinding creates profile and returns auth URL", async () => {
  const mock = createMockFetch([
    {
      status: 201,
      body: {
        profile: {
          _id: "profile_001",
          name: "Warmup Profile",
          description: "IG warmup",
          color: "#4CAF50",
          createdAt: "2026-08-25T00:00:00.000Z"
        }
      }
    },
    {
      status: 200,
      body: {
        authUrl: "https://zernio.example/oauth",
        state: "state_001"
      }
    }
  ]);
  const client = createInstagramOfficialApiClient({
    zernioBaseUrl: "https://zernio.example/api/v1",
    apiKey: "zernio_key",
    requestTimeoutMs: 30000,
    fetch: mock.fetch
  });

  const result = await client.connect.createProfileAndStartInstagramBinding({
    name: "Warmup Profile",
    description: "IG warmup",
    color: "#4CAF50",
    idempotencyKey: "idem_001",
    redirectUrl: "https://app.example/callback",
    loginMethod: "instagram_login"
  });

  assert.equal(result.profile.id, "profile_001");
  assert.equal(result.connect.authUrl, "https://zernio.example/oauth");
  assert.equal(result.connect.profileId, "profile_001");
  assert.equal(result.connect.loginMethod, "instagram_login");
  assert.equal(mock.requests[0].url, "https://zernio.example/api/v1/profiles");
  assert.equal(mock.requests[0].init.method, "POST");
  assert.equal(mock.requests[0].init.headers.authorization, "Bearer zernio_key");
  assert.equal(mock.requests[0].init.headers["idempotency-key"], "idem_001");
  assert.deepEqual(readBody(mock.requests[0]), {
    name: "Warmup Profile",
    description: "IG warmup",
    color: "#4CAF50"
  });
  assert.equal(
    mock.requests[1].url,
    "https://zernio.example/api/v1/connect/instagram?profileId=profile_001&redirect_url=https%3A%2F%2Fapp.example%2Fcallback&loginMethod=instagram_login"
  );
});

test("facebook login selection flow lists pages and connects selected Instagram account", async () => {
  const mock = createMockFetch([
    {
      status: 200,
      body: {
        pages: [
          {
            id: "page_001",
            name: "Brand Page",
            access_token: "page_token",
            instagram_business_account: {
              id: "ig_business_001",
              username: "brand",
              profile_picture_url: "https://cdn.example/avatar.jpg"
            }
          }
        ]
      }
    },
    {
      status: 200,
      body: {
        account: {
          accountId: "zernio_account_001",
          platform: "instagram",
          username: "brand",
          displayName: "Brand Page",
          profilePicture: "https://cdn.example/avatar.jpg",
          isActive: true,
          loginMethod: "facebook_login"
        }
      }
    }
  ]);
  const client = createInstagramOfficialApiClient({
    zernioBaseUrl: "https://zernio.example/api/v1",
    apiKey: "zernio_key",
    fetch: mock.fetch
  });

  const pages = await client.connect.listInstagramLinkedPages({
    profileId: "profile_001",
    tempToken: "temp_token"
  });
  const account = await client.connect.selectInstagramAccount({
    profileId: "profile_001",
    pageId: "page_001",
    tempToken: "temp_token",
    redirectUrl: "https://app.example/callback"
  });

  assert.equal(pages[0].instagramBusinessAccount.id, "ig_business_001");
  assert.equal(account.accountId, "zernio_account_001");
  assert.equal(account.sessionRef, "zernio_account_001");
  assert.equal(account.profileId, "profile_001");
  assert.equal(account.loginMethod, "facebook_login");
  assert.equal(
    mock.requests[0].url,
    "https://zernio.example/api/v1/connect/instagram/select-account?profileId=profile_001&tempToken=temp_token"
  );
  assert.equal(mock.requests[1].url, "https://zernio.example/api/v1/connect/instagram/select-account");
  assert.deepEqual(readBody(mock.requests[1]), {
    profileId: "profile_001",
    pageId: "page_001",
    tempToken: "temp_token",
    redirect_url: "https://app.example/callback"
  });
});

test("listConnectedInstagramAccounts returns sessionRef equal to Zernio accountId", async () => {
  const mock = createMockFetch([
    {
      status: 200,
      body: {
        accounts: [
          {
            _id: "zernio_account_001",
            platform: "instagram",
            profileId: { _id: "profile_001", name: "Brand" },
            username: "brand",
            displayName: "Brand",
            isActive: true,
            needsReconnection: false
          }
        ]
      }
    }
  ]);
  const client = createInstagramOfficialApiClient({
    zernioBaseUrl: "https://zernio.example/api/v1",
    apiKey: "zernio_key",
    fetch: mock.fetch
  });

  const accounts = await client.connect.listConnectedInstagramAccounts({
    profileId: "profile_001",
    status: "connected"
  });

  assert.equal(accounts[0].accountId, "zernio_account_001");
  assert.equal(accounts[0].sessionRef, "zernio_account_001");
  assert.equal(accounts[0].profileId, "profile_001");
  assert.equal(
    mock.requests[0].url,
    "https://zernio.example/api/v1/accounts?profileId=profile_001&platform=instagram&status=connected"
  );
});

test("health query exposes token status without changing accountId", async () => {
  const mock = createMockFetch([
    {
      status: 200,
      body: {
        accounts: [
          {
            accountId: "zernio_account_001",
            platform: "instagram",
            username: "brand",
            status: "healthy",
            canPost: true,
            tokenValid: true,
            tokenExpiresAt: "2026-09-25T00:00:00.000Z",
            needsReconnect: false,
            issues: []
          }
        ]
      }
    }
  ]);
  const client = createInstagramOfficialApiClient({
    zernioBaseUrl: "https://zernio.example/api/v1",
    apiKey: "zernio_key",
    fetch: mock.fetch
  });

  const accounts = await client.connect.checkInstagramAccountsHealth({ profileId: "profile_001" });

  assert.equal(accounts[0].accountId, "zernio_account_001");
  assert.equal(accounts[0].tokenValid, true);
  assert.equal(accounts[0].tokenExpiresAt, "2026-09-25T00:00:00.000Z");
  assert.equal(
    mock.requests[0].url,
    "https://zernio.example/api/v1/accounts/health?profileId=profile_001&platform=instagram"
  );
});

test("validation and Zernio http errors map to provider errors", async () => {
  const mock = createMockFetch([{ status: 401, body: { message: "invalid api key" } }]);
  const client = createInstagramOfficialApiClient({
    zernioBaseUrl: "https://zernio.example/api/v1",
    apiKey: "zernio_key",
    fetch: mock.fetch
  });

  await assert.rejects(
    () => client.connect.getInstagramConnectUrl({ profileId: "" }),
    (error) => error instanceof InstagramProviderError && error.code === "provider_validation_failed"
  );
  await assert.rejects(
    () => client.connect.listConnectedInstagramAccounts(),
    (error) => error instanceof InstagramProviderError && error.code === "auth_required"
  );
});
