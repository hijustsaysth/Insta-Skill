import { provideInstagram, type InstagramContext } from "@instagram-skills/instagram-cordis";
import { createInstagramOfficialApiClient } from "./client.js";
import { loadInstagramOfficialApiConfig } from "./config-file.js";
import type { InstagramOfficialApiConfig } from "./config.js";

export type InstagramOfficialApiPluginConfig =
  | InstagramOfficialApiConfig
  | {
      configPath: string;
      fetch?: InstagramOfficialApiConfig["fetch"];
    };

/**
 * 输入：Cordis 兼容上下文和官方 API 配置。
 * 输出：无。
 * 作用：创建官方 API client，并注册到 ctx.instagram。
 */
export function apply(ctx: InstagramContext, config: InstagramOfficialApiPluginConfig): void {
  provideInstagram(ctx, {
    id: "official-api",
    client: createInstagramOfficialApiClient(resolvePluginConfig(config))
  });
}

/**
 * 输入：插件配置。
 * 输出：official-api client 配置。
 * 作用：兼容直接传参和 api.yml 文件两种插件配置方式。
 */
function resolvePluginConfig(config: InstagramOfficialApiPluginConfig): InstagramOfficialApiConfig {
  if ("configPath" in config) {
    return {
      ...loadInstagramOfficialApiConfig(config.configPath),
      ...(config.fetch === undefined ? {} : { fetch: config.fetch })
    };
  }

  return config;
}
