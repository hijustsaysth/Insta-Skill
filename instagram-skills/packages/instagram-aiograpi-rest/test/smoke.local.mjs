import assert from "node:assert/strict";

const baseUrl = process.env.AIOGRAPI_REST_BASE_URL ?? "http://localhost:8005";
const requiredPaths = [
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
  "/story/upload/by/url"
];

/**
 * 输入：本地 aiograpi-rest baseUrl。
 * 输出：OpenAPI JSON。
 * 作用：读取本地服务 schema，用于确认 provider client 的真实路由依赖仍成立。
 */
async function readOpenApi(url) {
  const response = await fetch(`${url.replace(/\/+$/, "")}/openapi.json`);

  assert.equal(response.ok, true, `failed to load aiograpi-rest OpenAPI from ${url}`);
  return response.json();
}

const openapi = await readOpenApi(baseUrl);

assert.equal(openapi.info?.title, "aiograpi-rest");
assert.equal(openapi.components?.securitySchemes?.SessionId?.in, "header");
assert.equal(openapi.components?.securitySchemes?.SessionId?.name, "X-Session-ID");

for (const path of requiredPaths) {
  assert.ok(openapi.paths?.[path], `missing aiograpi-rest path: ${path}`);
}

console.log(`aiograpi-rest smoke passed: ${baseUrl}`);
