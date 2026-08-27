import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

test("package keeps MCP SDK out of runtime dependencies", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

  assert.deepEqual(packageJson.dependencies ?? {}, {});
  assert.equal(packageJson.devDependencies["@modelcontextprotocol/sdk"], undefined);
  assert.equal(packageJson.bin["instagram-connector"], "./dist/cli.js");
});

test("source does not import MCP server SDK or unrelated provider packages", () => {
  const source = readSourceFiles(join(packageRoot, "src"));

  assert.equal(source.includes("@modelcontextprotocol"), false);
  assert.equal(source.includes("instagram-aiograpi-rest"), false);
  assert.equal(source.includes("instagram-official-api"), false);
  assert.equal(source.includes("instagram-profile-setup"), false);
  assert.equal(source.includes("instagram-content-publish"), false);
  assert.equal(source.includes("instagram-warmup-orchestrator"), false);
  assert.equal(source.includes("instagram-runtime-mcp-server"), false);
});

test("main entry does not export old MCP launch APIs", async () => {
  const mod = await import("../dist/index.js");

  assert.equal(Object.hasOwn(mod, "executeConnectorTool"), false);
  assert.equal(Object.hasOwn(mod, "createInstagramConnectorMcpLaunchConfig"), false);
  assert.equal(Object.hasOwn(mod, "toInstagramConnectorMcpEnv"), false);
  assert.equal(Object.hasOwn(mod, "normalizeInstagramConnectorMcpResult"), false);
});

/**
 * 输入：源码目录。
 * 输出：目录下 TypeScript 源码内容。
 * 作用：让包边界测试检查源码是否引入了不允许的实现依赖。
 */
function readSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) return readSourceFiles(fullPath);
      if (!entry.name.endsWith(".ts")) return [];
      return readFileSync(fullPath, "utf8");
    })
    .join("\n");
}
