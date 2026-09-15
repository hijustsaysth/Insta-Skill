import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const skillDocument = readFileSync(new URL("../SKILL.md", import.meta.url), "utf8");
const distSkillDocument = readFileSync(
  new URL("../../../dist-skills/instagram-profile-setup/SKILL.md", import.meta.url),
  "utf8",
);
const successSection = skillDocument.match(/## 成功条件\n([\s\S]*?)(?=\n## |$)/)?.[1] ?? "";
const nonAvatarRule = successSection
  .split("\n")
  .find((line) => line.includes("`targets` 不含 `avatar`")) ?? "";
const avatarRule = successSection
  .split("\n")
  .find((line) => line.includes("`targets` 含 `avatar`")) ?? "";

test("普通资料目标不要求头像输入或状态", () => {
  assert.match(nonAvatarRule, /`username`、`displayName`、`biography`/);
  assert.match(nonAvatarRule, /不要求 `referenceAssets`、`generatedAvatarAssets` 或 `avatarGeneration.status`/);
});

test("头像目标保留生成成功条件", () => {
  assert.match(avatarRule, /`referenceAssets.length >= 1`/);
  assert.match(avatarRule, /`generatedAvatarAssets.length === avatarCount`/);
  assert.match(avatarRule, /`avatarGeneration.status === generated`/);
  assert.match(avatarRule, /`avatarAsset` 来自 `generatedAvatarAssets`/);
});

test("发布镜像与源文档逐字节一致", () => {
  assert.equal(distSkillDocument, skillDocument);
});
