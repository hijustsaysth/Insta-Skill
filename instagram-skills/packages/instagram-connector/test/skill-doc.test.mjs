import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const skillPath = new URL("../SKILL.md", import.meta.url);
const distSkillPath = new URL(
  "../../../dist-skills/instagram-connector/SKILL.md",
  import.meta.url,
);
const skillDocument = readFileSync(skillPath, "utf8");
const commentSection = skillDocument.match(/## 评论输入\n([\s\S]*?)(?=\n## )/)?.[1] ?? "";
const unsupportedRule = commentSection
  .split("\n")
  .find((line) => line.includes("UI_INPUT_UNICODE_UNSUPPORTED")) ?? "";

test("ADB Keyboard 可用时通过 UTF-8 base64 发送非 ASCII 评论", () => {
  assert.match(
    commentSection,
    /ADB Keyboard 可用时[^\n]*非 ASCII[^\n]*`ADB_INPUT_B64`[^\n]*UTF-8 base64/,
  );
});

test("ADB Keyboard 不可用时降级并停止评论", () => {
  assert.match(unsupportedRule, /ADB Keyboard 不可用或无法启用/);
  assert.match(unsupportedRule, /立即停止评论/);
  assert.match(unsupportedRule, /不得点击 Post/);
});

test("非 ASCII 降级规则必须包含 ADB Keyboard 可用性条件", () => {
  assert.doesNotMatch(commentSection, /非 ASCII 必须返回降级/);
  assert.match(unsupportedRule, /仅当 ADB Keyboard 不可用或无法启用时才返回降级/);
});

test("发布镜像与源文档逐字节一致", () => {
  assert.equal(readFileSync(distSkillPath, "utf8"), skillDocument);
});
