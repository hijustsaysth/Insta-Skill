#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createInstagramConnectorCommand,
  invokeInstagramConnector,
  type InstagramConnectorCliAction
} from "./command.js";
import type { InstagramConnectorCliConfig } from "./config.js";
import { connectorTools } from "./tools.js";

type CliCommand = "list-tools" | "invoke" | "probe" | "print-command";

interface CliOptions {
  command: CliCommand;
  action?: InstagramConnectorCliAction;
  inputJson: string;
  config: InstagramConnectorCliConfig;
}

interface CliOkOutput {
  ok: true;
  result: unknown;
}

interface CliErrorOutput {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * 输入：CLI 参数和环境变量。
 * 输出：进程退出码。
 * 作用：执行本地 Instagram Connector CLI，并用结构化 JSON 输出结果。
 */
export async function runCli(argv: string[], env: Record<string, string | undefined> = process.env): Promise<number> {
  try {
    const options = parseArgs(argv, env);
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
 * 输入：CLI 选项。
 * 输出：命令结果。
 * 作用：把稳定 CLI 命令路由到本地 connector 执行层。
 */
async function executeCommand(options: CliOptions): Promise<unknown> {
  if (options.command === "list-tools") {
    return { tools: connectorTools };
  }

  const action = options.command === "probe" ? "connector.load" : options.action;
  if (action === undefined) {
    throw new Error("INSTAGRAM_CONNECTOR_ACTION_REQUIRED");
  }

  const input = await readInputJson(options.inputJson);
  if (options.command === "print-command") {
    return createInstagramConnectorCommand({ action, input, config: options.config });
  }

  return await invokeInstagramConnector({ action, input, config: options.config });
}

/**
 * 输入：CLI 参数和环境变量。
 * 输出：解析后的 CLI 选项。
 * 作用：解析稳定命令、JSON 输入来源和本地 Runtime 配置。
 */
function parseArgs(argv: string[], env: Record<string, string | undefined>): CliOptions {
  const command = argv[0] as CliCommand | undefined;
  if (!isCliCommand(command)) {
    throw new Error("INSTAGRAM_CONNECTOR_COMMAND_REQUIRED");
  }

  let action: InstagramConnectorCliAction | undefined;
  let inputJson = "{}";
  const config: InstagramConnectorCliConfig = {};

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];

    if (arg === "--action") {
      if (value === undefined) throw new Error("INSTAGRAM_CONNECTOR_ACTION_REQUIRED");
      action = readAction(value);
      index += 1;
      continue;
    }

    if (arg === "--input-json") {
      if (value === undefined) throw new Error("INSTAGRAM_CONNECTOR_INPUT_JSON_REQUIRED");
      inputJson = value;
      index += 1;
      continue;
    }

    if (arg === "--runtime-root") {
      if (value === undefined) throw new Error("INSTAGRAM_CONNECTOR_RUNTIME_ROOT_REQUIRED");
      config.runtimeRoot = resolve(value);
      index += 1;
      continue;
    }

    if (arg === "--gradle-command") {
      if (value === undefined) throw new Error("INSTAGRAM_CONNECTOR_GRADLE_COMMAND_REQUIRED");
      config.gradleCommand = value;
      index += 1;
      continue;
    }

    if (arg === "--adb-path") {
      if (value === undefined) throw new Error("INSTAGRAM_CONNECTOR_ADB_PATH_REQUIRED");
      config.adbPath = value;
      index += 1;
      continue;
    }

    if (arg === "--adb-serial") {
      if (value === undefined) throw new Error("INSTAGRAM_CONNECTOR_ADB_SERIAL_REQUIRED");
      config.adbSerial = value;
      index += 1;
      continue;
    }

    if (arg === "--artifact-dir") {
      if (value === undefined) throw new Error("INSTAGRAM_CONNECTOR_ARTIFACT_DIR_REQUIRED");
      config.artifactDir = value;
      index += 1;
      continue;
    }

    if (arg === "--command-timeout-ms") {
      if (value === undefined) throw new Error("INSTAGRAM_CONNECTOR_COMMAND_TIMEOUT_REQUIRED");
      config.commandTimeoutMs = readPositiveInteger(value, "INSTAGRAM_CONNECTOR_COMMAND_TIMEOUT_MS");
      index += 1;
      continue;
    }

    if (arg === "--wait-timeout-ms") {
      if (value === undefined) throw new Error("INSTAGRAM_CONNECTOR_WAIT_TIMEOUT_REQUIRED");
      config.waitTimeoutMs = readPositiveInteger(value, "INSTAGRAM_CONNECTOR_WAIT_TIMEOUT_MS");
      index += 1;
      continue;
    }

    if (arg === "--deadline-ms") {
      if (value === undefined) throw new Error("INSTAGRAM_CONNECTOR_DEADLINE_REQUIRED");
      config.deadlineMs = readPositiveInteger(value, "INSTAGRAM_CONNECTOR_DEADLINE_MS");
      index += 1;
      continue;
    }

    if (arg === "--adb-keyboard-ime") {
      if (value === undefined) throw new Error("INSTAGRAM_CONNECTOR_ADB_KEYBOARD_IME_REQUIRED");
      config.adbKeyboardIme = value;
      index += 1;
      continue;
    }

    if (arg === "--adb-keyboard-input-action") {
      if (value === undefined) throw new Error("INSTAGRAM_CONNECTOR_ADB_KEYBOARD_INPUT_ACTION_REQUIRED");
      config.adbKeyboardInputAction = value;
      index += 1;
      continue;
    }

    throw new Error(`INSTAGRAM_CONNECTOR_UNKNOWN_ARG: ${arg}`);
  }

  applyEnvDefaults(config, env);
  return { command, inputJson, config, ...(action === undefined ? {} : { action }) };
}

/**
 * 输入：CLI 配置和环境变量。
 * 输出：无。
 * 作用：让环境变量成为命令行参数之外的默认配置来源。
 */
function applyEnvDefaults(config: InstagramConnectorCliConfig, env: Record<string, string | undefined>): void {
  assignOptionalString(config, "runtimeRoot", env.INSTAGRAM_CONNECTOR_RUNTIME_ROOT);
  assignOptionalString(config, "gradleCommand", env.INSTAGRAM_CONNECTOR_GRADLE_COMMAND);
  assignOptionalString(config, "adbPath", env.INSTAGRAM_CONNECTOR_ADB_PATH);
  assignOptionalString(config, "adbSerial", env.INSTAGRAM_CONNECTOR_ADB_SERIAL ?? env.INSTAGRAM_ADB_SERIAL);
  assignOptionalString(config, "artifactDir", env.INSTAGRAM_CONNECTOR_ARTIFACT_DIR);
  assignOptionalString(config, "adbKeyboardIme", env.INSTAGRAM_CONNECTOR_ADB_KEYBOARD_IME);
  assignOptionalString(config, "adbKeyboardInputAction", env.INSTAGRAM_CONNECTOR_ADB_KEYBOARD_INPUT_ACTION);
  assignOptionalNumber(
    config,
    "commandTimeoutMs",
    readOptionalPositiveInteger(env.INSTAGRAM_CONNECTOR_COMMAND_TIMEOUT_MS, "INSTAGRAM_CONNECTOR_COMMAND_TIMEOUT_MS")
  );
  assignOptionalNumber(
    config,
    "waitTimeoutMs",
    readOptionalPositiveInteger(env.INSTAGRAM_CONNECTOR_WAIT_TIMEOUT_MS, "INSTAGRAM_CONNECTOR_WAIT_TIMEOUT_MS")
  );
  assignOptionalNumber(
    config,
    "deadlineMs",
    readOptionalPositiveInteger(env.INSTAGRAM_CONNECTOR_DEADLINE_MS, "INSTAGRAM_CONNECTOR_DEADLINE_MS")
  );
}

/**
 * 输入：CLI 配置、字段名和可选字符串。
 * 输出：无。
 * 作用：仅在字段缺失且环境变量有值时写入配置。
 */
function assignOptionalString(
  config: InstagramConnectorCliConfig,
  field:
    | "runtimeRoot"
    | "gradleCommand"
    | "adbPath"
    | "adbSerial"
    | "artifactDir"
    | "adbKeyboardIme"
    | "adbKeyboardInputAction",
  value: string | undefined
): void {
  if (config[field] === undefined && value !== undefined && value.trim().length > 0) {
    config[field] = value;
  }
}

/**
 * 输入：CLI 配置、字段名和可选数值。
 * 输出：无。
 * 作用：仅在字段缺失且环境变量有值时写入数值配置。
 */
function assignOptionalNumber(
  config: InstagramConnectorCliConfig,
  field: "commandTimeoutMs" | "waitTimeoutMs" | "deadlineMs",
  value: number | undefined
): void {
  if (config[field] === undefined && value !== undefined) {
    config[field] = value;
  }
}

/**
 * 输入：JSON 来源。
 * 输出：解析后的 JSON。
 * 作用：支持 stdin、文件路径和内联 JSON 三种输入方式。
 */
async function readInputJson(source: string): Promise<unknown> {
  const text = source === "-" ? await readStdin() : source.trim().startsWith("{") ? source : await readFile(source, "utf8");
  if (text.trim().length === 0) return {};
  return JSON.parse(text) as unknown;
}

/**
 * 输入：无。
 * 输出：stdin 文本。
 * 作用：读取 agent 通过管道传入的 JSON 请求体。
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * 输入：action 文本。
 * 输出：合法 connector action。
 * 作用：在 CLI 边界拒绝未知操作。
 */
function readAction(value: string): InstagramConnectorCliAction {
  if (value === "connector.load" || connectorTools.some((tool) => tool.name === value)) {
    return value as InstagramConnectorCliAction;
  }
  throw new Error(`INSTAGRAM_CONNECTOR_ACTION_UNSUPPORTED: ${value}`);
}

/**
 * 输入：字符串数字和字段名。
 * 输出：正整数。
 * 作用：解析 CLI 数值参数。
 */
function readPositiveInteger(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field}_INVALID`);
  }
  return parsed;
}

/**
 * 输入：可选字符串数字和字段名。
 * 输出：正整数或 undefined。
 * 作用：解析可选环境变量数值。
 */
function readOptionalPositiveInteger(value: string | undefined, field: string): number | undefined {
  return value === undefined || value.trim().length === 0 ? undefined : readPositiveInteger(value, field);
}

/**
 * 输入：候选命令。
 * 输出：是否为支持的 CLI 命令。
 * 作用：收窄 CLI 命令类型。
 */
function isCliCommand(value: string | undefined): value is CliCommand {
  return value === "list-tools" || value === "invoke" || value === "probe" || value === "print-command";
}

/**
 * 输入：未知错误。
 * 输出：CLI 错误码。
 * 作用：将适配层错误和参数错误转换为结构化错误码。
 */
function readErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  if (error instanceof SyntaxError) return "invalid_json";
  return "instagram_connector_cli_failed";
}

/**
 * 输入：未知错误。
 * 输出：CLI 退出码。
 * 作用：区分参数失败、connector 失败和系统失败。
 */
function readExitCode(error: unknown): number {
  if (error instanceof SyntaxError) return 2;
  const message = error instanceof Error ? error.message : String(error);
  if (message.endsWith("_REQUIRED") || message.endsWith("_INVALID") || message.includes("_UNSUPPORTED")) return 2;
  if (typeof error === "object" && error !== null && "code" in error) return 1;
  return 3;
}

/**
 * 输入：结构化 JSON 值。
 * 输出：无。
 * 作用：向 stdout 写入结构化结果。
 */
function writeJson(value: CliOkOutput | CliErrorOutput): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
