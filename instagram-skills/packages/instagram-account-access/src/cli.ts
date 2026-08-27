#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadInstagramOfficialApiConfig } from "@instagram-skills/instagram-official-api/config-file";
import { createAccountAccessPlan } from "./plan.js";
import { redactSensitiveText, redactSensitiveValue } from "./security.js";
import type {
  AccountAccessCheckOfficialHealthInput,
  AccountAccessCompleteOAuthCallbackInput,
  AccountAccessSelectOfficialAccountInput,
  CreateAccountAccessPlanInput,
  ExportSettingsInput,
  InstagramAccountAccessConfig,
  LoginWithPasswordInput,
  LoginWithSessionIdInput,
  ReloginInput,
  ResolveChallengeInput,
  StartOfficialBindingInput
} from "./schema.js";

type CliCommand =
  | "plan"
  | "login"
  | "login-with-sessionid"
  | "continue-challenge"
  | "refresh"
  | "export-settings"
  | "bind"
  | "complete-official-callback"
  | "select-official-account"
  | "check-official-health";

interface CliOptions {
  command: CliCommand;
  inputJson: string;
  zernioConfigPath?: string;
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
 * 作用：执行账号接入 CLI，并用结构化 JSON 输出结果。
 */
export async function runCli(argv: string[], env: Record<string, string | undefined> = process.env): Promise<number> {
  try {
    const options = parseArgs(argv);
    const input = await readInputJson(options.inputJson);
    const result = await executeCommand(options, input, env);

    writeJson({ ok: true, result });
    return 0;
  } catch (error) {
    writeJson({
      ok: false,
      error: {
        code: readErrorCode(error),
        message: redactSensitiveText(error instanceof Error ? error.message : String(error))
      }
    });

    return readExitCode(error);
  }
}

/**
 * 输入：CLI 选项、命令输入和环境变量。
 * 输出：命令执行结果。
 * 作用：把稳定 CLI 命令路由到 AccountAccessService 方法。
 */
async function executeCommand(options: CliOptions, input: unknown, env: Record<string, string | undefined>): Promise<unknown> {
  if (options.command === "plan") {
    return createAccountAccessPlan(input as CreateAccountAccessPlanInput);
  }

  const config = loadServiceConfig(options, env);
  const { createInstagramAccountAccessService } = await import("./service.js");
  const service = createInstagramAccountAccessService(config);

  try {
    switch (options.command) {
      case "login":
        return await service.loginWithPassword(input as LoginWithPasswordInput);
      case "login-with-sessionid":
        return await service.loginWithSessionId(input as LoginWithSessionIdInput);
      case "continue-challenge":
        return await service.resolveChallenge(input as ResolveChallengeInput);
      case "refresh":
        return await service.relogin(input as ReloginInput);
      case "export-settings":
        return await service.exportSettings(input as ExportSettingsInput);
      case "bind":
        return await service.startOfficialBinding(input as StartOfficialBindingInput);
      case "complete-official-callback":
        return await service.completeOfficialCallback(input as AccountAccessCompleteOAuthCallbackInput);
      case "select-official-account":
        return await service.selectOfficialAccount(input as AccountAccessSelectOfficialAccountInput);
      case "check-official-health":
        return await service.checkOfficialHealth(input as AccountAccessCheckOfficialHealthInput);
    }
  } finally {
    service.close();
  }
}

/**
 * 输入：CLI 选项和环境变量。
 * 输出：账号接入 service 配置。
 * 作用：从环境变量和 Zernio 配置文件创建 CLI 运行配置。
 */
function loadServiceConfig(options: CliOptions, env: Record<string, string | undefined>): InstagramAccountAccessConfig {
  const officialApi = isOfficialExecutionCommand(options.command) ? loadRequiredOfficialApiConfig(options, env) : undefined;

  return {
    aiograpiRest: {
      baseUrl: env.INSTAGRAM_AIOGRAPI_REST_BASE_URL ?? "http://127.0.0.1:8005",
      requestTimeoutMs: readPositiveInteger(env.INSTAGRAM_AIOGRAPI_REST_TIMEOUT_MS ?? "30000", "INSTAGRAM_AIOGRAPI_REST_TIMEOUT_MS")
    },
    ...(officialApi === undefined ? {} : { officialApi }),
    sessionStore: {
      databasePath: env.INSTAGRAM_SESSION_STORE_SQLITE_PATH ?? "instagram-session-store.sqlite"
    },
    ...(env.INSTAGRAM_SKILLS_SECRET_KEY === undefined && env.INSECURE_PLAINTEXT_SECRET_ALLOWED !== "true"
      ? {}
      : { allowInsecurePlaintextSecrets: env.INSECURE_PLAINTEXT_SECRET_ALLOWED === "true" })
  };
}

/**
 * 输入：CLI 选项和环境变量。
 * 输出：official-api 配置。
 * 作用：只在 official 执行命令中加载 Zernio 配置。
 */
function loadRequiredOfficialApiConfig(
  options: CliOptions,
  env: Record<string, string | undefined>
): NonNullable<InstagramAccountAccessConfig["officialApi"]> {
  const configPath = options.zernioConfigPath ?? env.INSTAGRAM_OFFICIAL_API_CONFIG_PATH ?? defaultApiConfigPath();

  if (configPath !== undefined && existsSync(configPath)) {
    return loadInstagramOfficialApiConfig(configPath, { env });
  }

  if (env.ZERNIO_API_KEY !== undefined && env.ZERNIO_API_KEY.trim().length > 0) {
    return {
      apiKey: env.ZERNIO_API_KEY,
      requestTimeoutMs: readPositiveInteger(env.ZERNIO_REQUEST_TIMEOUT_MS ?? "30000", "ZERNIO_REQUEST_TIMEOUT_MS"),
      ...(env.ZERNIO_BASE_URL === undefined ? {} : { zernioBaseUrl: env.ZERNIO_BASE_URL })
    };
  }

  throw new Error("ZERNIO_CONFIG_REQUIRED");
}

/**
 * 输入：CLI 参数。
 * 输出：解析后的 CLI 选项。
 * 作用：解析稳定命令和 JSON 输入来源。
 */
function parseArgs(argv: string[]): CliOptions {
  const command = argv[0] as CliCommand | undefined;

  if (!isCliCommand(command)) {
    throw new Error("ACCOUNT_ACCESS_CLI_COMMAND_REQUIRED");
  }

  let inputJson = "-";
  let zernioConfigPath: string | undefined;

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--input-json") {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error("ACCOUNT_ACCESS_CLI_INPUT_JSON_REQUIRED");
      }

      inputJson = value;
      index += 1;
      continue;
    }

    if (arg === "--zernio-config") {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error("ACCOUNT_ACCESS_CLI_ZERNIO_CONFIG_REQUIRED");
      }

      zernioConfigPath = resolve(value);
      index += 1;
      continue;
    }

    throw new Error(`ACCOUNT_ACCESS_CLI_UNKNOWN_ARG: ${arg}`);
  }

  return {
    command,
    inputJson,
    ...(zernioConfigPath === undefined ? {} : { zernioConfigPath })
  };
}

/**
 * 输入：JSON 来源。
 * 输出：解析后的 JSON。
 * 作用：支持 stdin、文件路径和内联 JSON 三种输入方式。
 */
async function readInputJson(source: string): Promise<unknown> {
  const text = source === "-" ? await readStdin() : source.trim().startsWith("{") ? source : await readFile(source, "utf8");

  if (text.trim().length === 0) {
    return {};
  }

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
 * 输入：字符串数字和字段名。
 * 输出：正整数。
 * 作用：解析 CLI 环境变量中的超时时间。
 */
function readPositiveInteger(value: string, field: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field}_INVALID`);
  }

  return parsed;
}

/**
 * 输入：未知错误。
 * 输出：CLI 错误码。
 * 作用：将 provider 错误和配置错误转换为结构化错误码。
 */
function readErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }

  if (error instanceof SyntaxError) {
    return "invalid_json";
  }

  return "account_access_cli_failed";
}

/**
 * 输入：未知错误。
 * 输出：CLI 退出码。
 * 作用：区分业务失败、配置失败和系统失败。
 */
function readExitCode(error: unknown): number {
  if (error instanceof SyntaxError) {
    return 2;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message.endsWith("_REQUIRED") || message.endsWith("_INVALID") || message.includes("_CONFIG_")) {
    return 2;
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    return 1;
  }

  return 3;
}

/**
 * 输入：候选命令。
 * 输出：是否为支持的 CLI 命令。
 * 作用：收窄 CLI 命令类型。
 */
function isCliCommand(value: string | undefined): value is CliCommand {
  return (
    value === "plan" ||
    value === "login" ||
    value === "login-with-sessionid" ||
    value === "continue-challenge" ||
    value === "refresh" ||
    value === "export-settings" ||
    value === "bind" ||
    value === "complete-official-callback" ||
    value === "select-official-account" ||
    value === "check-official-health"
  );
}

/**
 * 输入：CLI 命令。
 * 输出：是否为 official-api 执行命令。
 * 作用：避免 plan 和 aiograpi 命令读取无关 Zernio 配置。
 */
function isOfficialExecutionCommand(command: CliCommand): boolean {
  return (
    command === "bind" ||
    command === "complete-official-callback" ||
    command === "select-official-account" ||
    command === "check-official-health"
  );
}

/**
 * 输入：无。
 * 输出：默认 api.yml 路径。
 * 作用：允许仓库根目录 api.yml 被 CLI 自动发现。
 */
function defaultApiConfigPath(): string | undefined {
  const cwdPath = resolve(process.cwd(), "api.yml");

  return existsSync(cwdPath) ? cwdPath : undefined;
}

/**
 * 输入：结构化 JSON 值。
 * 输出：无。
 * 作用：向 stdout 写入脱敏后的结构化结果。
 */
function writeJson(value: CliOkOutput | CliErrorOutput): void {
  process.stdout.write(`${JSON.stringify(redactSensitiveValue(value), null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
