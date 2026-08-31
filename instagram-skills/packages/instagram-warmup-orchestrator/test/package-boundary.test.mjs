import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import test from "node:test";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = fileURLToPath(new URL("../src", import.meta.url));

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

test("包源码不依赖 provider、connector 源码或具体能力包", () => {
  const source = sourceFiles(srcRoot)
    .filter((path) => statSync(path).isFile())
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  for (const forbidden of [
    "@instagram-skills/instagram-core",
    "@instagram-skills/instagram-cordis",
    "@instagram-skills/instagram-aiograpi-rest",
    "@instagram-skills/instagram-official-api",
    "@instagram-skills/instagram-connector",
    "@instagram-skills/instagram-profile-setup",
    "@instagram-skills/instagram-video-interaction",
    "@instagram-skills/instagram-content-publish",
    "ctx.instagram",
    "adb",
    "playwright"
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("包根目录存在 SKILL.md", () => {
  const skill = readFileSync(join(packageRoot, "SKILL.md"), "utf8");
  assert.equal(skill.includes("只生成 Instagram 养号总计划和执行结果汇总"), true);
  assert.equal(skill.includes("不调用其他 skill tool、provider、MCP tool"), true);
});
