import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  INSTAGRAM_CONNECTOR_GRADLE_TASK,
  type InstagramConnectorCliConfig,
  type InstagramConnectorCommandConfig
} from "./config.js";
import { InstagramConnectorAdapterError } from "./errors.js";
import { normalizeInstagramConnectorCliResult, type ConnectorActionResult } from "./result.js";
import type { ConnectorToolName } from "./tools.js";

export type InstagramConnectorCliAction = ConnectorToolName | "connector.load";

export interface InvokeInstagramConnectorInput {
  action: InstagramConnectorCliAction;
  input?: unknown;
  config?: InstagramConnectorCliConfig;
}

interface ProcessOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

/**
 * 输入：connector action、输入 JSON 和 CLI 配置。
 * 输出：Gradle JavaExec 命令配置。
 * 作用：构造 agent 可直接执行的本地 connector 命令。
 */
export function createInstagramConnectorCommand(input: InvokeInstagramConnectorInput): InstagramConnectorCommandConfig {
  const runtimeRoot = resolve(input.config?.runtimeRoot ?? defaultRuntimeRoot());
  if (!existsSync(runtimeRoot)) {
    throw new InstagramConnectorAdapterError("CONNECTOR_RUNTIME_NOT_FOUND", runtimeRoot);
  }

  const command = input.config?.gradleCommand ?? defaultGradleCommand();
  const inputJsonFile = writeInputJsonTempFile(input.input ?? {});
  const args = [
    ...(input.config?.gradleCommand === undefined ? defaultGradleArgsPrefix(runtimeRoot) : []),
    "--no-configuration-cache",
    "--quiet",
    INSTAGRAM_CONNECTOR_GRADLE_TASK,
    `-Dinstagram.local.action=${input.action}`,
    `-Dinstagram.local.inputJsonFile=${inputJsonFile}`
  ];

  addOptionalProperty(args, "instagram.local.adbPath", input.config?.adbPath);
  addOptionalProperty(args, "instagram.local.serial", input.config?.adbSerial);
  addOptionalProperty(args, "instagram.local.artifactDir", input.config?.artifactDir);
  addOptionalProperty(args, "instagram.local.commandTimeoutMs", input.config?.commandTimeoutMs);
  addOptionalProperty(args, "instagram.local.waitTimeoutMs", input.config?.waitTimeoutMs);
  addOptionalProperty(args, "instagram.local.deadlineMs", input.config?.deadlineMs);
  addOptionalProperty(args, "instagram.local.adbKeyboardIme", input.config?.adbKeyboardIme);
  addOptionalProperty(args, "instagram.local.adbKeyboardInputAction", input.config?.adbKeyboardInputAction);

  return {
    command,
    args,
    cwd: runtimeRoot,
    env: connectorEnvironment(input.config),
    cleanupPaths: [inputJsonFile]
  };
}

/**
 * 输入：connector action、输入 JSON、CLI 配置和取消信号。
 * 输出：标准 connector 结果。
 * 作用：通过本地 Java CLI 执行 Instagram Connector。
 */
export async function invokeInstagramConnector(
  input: InvokeInstagramConnectorInput,
  signal?: AbortSignal
): Promise<ConnectorActionResult> {
  const command = createInstagramConnectorCommand(input);
  try {
    const output = await runProcess(command, signal);
    if (output.exitCode !== 0) {
      throw new InstagramConnectorAdapterError(
        "CONNECTOR_CLI_EXECUTION_FAILED",
        processFailureDetail(output)
      );
    }

    return normalizeInstagramConnectorCliResult(parseConnectorJson(output.stdout));
  } finally {
    cleanupCommandFiles(command);
  }
}

/**
 * 输入：命令配置和取消信号。
 * 输出：进程 stdout、stderr 和退出状态。
 * 作用：执行本地 Gradle JavaExec 任务并收集结果。
 */
function runProcess(command: InstagramConnectorCommandConfig, signal?: AbortSignal): Promise<ProcessOutput> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command.command, command.args, {
      cwd: command.cwd,
      env: { ...process.env, ...command.env },
      windowsHide: true
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    const abort = () => {
      child.kill();
    };

    signal?.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (exitCode, childSignal) => {
      signal?.removeEventListener("abort", abort);
      resolvePromise({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode,
        signal: childSignal
      });
    });
  });
}

/**
 * 输入：stdout 文本。
 * 输出：Java CLI 输出的 JSON 对象。
 * 作用：从 Gradle 输出中提取 connector 返回的最后一行 JSON。
 */
function parseConnectorJson(stdout: string): unknown {
  const line = stdout
    .split(/\r?\n/)
    .map((item) => item.trim())
    .reverse()
    .find((item) => item.startsWith("{") && item.endsWith("}"));
  if (line === undefined) {
    throw new InstagramConnectorAdapterError("CONNECTOR_CLI_RESULT_INVALID", "CLI stdout did not contain JSON");
  }

  try {
    return JSON.parse(line) as unknown;
  } catch (error) {
    throw new InstagramConnectorAdapterError(
      "CONNECTOR_CLI_RESULT_INVALID",
      error instanceof Error ? error.message : "CLI stdout JSON parse failed"
    );
  }
}

/**
 * 输入：进程输出。
 * 输出：适合错误详情的文本。
 * 作用：保留失败诊断并限制返回长度。
 */
function processFailureDetail(output: ProcessOutput): string {
  const detail = [
    `exitCode=${output.exitCode}`,
    `signal=${output.signal ?? ""}`,
    `stderr=${tail(output.stderr)}`,
    `stdout=${tail(output.stdout)}`
  ].join("; ");
  return detail;
}

/**
 * 输入：文本。
 * 输出：末尾诊断片段。
 * 作用：避免 Gradle 失败时向 agent 返回过长日志。
 */
function tail(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= 1200 ? normalized : normalized.slice(normalized.length - 1200);
}

/**
 * 输入：参数数组、系统属性名和可选值。
 * 输出：无。
 * 作用：把已显式配置的本地 Runtime 参数传给 JavaExec。
 */
function addOptionalProperty(args: string[], name: string, value: string | number | undefined): void {
  if (value !== undefined) args.push(`-D${name}=${value}`);
}

/**
 * 输入：CLI 配置。
 * 输出：子进程环境变量。
 * 作用：让 Java 命令可从环境读取本地 Runtime 参数。
 */
function connectorEnvironment(config: InstagramConnectorCliConfig | undefined): Record<string, string> {
  const env: Record<string, string> = {};
  addOptionalEnv(env, "INSTAGRAM_CONNECTOR_ADB_PATH", config?.adbPath);
  addOptionalEnv(env, "INSTAGRAM_CONNECTOR_ADB_SERIAL", config?.adbSerial);
  addOptionalEnv(env, "INSTAGRAM_CONNECTOR_ARTIFACT_DIR", config?.artifactDir);
  addOptionalEnv(env, "INSTAGRAM_CONNECTOR_COMMAND_TIMEOUT_MS", config?.commandTimeoutMs);
  addOptionalEnv(env, "INSTAGRAM_CONNECTOR_WAIT_TIMEOUT_MS", config?.waitTimeoutMs);
  addOptionalEnv(env, "INSTAGRAM_CONNECTOR_DEADLINE_MS", config?.deadlineMs);
  addOptionalEnv(env, "INSTAGRAM_CONNECTOR_ADB_KEYBOARD_IME", config?.adbKeyboardIme);
  addOptionalEnv(env, "INSTAGRAM_CONNECTOR_ADB_KEYBOARD_INPUT_ACTION", config?.adbKeyboardInputAction);
  return env;
}

/**
 * 输入：环境变量对象、名称和可选值。
 * 输出：无。
 * 作用：只传递显式配置的环境变量。
 */
function addOptionalEnv(env: Record<string, string>, name: string, value: string | number | undefined): void {
  if (value !== undefined) env[name] = String(value);
}

/**
 * 输入：connector 业务输入。
 * 输出：临时 JSON 文件路径。
 * 作用：用文件传输业务 JSON，避免 Gradle system property 拆散空格、引号或 Unicode。
 */
function writeInputJsonTempFile(input: unknown): string {
  const dir = mkdtempSync(resolve(tmpdir(), "instagram-connector-"));
  const filePath = resolve(dir, "input.json");
  writeFileSync(filePath, JSON.stringify(input), "utf8");
  return filePath;
}

/**
 * 输入：本地 connector 命令配置。
 * 输出：无。
 * 作用：执行结束后清理 CLI 为 JSON 传输创建的临时文件和目录。
 */
function cleanupCommandFiles(command: InstagramConnectorCommandConfig): void {
  for (const filePath of command.cleanupPaths ?? []) {
    rmSync(dirname(filePath), { recursive: true, force: true });
  }
}

/**
 * 输入：无。
 * 输出：当前平台的 Gradle 命令。
 * 作用：在 Windows 上通过 cmd.exe 启动 Gradle wrapper。
 */
function defaultGradleCommand(): string {
  return process.platform === "win32" ? "cmd.exe" : "./gradlew";
}

/**
 * 输入：runtime 根目录。
 * 输出：默认 Gradle 命令前置参数。
 * 作用：让 Windows batch wrapper 和 Unix shell wrapper 使用同一个后续参数列表。
 */
function defaultGradleArgsPrefix(runtimeRoot: string): string[] {
  if (process.platform !== "win32") return [];
  return ["/d", "/s", "/c", resolve(runtimeRoot, "gradlew.bat")];
}

/**
 * 输入：无。
 * 输出：包内 runtime 目录。
 * 作用：从编译后 dist 文件定位随包发布的 Java runtime。
 */
function defaultRuntimeRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "runtime");
}
