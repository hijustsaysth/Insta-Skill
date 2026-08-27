import { createCipheriv, createHash, randomBytes } from "node:crypto";

const SECRET_ENV_NAME = "INSTAGRAM_SKILLS_SECRET_KEY";
const INSECURE_ENV_NAME = "INSECURE_PLAINTEXT_SECRET_ALLOWED";
const SENSITIVE_KEYS = [
  "password",
  "sessionid",
  "sessionId",
  "session_id",
  "aiograpiSessionId",
  "cookies",
  "settings",
  "settingsCiphertext",
  "apiKey",
  "accessToken",
  "accessTokenCiphertext",
  "access_token",
  "authorization",
  "code",
  "securityCode",
  "security_code"
];

/**
 * 输入：密钥字符串。
 * 输出：加密函数。
 * 作用：创建 AES-256-GCM 加密函数，用于持久化 provider secret。
 */
export function createAesGcmSecretEncryptor(secretKey: string): (plaintext: string) => string {
  if (secretKey.trim().length === 0) {
    throw new Error("INSTAGRAM_SKILLS_SECRET_KEY_REQUIRED");
  }

  const key = createHash("sha256").update(secretKey).digest();

  return (plaintext: string) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `v1:aes-256-gcm:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
  };
}

/**
 * 输入：环境变量表。
 * 输出：加密函数。
 * 作用：从运行环境创建 secret 加密函数；仅显式开启本地调试开关时允许明文。
 */
export function createSecretEncryptorFromEnv(env: Record<string, string | undefined> = process.env): (plaintext: string) => string {
  const secretKey = env[SECRET_ENV_NAME];

  if (secretKey !== undefined && secretKey.trim().length > 0) {
    return createAesGcmSecretEncryptor(secretKey);
  }

  if (env[INSECURE_ENV_NAME] === "true") {
    return (plaintext: string) => plaintext;
  }

  throw new Error("INSTAGRAM_SKILLS_SECRET_KEY_REQUIRED");
}

/**
 * 输入：原始文本。
 * 输出：脱敏后的文本。
 * 作用：避免 CLI 错误输出和日志暴露常见敏感字段。
 */
export function redactSensitiveText(text: string): string {
  let redacted = text;

  for (const key of SENSITIVE_KEYS) {
    redacted = redacted.replace(new RegExp(`("${key}"\\s*:\\s*")([^"]+)(")`, "gi"), `$1[REDACTED]$3`);
    redacted = redacted.replace(new RegExp(`(${key}=)([^\\s&]+)`, "gi"), `$1[REDACTED]`);
  }

  return redacted;
}

/**
 * 输入：待输出的任意 JSON 值。
 * 输出：脱敏后的 JSON 值。
 * 作用：递归移除结构化输出中的敏感字段原文。
 */
export function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item));
  }

  if (typeof value === "object" && value !== null) {
    const redacted: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      redacted[key] = SENSITIVE_KEYS.includes(key) ? "[REDACTED]" : redactSensitiveValue(item);
    }

    return redacted;
  }

  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  return value;
}
