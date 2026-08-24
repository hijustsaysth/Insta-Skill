import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("core package has no runtime dependencies", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(packageJson.dependencies, undefined);
});

test("core source does not import adapter provider or http clients", async () => {
  const sourceDir = new URL("../src/", import.meta.url);
  const sourceDirPath = fileURLToPath(sourceDir);
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const sourceFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".ts"));
  const forbiddenImportPattern =
    /^import\s+.*(?:@instagram-skills\/instagram(?!-core)|cordis|aiograpi|official-api|connector|axios|undici)/m;
  const forbiddenRuntimeCallPattern = /fetch\(/;

  for (const file of sourceFiles) {
    const source = await readFile(join(sourceDirPath, file.name), "utf8");
    assert.equal(forbiddenImportPattern.test(source), false, `${file.name} imports forbidden dependency`);
    assert.equal(forbiddenRuntimeCallPattern.test(source), false, `${file.name} calls forbidden runtime client`);
  }
});
