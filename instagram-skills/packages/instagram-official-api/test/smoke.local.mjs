import assert from "node:assert/strict";
import { createInstagramOfficialApiClient, loadInstagramOfficialApiConfig } from "../dist/index.js";

const DEFAULT_ACTIONS = ["accounts", "health"];
const VALID_ACTIONS = new Set([
  "accounts",
  "health",
  "connect-url",
  "create-profile",
  "publish-status",
  "publish-post",
  "publish-story",
  "publish-reel"
]);

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

const actions = readActions();
const client = createInstagramOfficialApiClient(readConfig());
const account = readAccount();
const results = [];

for (const action of actions) {
  switch (action) {
    case "accounts":
      results.push(["accounts", await listAccounts()]);
      break;
    case "health":
      results.push(["health", await checkHealth()]);
      break;
    case "connect-url":
      results.push(["connect-url", await getConnectUrl()]);
      break;
    case "create-profile":
      results.push(["create-profile", await createProfile()]);
      break;
    case "publish-status":
      results.push(["publish-status", await getPublishStatus()]);
      break;
    case "publish-post":
      results.push(["publish-post", await publishContent("post")]);
      break;
    case "publish-story":
      results.push(["publish-story", await publishContent("story")]);
      break;
    case "publish-reel":
      results.push(["publish-reel", await publishContent("reel")]);
      break;
    default:
      throw new Error(`Unsupported smoke action: ${action}`);
  }
}

console.log(JSON.stringify(Object.fromEntries(results), null, 2));

function readConfig() {
  const configPath = process.env.ZERNIO_CONFIG_PATH;

  if (configPath !== undefined && configPath.trim().length > 0) {
    return loadInstagramOfficialApiConfig(configPath);
  }

  const apiKey = requiredEnv("ZERNIO_API_KEY");
  const zernioBaseUrl = process.env.ZERNIO_BASE_URL;
  const requestTimeoutMs = process.env.ZERNIO_REQUEST_TIMEOUT_MS;

  return {
    apiKey,
    ...(zernioBaseUrl === undefined ? {} : { zernioBaseUrl }),
    ...(requestTimeoutMs === undefined ? {} : { requestTimeoutMs: Number(requestTimeoutMs) })
  };
}

function readActions() {
  const raw = process.env.ZERNIO_SMOKE_ACTIONS ?? DEFAULT_ACTIONS.join(",");
  const actions = raw
    .split(",")
    .map((action) => action.trim())
    .filter((action) => action.length > 0);

  assert.ok(actions.length > 0, "ZERNIO_SMOKE_ACTIONS must include at least one action");

  for (const action of actions) {
    assert.ok(VALID_ACTIONS.has(action), `Unknown ZERNIO_SMOKE_ACTIONS action: ${action}`);
  }

  return actions;
}

function readAccount() {
  const accountId = process.env.ZERNIO_ACCOUNT_ID;
  const sessionRef = process.env.ZERNIO_SESSION_REF ?? accountId;

  if (accountId === undefined && sessionRef === undefined) {
    return undefined;
  }

  return {
    accountId: accountId ?? sessionRef,
    sessionRef
  };
}

async function listAccounts() {
  const accounts = await client.connect.listConnectedInstagramAccounts({
    profileId: optionalEnv("ZERNIO_PROFILE_ID"),
    status: optionalEnv("ZERNIO_ACCOUNT_STATUS"),
    includeOverLimit: readBooleanEnv("ZERNIO_INCLUDE_OVER_LIMIT")
  });

  return accounts.map((item) => ({
    accountId: item.accountId,
    sessionRef: item.sessionRef,
    profileId: item.profileId,
    username: item.username,
    displayName: item.displayName,
    isActive: item.isActive,
    loginMethod: item.loginMethod,
    needsReconnection: item.needsReconnection
  }));
}

async function checkHealth() {
  return client.connect.checkInstagramAccountsHealth({
    profileId: optionalEnv("ZERNIO_PROFILE_ID"),
    status: optionalEnv("ZERNIO_HEALTH_STATUS")
  });
}

async function getConnectUrl() {
  const result = await client.connect.getInstagramConnectUrl({
    profileId: requiredEnv("ZERNIO_PROFILE_ID"),
    redirectUrl: optionalEnv("ZERNIO_REDIRECT_URL"),
    loginMethod: optionalEnv("ZERNIO_LOGIN_METHOD"),
    headless: readBooleanEnv("ZERNIO_HEADLESS")
  });

  return {
    profileId: result.profileId,
    loginMethod: result.loginMethod,
    authUrl: summarizeUrl(result.authUrl),
    statePresent: result.state !== undefined
  };
}

async function createProfile() {
  const result = await client.connect.createProfile({
    name: process.env.ZERNIO_PROFILE_NAME ?? `instagram-official-api-smoke-${Date.now()}`,
    description: optionalEnv("ZERNIO_PROFILE_DESCRIPTION"),
    color: optionalEnv("ZERNIO_PROFILE_COLOR"),
    idempotencyKey: optionalEnv("ZERNIO_IDEMPOTENCY_KEY")
  });

  return result;
}

async function getPublishStatus() {
  return client.publish.getPublishStatus({
    account: requiredAccount(),
    publishId: requiredEnv("ZERNIO_PUBLISH_ID")
  });
}

async function publishContent(type) {
  assert.equal(
    process.env.ZERNIO_CONFIRM_PUBLISH,
    "1",
    "Set ZERNIO_CONFIRM_PUBLISH=1 before running a smoke action that creates an Instagram post"
  );

  return client.publish.publishContent({
    account: requiredAccount(),
    type,
    caption: optionalEnv("ZERNIO_CAPTION"),
    scheduledAt: optionalEnv("ZERNIO_SCHEDULED_AT"),
    assets: [readAsset(type)]
  });
}

function readAsset(type) {
  const mediaType = process.env.ZERNIO_MEDIA_TYPE ?? (type === "reel" ? "video" : "image");

  return {
    uri: requiredEnv("ZERNIO_MEDIA_URL"),
    mediaType,
    ...(process.env.ZERNIO_MEDIA_SIZE_BYTES === undefined ? {} : { sizeBytes: Number(process.env.ZERNIO_MEDIA_SIZE_BYTES) }),
    ...(process.env.ZERNIO_MEDIA_DURATION_SECONDS === undefined
      ? {}
      : { durationSeconds: Number(process.env.ZERNIO_MEDIA_DURATION_SECONDS) }),
    ...(process.env.ZERNIO_MEDIA_ASPECT_RATIO === undefined ? {} : { aspectRatio: Number(process.env.ZERNIO_MEDIA_ASPECT_RATIO) }),
    ...(process.env.ZERNIO_MEDIA_MIME_TYPE === undefined ? {} : { mimeType: process.env.ZERNIO_MEDIA_MIME_TYPE })
  };
}

function requiredAccount() {
  assert.ok(account !== undefined, "ZERNIO_ACCOUNT_ID or ZERNIO_SESSION_REF is required");
  return account;
}

function requiredEnv(name) {
  const value = process.env[name];

  assert.ok(value !== undefined && value.trim().length > 0, `${name} is required`);
  return value;
}

function optionalEnv(name) {
  const value = process.env[name];
  return value === undefined || value.trim().length === 0 ? undefined : value;
}

function readBooleanEnv(name) {
  const value = optionalEnv(name);

  if (value === undefined) {
    return undefined;
  }

  if (value === "1" || value.toLowerCase() === "true") {
    return true;
  }

  if (value === "0" || value.toLowerCase() === "false") {
    return false;
  }

  throw new Error(`${name} must be one of: 1, 0, true, false`);
}

function summarizeUrl(value) {
  const url = new URL(value);

  return {
    origin: url.origin,
    pathname: url.pathname,
    queryKeys: [...url.searchParams.keys()]
  };
}

function printHelp() {
  console.log(`instagram-official-api local smoke

Required config:
  ZERNIO_CONFIG_PATH=path/to/api.yml
  or
  ZERNIO_API_KEY=...

Optional config:
  ZERNIO_BASE_URL=https://zernio.com/api/v1
  ZERNIO_REQUEST_TIMEOUT_MS=30000

Actions:
  ZERNIO_SMOKE_ACTIONS=accounts,health
  ZERNIO_SMOKE_ACTIONS=connect-url
  ZERNIO_SMOKE_ACTIONS=create-profile
  ZERNIO_SMOKE_ACTIONS=publish-status
  ZERNIO_SMOKE_ACTIONS=publish-post
  ZERNIO_SMOKE_ACTIONS=publish-story
  ZERNIO_SMOKE_ACTIONS=publish-reel

Common action inputs:
  ZERNIO_PROFILE_ID=...
  ZERNIO_ACCOUNT_ID=...
  ZERNIO_SESSION_REF=...
  ZERNIO_PUBLISH_ID=...

Publishing inputs:
  ZERNIO_CONFIRM_PUBLISH=1
  ZERNIO_MEDIA_URL=https://cdn.example/media.jpg
  ZERNIO_MEDIA_TYPE=image|video
  ZERNIO_MEDIA_MIME_TYPE=image/jpeg|image/png|video/mp4|video/quicktime
  ZERNIO_CAPTION=...
`);
}
