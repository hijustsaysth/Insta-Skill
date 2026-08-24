import { provideInstagram, type InstagramContext } from "@instagram-skills/instagram-cordis";
import { createOfficialApiClient, type InstagramOfficialApiConfig } from "./index.js";

/**
 * 输入：Cordis 兼容上下文和官方 API 配置。
 * 输出：无。
 * 作用：创建官方 API client，并注册到 ctx.instagram。
 */
export function apply(ctx: InstagramContext, config: InstagramOfficialApiConfig): void {
  provideInstagram(ctx, {
    id: "official-api",
    client: createOfficialApiClient(config)
  });
}
