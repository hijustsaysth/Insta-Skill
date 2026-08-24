import { provideInstagram, type InstagramContext } from "@instagram-skills/instagram-cordis";
import { createAiograpiRestClient, type AiograpiRestClientConfig } from "./index.js";

/**
 * 输入：Cordis 兼容上下文和 aiograpi-rest 配置。
 * 输出：无。
 * 作用：创建 aiograpi-rest client，并注册到 ctx.instagram。
 */
export function apply(ctx: InstagramContext, config: AiograpiRestClientConfig): void {
  provideInstagram(ctx, {
    id: "aiograpi-rest",
    client: createAiograpiRestClient(config)
  });
}
