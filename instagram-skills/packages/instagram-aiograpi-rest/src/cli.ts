#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { InstagramAccountId, InstagramSessionRef } from "./instagram-types.js";
import { createAiograpiRestAccountClient } from "./account.js";
import { createAiograpiRestAuthClient } from "./auth.js";
import { createAiograpiRestClient } from "./client.js";
import type { AiograpiRestClientConfig, AiograpiRestFetch } from "./config.js";
import { DEFAULT_SESSION_HEADER_NAME } from "./config.js";

export type AiograpiRestCliAction =
  | "auth.login"
  | "auth.loginBySessionId"
  | "auth.relogin"
  | "auth.settings"
  | "account.get"
  | "account.about"
  | "profile.update";

type CliCommand = "list-tools" | "invoke";

interface CliOptions {
  command: CliCommand;
  action?: AiograpiRestCliAction;
  inputJson: string;
  config: AiograpiRestClientConfig;
  sessionCachePath?: string;
  confirmMutation: boolean;
  pretty: boolean;
}

export interface AiograpiRestCliRuntime {
  env?: Record<string, string | undefined>;
  fetch?: AiograpiRestFetch;
  stdin?: NodeJS.ReadableStream;
  stdout?: Pick<NodeJS.WritableStream, "write">;
}

interface SessionCache {
  aiograpiSessionId?: string;
  accountId?: string;
  username?: string;
  baseUrl?: string;
  source?: string;
  updatedAt?: string;
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
    causeDetail?: unknown;
  };
}

export const aiograpiRestCliTools = [
  {
    name: "auth.login",
    description: "使用账号密码登录 aiograpi-rest，并可写入 session cache",
    sideEffect: true
  },
  {
    name: "auth.loginBySessionId",
    description: "使用 Instagram sessionid 登录 aiograpi-rest，并可写入 session cache",
    sideEffect: true
  },
  {
    name: "auth.relogin",
    description: "复用已有 aiograpi session 执行 relogin",
    sideEffect: true
  },
  {
    name: "auth.settings",
    description: "读取当前 aiograpi session 的 settings",
    sideEffect: false
  },
  {
    name: "account.get",
    description: "读取当前登录账号资料",
    sideEffect: false
  },
  {
    name: "account.about",
    description: "读取指定账号或当前登录账号的 about 信息，包含 date/join date",
    sideEffect: false
  },
  {
    name: "profile.update",
    description: "修改当前账号头像、username、fullname/displayName 或简介",
    sideEffect: true
  }
] as const;

/**
 * 输入：CLI 参数和运行时依赖。
 * 输出：进程退出码。
 * 作用：执行 aiograpi-rest CLI，并用结构化 JSON 输出结果。
 */
export async function runAiograpiRestCli(argv: string[], runtime: AiograpiRestCliRuntime = {}): Promise<number> {
  const stdout = runtime.stdout ?? process.stdout;

  try {
    const env = runtime.env ?? process.env;
    const options = parseArgs(argv, env, runtime.fetch);
    const result = await executeCommand(options, runtime);
    writeJson(stdout, { ok: true, result }, options.pretty);
    return 0;
  } catch (error) {
    writeJson(stdout, {
      ok: false,
      error: {
        code: readErrorCode(error),
        message: error instanceof Error ? error.message : String(error),
        ...(readCauseDetail(error) === undefined ? {} : { causeDetail: readCauseDetail(error) })
      }
    });
    return readExitCode(error);
  }
}

async function executeCommand(options: CliOptions, runtime: AiograpiRestCliRuntime): Promise<unknown> {
  if (options.command === "list-tools") {
    return { tools: aiograpiRestCliTools };
  }

  if (options.action === undefined) {
    throw new Error("AIOGRAPI_REST_CLI_ACTION_REQUIRED");
  }

  const input = await readInputJson(options.inputJson, runtime.stdin ?? process.stdin);

  switch (options.action) {
    case "auth.login":
      return login(options, input);
    case "auth.loginBySessionId":
      return loginBySessionId(options, input);
    case "auth.relogin":
      return relogin(options, input);
    case "auth.settings":
      return exportSettings(options, input);
    case "account.get":
      return getAccount(options, input);
    case "account.about":
      return getAccountAbout(options, input);
    case "profile.update":
      return updateProfile(options, input);
  }
}

async function login(options: CliOptions, input: unknown): Promise<unknown> {
  const body = requireRecord(input);
  const auth = createAiograpiRestAuthClient(options.config);
  const verificationCode = optionalString(body.verificationCode);
  const proxy = optionalString(body.proxy);
  const locale = optionalString(body.locale);
  const timezone = optionalString(body.timezone);
  const accountId = optionalString(body.accountId);
  const result = await auth.login({
    username: requiredString(body.username, "username"),
    password: requiredString(body.password, "password"),
    ...(verificationCode === undefined ? {} : { verificationCode }),
    ...(proxy === undefined ? {} : { proxy }),
    ...(locale === undefined ? {} : { locale }),
    ...(timezone === undefined ? {} : { timezone }),
    ...(accountId === undefined ? {} : { accountId })
  });

  await writeSessionCacheIfConfigured(options, input, result.aiograpiSessionId, "auth.login");
  return result;
}

async function loginBySessionId(options: CliOptions, input: unknown): Promise<unknown> {
  const body = requireRecord(input);
  const auth = createAiograpiRestAuthClient(options.config);
  const proxy = optionalString(body.proxy);
  const locale = optionalString(body.locale);
  const timezone = optionalString(body.timezone);
  const accountId = optionalString(body.accountId);
  const username = optionalString(body.username);
  const result = await auth.loginBySessionId({
    sessionid: requiredString(body.sessionid, "sessionid"),
    ...(proxy === undefined ? {} : { proxy }),
    ...(locale === undefined ? {} : { locale }),
    ...(timezone === undefined ? {} : { timezone }),
    ...(accountId === undefined ? {} : { accountId }),
    ...(username === undefined ? {} : { username })
  });

  await writeSessionCacheIfConfigured(options, input, result.aiograpiSessionId, "auth.loginBySessionId");
  return result;
}

async function relogin(options: CliOptions, input: unknown): Promise<unknown> {
  const auth = createAiograpiRestAuthClient(options.config);
  const aiograpiSessionId = await requiredSessionRef(options, input);
  const result = await auth.relogin({ aiograpiSessionId });

  await writeSessionCacheIfConfigured(options, input, aiograpiSessionId, "auth.relogin");
  return result;
}

async function exportSettings(options: CliOptions, input: unknown): Promise<unknown> {
  const auth = createAiograpiRestAuthClient(options.config);
  return auth.exportSettings({ aiograpiSessionId: await requiredSessionRef(options, input) });
}

async function getAccount(options: CliOptions, input: unknown): Promise<unknown> {
  const account = createAiograpiRestAccountClient(options.config);
  return account.getCurrentAccount({ aiograpiSessionId: await requiredSessionRef(options, input) });
}

async function getAccountAbout(options: CliOptions, input: unknown): Promise<unknown> {
  const body = isRecord(input) ? input : {};
  const userId = optionalString(body.userId);
  const account = createAiograpiRestAccountClient(options.config);
  return account.getCurrentAccountAbout({
    aiograpiSessionId: await requiredSessionRef(options, input),
    ...(userId === undefined ? {} : { userId })
  });
}

async function updateProfile(options: CliOptions, input: unknown): Promise<unknown> {
  if (!options.confirmMutation && readBooleanFlag(input, "confirmMutation") !== true) {
    throw new Error("AIOGRAPI_REST_CLI_CONFIRM_MUTATION_REQUIRED");
  }

  const body = requireRecord(input);
  const avatarAsset = readAvatarAsset(body);
  const username = optionalString(body.username);
  const displayName = optionalString(body.displayName) ?? optionalString(body.fullName) ?? optionalString(body.fullname);
  const biography = optionalString(body.biography);

  if (username === undefined && displayName === undefined && biography === undefined && avatarAsset === undefined) {
    throw new Error("AIOGRAPI_REST_CLI_PROFILE_UPDATE_FIELDS_REQUIRED");
  }

  const client = createAiograpiRestClient(options.config);
  return client.profile.updateProfile({
    account: {
      accountId: InstagramAccountId(await readAccountId(options, input)),
      sessionRef: InstagramSessionRef(await requiredSessionRef(options, input))
    },
    ...(username === undefined ? {} : { username }),
    ...(displayName === undefined ? {} : { displayName }),
    ...(biography === undefined ? {} : { biography }),
    ...(avatarAsset === undefined ? {} : { avatarAsset })
  });
}

function parseArgs(
  argv: string[],
  env: Record<string, string | undefined>,
  fetchImpl: AiograpiRestFetch | undefined
): CliOptions {
  const command = argv[0] as CliCommand | undefined;
  if (!isCliCommand(command)) {
    throw new Error("AIOGRAPI_REST_CLI_COMMAND_REQUIRED");
  }

  let action: AiograpiRestCliAction | undefined;
  let inputJson = "{}";
  let baseUrl = env.AIOGRAPI_REST_BASE_URL ?? "http://localhost:8005";
  let requestTimeoutMs = readOptionalPositiveInteger(env.AIOGRAPI_REST_REQUEST_TIMEOUT_MS, "AIOGRAPI_REST_REQUEST_TIMEOUT_MS") ?? 30000;
  let defaultSessionHeaderName = env.AIOGRAPI_REST_SESSION_HEADER;
  let sessionCachePath = optionalEnv(env, "AIOGRAPI_SESSION_CACHE_PATH");
  let confirmMutation = env.AIOGRAPI_CONFIRM_MUTATION === "1";
  let pretty = true;

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];

    if (arg === "--action") {
      if (value === undefined) throw new Error("AIOGRAPI_REST_CLI_ACTION_REQUIRED");
      action = readAction(value);
      index += 1;
      continue;
    }

    if (arg === "--input-json") {
      if (value === undefined) throw new Error("AIOGRAPI_REST_CLI_INPUT_JSON_REQUIRED");
      inputJson = value;
      index += 1;
      continue;
    }

    if (arg === "--base-url") {
      if (value === undefined) throw new Error("AIOGRAPI_REST_BASE_URL_REQUIRED");
      baseUrl = value;
      index += 1;
      continue;
    }

    if (arg === "--timeout-ms") {
      if (value === undefined) throw new Error("AIOGRAPI_REST_REQUEST_TIMEOUT_MS_REQUIRED");
      requestTimeoutMs = readPositiveInteger(value, "AIOGRAPI_REST_REQUEST_TIMEOUT_MS");
      index += 1;
      continue;
    }

    if (arg === "--session-header") {
      if (value === undefined) throw new Error("AIOGRAPI_REST_SESSION_HEADER_REQUIRED");
      defaultSessionHeaderName = value;
      index += 1;
      continue;
    }

    if (arg === "--session-cache") {
      if (value === undefined) throw new Error("AIOGRAPI_SESSION_CACHE_PATH_REQUIRED");
      sessionCachePath = resolve(value);
      index += 1;
      continue;
    }

    if (arg === "--confirm-mutation") {
      confirmMutation = true;
      continue;
    }

    if (arg === "--compact") {
      pretty = false;
      continue;
    }

    throw new Error(`AIOGRAPI_REST_CLI_UNKNOWN_ARG: ${arg}`);
  }

  return {
    command,
    inputJson,
    config: {
      baseUrl,
      requestTimeoutMs,
      ...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
      ...(defaultSessionHeaderName === undefined ? {} : { defaultSessionHeaderName })
    },
    ...(action === undefined ? {} : { action }),
    ...(sessionCachePath === undefined ? {} : { sessionCachePath }),
    confirmMutation,
    pretty
  };
}

async function readInputJson(source: string, stdin: NodeJS.ReadableStream): Promise<unknown> {
  const text = source === "-" ? await readStdin(stdin) : looksInlineJson(source) ? source : await readFile(source, "utf8");
  return text.trim().length === 0 ? {} : JSON.parse(text) as unknown;
}

async function readStdin(stdin: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function requiredSessionRef(options: CliOptions, input: unknown): Promise<string> {
  const body = isRecord(input) ? input : {};
  const direct = optionalString(body.aiograpiSessionId) ?? optionalString(body.sessionRef);
  if (direct !== undefined) {
    return direct;
  }

  const cache = await readSessionCache(options);
  const cached = optionalString(cache?.aiograpiSessionId);
  if (cached !== undefined) {
    return cached;
  }

  throw new Error("AIOGRAPI_REST_CLI_SESSION_REF_REQUIRED");
}

async function readAccountId(options: CliOptions, input: unknown): Promise<string> {
  const body = isRecord(input) ? input : {};
  const direct = optionalString(body.accountId);
  if (direct !== undefined) {
    return direct;
  }

  const cache = await readSessionCache(options);
  return optionalString(cache?.accountId) ?? optionalString(cache?.username) ?? "aiograpi-rest-cli-account";
}

async function readSessionCache(options: CliOptions): Promise<SessionCache | undefined> {
  if (options.sessionCachePath === undefined) {
    return undefined;
  }

  try {
    const value = JSON.parse(await readFile(options.sessionCachePath, "utf8")) as unknown;
    return isRecord(value) ? value as SessionCache : undefined;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function writeSessionCacheIfConfigured(
  options: CliOptions,
  input: unknown,
  aiograpiSessionId: string,
  source: string
): Promise<void> {
  if (options.sessionCachePath === undefined) {
    return;
  }

  const body = isRecord(input) ? input : {};
  const accountId = optionalString(body.accountId);
  const username = optionalString(body.username);
  const cache: SessionCache = {
    aiograpiSessionId,
    baseUrl: options.config.baseUrl,
    source,
    updatedAt: new Date().toISOString(),
    ...(accountId === undefined ? {} : { accountId }),
    ...(username === undefined ? {} : { username })
  };

  await mkdir(dirname(options.sessionCachePath), { recursive: true });
  await writeFile(options.sessionCachePath, `${JSON.stringify(cache, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function readAvatarAsset(body: Record<string, unknown>) {
  const avatarPath = optionalString(body.avatarPath);
  if (avatarPath !== undefined) {
    return { uri: avatarPath, mediaType: "image" as const };
  }

  if (isRecord(body.avatarAsset)) {
    return {
      uri: requiredString(body.avatarAsset.uri, "avatarAsset.uri"),
      mediaType: "image" as const
    };
  }

  return undefined;
}

function readAction(value: string): AiograpiRestCliAction {
  const aliases: Record<string, AiograpiRestCliAction> = {
    login: "auth.login",
    "login-sessionid": "auth.loginBySessionId",
    relogin: "auth.relogin",
    settings: "auth.settings",
    account: "account.get",
    about: "account.about",
    "account-about": "account.about",
    "update-profile": "profile.update"
  };
  const action = aliases[value] ?? value;

  if (isCliAction(action)) {
    return action;
  }

  throw new Error(`AIOGRAPI_REST_CLI_ACTION_UNSUPPORTED: ${value}`);
}

function requiredString(value: unknown, field: string): string {
  const text = optionalString(value);
  if (text === undefined) {
    throw new Error(`AIOGRAPI_REST_CLI_${field.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_REQUIRED`);
  }
  return text;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readBooleanFlag(input: unknown, field: string): boolean | undefined {
  if (!isRecord(input) || typeof input[field] !== "boolean") {
    return undefined;
  }
  return input[field];
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("AIOGRAPI_REST_CLI_INPUT_OBJECT_REQUIRED");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCliCommand(value: string | undefined): value is CliCommand {
  return value === "list-tools" || value === "invoke";
}

function isCliAction(value: string): value is AiograpiRestCliAction {
  return aiograpiRestCliTools.some((tool) => tool.name === value);
}

function looksInlineJson(value: string): boolean {
  const text = value.trim();
  return text.startsWith("{") || text.startsWith("[");
}

function optionalEnv(env: Record<string, string | undefined>, name: string): string | undefined {
  const value = env[name];
  return value === undefined || value.trim().length === 0 ? undefined : value;
}

function readPositiveInteger(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field}_INVALID`);
  }
  return parsed;
}

function readOptionalPositiveInteger(value: string | undefined, field: string): number | undefined {
  return value === undefined || value.trim().length === 0 ? undefined : readPositiveInteger(value, field);
}

function readErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  if (error instanceof SyntaxError) return "invalid_json";
  return "aiograpi_rest_cli_failed";
}

function readCauseDetail(error: unknown): unknown {
  return typeof error === "object" && error !== null && "causeDetail" in error ? error.causeDetail : undefined;
}

function readExitCode(error: unknown): number {
  if (error instanceof SyntaxError) return 2;
  const message = error instanceof Error ? error.message : String(error);
  if (message.endsWith("_REQUIRED") || message.endsWith("_INVALID") || message.includes("_UNSUPPORTED")) return 2;
  if (typeof error === "object" && error !== null && "code" in error) return 1;
  return 3;
}

function writeJson(stdout: Pick<NodeJS.WritableStream, "write">, value: CliOkOutput | CliErrorOutput, pretty = true): void {
  stdout.write(`${JSON.stringify(value, null, pretty ? 2 : 0)}\n`);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAiograpiRestCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
