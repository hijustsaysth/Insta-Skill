#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createVideoInteractionToolRegistry } from "./tool-registry.js";
import type { InstagramVideoInteractionToolName } from "./schema.js";

type CliCommand = "list-tools" | "invoke";

interface CliOptions {
  command: CliCommand;
  action?: InstagramVideoInteractionToolName;
  inputJson: string;
}

/**
 * 输入：CLI 参数数组。
 * 输出：进程退出码。
 * 作用：执行 video interaction CLI 并输出结构化 JSON。
 */
export async function runCli(argv: string[]): Promise<number> {
  try {
    const options = parseArgs(argv);
    const result = await executeCommand(options);
    writeJson({ ok: true, result });
    return 0;
  } catch (error) {
    writeJson({
      ok: false,
      error: {
        code: readErrorCode(error),
        message: error instanceof Error ? error.message : String(error)
      }
    });
    return readExitCode(error);
  }
}

/**
 * 输入：解析后的 CLI 选项。
 * 输出：工具执行结果或工具列表。
 * 作用：把 CLI 命令路由到 video interaction 工具注册表。
 */
async function executeCommand(options: CliOptions): Promise<unknown> {
  const registry = createVideoInteractionToolRegistry();
  if (options.command === "list-tools") {
    return { tools: registry.schemas() };
  }

  if (options.action === undefined) {
    throw new Error("INSTAGRAM_VIDEO_INTERACTION_ACTION_REQUIRED");
  }

  return registry.execute(options.action, await readInputJson(options.inputJson));
}

/**
 * 输入：原始 CLI 参数数组。
 * 输出：标准化 CLI 选项。
 * 作用：在命令行边界校验命令、action 和 JSON 输入来源。
 */
function parseArgs(argv: string[]): CliOptions {
  const command = argv[0];
  if (command !== "list-tools" && command !== "invoke") {
    throw new Error("INSTAGRAM_VIDEO_INTERACTION_COMMAND_REQUIRED");
  }

  let action: InstagramVideoInteractionToolName | undefined;
  let inputJson = "{}";

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];

    if (arg === "--action") {
      if (value === undefined) throw new Error("INSTAGRAM_VIDEO_INTERACTION_ACTION_REQUIRED");
      action = readAction(value);
      index += 1;
      continue;
    }

    if (arg === "--input-json") {
      if (value === undefined) throw new Error("INSTAGRAM_VIDEO_INTERACTION_INPUT_JSON_REQUIRED");
      inputJson = value;
      index += 1;
      continue;
    }

    throw new Error(`INSTAGRAM_VIDEO_INTERACTION_UNKNOWN_ARG: ${String(arg)}`);
  }

  return { command, inputJson, ...(action === undefined ? {} : { action }) };
}

/**
 * 输入：JSON 来源。
 * 输出：解析后的 JSON 值。
 * 作用：支持内联 JSON、文件路径和 stdin 三种输入。
 */
async function readInputJson(source: string): Promise<unknown> {
  const trimmed = source.trim();
  const text = source === "-"
    ? await readStdin()
    : trimmed.startsWith("{") || trimmed.startsWith("[")
      ? source
      : await readFile(source, "utf8");
  return text.trim().length === 0 ? {} : JSON.parse(text);
}

/**
 * 输入：无。
 * 输出：stdin 文本。
 * 作用：读取管道传入的 JSON 请求体。
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * 输入：action 字符串。
 * 输出：合法 video interaction 工具名。
 * 作用：拒绝未知工具名。
 */
function readAction(value: string): InstagramVideoInteractionToolName {
  if (
    value === "instagram_video_interaction_plan" ||
    value === "instagram_video_evaluate" ||
    value === "instagram_video_log_summarize"
  ) {
    return value;
  }
  throw new Error(`INSTAGRAM_VIDEO_INTERACTION_ACTION_UNSUPPORTED: ${value}`);
}

/**
 * 输入：未知错误。
 * 输出：CLI 错误码。
 * 作用：把异常转换成稳定 JSON 错误字段。
 */
function readErrorCode(error: unknown): string {
  if (error instanceof SyntaxError) return "invalid_json";
  const message = error instanceof Error ? error.message : String(error);
  return message.split(":")[0] || "instagram_video_interaction_cli_failed";
}

/**
 * 输入：未知错误。
 * 输出：进程退出码。
 * 作用：区分参数错误和执行错误。
 */
function readExitCode(error: unknown): number {
  if (error instanceof SyntaxError) return 2;
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("_REQUIRED") || message.includes("_INVALID") || message.includes("_UNSUPPORTED")) return 2;
  return 1;
}

/**
 * 输入：任意结构化值。
 * 输出：无。
 * 作用：向 stdout 写入 JSON。
 */
function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
