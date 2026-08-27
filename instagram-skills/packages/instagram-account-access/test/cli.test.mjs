import assert from "node:assert/strict";
import test from "node:test";
import { runCli } from "../dist/cli.js";

test("CLI plan command returns structured JSON without provider execution", async () => {
  const writes = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (chunk) => {
    writes.push(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
    return true;
  };

  try {
    const exitCode = await runCli(["plan", "--input-json", JSON.stringify({ action: "aiograpi_relogin" })], {
      INSTAGRAM_SESSION_STORE_SQLITE_PATH: "unused.sqlite"
    });

    assert.equal(exitCode, 0);
    const parsed = JSON.parse(writes.join(""));
    assert.equal(parsed.ok, true);
    assert.equal(parsed.result.providerId, "aiograpi-rest");
    assert.equal(parsed.result.nextServiceCall, "relogin");
  } finally {
    process.stdout.write = originalWrite;
  }
});
