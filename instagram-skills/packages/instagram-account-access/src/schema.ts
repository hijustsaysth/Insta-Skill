import type { AiograpiRestClientConfig } from "@instagram-skills/instagram-aiograpi-rest";
import type {
  CheckInstagramAccountsHealthInput,
  CompleteOAuthCallbackInput,
  InstagramLoginMethod,
  SelectInstagramAccountInput
} from "@instagram-skills/instagram-official-api";
import type { InstagramOfficialApiConfig } from "@instagram-skills/instagram-official-api";
import type { SqliteInstagramSessionStoreOptions } from "@instagram-skills/instagram-session-store-sqlite";

export type InstagramAccountAccessProviderId = "aiograpi-rest" | "official-api";

export type InstagramAccountAccessAction =
  | "aiograpi_login_with_password"
  | "aiograpi_login_with_sessionid"
  | "aiograpi_resolve_challenge"
  | "aiograpi_relogin"
  | "aiograpi_export_settings"
  | "official_start_binding"
  | "official_complete_callback"
  | "official_select_account"
  | "official_check_health";

export type InstagramAccountAccessStatus = "success" | "requires_input" | "failed";

export interface CreateAccountAccessPlanInput {
  action: InstagramAccountAccessAction;
  planId?: string;
}

export interface InstagramAccountAccessPlan {
  planId: string;
  providerId: InstagramAccountAccessProviderId;
  action: InstagramAccountAccessAction;
  requiredInputs: string[];
  optionalInputs: string[];
  sensitiveInputs: string[];
  nextServiceCall: keyof InstagramAccountAccessService;
  sessionStoreActions: string[];
  humanVisibleInstructions: string[];
  expectedResult: string;
}

export interface AccountAccessExecutionResult {
  planId?: string;
  providerId: InstagramAccountAccessProviderId;
  action: InstagramAccountAccessAction;
  status: InstagramAccountAccessStatus;
  sessionRef?: string;
  accountId?: string;
  nextStep?: string;
  safeMessage: string;
  publicData?: Record<string, string | number | boolean | null>;
}

export interface LoginWithPasswordInput {
  planId?: string;
  accountId: string;
  sessionRef?: string;
  username: string;
  password: string;
  verificationCode?: string;
  proxy?: string;
  locale?: string;
  timezone?: string;
}

export interface LoginWithSessionIdInput {
  planId?: string;
  accountId: string;
  sessionRef?: string;
  sessionid: string;
  proxy?: string;
  locale?: string;
  timezone?: string;
}

export interface ResolveChallengeInput {
  planId?: string;
  sessionRef: string;
  lastJson: string;
  securityCode?: string;
}

export interface ReloginInput {
  planId?: string;
  sessionRef: string;
}

export interface ExportSettingsInput {
  planId?: string;
  sessionRef: string;
}

export interface StartOfficialBindingInput {
  planId?: string;
  profileName: string;
  description?: string;
  color?: string;
  redirectUrl?: string;
  loginMethod?: InstagramLoginMethod;
  headless?: boolean;
  idempotencyKey?: string;
}

export interface AccountAccessCompleteOAuthCallbackInput extends CompleteOAuthCallbackInput {
  planId?: string;
}

export interface AccountAccessSelectOfficialAccountInput extends SelectInstagramAccountInput {
  planId?: string;
  accountId?: string;
  sessionRef?: string;
  scopes?: string;
  expiresAt?: string;
}

export interface AccountAccessCheckOfficialHealthInput extends CheckInstagramAccountsHealthInput {
  planId?: string;
}

export interface InstagramAccountAccessService {
  createPlan(input: CreateAccountAccessPlanInput): Promise<InstagramAccountAccessPlan>;
  loginWithPassword(input: LoginWithPasswordInput): Promise<AccountAccessExecutionResult>;
  loginWithSessionId(input: LoginWithSessionIdInput): Promise<AccountAccessExecutionResult>;
  resolveChallenge(input: ResolveChallengeInput): Promise<AccountAccessExecutionResult>;
  relogin(input: ReloginInput): Promise<AccountAccessExecutionResult>;
  exportSettings(input: ExportSettingsInput): Promise<AccountAccessExecutionResult>;
  startOfficialBinding(input: StartOfficialBindingInput): Promise<AccountAccessExecutionResult>;
  completeOfficialCallback(input: AccountAccessCompleteOAuthCallbackInput): Promise<AccountAccessExecutionResult>;
  selectOfficialAccount(input: AccountAccessSelectOfficialAccountInput): Promise<AccountAccessExecutionResult>;
  checkOfficialHealth(input: AccountAccessCheckOfficialHealthInput): Promise<AccountAccessExecutionResult>;
  close(): void;
}

export interface InstagramAccountAccessConfig {
  aiograpiRest?: AiograpiRestClientConfig;
  officialApi?: InstagramOfficialApiConfig;
  sessionStore: SqliteInstagramSessionStoreOptions;
  encryptSecret?: (plaintext: string) => string;
  allowInsecurePlaintextSecrets?: boolean;
  now?: () => Date;
  createSessionRef?: () => string;
}
