import { InstagramProviderError } from "./instagram-types.js";
import type { AiograpiRestClientConfig } from "./config.js";
import { createAiograpiRestHttpClient } from "./http.js";
import { AIOGRAPI_REST_ROUTES } from "./routes.js";

export interface AiograpiRestCurrentAccountRequest {
  aiograpiSessionId: string;
}

export interface AiograpiRestUserAboutRequest {
  aiograpiSessionId: string;
  userId: string;
}

export interface AiograpiRestCurrentAccountAboutRequest {
  aiograpiSessionId: string;
  userId?: string;
}

export interface AiograpiRestAccountProfile {
  pk?: string | number;
  username?: string;
  [key: string]: unknown;
}

export interface AiograpiRestUserAbout {
  username?: string;
  is_verified?: boolean;
  country?: string;
  date?: string;
  former_usernames?: string;
}

export interface AiograpiRestAccountClient {
  getCurrentAccount(request: AiograpiRestCurrentAccountRequest): Promise<AiograpiRestAccountProfile>;
  getUserAbout(request: AiograpiRestUserAboutRequest): Promise<AiograpiRestUserAbout>;
  getCurrentAccountAbout(request: AiograpiRestCurrentAccountAboutRequest): Promise<AiograpiRestUserAbout>;
}

/**
 * 输入：aiograpi-rest provider 配置。
 * 输出：AiograpiRestAccountClient。
 * 作用：创建账号只读 client，用于读取当前账号资料和 about/join date。
 */
export function createAiograpiRestAccountClient(config: AiograpiRestClientConfig): AiograpiRestAccountClient {
  const http = createAiograpiRestHttpClient(config);
  const client: AiograpiRestAccountClient = {
    async getCurrentAccount(request: AiograpiRestCurrentAccountRequest) {
      return http.requestJson<AiograpiRestAccountProfile>({
        path: AIOGRAPI_REST_ROUTES.account,
        method: "GET",
        sessionRef: request.aiograpiSessionId
      });
    },
    async getUserAbout(request: AiograpiRestUserAboutRequest) {
      return http.requestJson<AiograpiRestUserAbout>({
        path: AIOGRAPI_REST_ROUTES.userAbout,
        method: "GET",
        sessionRef: request.aiograpiSessionId,
        query: {
          user_id: request.userId
        }
      });
    },
    async getCurrentAccountAbout(request: AiograpiRestCurrentAccountAboutRequest) {
      const userId = request.userId ?? readCurrentAccountUserId(await client.getCurrentAccount(request));
      return client.getUserAbout({ aiograpiSessionId: request.aiograpiSessionId, userId });
    }
  };

  return client;
}

/**
 * 输入：当前账号资料响应。
 * 输出：当前账号 user id。
 * 作用：从 /account 响应中提取 /user/about 所需的 user_id。
 */
function readCurrentAccountUserId(account: AiograpiRestAccountProfile): string {
  const value = account.pk;
  if ((typeof value === "string" && value.trim().length > 0) || typeof value === "number") {
    return String(value);
  }

  throw new InstagramProviderError("provider_request_failed", "aiograpi-rest account response missing pk");
}
