import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  createInstagramConnectorCommand,
  invokeInstagramConnector
} from "../dist/index.js";

test("command config invokes local Gradle runtime with connector properties", () => {
  const runtimeRoot = mkdtempSync(join(tmpdir(), "instagram-connector-runtime-"));
  let cleanupPaths = [];

  try {
    const command = createInstagramConnectorCommand({
      action: "instagram.search.input",
      input: { keyword: "fitness" },
      config: {
        runtimeRoot,
        gradleCommand: "gradle",
        adbPath: "C:\\Android\\adb.exe",
        adbSerial: "emulator-5554",
        artifactDir: "F:\\artifacts",
        commandTimeoutMs: 15000,
        waitTimeoutMs: 8000,
        deadlineMs: 120000
      }
    });
    cleanupPaths = command.cleanupPaths ?? [];

    assert.equal(command.command, "gradle");
    assert.equal(command.cwd, runtimeRoot);
    assert.equal(command.args.includes("-Dinstagram.local.inputJson={\"keyword\":\"fitness\"}"), false);
    const inputJsonFileArg = command.args.find((arg) => arg.startsWith("-Dinstagram.local.inputJsonFile="));
    assert.equal(typeof inputJsonFileArg, "string");
    const inputJsonFile = inputJsonFileArg.slice("-Dinstagram.local.inputJsonFile=".length);
    assert.deepEqual(JSON.parse(readFileSync(inputJsonFile, "utf8")), { keyword: "fitness" });
    assert.deepEqual(command.args, [
      "--no-configuration-cache",
      "--quiet",
      ":instagram-connector:invokeLocalInstagramRuntime",
      "-Dinstagram.local.action=instagram.search.input",
      inputJsonFileArg,
      "-Dinstagram.local.adbPath=C:\\Android\\adb.exe",
      "-Dinstagram.local.serial=emulator-5554",
      "-Dinstagram.local.artifactDir=F:\\artifacts",
      "-Dinstagram.local.commandTimeoutMs=15000",
      "-Dinstagram.local.waitTimeoutMs=8000",
      "-Dinstagram.local.deadlineMs=120000"
    ]);
    assert.equal(command.env.INSTAGRAM_CONNECTOR_ADB_SERIAL, "emulator-5554");
  } finally {
    for (const filePath of cleanupPaths) {
      rmSync(dirname(filePath), { recursive: true, force: true });
    }
    rmSync(runtimeRoot, { recursive: true, force: true });
  }
});

test("invoke parses JSON emitted by local runtime command", async () => {
  const runtimeRoot = mkdtempSync(join(tmpdir(), "instagram-connector-runtime-"));
  writeFakeGradle(runtimeRoot, "{\"status\":\"SUCCEEDED\",\"code\":\"OK\",\"output\":{\"loaded\":true},\"detail\":\"\"}");

  try {
    const result = await invokeInstagramConnector({
      action: "connector.load",
      config: { runtimeRoot }
    });

    assert.equal(result.status, "SUCCESS");
    assert.equal(result.code, "OK");
    assert.deepEqual(result.output, { loaded: true });
  } finally {
    rmSync(runtimeRoot, { recursive: true, force: true });
  }
});

test("missing runtime root fails before spawning Gradle", () => {
  assert.throws(
    () =>
      createInstagramConnectorCommand({
        action: "instagram.debug.snapshot",
        config: { runtimeRoot: "F:\\missing\\instagram-connector-runtime" }
      }),
    (error) => error.code === "CONNECTOR_RUNTIME_NOT_FOUND"
  );
});

/**
 * 输入：runtime 根目录和 stdout JSON。
 * 输出：无。
 * 作用：创建测试用 Gradle wrapper，避免单元测试触碰真实 Android 工程。
 */
function writeFakeGradle(runtimeRoot, jsonLine) {
  if (process.platform === "win32") {
    writeFileSync(join(runtimeRoot, "gradlew.bat"), `@echo off\r\necho fake gradle\r\necho ${jsonLine}\r\n`);
    return;
  }

  const gradlePath = join(runtimeRoot, "gradlew");
  writeFileSync(gradlePath, `#!/usr/bin/env sh\necho fake gradle\necho '${jsonLine}'\n`);
}
