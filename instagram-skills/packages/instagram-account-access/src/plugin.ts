import type { Context } from "@deepseek-ai/cordis";
import { createInstagramAccountAccessService } from "./service.js";
import type { InstagramAccountAccessConfig, InstagramAccountAccessService } from "./schema.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    instagramAccountAccess: InstagramAccountAccessService;
    provide(name: "instagramAccountAccess", value: InstagramAccountAccessService): () => void;
  }
}

export type InstagramAccountAccessContext = Pick<Context, "provide">;

/**
 * 输入：Cordis 上下文和账号接入配置。
 * 输出：无。
 * 作用：创建账号接入 service，并注册到 ctx.instagramAccountAccess。
 */
export function apply(ctx: InstagramAccountAccessContext, config: InstagramAccountAccessConfig): void {
  const service = createInstagramAccountAccessService(config);
  ctx.provide("instagramAccountAccess", service);
}
