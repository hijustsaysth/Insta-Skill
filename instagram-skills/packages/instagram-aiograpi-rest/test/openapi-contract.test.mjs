import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AIOGRAPI_REST_ROUTES } from "../dist/routes.js";

const openapi = JSON.parse(readFileSync(new URL("../../../../docs/instruction/aiograpi-doc.json", import.meta.url), "utf8"));

/**
 * 输入：OpenAPI path、method 和 content type。
 * 输出：无。
 * 作用：确认本包依赖的 aiograpi-rest 请求体协议仍与文档一致。
 */
function assertRequestContentType(path, method, contentType) {
  const content = openapi.paths?.[path]?.[method]?.requestBody?.content;

  assert.ok(content, `missing requestBody content for ${method.toUpperCase()} ${path}`);
  assert.ok(content[contentType], `missing ${contentType} for ${method.toUpperCase()} ${path}`);
}

test("route constants exist in aiograpi-rest OpenAPI document", () => {
  for (const path of Object.values(AIOGRAPI_REST_ROUTES)) {
    assert.ok(openapi.paths?.[path], `missing aiograpi-rest path: ${path}`);
  }
});

test("upload routes use aiograpi-rest documented content types", () => {
  assertRequestContentType(AIOGRAPI_REST_ROUTES.photoUpload, "post", "multipart/form-data");
  assertRequestContentType(AIOGRAPI_REST_ROUTES.photoUploadByUrl, "post", "application/x-www-form-urlencoded");
  assertRequestContentType(AIOGRAPI_REST_ROUTES.videoUpload, "post", "multipart/form-data");
  assertRequestContentType(AIOGRAPI_REST_ROUTES.videoUploadByUrl, "post", "multipart/form-data");
  assertRequestContentType(AIOGRAPI_REST_ROUTES.clipUpload, "post", "multipart/form-data");
  assertRequestContentType(AIOGRAPI_REST_ROUTES.clipUploadByUrl, "post", "multipart/form-data");
  assertRequestContentType(AIOGRAPI_REST_ROUTES.storyUpload, "post", "multipart/form-data");
  assertRequestContentType(AIOGRAPI_REST_ROUTES.storyUploadByUrl, "post", "application/x-www-form-urlencoded");
  assertRequestContentType(AIOGRAPI_REST_ROUTES.albumUpload, "post", "multipart/form-data");
});

test("auth routes use aiograpi-rest documented content types", () => {
  assertRequestContentType(AIOGRAPI_REST_ROUTES.authLogin, "post", "application/x-www-form-urlencoded");
  assertRequestContentType(AIOGRAPI_REST_ROUTES.authLoginBySessionId, "post", "application/x-www-form-urlencoded");
  assertRequestContentType(AIOGRAPI_REST_ROUTES.authChallengeResolve, "post", "application/x-www-form-urlencoded");
  assert.ok(openapi.paths?.[AIOGRAPI_REST_ROUTES.authRelogin]?.patch, "missing PATCH /auth/relogin");
  assert.ok(openapi.paths?.[AIOGRAPI_REST_ROUTES.authSettings]?.get, "missing GET /auth/settings");
});

test("user about route requires user_id and returns About schema", () => {
  const operation = openapi.paths?.[AIOGRAPI_REST_ROUTES.userAbout]?.get;
  assert.ok(operation, "missing GET /user/about");
  assert.ok(
    operation.parameters.some((parameter) => parameter.name === "user_id" && parameter.required === true),
    "GET /user/about must require user_id"
  );
  assert.equal(
    operation.responses?.["200"]?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/About"
  );
  assert.ok(openapi.components?.schemas?.About?.properties?.date, "About schema must expose date");
});

test("album upload with music exists but is not part of first-version publish implementation", () => {
  assert.ok(openapi.paths?.["/album/upload"], "missing aiograpi-rest path: /album/upload");
  assert.ok(openapi.paths?.["/album/upload/with/music"], "missing aiograpi-rest path: /album/upload/with/music");
});
