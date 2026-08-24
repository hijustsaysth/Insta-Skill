import assert from "node:assert/strict";
import test from "node:test";
import { InstagramAccountId, InstagramSessionRef } from "../dist/index.js";

test("id constructors return non-empty strings", () => {
  assert.equal(InstagramAccountId("acct_1"), "acct_1");
  assert.equal(InstagramSessionRef("session_1"), "session_1");
});

test("id constructors reject empty strings", () => {
  assert.throws(() => InstagramAccountId(""), TypeError);
  assert.throws(() => InstagramSessionRef("   "), TypeError);
});
