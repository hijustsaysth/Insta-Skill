import {
  InstagramMediaId,
  InstagramPublishId,
  InstagramProviderError,
  type InstagramPublishResult,
  type InstagramPublishStatus,
  type InstagramPublishStatusResult
} from "@instagram-skills/instagram-core";

export interface ZernioPostResponse {
  post?: unknown;
}

/**
 * 输入：Zernio create post 响应和提交时间。
 * 输出：core 发布结果。
 * 作用：将 Zernio post id 和状态映射为 InstagramPublishResult。
 */
export function mapZernioPublishResult(response: ZernioPostResponse, submittedAt: string): InstagramPublishResult {
  const post = readObject(response.post, "post");

  return {
    publishId: InstagramPublishId(readString(post._id, "post._id")),
    status: mapZernioPostStatus(readOptionalString(post.status), findInstagramPlatformStatus(post)),
    submittedAt: readOptionalString(post.createdAt) ?? readOptionalString(post.scheduledFor) ?? submittedAt
  };
}

/**
 * 输入：Zernio get post 响应。
 * 输出：core 发布状态结果。
 * 作用：查询并转换 Zernio 发布状态。
 */
export function mapZernioPublishStatusResult(response: ZernioPostResponse, checkedAt: string): InstagramPublishStatusResult {
  const post = readObject(response.post, "post");
  const instagramPlatform = findInstagramPlatform(post);
  const result: InstagramPublishStatusResult = {
    publishId: InstagramPublishId(readString(post._id, "post._id")),
    status: mapZernioPostStatus(readOptionalString(post.status), readOptionalString(instagramPlatform?.status)),
    checkedAt
  };
  const mediaId = readOptionalString(instagramPlatform?.platformPostId);

  if (mediaId !== undefined) {
    result.mediaId = InstagramMediaId(mediaId);
  }

  return result;
}

function mapZernioPostStatus(postStatus: string | undefined, platformStatus: string | undefined): InstagramPublishStatus {
  const status = platformStatus ?? postStatus;

  switch (status) {
    case "published":
    case "posted":
      return "published";
    case "failed":
    case "rejected":
    case "cancelled":
      return "failed";
    case "draft":
    case "queued":
    case "scheduled":
    case "pending":
    case "processing":
    case "publishing":
    case undefined:
    case "partial":
      return "submitted";
    default:
      throw new InstagramProviderError("provider_request_failed", `Unsupported Zernio publish status: ${status}`);
  }
}

function findInstagramPlatformStatus(post: Record<string, unknown>): string | undefined {
  return readOptionalString(findInstagramPlatform(post)?.status);
}

function findInstagramPlatform(post: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!Array.isArray(post.platforms)) {
    return undefined;
  }

  return post.platforms.find((platform): platform is Record<string, unknown> => {
    if (typeof platform !== "object" || platform === null || Array.isArray(platform)) {
      return false;
    }

    return (platform as Record<string, unknown>).platform === "instagram";
  });
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
