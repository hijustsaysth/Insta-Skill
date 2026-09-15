import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const registrationSources = [
  "../../instagram-aiograpi-rest/src/cli.ts",
  "../../instagram-connector/src/tools.ts",
  "../../instagram-profile-setup/src/tools.ts",
  "../../instagram-video-interaction/src/tools.ts",
  "../src/tools.ts",
];
const registeredTools = new Set(
  registrationSources.flatMap((source) =>
    [...readFileSync(new URL(source, import.meta.url), "utf8").matchAll(/\bname:\s*"([^"]+)"/g)]
      .map((match) => match[1]),
  ),
);
const skillDocument = readFileSync(new URL("../SKILL.md", import.meta.url), "utf8");
const distSkillDocument = readFileSync(
  new URL("../../../dist-skills/instagram-warmup-orchestrator/SKILL.md", import.meta.url),
  "utf8",
);
const toolHintsText = skillDocument.match(/计划可建议的执行工具包括：([^\n]+)/)?.[1] ?? "";
const toolHints = [...toolHintsText.matchAll(/`([^`]+)`/g)].map((match) => match[1]);

test("warmup toolHints 全部来自仓库工具注册表", () => {
  assert.ok(toolHints.length > 0);
  for (const toolHint of toolHints) {
    assert.equal(registeredTools.has(toolHint), true, `未注册的 toolHint: ${toolHint}`);
  }
});

test("移除不存在的评论生成工具并保留合法跨 skill 提示", () => {
  assert.equal(toolHints.includes("instagram_video_comment_generate"), false);
  assert.equal(toolHints.includes("instagram_profile_generate"), true);
  assert.equal(toolHints.includes("instagram_video_evaluate"), true);
  assert.equal(toolHints.includes("instagram.reel.comment"), true);
  assert.match(skillDocument, /评论文本由 agent[^\n]*不是工具调用/);
});

test("发布镜像与源文档逐字节一致", () => {
  assert.equal(distSkillDocument, skillDocument);
});
