import { InstagramProviderError } from "@instagram-skills/instagram-core";
import type { AiograpiRestClientConfig } from "./config.js";
import { createAiograpiRestHttpClient } from "./http.js";
import { AIOGRAPI_REST_ROUTES } from "./routes.js";

export interface AiograpiRestLoginRequest {
  username: string;
  password: string;
  verificationCode?: string;
  proxy?: string;
  locale?: string;
  timezone?: string;
}

export interface AiograpiRestLoginBySessionIdRequest {
  sessionid: string;
  proxy?: string;
  locale?: string;
  timezone?: string;
}

export interface AiograpiRestLoginResult {
  aiograpiSessionId: string;
}

export interface AiograpiRestReloginRequest {
  aiograpiSessionId: string;
}

export interface AiograpiRestReloginResult {
  refreshed: true;
}

export interface AiograpiRestResolveChallengeRequest {
  aiograpiSessionId: string;
  lastJson: string;
  securityCode?: string;
}

export interface AiograpiRestResolveChallengeResult {
  resolved: true;
}

export interface AiograpiRestExportSettingsRequest {
  aiograpiSessionId: string;
}

export interface AiograpiRestExportSettingsResult {
  settings: string;
}

export interface AiograpiRestAuthClient {
  login(request: AiograpiRestLoginRequest): Promise<AiograpiRestLoginResult>;
  loginBySessionId(request: AiograpiRestLoginBySessionIdRequest): Promise<AiograpiRestLoginResult>;
  relogin(request: AiograpiRestReloginRequest): Promise<AiograpiRestReloginResult>;
  resolveChallenge(request: AiograpiRestResolveChallengeRequest): Promise<AiograpiRestResolveChallengeResult>;
  exportSettings(request: AiograpiRestExportSettingsRequest): Promise<AiograpiRestExportSettingsResult>;
}

/**
 * 输入：aiograpi-rest provider 配置。
 * 输出：AiograpiRestAuthClient。
 * 作用：创建 provider 专属认证 client，用于登录、重登录、challenge 继续验证和导出 settings。
 */
export function createAiograpiRestAuthClient(config: AiograpiRestClientConfig): AiograpiRestAuthClient {
  const http = createAiograpiRestHttpClient(config);

  return {
    async login(request: AiograpiRestLoginRequest) {
      const response = await http.requestForm<unknown>({
        path: AIOGRAPI_REST_ROUTES.authLogin,
        method: "POST",
        body: createFormFields({
          username: request.username,
          password: request.password,
          verification_code: request.verificationCode,
          proxy: request.proxy,
          locale: request.locale,
          timezone: request.timezone
        })
      });

      return mapLoginResult(response);
    },
    async loginBySessionId(request: AiograpiRestLoginBySessionIdRequest) {
      const response = await http.requestForm<unknown>({
        path: AIOGRAPI_REST_ROUTES.authLoginBySessionId,
        method: "POST",
        body: createFormFields({
          sessionid: request.sessionid,
          proxy: request.proxy,
          locale: request.locale,
          timezone: request.timezone
        })
      });

      return mapLoginResult(response);
    },
    async relogin(request: AiograpiRestReloginRequest) {
      const response = await http.requestJson<unknown>({
        path: AIOGRAPI_REST_ROUTES.authRelogin,
        method: "PATCH",
        sessionRef: request.aiograpiSessionId
      });

      assertBooleanSuccess(response, "aiograpi-rest relogin failed");
      return { refreshed: true };
    },
    async resolveChallenge(request: AiograpiRestResolveChallengeRequest) {
      const response = await http.requestForm<unknown>({
        path: AIOGRAPI_REST_ROUTES.authChallengeResolve,
        method: "POST",
        sessionRef: request.aiograpiSessionId,
        body: createFormFields({
          last_json: request.lastJson,
          security_code: request.securityCode
        })
      });

      assertBooleanSuccess(response, "aiograpi-rest challenge resolve failed");
      return { resolved: true };
    },
    async exportSettings(request: AiograpiRestExportSettingsRequest) {
      const response = await http.requestJson<unknown>({
        path: AIOGRAPI_REST_ROUTES.authSettings,
        method: "GET",
        sessionRef: request.aiograpiSessionId
      });

      return { settings: normalizeSettingsResponse(response) };
    }
  };
}

/**
 * 输入：登录响应。
 * 输出：稳定的 aiograpi session id。
 * 作用：把 aiograpi-rest 登录响应转换为可写入 session store 的结果。
 */
function mapLoginResult(response: unknown): AiograpiRestLoginResult {
  if (typeof response === "string" && response.trim().length > 0) {
    return { aiograpiSessionId: response };
  }

  if (response === false) {
    throw new InstagramProviderError("auth_required", "aiograpi-rest login failed");
  }

  throw new InstagramProviderError("provider_request_failed", "aiograpi-rest login did not return a stable session id");
}

/**
 * 输入：布尔响应和失败信息。
 * 输出：无。
 * 作用：校验 aiograpi-rest 布尔型认证接口是否执行成功。
 */
function assertBooleanSuccess(response: unknown, message: string): void {
  if (response !== true) {
    throw new InstagramProviderError("auth_required", message);
  }
}

/**
 * 输入：未知响应和字段名。
 * 输出：字符串。
 * 作用：校验 aiograpi-rest 字符串响应存在。
 */
function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InstagramProviderError("provider_request_failed", `aiograpi-rest response field required: ${fieldName}`);
  }

  return value;
}

/**
 * 输入：aiograpi-rest settings 响应。
 * 输出：可加密持久化的 settings 字符串。
 * 作用：兼容 provider 返回 JSON 字符串或 settings 对象两种形式。
 */
function normalizeSettingsResponse(response: unknown): string {
  if (typeof response === "string") {
    return requireString(response, "settings");
  }

  if (typeof response === "object" && response !== null) {
    return JSON.stringify(response);
  }

  throw new InstagramProviderError("provider_request_failed", "aiograpi-rest response field required: settings");
}

/**
 * 输入：可选字符串字段。
 * 输出：URLSearchParams。
 * 作用：创建 aiograpi-rest 表单请求体并跳过未传字段。
 */
function createFormFields(fields: Record<string, string | undefined>): URLSearchParams {
  const form = new URLSearchParams();

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      form.set(key, value);
    }
  }

  return form;
}
