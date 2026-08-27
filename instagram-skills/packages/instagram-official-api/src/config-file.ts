import { readFileSync } from "node:fs";
import { parse } from "yaml";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_ZERNIO_BASE_URL,
  type InstagramOfficialApiConfig
} from "./config.js";

export interface InstagramOfficialApiFileConfig {
  zernioBaseUrl?: string;
  apiKey?: string;
  requestTimeoutMs?: number;
}

export interface LoadInstagramOfficialApiConfigOptions {
  env?: Record<string, string | undefined>;
}

const CONFIG_FIELDS = new Set(["zernioBaseUrl", "apiKey", "requestTimeoutMs"]);

/**
 * 输入：本地 YAML 配置路径和可选环境变量来源。
 * 输出：可直接传入 official-api client 的配置对象。
 * 作用：从 api.yml 读取 Zernio 配置，并解析 ${ENV_NAME} 环境变量占位符。
 */
export function loadInstagramOfficialApiConfig(
  configPath: string,
  options: LoadInstagramOfficialApiConfigOptions = {}
): InstagramOfficialApiConfig {
  if (configPath.trim().length === 0) {
    throw new Error("ZERNIO_CONFIG_PATH_REQUIRED");
  }

  const parsed = parse(readFileSync(configPath, "utf8")) as unknown;
  const fileConfig = readFileConfigObject(parsed);
  const env = options.env ?? process.env;
  const zernioBaseUrl = expandEnvValue(fileConfig.zernioBaseUrl ?? DEFAULT_ZERNIO_BASE_URL, env);
  const apiKey = expandEnvValue(fileConfig.apiKey ?? "", env);
  const requestTimeoutMs = fileConfig.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  if (apiKey.trim().length === 0) {
    throw new Error("ZERNIO_API_KEY_REQUIRED");
  }

  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error("ZERNIO_REQUEST_TIMEOUT_MS_INVALID");
  }

  return {
    zernioBaseUrl,
    apiKey,
    requestTimeoutMs
  };
}

/**
 * 输入：YAML 解析后的原始值。
 * 输出：配置文件对象。
 * 作用：校验配置根节点和字段名，避免配置拼写错误静默生效。
 */
function readFileConfigObject(value: unknown): InstagramOfficialApiFileConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("ZERNIO_CONFIG_OBJECT_REQUIRED");
  }

  for (const field of Object.keys(value)) {
    if (!CONFIG_FIELDS.has(field)) {
      throw new Error(`ZERNIO_CONFIG_UNKNOWN_FIELD: ${field}`);
    }
  }

  return value as InstagramOfficialApiFileConfig;
}

/**
 * 输入：配置字符串和环境变量表。
 * 输出：完成占位符替换后的字符串。
 * 作用：让 api.yml 能引用运行环境中的敏感配置。
 */
function expandEnvValue(value: string, env: Record<string, string | undefined>): string {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_placeholder, name: string) => {
    const envValue = env[name];

    if (envValue === undefined || envValue.length === 0) {
      throw new Error(`ZERNIO_CONFIG_ENV_REQUIRED: ${name}`);
    }

    return envValue;
  });
}
