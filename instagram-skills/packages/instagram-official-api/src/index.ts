import { notImplemented, type InstagramClient } from "@instagram-skills/instagram-core";

export interface InstagramOfficialApiConfig {
  graphApiBaseUrl: string;
}

/**
 * 输入：Instagram 官方 API provider 配置。
 * 输出：InstagramClient。
 * 作用：创建官方 API client 占位，后续接入专业账号路线。
 */
export function createOfficialApiClient(config: InstagramOfficialApiConfig): InstagramClient {
  if (config.graphApiBaseUrl.trim().length === 0) {
    throw new Error("INSTAGRAM_OFFICIAL_API_BASE_URL_REQUIRED");
  }

  return {
    profile: {
      async updateProfile() {
        // TODO: 官方 API 是否支持目标资料字段需要按账号类型确认，第一版不实现。
        throw notImplemented("official-api profile.updateProfile");
      }
    },
    media: {
      async searchVideos() {
        // TODO: 官方 API 路线第一版不实现视频搜索。
        throw notImplemented("official-api media.searchVideos");
      },
      async getMedia() {
        // TODO: 接入 Instagram Graph API 媒体详情能力。
        throw notImplemented("official-api media.getMedia");
      },
      async likeMedia() {
        // TODO: 官方 API 路线第一版不实现点赞。
        throw notImplemented("official-api media.likeMedia");
      },
      async commentMedia() {
        // TODO: 接入 Instagram Graph API 评论能力。
        throw notImplemented("official-api media.commentMedia");
      }
    },
    publish: {
      async publishContent() {
        // TODO: 接入 Instagram Graph API 内容发布能力，第一版不实现真实发布。
        throw notImplemented("official-api publish.publishContent");
      },
      async getPublishStatus() {
        // TODO: 接入 Instagram Graph API 发布状态查询能力。
        throw notImplemented("official-api publish.getPublishStatus");
      }
    }
  };
}
