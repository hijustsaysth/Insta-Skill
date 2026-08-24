import assert from "node:assert/strict";
import test from "node:test";
import { InstagramProviderError, notImplemented } from "../dist/index.js";

test("provider error keeps code message name and cause detail", () => {
  const causeDetail = { status: 401 };
  const error = new InstagramProviderError("auth_required", "login required", causeDetail);

  assert.equal(error.name, "InstagramProviderError");
  assert.equal(error.code, "auth_required");
  assert.equal(error.message, "login required");
  assert.equal(error.causeDetail, causeDetail);
});

test("notImplemented returns explicit provider error", () => {
  const error = notImplemented("publishContent");

  assert.equal(error.name, "InstagramProviderError");
  assert.equal(error.code, "NOT_IMPLEMENTED");
  assert.match(error.message, /publishContent/);
});
