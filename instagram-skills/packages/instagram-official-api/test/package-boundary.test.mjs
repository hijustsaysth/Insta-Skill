import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("main entry does not import cordis adapter or plugin entry", () => {
  const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

  assert.equal(indexSource.includes("./plugin"), false);
  assert.equal(indexSource.includes("@instagram-skills/instagram-cordis"), false);
});

test("package keeps cordis adapter out of runtime dependencies", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(packageJson.dependencies["@instagram-skills/instagram-core"], "workspace:*");
  assert.equal(packageJson.dependencies["@instagram-skills/instagram-cordis"], undefined);
  assert.equal(typeof packageJson.dependencies.yaml, "string");
  assert.equal(packageJson.peerDependencies["@instagram-skills/instagram-cordis"], "workspace:*");
});
