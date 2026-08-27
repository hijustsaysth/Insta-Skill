import { randomUUID } from "node:crypto";
import { InstagramProviderError } from "@instagram-skills/instagram-core";
import { createAiograpiRestAuthClient } from "@instagram-skills/instagram-aiograpi-rest";
import { createInstagramOfficialApiClient } from "@instagram-skills/instagram-official-api";
import { createSqliteInstagramSessionStore } from "@instagram-skills/instagram-session-store-sqlite";
import { createAccountAccessPlan } from "./plan.js";
import { createSecretEncryptorFromEnv } from "./security.js";
import { saveAiograpiSession, saveOfficialSession } from "./session-writer.js";
import type {
  AccountAccessCheckOfficialHealthInput,
  AccountAccessCompleteOAuthCallbackInput,
  AccountAccessExecutionResult,
  AccountAccessSelectOfficialAccountInput,
  CreateAccountAccessPlanInput,
  ExportSettingsInput,
  InstagramAccountAccessConfig,
  InstagramAccountAccessPlan,
  InstagramAccountAccessService,
  LoginWithPasswordInput,
  LoginWithSessionIdInput,
  ReloginInput,
  ResolveChallengeInput,
  StartOfficialBindingInput
} from "./schema.js";

/**
 * 输入：账号接入配置。
 * 输出：InstagramAccountAccessService。
 * 作用：创建可执行登录、绑定、写 SQLite 的账号接入服务。
 */
export function createInstagramAccountAccessService(
  config: InstagramAccountAccessConfig
): InstagramAccountAccessService {
  const store = createSqliteInstagramSessionStore(config.sessionStore);
  const createSessionRef = config.createSessionRef ?? (() => `sess_${randomUUID()}`);
  const now = config.now ?? (() => new Date());

  store.initializeSchema();

  return {
    async createPlan(input: CreateAccountAccessPlanInput): Promise<InstagramAccountAccessPlan> {
      return createAccountAccessPlan(input);
    },

    async loginWithPassword(input: LoginWithPasswordInput): Promise<AccountAccessExecutionResult> {
      assertNonEmpty(input.accountId, "accountId");
      const aiograpiRest = requireAiograpiRestConfig(config);
      const aiograpiAuth = createAiograpiRestAuthClient(aiograpiRest);
      const sessionRef = input.sessionRef ?? createSessionRef();
      const loggedIn = await aiograpiAuth.login({
        username: input.username,
        password: input.password,
        ...(input.verificationCode === undefined ? {} : { verificationCode: input.verificationCode }),
        ...(input.proxy === undefined ? {} : { proxy: input.proxy }),
        ...(input.locale === undefined ? {} : { locale: input.locale }),
        ...(input.timezone === undefined ? {} : { timezone: input.timezone })
      });
      const exported = await aiograpiAuth.exportSettings({ aiograpiSessionId: loggedIn.aiograpiSessionId });
      const timestamp = now().toISOString();

      saveAiograpiSession({
        store,
        sessionRef,
        accountId: input.accountId,
        aiograpiSessionId: loggedIn.aiograpiSessionId,
        baseUrl: aiograpiRest.baseUrl,
        settingsCiphertext: encryptSecretForStorage(config, exported.settings),
        lastLoginAt: timestamp,
        now: timestamp
      });

      return successResult(input.planId, "aiograpi-rest", "aiograpi_login_with_password", sessionRef, input.accountId, "aiograpi-rest login saved");
    },

    async loginWithSessionId(input: LoginWithSessionIdInput): Promise<AccountAccessExecutionResult> {
      assertNonEmpty(input.accountId, "accountId");
      const aiograpiRest = requireAiograpiRestConfig(config);
      const aiograpiAuth = createAiograpiRestAuthClient(aiograpiRest);
      const sessionRef = input.sessionRef ?? createSessionRef();
      const loggedIn = await aiograpiAuth.loginBySessionId({
        sessionid: input.sessionid,
        ...(input.proxy === undefined ? {} : { proxy: input.proxy }),
        ...(input.locale === undefined ? {} : { locale: input.locale }),
        ...(input.timezone === undefined ? {} : { timezone: input.timezone })
      });
      const exported = await aiograpiAuth.exportSettings({ aiograpiSessionId: loggedIn.aiograpiSessionId });
      const timestamp = now().toISOString();

      saveAiograpiSession({
        store,
        sessionRef,
        accountId: input.accountId,
        aiograpiSessionId: loggedIn.aiograpiSessionId,
        baseUrl: aiograpiRest.baseUrl,
        settingsCiphertext: encryptSecretForStorage(config, exported.settings),
        lastLoginAt: timestamp,
        now: timestamp
      });

      return successResult(input.planId, "aiograpi-rest", "aiograpi_login_with_sessionid", sessionRef, input.accountId, "aiograpi-rest sessionid login saved");
    },

    async resolveChallenge(input: ResolveChallengeInput): Promise<AccountAccessExecutionResult> {
      const aiograpiRest = requireAiograpiRestConfig(config);
      const aiograpiAuth = createAiograpiRestAuthClient(aiograpiRest);
      const resolved = await store.resolveAiograpi(input.sessionRef);
      await aiograpiAuth.resolveChallenge({
        aiograpiSessionId: resolved.aiograpiSessionId,
        lastJson: input.lastJson,
        ...(input.securityCode === undefined ? {} : { securityCode: input.securityCode })
      });
      const exported = await aiograpiAuth.exportSettings({ aiograpiSessionId: resolved.aiograpiSessionId });
      const registry = await store.getRegistry(input.sessionRef);
      const timestamp = now().toISOString();

      saveAiograpiSession({
        store,
        sessionRef: input.sessionRef,
        accountId: registry.accountId,
        aiograpiSessionId: resolved.aiograpiSessionId,
        baseUrl: resolved.baseUrl ?? aiograpiRest.baseUrl,
        settingsCiphertext: encryptSecretForStorage(config, exported.settings),
        ...(resolved.lastLoginAt === undefined ? {} : { lastLoginAt: resolved.lastLoginAt }),
        lastRefreshAt: timestamp,
        now: timestamp
      });

      return successResult(input.planId, "aiograpi-rest", "aiograpi_resolve_challenge", input.sessionRef, registry.accountId, "aiograpi-rest challenge resolved");
    },

    async relogin(input: ReloginInput): Promise<AccountAccessExecutionResult> {
      const aiograpiRest = requireAiograpiRestConfig(config);
      const aiograpiAuth = createAiograpiRestAuthClient(aiograpiRest);
      const resolved = await store.resolveAiograpi(input.sessionRef);
      await aiograpiAuth.relogin({ aiograpiSessionId: resolved.aiograpiSessionId });
      const exported = await aiograpiAuth.exportSettings({ aiograpiSessionId: resolved.aiograpiSessionId });
      const registry = await store.getRegistry(input.sessionRef);
      const timestamp = now().toISOString();

      saveAiograpiSession({
        store,
        sessionRef: input.sessionRef,
        accountId: registry.accountId,
        aiograpiSessionId: resolved.aiograpiSessionId,
        baseUrl: resolved.baseUrl ?? aiograpiRest.baseUrl,
        settingsCiphertext: encryptSecretForStorage(config, exported.settings),
        ...(resolved.lastLoginAt === undefined ? {} : { lastLoginAt: resolved.lastLoginAt }),
        lastRefreshAt: timestamp,
        now: timestamp
      });

      return successResult(input.planId, "aiograpi-rest", "aiograpi_relogin", input.sessionRef, registry.accountId, "aiograpi-rest session refreshed");
    },

    async exportSettings(input: ExportSettingsInput): Promise<AccountAccessExecutionResult> {
      const aiograpiRest = requireAiograpiRestConfig(config);
      const aiograpiAuth = createAiograpiRestAuthClient(aiograpiRest);
      const resolved = await store.resolveAiograpi(input.sessionRef);
      const exported = await aiograpiAuth.exportSettings({ aiograpiSessionId: resolved.aiograpiSessionId });
      const registry = await store.getRegistry(input.sessionRef);
      const timestamp = now().toISOString();

      saveAiograpiSession({
        store,
        sessionRef: input.sessionRef,
        accountId: registry.accountId,
        aiograpiSessionId: resolved.aiograpiSessionId,
        baseUrl: resolved.baseUrl ?? aiograpiRest.baseUrl,
        settingsCiphertext: encryptSecretForStorage(config, exported.settings),
        ...(resolved.lastLoginAt === undefined ? {} : { lastLoginAt: resolved.lastLoginAt }),
        ...(resolved.lastRefreshAt === undefined ? {} : { lastRefreshAt: resolved.lastRefreshAt }),
        now: timestamp
      });

      return successResult(input.planId, "aiograpi-rest", "aiograpi_export_settings", input.sessionRef, registry.accountId, "aiograpi-rest settings exported");
    },

    async startOfficialBinding(input: StartOfficialBindingInput): Promise<AccountAccessExecutionResult> {
      const officialApi = createInstagramOfficialApiClient(requireOfficialApiConfig(config));
      const result = await officialApi.connect.createProfileAndStartInstagramBinding({
        name: input.profileName,
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.color === undefined ? {} : { color: input.color }),
        ...(input.redirectUrl === undefined ? {} : { redirectUrl: input.redirectUrl }),
        ...(input.loginMethod === undefined ? {} : { loginMethod: input.loginMethod }),
        ...(input.headless === undefined ? {} : { headless: input.headless }),
        ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey })
      });

      return {
        ...(input.planId === undefined ? {} : { planId: input.planId }),
        providerId: "official-api",
        action: "official_start_binding",
        status: "requires_input",
        nextStep: "open_auth_url",
        safeMessage: "Zernio Instagram binding URL created",
        publicData: {
          profileId: result.profile.id,
          authUrl: result.connect.authUrl,
          ...(result.connect.state === undefined ? {} : { state: result.connect.state }),
          loginMethod: result.connect.loginMethod
        }
      };
    },

    async completeOfficialCallback(input: AccountAccessCompleteOAuthCallbackInput): Promise<AccountAccessExecutionResult> {
      const officialApi = createInstagramOfficialApiClient(requireOfficialApiConfig(config));
      await officialApi.connect.completeOAuthCallback(input);

      return {
        ...(input.planId === undefined ? {} : { planId: input.planId }),
        providerId: "official-api",
        action: "official_complete_callback",
        status: "success",
        nextStep: "select_instagram_account",
        safeMessage: "Zernio OAuth callback completed",
        publicData: {
          profileId: input.profileId
        }
      };
    },

    async selectOfficialAccount(input: AccountAccessSelectOfficialAccountInput): Promise<AccountAccessExecutionResult> {
      const officialApi = createInstagramOfficialApiClient(requireOfficialApiConfig(config));
      const selected = await officialApi.connect.selectInstagramAccount(input);
      const sessionRef = input.sessionRef ?? selected.sessionRef;
      const accountId = input.accountId ?? selected.accountId;
      const timestamp = now().toISOString();

      saveOfficialSession({
        store,
        sessionRef,
        accountId,
        selectedAccount: selected,
        accessTokenCiphertext: encryptSecretForStorage(config, selected.sessionRef),
        ...(input.scopes === undefined ? {} : { scopes: input.scopes }),
        ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
        now: timestamp
      });

      return successResult(input.planId, "official-api", "official_select_account", sessionRef, accountId, "Zernio Instagram account selected");
    },

    async checkOfficialHealth(input: AccountAccessCheckOfficialHealthInput): Promise<AccountAccessExecutionResult> {
      const officialApi = createInstagramOfficialApiClient(requireOfficialApiConfig(config));
      const accounts = await officialApi.connect.checkInstagramAccountsHealth(input);

      return {
        ...(input.planId === undefined ? {} : { planId: input.planId }),
        providerId: "official-api",
        action: "official_check_health",
        status: "success",
        safeMessage: "Zernio Instagram account health checked",
        publicData: {
          accountCount: accounts.length
        }
      };
    },

    close(): void {
      store.close();
    }
  };
}

/**
 * 输入：账号接入配置。
 * 输出：aiograpi-rest 配置。
 * 作用：在执行 aiograpi 动作前确认 provider 配置存在。
 */
function requireAiograpiRestConfig(config: InstagramAccountAccessConfig): NonNullable<InstagramAccountAccessConfig["aiograpiRest"]> {
  if (config.aiograpiRest === undefined) {
    throw new InstagramProviderError("provider_validation_failed", "aiograpi-rest config is required");
  }

  return config.aiograpiRest;
}

/**
 * 输入：账号接入配置。
 * 输出：official-api 配置。
 * 作用：在执行 official-api 动作前确认 provider 配置存在。
 */
function requireOfficialApiConfig(config: InstagramAccountAccessConfig): NonNullable<InstagramAccountAccessConfig["officialApi"]> {
  if (config.officialApi === undefined) {
    throw new InstagramProviderError("provider_validation_failed", "official-api config is required");
  }

  return config.officialApi;
}

/**
 * 输入：账号接入配置和明文。
 * 输出：可持久化的密文。
 * 作用：统一执行 secret 加密，并阻止默认场景下的明文落库。
 */
function encryptSecretForStorage(config: InstagramAccountAccessConfig, plaintext: string): string {
  const encryptSecret = config.encryptSecret ?? createSecretEncryptorFromEnv();
  const encrypted = encryptSecret(plaintext);

  if (encrypted === plaintext && config.allowInsecurePlaintextSecrets !== true) {
    throw new Error("INSECURE_SECRET_ENCRYPTOR_REJECTED");
  }

  return encrypted;
}

/**
 * 输入：可选 planId、provider、action、sessionRef、accountId 和安全消息。
 * 输出：成功执行结果。
 * 作用：创建不包含敏感字段的统一成功结果。
 */
function successResult(
  planId: string | undefined,
  providerId: "aiograpi-rest" | "official-api",
  action: AccountAccessExecutionResult["action"],
  sessionRef: string,
  accountId: string,
  safeMessage: string
): AccountAccessExecutionResult {
  return {
    ...(planId === undefined ? {} : { planId }),
    providerId,
    action,
    status: "success",
    sessionRef,
    accountId,
    safeMessage
  };
}

/**
 * 输入：字符串和值名。
 * 输出：无。
 * 作用：在 service 边界拒绝空业务 id。
 */
function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new InstagramProviderError("provider_validation_failed", `${field} is required`);
  }
}
