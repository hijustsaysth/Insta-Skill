import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * 输入：目录路径。
 * 输出：目录下所有文件路径。
 * 作用：递归收集源码文件用于依赖边界检查。
 */
function listFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

test("package depends only on instagram-core at runtime", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

  assert.deepEqual(packageJson.dependencies, {
    "@instagram-skills/instagram-core": "workspace:*"
  });
  assert.deepEqual(packageJson.peerDependencies, {
    "@deepseek-ai/cordis": "^4.0.1"
  });
});

test("source does not import provider or business skill packages", () => {
  const sourceFiles = listFiles(fileURLToPath(new URL("../src", import.meta.url))).filter((file) =>
    file.endsWith(".ts")
  );
  const source = sourceFiles.map((file) => readFileSync(file, "utf8")).join("\n");

  assert.equal(source.includes("@instagram-skills/instagram-aiograpi-rest"), false);
  assert.equal(source.includes("@instagram-skills/instagram-official-api"), false);
  assert.equal(source.includes("@instagram-skills/instagram-connector"), false);
  assert.equal(source.includes("@instagram-skills/instagram-profile-setup"), false);
  assert.equal(source.includes("@instagram-skills/instagram-content-publish"), false);
  assert.equal(source.includes("@instagram-skills/instagram-video-interaction"), false);
  assert.equal(source.includes("@instagram-skills/instagram-warmup-orchestrator"), false);
});
