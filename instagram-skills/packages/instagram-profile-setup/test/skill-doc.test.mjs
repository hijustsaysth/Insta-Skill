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
const generatedAvatarRule = successSection
  .split("\n")
  .find((line) => line.includes("确认具备图片生成能力")) ?? "";
const degradedAvatarRule = successSection
  .split("\n")
  .find((line) => line.includes("确认环境没有图片生成能力")) ?? "";

test("普通资料目标不要求头像输入或状态", () => {
  assert.match(nonAvatarRule, /`username`、`displayName`、`biography`/);
  assert.match(nonAvatarRule, /不要求 `referenceAssets`、`generatedAvatarAssets` 或 `avatarGeneration.status`/);
});

test("具备图片生成能力时保留 generated 成功条件", () => {
  assert.match(generatedAvatarRule, /`targets` 含 `avatar`/);
  assert.match(generatedAvatarRule, /`referenceAssets.length >= 1`/);
  assert.match(generatedAvatarRule, /`generatedAvatarAssets.length === avatarCount`/);
  assert.match(generatedAvatarRule, /`avatarGeneration.status === generated`/);
  assert.match(generatedAvatarRule, /返回来自 `generatedAvatarAssets` 的 `avatarAsset`/);
  assert.doesNotMatch(generatedAvatarRule, /status === degraded|不返回 `avatarAsset`/);
});

test("无图片生成能力时允许 degraded 结果", () => {
  assert.match(degradedAvatarRule, /`targets` 含 `avatar`/);
  assert.match(degradedAvatarRule, /`avatarGeneration.status === degraded`/);
  assert.match(degradedAvatarRule, /非空 `fallbackReason`/);
  assert.match(degradedAvatarRule, /`generatedAvatarAssets`[^\n]*为空/);
  assert.match(degradedAvatarRule, /`avatarGeneration.generatedAssets`[^\n]*为空/);
  assert.match(degradedAvatarRule, /不返回 `avatarAsset`/);
  assert.doesNotMatch(degradedAvatarRule, /status === generated|length === avatarCount/);
});

test("发布镜像与源文档逐字节一致", () => {
  assert.equal(distSkillDocument, skillDocument);
});
