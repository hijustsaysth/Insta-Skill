import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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

const sourceDocuments = findMarkdownFiles(packagesRoot);

test("全部 skill Markdown 均有逐字节一致的发布镜像", () => {
  assert.equal(sourceDocuments.length, 8);
  for (const sourcePath of sourceDocuments) {
    const relativePath = relative(packagesRoot, sourcePath);
    const mirrorPath = join(distributionRoot, relativePath);
    assert.deepEqual(
      readFileSync(mirrorPath),
      readFileSync(sourcePath),
      `${relativePath} 的发布镜像不一致`,
    );
  }
});
