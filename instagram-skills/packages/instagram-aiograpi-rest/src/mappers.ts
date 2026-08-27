import {
  InstagramAccountId,
  InstagramMediaId,
  InstagramPublishId,
  InstagramProviderError,
  type InstagramActionResult,
  type InstagramMediaItem,
  type InstagramPublishResult,
  type InstagramPublishStatus,
  type InstagramPublishStatusResult,
  type InstagramUpdateProfileResult
} from "@instagram-skills/instagram-core";

interface AiograpiProfileResponse {
  pk?: string;
  accountId?: string;
  account_id?: string;
  updatedAt?: string;
  updated_at?: string;
}

interface AiograpiMediaResponse {
  pk?: string | number;
  mediaId?: string;
  media_id?: string;
  id?: string;
  url?: string;
  video_url?: string;
  thumbnail_url?: string;
  caption?: string;
  caption_text?: string;
  authorUsername?: string;
  author_username?: string;
  user?: {
    username?: string | null;
  };
}

interface AiograpiSearchVideosResponse {
  items?: AiograpiMediaResponse[];
  results?: AiograpiMediaResponse[];
  reels?: AiograpiMediaResponse[];
  media?: AiograpiMediaResponse[];
  clips?: AiograpiMediaResponse[];
}

interface AiograpiActionResponse {
  mediaId?: string;
  media_id?: string;
  actedAt?: string;
  acted_at?: string;
  created_at_utc?: string;
}

interface AiograpiCommentResponse {
  pk?: string | number;
  text?: string;
  created_at_utc?: string;
  status?: string;
}

interface AiograpiPublishResponse {
  pk?: string | number;
  publishId?: string;
  publish_id?: string;
  id?: string;
  status?: string;
  submittedAt?: string;
  submitted_at?: string;
  taken_at?: string;
}

interface AiograpiPublishStatusResponse {
  publishId?: string;
  publish_id?: string;
  id?: string;
  status?: string;
  mediaId?: string;
  media_id?: string;
  checkedAt?: string;
  checked_at?: string;
}

/**
 * 输入：aiograpi-rest 资料更新响应。
 * 输出：InstagramUpdateProfileResult。
 * 作用：把 provider 字段映射为核心资料更新结果。
 */
export function mapProfileResult(response: unknown, fallbackAccountId: string, updatedAt: string): InstagramUpdateProfileResult {
  const body = response as AiograpiProfileResponse;

  return {
    accountId: InstagramAccountId(body.accountId ?? body.account_id ?? body.pk ?? fallbackAccountId),
    updatedAt: body.updatedAt ?? body.updated_at ?? updatedAt
  };
}

/**
 * 输入：aiograpi-rest 搜索响应。
 * 输出：InstagramMediaItem 数组。
 * 作用：把 provider 搜索结果映射为核心媒体列表。
 */
export function mapSearchVideosResult(response: unknown, limit: number): { items: InstagramMediaItem[] } {
  const body = response as AiograpiSearchVideosResponse;
  const items = Array.isArray(response)
    ? (response as AiograpiMediaResponse[])
    : (body.items ?? body.results ?? body.reels ?? body.media ?? body.clips ?? []);

  return {
    items: items.slice(0, limit).map(mapMediaItem)
  };
}

/**
 * 输入：aiograpi-rest 媒体详情响应。
 * 输出：InstagramMediaItem。
 * 作用：把 provider 媒体详情映射为核心媒体对象。
 */
export function mapMediaItem(response: unknown): InstagramMediaItem {
  const body = response as AiograpiMediaResponse;
  const item: InstagramMediaItem = {
    mediaId: InstagramMediaId(requireString(body.mediaId ?? body.media_id ?? body.id ?? stringifyValue(body.pk), "mediaId"))
  };

  if (body.url !== undefined || body.video_url !== undefined || body.thumbnail_url !== undefined) {
    item.url = requireString(body.url ?? body.video_url ?? body.thumbnail_url, "url");
  }

  if (body.caption !== undefined || body.caption_text !== undefined) {
    item.caption = requireString(body.caption ?? body.caption_text, "caption");
  }

  if (body.authorUsername !== undefined || body.author_username !== undefined || body.user?.username !== undefined) {
    item.authorUsername = requireString(body.authorUsername ?? body.author_username ?? body.user?.username ?? undefined, "authorUsername");
  }

  return item;
}

/**
 * 输入：aiograpi-rest 点赞或评论响应和回退 mediaId。
 * 输出：InstagramActionResult。
 * 作用：把 provider 互动响应映射为核心动作结果。
 */
export function mapActionResult(response: unknown, fallbackMediaId: string, actedAt: string): InstagramActionResult {
  if (typeof response === "boolean") {
    if (!response) {
      throw new InstagramProviderError("provider_request_failed", "aiograpi-rest action returned false");
    }

    return {
      mediaId: InstagramMediaId(fallbackMediaId),
      actedAt
    };
  }

  const body = response as AiograpiActionResponse;

  return {
    mediaId: InstagramMediaId(body.mediaId ?? body.media_id ?? fallbackMediaId),
    actedAt: body.actedAt ?? body.acted_at ?? body.created_at_utc ?? actedAt
  };
}

/**
 * 输入：aiograpi-rest 评论响应和回退 mediaId。
 * 输出：InstagramActionResult。
 * 作用：把 /media/comment 返回的 Comment 结构映射为核心动作结果。
 */
export function mapCommentActionResult(response: unknown, fallbackMediaId: string, actedAt: string): InstagramActionResult {
  const body = response as AiograpiCommentResponse;

  return {
    mediaId: InstagramMediaId(fallbackMediaId),
    actedAt: body.created_at_utc ?? actedAt
  };
}

/**
 * 输入：aiograpi-rest 发布响应。
 * 输出：InstagramPublishResult。
 * 作用：把 provider 发布响应映射为核心发布结果。
 */
export function mapPublishResult(response: unknown, submittedAt: string): InstagramPublishResult {
  const body = response as AiograpiPublishResponse;

  return {
    publishId: InstagramPublishId(requireString(body.publishId ?? body.publish_id ?? body.id ?? stringifyValue(body.pk), "publishId")),
    status: body.status === undefined ? "published" : mapPublishStatus(body.status),
    submittedAt: body.submittedAt ?? body.submitted_at ?? body.taken_at ?? submittedAt
  };
}

/**
 * 输入：aiograpi-rest 发布状态响应。
 * 输出：InstagramPublishStatusResult。
 * 作用：把 provider 发布状态响应映射为核心状态结果。
 */
export function mapPublishStatusResult(response: unknown): InstagramPublishStatusResult {
  const body = response as AiograpiPublishStatusResponse;
  const result: InstagramPublishStatusResult = {
    publishId: InstagramPublishId(requireString(body.publishId ?? body.publish_id ?? body.id, "publishId")),
    status: mapPublishStatus(body.status),
    checkedAt: requireString(body.checkedAt ?? body.checked_at, "checkedAt")
  };

  if (body.mediaId !== undefined || body.media_id !== undefined) {
    result.mediaId = InstagramMediaId(requireString(body.mediaId ?? body.media_id, "mediaId"));
  }

  return result;
}

/**
 * 输入：provider 发布状态。
 * 输出：核心发布状态。
 * 作用：把字符串状态收窄为核心状态枚举。
 */
function mapPublishStatus(status: string | undefined): InstagramPublishStatus {
  if (status === "submitted" || status === "published" || status === "failed") {
    return status;
  }

  throw new InstagramProviderError("provider_request_failed", `Unsupported aiograpi-rest publish status: ${status ?? "<missing>"}`);
}

/**
 * 输入：未知值和字段名。
 * 输出：字符串。
 * 作用：在 provider 响应边界要求必要字段存在。
 */
function requireString(value: string | undefined, fieldName: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new InstagramProviderError("provider_request_failed", `aiograpi-rest response field required: ${fieldName}`);
  }

  return value;
}

/**
 * 输入：未知值。
 * 输出：字符串或 undefined。
 * 作用：兼容 aiograpi-rest 返回的数字 pk。
 */
function stringifyValue(value: string | number | undefined): string | undefined {
  return value === undefined ? undefined : String(value);
}
