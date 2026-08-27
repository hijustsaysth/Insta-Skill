import { randomUUID } from "node:crypto";
import type { CreateAccountAccessPlanInput, InstagramAccountAccessPlan } from "./schema.js";

const PLAN_TEMPLATES: Record<
  CreateAccountAccessPlanInput["action"],
  Omit<InstagramAccountAccessPlan, "planId" | "action">
> = {
  aiograpi_login_with_password: {
    providerId: "aiograpi-rest",
    requiredInputs: ["accountId", "username", "password"],
    optionalInputs: ["sessionRef", "verificationCode", "proxy", "locale", "timezone"],
    sensitiveInputs: ["password", "verificationCode"],
    nextServiceCall: "loginWithPassword",
    sessionStoreActions: ["upsert session_refs", "upsert aiograpi_sessions"],
    humanVisibleInstructions: ["收集 Instagram 用户名和密码；如触发二次验证，再收集验证码。"],
    expectedResult: "返回 active sessionRef"
  },
  aiograpi_login_with_sessionid: {
    providerId: "aiograpi-rest",
    requiredInputs: ["accountId", "sessionid"],
    optionalInputs: ["sessionRef", "proxy", "locale", "timezone"],
    sensitiveInputs: ["sessionid"],
    nextServiceCall: "loginWithSessionId",
    sessionStoreActions: ["upsert session_refs", "upsert aiograpi_sessions"],
    humanVisibleInstructions: ["使用已有 Instagram sessionid 创建可执行 session。"],
    expectedResult: "返回 active sessionRef"
  },
  aiograpi_resolve_challenge: {
    providerId: "aiograpi-rest",
    requiredInputs: ["sessionRef", "lastJson"],
    optionalInputs: ["securityCode"],
    sensitiveInputs: ["securityCode"],
    nextServiceCall: "resolveChallenge",
    sessionStoreActions: ["update aiograpi_sessions"],
    humanVisibleInstructions: ["继续处理 Instagram challenge，并在成功后刷新 settings 备份。"],
    expectedResult: "challenge resolved"
  },
  aiograpi_relogin: {
    providerId: "aiograpi-rest",
    requiredInputs: ["sessionRef"],
    optionalInputs: [],
    sensitiveInputs: [],
    nextServiceCall: "relogin",
    sessionStoreActions: ["update aiograpi_sessions"],
    humanVisibleInstructions: ["刷新已有 aiograpi-rest session。"],
    expectedResult: "session refreshed"
  },
  aiograpi_export_settings: {
    providerId: "aiograpi-rest",
    requiredInputs: ["sessionRef"],
    optionalInputs: [],
    sensitiveInputs: ["settings"],
    nextServiceCall: "exportSettings",
    sessionStoreActions: ["update aiograpi_sessions"],
    humanVisibleInstructions: ["导出当前 aiograpi settings，并交由 service 加密保存。"],
    expectedResult: "settings exported and stored"
  },
  official_start_binding: {
    providerId: "official-api",
    requiredInputs: ["profileName"],
    optionalInputs: ["description", "color", "redirectUrl", "loginMethod", "headless", "idempotencyKey"],
    sensitiveInputs: [],
    nextServiceCall: "startOfficialBinding",
    sessionStoreActions: [],
    humanVisibleInstructions: ["创建 Zernio profile，并生成 Instagram 授权链接。"],
    expectedResult: "返回 authUrl"
  },
  official_complete_callback: {
    providerId: "official-api",
    requiredInputs: ["code", "state", "profileId"],
    optionalInputs: [],
    sensitiveInputs: ["code"],
    nextServiceCall: "completeOfficialCallback",
    sessionStoreActions: [],
    humanVisibleInstructions: ["处理 Zernio OAuth callback，之后继续选择 Instagram 账号。"],
    expectedResult: "callback completed"
  },
  official_select_account: {
    providerId: "official-api",
    requiredInputs: ["profileId", "pageId", "tempToken"],
    optionalInputs: ["sessionRef", "accountId", "redirectUrl", "scopes", "expiresAt"],
    sensitiveInputs: ["tempToken"],
    nextServiceCall: "selectOfficialAccount",
    sessionStoreActions: ["upsert session_refs", "upsert official_api_sessions"],
    humanVisibleInstructions: ["选择已授权的 Instagram 账号，并写入 sessionRef。"],
    expectedResult: "返回 active sessionRef"
  },
  official_check_health: {
    providerId: "official-api",
    requiredInputs: [],
    optionalInputs: ["profileId", "status"],
    sensitiveInputs: [],
    nextServiceCall: "checkOfficialHealth",
    sessionStoreActions: [],
    humanVisibleInstructions: ["检查 Zernio 已绑定 Instagram 账号健康状态。"],
    expectedResult: "返回账号健康状态摘要"
  }
};

/**
 * 输入：账号接入动作。
 * 输出：结构化账号接入计划。
 * 作用：生成 agent 可执行、可记录、可 eval 的账号接入计划。
 */
export function createAccountAccessPlan(input: CreateAccountAccessPlanInput): InstagramAccountAccessPlan {
  return {
    planId: input.planId ?? randomUUID(),
    action: input.action,
    ...PLAN_TEMPLATES[input.action]
  };
}
