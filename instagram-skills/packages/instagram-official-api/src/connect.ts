import { InstagramProviderError } from "@instagram-skills/instagram-core";
import type { ZernioHttpClient } from "./http.js";

export type InstagramLoginMethod = "instagram_login" | "facebook_login";
export type ZernioAccountStatus = "connected" | "disconnected";

export interface CreateProfileInput {
  name: string;
  description?: string | undefined;
  color?: string | undefined;
  idempotencyKey?: string | undefined;
}

export interface ZernioProfile {
  id: string;
  name: string;
  description?: string | undefined;
  color?: string | undefined;
  isDefault?: boolean | undefined;
  createdAt?: string | undefined;
}

export interface GetInstagramConnectUrlInput {
  profileId: string;
  redirectUrl?: string | undefined;
  loginMethod?: InstagramLoginMethod | undefined;
  headless?: boolean | undefined;
}

export interface InstagramConnectUrl {
  authUrl: string;
  state?: string | undefined;
  profileId: string;
  loginMethod: InstagramLoginMethod;
}

export interface CreateProfileAndStartInstagramBindingInput extends CreateProfileInput {
  redirectUrl?: string | undefined;
  loginMethod?: InstagramLoginMethod | undefined;
  headless?: boolean | undefined;
}

export interface CreateProfileAndStartInstagramBindingResult {
  profile: ZernioProfile;
  connect: InstagramConnectUrl;
}

export interface CompleteOAuthCallbackInput {
  code: string;
  state: string;
  profileId: string;
}

export interface ListInstagramLinkedPagesInput {
  profileId: string;
  tempToken: string;
}

export interface InstagramLinkedPage {
  id: string;
  name: string;
  accessToken?: string | undefined;
  instagramBusinessAccount: {
    id: string;
    username?: string | undefined;
    profilePictureUrl?: string | undefined;
  };
}

export interface SelectInstagramAccountInput {
  profileId: string;
  pageId: string;
  tempToken: string;
  redirectUrl?: string | undefined;
}

export interface ZernioInstagramAccount {
  accountId: string;
  sessionRef: string;
  platform: "instagram";
  profileId?: string | undefined;
  username?: string | undefined;
  displayName?: string | undefined;
  profilePicture?: string | null;
  profileUrl?: string | undefined;
  isActive?: boolean | undefined;
  loginMethod?: InstagramLoginMethod | undefined;
  needsReconnection?: boolean | undefined;
}

export interface ListConnectedInstagramAccountsInput {
  profileId?: string | undefined;
  status?: ZernioAccountStatus | undefined;
  includeOverLimit?: boolean | undefined;
}

export interface ZernioAccountHealth {
  accountId: string;
  platform: string;
  username?: string | undefined;
  displayName?: string | undefined;
  profileId?: string | undefined;
  status?: "healthy" | "warning" | "error" | undefined;
  canPost?: boolean | undefined;
  canFetchAnalytics?: boolean | undefined;
  tokenValid?: boolean | undefined;
  tokenExpiresAt?: string | undefined;
  needsReconnect?: boolean | undefined;
  issues?: string[] | undefined;
}

export interface CheckInstagramAccountsHealthInput {
  profileId?: string | undefined;
  status?: "healthy" | "warning" | "error" | undefined;
}

export interface InstagramAccountBindingClient {
  createProfile(input: CreateProfileInput): Promise<ZernioProfile>;
  getInstagramConnectUrl(input: GetInstagramConnectUrlInput): Promise<InstagramConnectUrl>;
  createProfileAndStartInstagramBinding(
    input: CreateProfileAndStartInstagramBindingInput
  ): Promise<CreateProfileAndStartInstagramBindingResult>;
  completeOAuthCallback(input: CompleteOAuthCallbackInput): Promise<unknown>;
  listInstagramLinkedPages(input: ListInstagramLinkedPagesInput): Promise<InstagramLinkedPage[]>;
  selectInstagramAccount(input: SelectInstagramAccountInput): Promise<ZernioInstagramAccount>;
  listConnectedInstagramAccounts(input?: ListConnectedInstagramAccountsInput): Promise<ZernioInstagramAccount[]>;
  checkInstagramAccountsHealth(input?: CheckInstagramAccountsHealthInput): Promise<ZernioAccountHealth[]>;
}

interface ZernioProfileResponse {
  profile?: {
    _id?: unknown;
    name?: unknown;
    description?: unknown;
    color?: unknown;
    isDefault?: unknown;
    createdAt?: unknown;
  };
}

interface ZernioConnectUrlResponse {
  authUrl?: unknown;
  state?: unknown;
}

interface ZernioLinkedPagesResponse {
  pages?: unknown;
}

interface ZernioSelectAccountResponse {
  account?: unknown;
}

interface ZernioListAccountsResponse {
  accounts?: unknown;
}

interface ZernioHealthResponse {
  accounts?: unknown;
}

/**
 * 输入：Zernio HTTP client。
 * 输出：Instagram 账号绑定 client。
 * 作用：封装创建 profile、启动 OAuth、二次选择账号和绑定结果确认链路。
 */
export function createInstagramAccountBindingClient(http: ZernioHttpClient): InstagramAccountBindingClient {
  return {
    async createProfile(input) {
      assertNonEmpty(input.name, "profile name");

      const body = await http.requestJson<ZernioProfileResponse>({
        path: "/profiles",
        method: "POST",
        body: {
          name: input.name,
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.color === undefined ? {} : { color: input.color })
        },
        idempotencyKey: input.idempotencyKey
      });

      return mapProfile(body);
    },

    async getInstagramConnectUrl(input) {
      assertNonEmpty(input.profileId, "profileId");
      const loginMethod = input.loginMethod ?? "instagram_login";

      const body = await http.requestJson<ZernioConnectUrlResponse>({
        path: "/connect/instagram",
        method: "GET",
        query: {
          profileId: input.profileId,
          redirect_url: input.redirectUrl,
          loginMethod,
          headless: input.headless
        }
      });

      return mapConnectUrl(body, input.profileId, loginMethod);
    },

    async createProfileAndStartInstagramBinding(input) {
      const profile = await this.createProfile(input);
      const connect = await this.getInstagramConnectUrl({
        profileId: profile.id,
        redirectUrl: input.redirectUrl,
        loginMethod: input.loginMethod,
        headless: input.headless
      });

      return { profile, connect };
    },

    async completeOAuthCallback(input) {
      assertNonEmpty(input.code, "code");
      assertNonEmpty(input.state, "state");
      assertNonEmpty(input.profileId, "profileId");

      return http.requestJson<unknown>({
        path: "/connect/instagram",
        method: "POST",
        body: {
          code: input.code,
          state: input.state,
          profileId: input.profileId
        }
      });
    },

    async listInstagramLinkedPages(input) {
      assertNonEmpty(input.profileId, "profileId");
      assertNonEmpty(input.tempToken, "tempToken");

      const body = await http.requestJson<ZernioLinkedPagesResponse>({
        path: "/connect/instagram/select-account",
        method: "GET",
        query: {
          profileId: input.profileId,
          tempToken: input.tempToken
        }
      });

      return mapLinkedPages(body);
    },

    async selectInstagramAccount(input) {
      assertNonEmpty(input.profileId, "profileId");
      assertNonEmpty(input.pageId, "pageId");
      assertNonEmpty(input.tempToken, "tempToken");

      const body = await http.requestJson<ZernioSelectAccountResponse>({
        path: "/connect/instagram/select-account",
        method: "POST",
        body: {
          profileId: input.profileId,
          pageId: input.pageId,
          tempToken: input.tempToken,
          ...(input.redirectUrl === undefined ? {} : { redirect_url: input.redirectUrl })
        }
      });

      return mapInstagramAccount(readObject(body.account, "account"), input.profileId);
    },

    async listConnectedInstagramAccounts(input = {}) {
      const body = await http.requestJson<ZernioListAccountsResponse>({
        path: "/accounts",
        method: "GET",
        query: {
          profileId: input.profileId,
          platform: "instagram",
          status: input.status,
          includeOverLimit: input.includeOverLimit
        }
      });

      const accounts = Array.isArray(body.accounts) ? body.accounts : [];
      return accounts.map((account) => mapInstagramAccount(readObject(account, "account")));
    },

    async checkInstagramAccountsHealth(input = {}) {
      const body = await http.requestJson<ZernioHealthResponse>({
        path: "/accounts/health",
        method: "GET",
        query: {
          profileId: input.profileId,
          platform: "instagram",
          status: input.status
        }
      });

      const accounts = Array.isArray(body.accounts) ? body.accounts : [];
      return accounts.map((account) => mapAccountHealth(readObject(account, "account health")));
    }
  };
}

function mapProfile(body: ZernioProfileResponse): ZernioProfile {
  const profile = readObject(body.profile, "profile");
  const id = readString(profile._id, "profile._id");

  return {
    id,
    name: readOptionalString(profile.name) ?? id,
    ...(readOptionalString(profile.description) === undefined ? {} : { description: readOptionalString(profile.description) }),
    ...(readOptionalString(profile.color) === undefined ? {} : { color: readOptionalString(profile.color) }),
    ...(typeof profile.isDefault === "boolean" ? { isDefault: profile.isDefault } : {}),
    ...(readOptionalString(profile.createdAt) === undefined ? {} : { createdAt: readOptionalString(profile.createdAt) })
  };
}

function mapConnectUrl(
  body: ZernioConnectUrlResponse,
  profileId: string,
  loginMethod: InstagramLoginMethod
): InstagramConnectUrl {
  return {
    authUrl: readString(body.authUrl, "authUrl"),
    ...(readOptionalString(body.state) === undefined ? {} : { state: readOptionalString(body.state) }),
    profileId,
    loginMethod
  };
}

function mapLinkedPages(body: ZernioLinkedPagesResponse): InstagramLinkedPage[] {
  const pages = Array.isArray(body.pages) ? body.pages : [];

  return pages.map((page) => {
    const object = readObject(page, "page");
    const instagramBusinessAccount = readObject(object.instagram_business_account, "page.instagram_business_account");

    return {
      id: readString(object.id, "page.id"),
      name: readString(object.name, "page.name"),
      ...(readOptionalString(object.access_token) === undefined ? {} : { accessToken: readOptionalString(object.access_token) }),
      instagramBusinessAccount: {
        id: readString(instagramBusinessAccount.id, "page.instagram_business_account.id"),
        ...(readOptionalString(instagramBusinessAccount.username) === undefined
          ? {}
          : { username: readOptionalString(instagramBusinessAccount.username) }),
        ...(readOptionalString(instagramBusinessAccount.profile_picture_url) === undefined
          ? {}
          : { profilePictureUrl: readOptionalString(instagramBusinessAccount.profile_picture_url) })
      }
    };
  });
}

function mapInstagramAccount(account: Record<string, unknown>, fallbackProfileId?: string): ZernioInstagramAccount {
  const accountId = readString(account.accountId ?? account._id, "account.accountId");
  const profileId = readProfileId(account.profileId) ?? fallbackProfileId;

  return {
    accountId,
    sessionRef: accountId,
    platform: "instagram",
    ...(profileId === undefined ? {} : { profileId }),
    ...(readOptionalString(account.username) === undefined ? {} : { username: readOptionalString(account.username) }),
    ...(readOptionalString(account.displayName) === undefined ? {} : { displayName: readOptionalString(account.displayName) }),
    ...(typeof account.profilePicture === "string" || account.profilePicture === null
      ? { profilePicture: account.profilePicture }
      : {}),
    ...(readOptionalString(account.profileUrl) === undefined ? {} : { profileUrl: readOptionalString(account.profileUrl) }),
    ...(typeof account.isActive === "boolean" ? { isActive: account.isActive } : {}),
    ...(isInstagramLoginMethod(account.loginMethod) ? { loginMethod: account.loginMethod } : {}),
    ...(typeof account.needsReconnection === "boolean" ? { needsReconnection: account.needsReconnection } : {})
  };
}

function mapAccountHealth(account: Record<string, unknown>): ZernioAccountHealth {
  return {
    accountId: readString(account.accountId, "account.accountId"),
    platform: readOptionalString(account.platform) ?? "instagram",
    ...(readOptionalString(account.username) === undefined ? {} : { username: readOptionalString(account.username) }),
    ...(readOptionalString(account.displayName) === undefined ? {} : { displayName: readOptionalString(account.displayName) }),
    ...(readOptionalString(account.profileId) === undefined ? {} : { profileId: readOptionalString(account.profileId) }),
    ...(isHealthStatus(account.status) ? { status: account.status } : {}),
    ...(typeof account.canPost === "boolean" ? { canPost: account.canPost } : {}),
    ...(typeof account.canFetchAnalytics === "boolean" ? { canFetchAnalytics: account.canFetchAnalytics } : {}),
    ...(typeof account.tokenValid === "boolean" ? { tokenValid: account.tokenValid } : {}),
    ...(readOptionalString(account.tokenExpiresAt) === undefined
      ? {}
      : { tokenExpiresAt: readOptionalString(account.tokenExpiresAt) }),
    ...(typeof account.needsReconnect === "boolean" ? { needsReconnect: account.needsReconnect } : {}),
    ...(Array.isArray(account.issues) ? { issues: account.issues.filter((issue): issue is string => typeof issue === "string") } : {})
  };
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new InstagramProviderError("provider_validation_failed", `${field} is required`);
  }
}

function readObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InstagramProviderError("provider_request_failed", `Zernio response missing ${field}`);
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InstagramProviderError("provider_request_failed", `Zernio response missing ${field}`);
  }

  return value;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readProfileId(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return readOptionalString((value as Record<string, unknown>)._id);
  }

  return undefined;
}

function isInstagramLoginMethod(value: unknown): value is InstagramLoginMethod {
  return value === "instagram_login" || value === "facebook_login";
}

function isHealthStatus(value: unknown): value is "healthy" | "warning" | "error" {
  return value === "healthy" || value === "warning" || value === "error";
}
