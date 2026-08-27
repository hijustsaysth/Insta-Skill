import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packagesDir = fileURLToPath(new URL("../packages/", import.meta.url));

/**
 * 输入：无。
 * 输出：校验失败时抛错。
 * 作用：检查所有包内 SKILL.md 是否包含 dsh 可识别的 frontmatter。
 */
async function main() {
  const packageNames = await readdir(packagesDir);
  const checked = [];

  for (const packageName of packageNames) {
    const skillPath = join(packagesDir, packageName, "SKILL.md");
    let content;

    try {
      content = await readFile(skillPath, "utf8");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        continue;
      }

      throw error;
    }

    checked.push(packageName);
    assert.equal(content.startsWith("---\n"), true, `${packageName}/SKILL.md missing frontmatter start`);
    assert.match(content, /\nname:\s*\S+/, `${packageName}/SKILL.md missing frontmatter name`);
    assert.match(content, /\ndescription:\s*.+/, `${packageName}/SKILL.md missing frontmatter description`);
    assert.match(content, /\n---\n/, `${packageName}/SKILL.md missing frontmatter end`);
  }

  assert.equal(checked.length > 0, true, "no SKILL.md files found");
  console.log(`validated ${checked.length} SKILL.md files`);
}

await main();
