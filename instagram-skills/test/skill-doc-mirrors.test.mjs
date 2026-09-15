import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packagesRoot = fileURLToPath(new URL("../packages/", import.meta.url));
const distributionRoot = fileURLToPath(new URL("../dist-skills/", import.meta.url));

/**
 * 输入：需要扫描的目录。
 * 输出：目录内全部 Markdown 文件的绝对路径。
 * 作用：递归发现随 skill package 维护的文档，避免镜像清单遗漏新增 reference。
 */
function findMarkdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findMarkdownFiles(path);
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
  });
}

test("全部 skill Markdown 均有逐字节一致的发布镜像", () => {
  assertMarkdownMirrors(packagesRoot, distributionRoot);
});

test("新增 Markdown 无需维护计数且缺失镜像会失败", (context) => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "instagram-skill-docs-"));
  const fixturePackagesRoot = join(fixtureRoot, "packages");
  const fixtureDistributionRoot = join(fixtureRoot, "dist-skills");
  const relativePath = join("example-skill", "references", "extra.md");
  const sourcePath = join(fixturePackagesRoot, relativePath);
  const mirrorPath = join(fixtureDistributionRoot, relativePath);

  context.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
  mkdirSync(join(fixturePackagesRoot, "example-skill", "references"), { recursive: true });
  mkdirSync(join(fixtureDistributionRoot, "example-skill", "references"), { recursive: true });
  writeFileSync(sourcePath, "# fixture\n");
  writeFileSync(mirrorPath, "# fixture\n");

  assert.doesNotThrow(() => assertMarkdownMirrors(fixturePackagesRoot, fixtureDistributionRoot));

  rmSync(mirrorPath);
  assert.throws(
    () => assertMarkdownMirrors(fixturePackagesRoot, fixtureDistributionRoot),
    /ENOENT/,
  );
});

/**
 * 输入：源 package 根目录和发布镜像根目录。
 * 输出：无；未发现文档或镜像不一致时抛错。
 * 作用：按递归发现的源 Markdown 校验每一份发布镜像。
 */
function assertMarkdownMirrors(sourceRoot, mirrorRoot) {
  const sourceDocuments = findMarkdownFiles(sourceRoot);
  assert.ok(sourceDocuments.length > 0, "未发现 skill Markdown");

  for (const sourcePath of sourceDocuments) {
    const relativePath = relative(sourceRoot, sourcePath);
    const mirrorPath = join(mirrorRoot, relativePath);
    assert.deepEqual(
      readFileSync(mirrorPath),
      readFileSync(sourcePath),
      `${relativePath} 的发布镜像不一致`,
    );
  }
}
