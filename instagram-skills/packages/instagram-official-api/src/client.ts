import { InstagramProviderError, type InstagramClient } from "@instagram-skills/instagram-core";
import { createInstagramAccountBindingClient, type InstagramAccountBindingClient } from "./connect.js";
import { createZernioHttpClient } from "./http.js";
import type { InstagramOfficialApiConfig } from "./config.js";
import { createOfficialApiPublishClient } from "./publish.js";

export interface InstagramOfficialApiClient extends InstagramClient {
  connect: InstagramAccountBindingClient;
}

/**
 * 输入：Instagram official-api provider 配置。
 * 输出：带 Zernio 账号绑定能力的 InstagramClient。
 * 作用：创建官方 API provider，当前重点补齐 Instagram 账号绑定入口。
 */
export function createInstagramOfficialApiClient(config: InstagramOfficialApiConfig): InstagramOfficialApiClient {
  const http = createZernioHttpClient(config);
  const publish = createOfficialApiPublishClient(http);

  return {
    connect: createInstagramAccountBindingClient(http),
    profile: {
      async updateProfile() {
        // TODO: Zernio 文档当前不作为 Instagram 资料编辑主路线。
        throw unsupported("official-api profile.updateProfile");
      }
    },
    media: {
      async searchVideos() {
        // TODO: 官方发布路线不支持关键词搜索同类型视频。
        throw unsupported("official-api media.searchVideos");
      },
      async getMedia() {
        // TODO: 后续按 Zernio post / analytics 能力扩展。
        throw unsupported("official-api media.getMedia");
      },
      async likeMedia() {
        // TODO: 官方 API 路线不作为养号点赞路线。
        throw unsupported("official-api media.likeMedia");
      },
      async commentMedia() {
        // TODO: 评论能力后续单独确认 Zernio 支持范围。
        throw unsupported("official-api media.commentMedia");
      }
    },
    publish
  };
}

/**
 * 兼容旧导出名；新代码优先使用 createInstagramOfficialApiClient。
 */
export const createOfficialApiClient = createInstagramOfficialApiClient;

function unsupported(feature: string): InstagramProviderError {
  return new InstagramProviderError("unsupported_operation", `${feature} is not supported by instagram-official-api`);
}
