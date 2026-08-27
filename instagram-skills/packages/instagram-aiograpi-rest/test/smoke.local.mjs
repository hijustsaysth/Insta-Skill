import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createAiograpiRestAuthClient, createAiograpiRestClient } from "../dist/index.js";

const DEFAULT_BASE_URL = "http://localhost:8005";
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_LOGIN_PATH = resolve(process.cwd(), "../../../login.json");
const DEFAULT_SESSION_CACHE_PATH = resolve(process.cwd(), "../../../runtime-data/aiograpi-rest-session.json");
const REQUIRED_OPENAPI_PATHS = [
  "/auth/login",
  "/auth/login/by/sessionid",
  "/auth/relogin",
  "/auth/challenge/resolve",
  "/auth/settings",
  "/account",
  "/account/picture",
  "/search/reels",
  "/media",
  "/media/like",
  "/media/comment",
  "/photo/upload",
  "/photo/upload/by/url",
  "/video/upload",
  "/video/upload/by/url",
  "/clip/upload",
  "/clip/upload/by/url",
  "/story/upload",
  "/story/upload/by/url",
  "/album/upload"
];
const DEFAULT_ACTIONS = ["openapi"];
const VALID_ACTIONS = new Set([
  "openapi",
  "login",
  "login-sessionid",
  "relogin",
  "settings",
  "account",
  "search",
  "media",
  "like",
  "comment",
  "update-profile",
  "publish-post",
  "publish-story",
  "publish-reel"
]);

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

const login = readLogin();
const config = readConfig();
const auth = createAiograpiRestAuthClient(config);
const client = createAiograpiRestClient(config);
const actions = readActions();
const results = [];
let activeSessionRef = optionalEnv("AIOGRAPI_SESSION_REF") ?? readCachedSessionRef();

for (const action of actions) {
  switch (action) {
    case "openapi":
      results.push(["openapi", await checkOpenApi()]);
      break;
    case "login":
      results.push(["login", await loginWithPassword()]);
      break;
    case "login-sessionid":
      results.push(["login-sessionid", await loginWithSessionId()]);
      break;
    case "relogin":
      results.push(["relogin", await auth.relogin({ aiograpiSessionId: requiredSessionRef() })]);
      break;
    case "settings":
      results.push(["settings", await exportSettings()]);
      break;
    case "account":
      results.push(["account", await getAccountInfo()]);
      break;
    case "search":
      results.push(["search", await searchVideos()]);
      break;
    case "media":
      results.push(["media", await getMedia()]);
      break;
    case "like":
      requireMutationConfirmation(action);
      results.push(["like", await likeMedia()]);
      break;
    case "comment":
      requireMutationConfirmation(action);
      results.push(["comment", await commentMedia()]);
      break;
    case "update-profile":
      requireMutationConfirmation(action);
      results.push(["update-profile", await updateProfile()]);
      break;
    case "publish-post":
      requirePublishConfirmation(action);
      results.push(["publish-post", await publishContent("post")]);
      break;
    case "publish-story":
      requirePublishConfirmation(action);
      results.push(["publish-story", await publishContent("story")]);
      break;
    case "publish-reel":
      requirePublishConfirmation(action);
      results.push(["publish-reel", await publishContent("reel")]);
      break;
    default:
      throw new Error(`Unsupported smoke action: ${action}`);
  }
}

console.log(JSON.stringify(Object.fromEntries(results), null, 2));

function readConfig() {
  const sessionHeaderName = optionalEnv("AIOGRAPI_REST_SESSION_HEADER");

  return {
    baseUrl: process.env.AIOGRAPI_REST_BASE_URL ?? DEFAULT_BASE_URL,
    requestTimeoutMs:
      process.env.AIOGRAPI_REST_REQUEST_TIMEOUT_MS === undefined
        ? DEFAULT_TIMEOUT_MS
        : Number(process.env.AIOGRAPI_REST_REQUEST_TIMEOUT_MS),
    ...(sessionHeaderName === undefined ? {} : { defaultSessionHeaderName: sessionHeaderName })
  };
}

function readActions() {
  const raw = process.env.AIOGRAPI_SMOKE_ACTIONS ?? DEFAULT_ACTIONS.join(",");
  const actions = raw
    .split(",")
    .map((action) => action.trim())
    .filter((action) => action.length > 0);

  assert.ok(actions.length > 0, "AIOGRAPI_SMOKE_ACTIONS must include at least one action");

  for (const action of actions) {
    assert.ok(VALID_ACTIONS.has(action), `Unknown AIOGRAPI_SMOKE_ACTIONS action: ${action}`);
  }

  return actions;
}

function readLogin() {
  const loginPath = process.env.AIOGRAPI_LOGIN_JSON ?? DEFAULT_LOGIN_PATH;

  if (!existsSync(loginPath)) {
    return {};
  }

  return JSON.parse(readFileSync(loginPath, "utf8"));
}

function readCachedSessionRef() {
  const cachePath = process.env.AIOGRAPI_SESSION_CACHE_PATH ?? DEFAULT_SESSION_CACHE_PATH;

  if (!existsSync(cachePath)) {
    return undefined;
  }

  const cache = JSON.parse(readFileSync(cachePath, "utf8"));
  return typeof cache.aiograpiSessionId === "string" && cache.aiograpiSessionId.trim().length > 0
    ? cache.aiograpiSessionId
    : undefined;
}

function writeSessionCache(aiograpiSessionId, source) {
  const cachePath = process.env.AIOGRAPI_SESSION_CACHE_PATH ?? DEFAULT_SESSION_CACHE_PATH;
  const payload = {
    aiograpiSessionId,
    accountId: login.accountId,
    username: login.username,
    baseUrl: config.baseUrl,
    source,
    createdAt: new Date().toISOString()
  };

  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(payload, null, 2), { encoding: "utf8", mode: 0o600 });
}

async function checkOpenApi() {
  const openapi = await readOpenApi(config.baseUrl);

  assert.equal(openapi.info?.title, "aiograpi-rest");
  assert.equal(openapi.components?.securitySchemes?.SessionId?.in, "header");
  assert.equal(openapi.components?.securitySchemes?.SessionId?.name, "X-Session-ID");

  for (const path of REQUIRED_OPENAPI_PATHS) {
    assert.ok(openapi.paths?.[path], `missing aiograpi-rest path: ${path}`);
  }

  return {
    baseUrl: config.baseUrl,
    pathsChecked: REQUIRED_OPENAPI_PATHS.length
  };
}

async function readOpenApi(baseUrl) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/openapi.json`);

  assert.equal(response.ok, true, `failed to load aiograpi-rest OpenAPI from ${baseUrl}`);
  return response.json();
}

async function getAccountInfo() {
  const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/account`, {
    method: "GET",
    headers: {
      [config.defaultSessionHeaderName ?? "X-Session-ID"]: requiredSessionRef()
    }
  });
  const body = await response.json();

  assert.equal(response.ok, true, `failed to load account info: ${response.status}`);
  return summarizeAccountInfo(body);
}

async function loginWithPassword() {
  const result = await auth.login({
    username: envOrLogin("AIOGRAPI_USERNAME", "username", true),
    password: envOrLogin("AIOGRAPI_PASSWORD", "password", true),
    verificationCode: optionalEnv("AIOGRAPI_VERIFICATION_CODE"),
    proxy: readLoginProxy(),
    locale: optionalEnv("AIOGRAPI_LOCALE"),
    timezone: optionalEnv("AIOGRAPI_TIMEZONE")
  });

  activeSessionRef = result.aiograpiSessionId;
  writeSessionCache(result.aiograpiSessionId, "login");
  return { aiograpiSessionIdPresent: true, cached: true };
}

async function loginWithSessionId() {
  const result = await auth.loginBySessionId({
    sessionid: envOrLogin("AIOGRAPI_INSTAGRAM_SESSIONID", "sessionid", true),
    proxy: readLoginProxy(),
    locale: optionalEnv("AIOGRAPI_LOCALE"),
    timezone: optionalEnv("AIOGRAPI_TIMEZONE")
  });

  activeSessionRef = result.aiograpiSessionId;
  writeSessionCache(result.aiograpiSessionId, "login-sessionid");
  return { aiograpiSessionIdPresent: true, cached: true };
}

async function exportSettings() {
  return readSettingsSummary(requiredSessionRef());
}

async function readSettingsSummary(aiograpiSessionId) {
  const result = await auth.exportSettings({ aiograpiSessionId });

  return {
    settingsBytes: Buffer.byteLength(result.settings, "utf8"),
    settingsLooksJson: looksJson(result.settings)
  };
}

async function searchVideos() {
  return client.media.searchVideos({
    account: smokeAccount(),
    keyword: process.env.AIOGRAPI_SEARCH_QUERY ?? "coffee",
    limit: Number(process.env.AIOGRAPI_SEARCH_LIMIT ?? 5)
  });
}

async function getMedia() {
  return client.media.getMedia({
    account: smokeAccount(),
    mediaId: requiredEnv("AIOGRAPI_MEDIA_ID")
  });
}

async function likeMedia() {
  return client.media.likeMedia({
    account: smokeAccount(),
    mediaId: requiredEnv("AIOGRAPI_MEDIA_ID")
  });
}

async function commentMedia() {
  return client.media.commentMedia({
    account: smokeAccount(),
    mediaId: requiredEnv("AIOGRAPI_MEDIA_ID"),
    text: requiredEnv("AIOGRAPI_COMMENT_TEXT")
  });
}

async function updateProfile() {
  const avatarPath = optionalEnv("AIOGRAPI_AVATAR_PATH");

  return client.profile.updateProfile({
    account: smokeAccount(),
    username: optionalEnv("AIOGRAPI_NEW_USERNAME"),
    displayName: optionalEnv("AIOGRAPI_NEW_DISPLAY_NAME"),
    biography: optionalEnv("AIOGRAPI_NEW_BIOGRAPHY"),
    ...(avatarPath === undefined ? {} : { avatarAsset: { uri: avatarPath, mediaType: "image" } })
  });
}

async function publishContent(type) {
  return client.publish.publishContent({
    account: smokeAccount(),
    type,
    caption: optionalEnv("AIOGRAPI_CAPTION"),
    tags: readCsvEnv("AIOGRAPI_TAGS"),
    assets: [readAsset(type)]
  });
}

function readAsset(type) {
  const mediaType = process.env.AIOGRAPI_MEDIA_TYPE ?? (type === "reel" ? "video" : "image");

  return {
    uri: requiredEnv("AIOGRAPI_MEDIA_URL"),
    mediaType,
    ...(process.env.AIOGRAPI_MEDIA_SIZE_BYTES === undefined ? {} : { sizeBytes: Number(process.env.AIOGRAPI_MEDIA_SIZE_BYTES) }),
    ...(process.env.AIOGRAPI_MEDIA_DURATION_SECONDS === undefined
      ? {}
      : { durationSeconds: Number(process.env.AIOGRAPI_MEDIA_DURATION_SECONDS) }),
    ...(process.env.AIOGRAPI_MEDIA_ASPECT_RATIO === undefined ? {} : { aspectRatio: Number(process.env.AIOGRAPI_MEDIA_ASPECT_RATIO) }),
    ...(process.env.AIOGRAPI_MEDIA_MIME_TYPE === undefined ? {} : { mimeType: process.env.AIOGRAPI_MEDIA_MIME_TYPE })
  };
}

function summarizeAccountInfo(body) {
  return {
    pk: body.pk === undefined ? undefined : String(body.pk),
    username: body.username,
    fullName: body.full_name,
    biographyLength: typeof body.biography === "string" ? body.biography.length : undefined,
    mediaCount: body.media_count,
    followerCount: body.follower_count,
    followingCount: body.following_count,
    isPrivate: body.is_private,
    isVerified: body.is_verified
  };
}

function smokeAccount() {
  return {
    accountId: process.env.AIOGRAPI_ACCOUNT_ID ?? login.accountId ?? login.username ?? "aiograpi-rest-smoke-account",
    sessionRef: requiredSessionRef()
  };
}

function requiredSessionRef() {
  assert.ok(
    activeSessionRef !== undefined && activeSessionRef.trim().length > 0,
    "AIOGRAPI_SESSION_REF is required, or run login/login-sessionid before this action"
  );
  return activeSessionRef;
}

function envOrLogin(envName, loginField, required) {
  const value = optionalEnv(envName) ?? readOptionalLoginString(loginField);

  if (required) {
    assert.ok(value !== undefined && value.trim().length > 0, `${envName} or login.json ${loginField} is required`);
  }

  return value;
}

function readLoginProxy() {
  if (process.env.AIOGRAPI_DISABLE_LOGIN_PROXY === "1") {
    return undefined;
  }

  return envOrLogin("AIOGRAPI_PROXY", "proxy", false);
}

function readOptionalLoginString(field) {
  return typeof login[field] === "string" && login[field].trim().length > 0 ? login[field] : undefined;
}

function requiredEnv(name) {
  const value = optionalEnv(name);

  assert.ok(value !== undefined, `${name} is required`);
  return value;
}

function optionalEnv(name) {
  const value = process.env[name];
  return value === undefined || value.trim().length === 0 ? undefined : value;
}

function readCsvEnv(name) {
  const value = optionalEnv(name);

  if (value === undefined) {
    return undefined;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function requireMutationConfirmation(action) {
  assert.equal(
    process.env.AIOGRAPI_CONFIRM_MUTATION,
    "1",
    `Set AIOGRAPI_CONFIRM_MUTATION=1 before running smoke action: ${action}`
  );
}

function requirePublishConfirmation(action) {
  assert.equal(
    process.env.AIOGRAPI_CONFIRM_PUBLISH,
    "1",
    `Set AIOGRAPI_CONFIRM_PUBLISH=1 before running smoke action: ${action}`
  );
}

function looksJson(value) {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function printHelp() {
  console.log(`instagram-aiograpi-rest local smoke

Service config:
  AIOGRAPI_REST_BASE_URL=http://localhost:8005
  AIOGRAPI_REST_REQUEST_TIMEOUT_MS=30000
  AIOGRAPI_REST_SESSION_HEADER=X-Session-ID

Login source:
  AIOGRAPI_LOGIN_JSON=../../../login.json
  or AIOGRAPI_USERNAME / AIOGRAPI_PASSWORD / AIOGRAPI_INSTAGRAM_SESSIONID / AIOGRAPI_PROXY
  AIOGRAPI_DISABLE_LOGIN_PROXY=1

Actions:
  AIOGRAPI_SMOKE_ACTIONS=openapi
  AIOGRAPI_SMOKE_ACTIONS=login-sessionid,settings,search
  AIOGRAPI_SMOKE_ACTIONS=login,settings,search
  AIOGRAPI_SMOKE_ACTIONS=account
  AIOGRAPI_SMOKE_ACTIONS=relogin,media
  AIOGRAPI_SMOKE_ACTIONS=like
  AIOGRAPI_SMOKE_ACTIONS=comment
  AIOGRAPI_SMOKE_ACTIONS=update-profile
  AIOGRAPI_SMOKE_ACTIONS=publish-post
  AIOGRAPI_SMOKE_ACTIONS=publish-story
  AIOGRAPI_SMOKE_ACTIONS=publish-reel

Common inputs:
  AIOGRAPI_SESSION_REF=aiograpi-rest session id
  AIOGRAPI_SESSION_CACHE_PATH=../../../runtime-data/aiograpi-rest-session.json
  AIOGRAPI_ACCOUNT_ID=account id label
  AIOGRAPI_SEARCH_QUERY=coffee
  AIOGRAPI_MEDIA_ID=instagram media id

Mutation inputs:
  AIOGRAPI_CONFIRM_MUTATION=1
  AIOGRAPI_COMMENT_TEXT=...
  AIOGRAPI_NEW_DISPLAY_NAME=...
  AIOGRAPI_NEW_BIOGRAPHY=...
  AIOGRAPI_AVATAR_PATH=F:\\path\\avatar.jpg

Publish inputs:
  AIOGRAPI_CONFIRM_PUBLISH=1
  AIOGRAPI_MEDIA_URL=https://cdn.example/post.jpg
  AIOGRAPI_MEDIA_TYPE=image|video
  AIOGRAPI_MEDIA_MIME_TYPE=image/jpeg|video/mp4
  AIOGRAPI_CAPTION=...
`);
}
