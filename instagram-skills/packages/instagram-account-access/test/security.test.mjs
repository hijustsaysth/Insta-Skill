import assert from "node:assert/strict";
import test from "node:test";
import { createAesGcmSecretEncryptor, redactSensitiveText, redactSensitiveValue } from "../dist/index.js";

test("AES-GCM encryptor returns non-plaintext versioned ciphertext", () => {
  const encrypt = createAesGcmSecretEncryptor("unit-test-secret");
  const plaintext = "{\"cookies\":{\"sessionid\":\"raw-session\"}}";
  const ciphertext = encrypt(plaintext);

  assert.notEqual(ciphertext, plaintext);
  assert.equal(ciphertext.startsWith("v1:aes-256-gcm:"), true);
});

test("redaction removes sensitive structured fields", () => {
  const redacted = redactSensitiveValue({
    username: "safe-user",
    password: "raw-password",
    cookies: {
      sessionid: "raw-session"
    }
  });

  assert.deepEqual(redacted, {
    username: "safe-user",
    password: "[REDACTED]",
    cookies: "[REDACTED]"
  });
});

test("redaction removes sensitive text fields", () => {
  assert.equal(redactSensitiveText('login failed: "sessionid":"raw-session"'), 'login failed: "sessionid":"[REDACTED]"');
  assert.equal(redactSensitiveText("apiKey=raw-key"), "apiKey=[REDACTED]");
});
