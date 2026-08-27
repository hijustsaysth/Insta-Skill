import assert from "node:assert/strict";
import test from "node:test";

import { normalizeInstagramConnectorCliResult } from "../dist/index.js";

test("successful connector result keeps outputJson payload", () => {
  const result = normalizeInstagramConnectorCliResult({
    status: "SUCCEEDED",
    code: "OK",
    outputJson: "{\"packageName\":\"com.instagram.android\"}",
    detail: ""
  });

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.code, "OK");
  assert.deepEqual(result.output, { packageName: "com.instagram.android" });
});

test("failed connector result preserves code and detail", () => {
  const result = normalizeInstagramConnectorCliResult({
    status: "FAILED",
    code: "INSTAGRAM_NOT_ACTIVE",
    outputJson: "{}",
    detail: "com.android.settings"
  });

  assert.equal(result.status, "FAILED");
  assert.equal(result.code, "INSTAGRAM_NOT_ACTIVE");
  assert.equal(result.detail, "com.android.settings");
});

test("visual coordinate unsupported result is normalized as degraded", () => {
  const result = normalizeInstagramConnectorCliResult({
    status: "FAILED",
    code: "INSTAGRAM_VISUAL_COORDINATE_UNSUPPORTED",
    outputJson: "{}",
    detail: "target=reel_like_button"
  });

  assert.equal(result.status, "DEGRADED");
  assert.equal(result.primaryStrategy, "xml_node");
  assert.equal(result.fallbackStrategy, "screenshot_coordinate");
  assert.equal(result.coordinateAttempted, false);
  assert.equal(result.code, "INSTAGRAM_VISUAL_COORDINATE_UNSUPPORTED");
});

test("unicode input unsupported result is normalized as degraded", () => {
  const result = normalizeInstagramConnectorCliResult({
    status: "FAILED",
    code: "UI_INPUT_UNICODE_UNSUPPORTED",
    outputJson: "{}",
    detail: "Clipboard input failed"
  });

  assert.equal(result.status, "DEGRADED");
  assert.equal(result.code, "UI_INPUT_UNICODE_UNSUPPORTED");
  assert.equal(result.detail, "Clipboard input failed");
  assert.equal(result.primaryStrategy, undefined);
  assert.equal(result.fallbackStrategy, undefined);
});

test("invalid CLI result fails fast", () => {
  assert.throws(
    () => normalizeInstagramConnectorCliResult("not an object"),
    (error) => error.code === "CONNECTOR_CLI_RESULT_INVALID"
  );
});
