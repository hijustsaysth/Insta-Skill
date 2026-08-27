import { InstagramProviderError, type InstagramPublishClient, type InstagramPublishContentRequest } from "@instagram-skills/instagram-core";
import type { ZernioHttpClient } from "./http.js";
import { validateOfficialApiPublishInput } from "./limits.js";
import { mapZernioPublishResult, mapZernioPublishStatusResult, type ZernioPostResponse } from "./mapper.js";

/**
 * 输入：Zernio HTTP client。
 * 输出：Instagram 发布 client。
 * 作用：把 core 发布请求映射为 Zernio Posts API。
 */
export function createOfficialApiPublishClient(http: ZernioHttpClient): InstagramPublishClient {
  return {
    async publishContent(request) {
      validateOfficialApiPublishInput(request.type, request.caption, request.assets);
      const submittedAt = new Date().toISOString();
      const response = await http.requestJson<ZernioPostResponse>({
        path: "/posts",
        method: "POST",
        body: mapPublishRequest(request)
      });

      return mapZernioPublishResult(response, submittedAt);
    },

    async getPublishStatus(request) {
      const response = await http.requestJson<ZernioPostResponse>({
        path: `/posts/${encodeURIComponent(request.publishId)}`,
        method: "GET"
      });

      return mapZernioPublishStatusResult(response, new Date().toISOString());
    }
  };
}

interface ZernioMediaItem {
  type: "image" | "video";
  url: string;
  size?: number | undefined;
  mimeType?: string | undefined;
}

interface ZernioInstagramPlatformData {
  contentType?: "story" | undefined;
  shareToFeed?: boolean | undefined;
}

interface ZernioPlatformTarget {
  platform: "instagram";
  accountId: string;
  platformSpecificData: ZernioInstagramPlatformData;
}

interface ZernioCreatePostPayload {
  content?: string | undefined;
  mediaItems: ZernioMediaItem[];
  platforms: ZernioPlatformTarget[];
  scheduledFor?: string | undefined;
  publishNow: boolean;
}

function mapPublishRequest(request: InstagramPublishContentRequest): ZernioCreatePostPayload {
  const zernioAccountId = resolveZernioAccountId(request);
  const payload: ZernioCreatePostPayload = {
    mediaItems: request.assets.map(mapMediaItem),
    platforms: [
      {
        platform: "instagram",
        accountId: zernioAccountId,
        platformSpecificData: mapInstagramPlatformData(request.type)
      }
    ],
    ...(request.scheduledAt === undefined ? { publishNow: true } : { scheduledFor: request.scheduledAt, publishNow: false })
  };

  if (request.type !== "story" && request.caption !== undefined && request.caption.length > 0) {
    payload.content = request.caption;
  }

  return payload;
}

function resolveZernioAccountId(request: InstagramPublishContentRequest): string {
  const accountId = String(request.account.sessionRef || request.account.accountId);

  if (accountId.trim().length === 0) {
    throw new InstagramProviderError("provider_validation_failed", "sessionRef or accountId is required");
  }

  return accountId;
}

function mapMediaItem(asset: InstagramPublishContentRequest["assets"][number]): ZernioMediaItem {
  const metadata = asset as InstagramPublishContentRequest["assets"][number] & {
    sizeBytes?: number;
    mimeType?: string;
  };

  return {
    type: asset.mediaType,
    url: asset.uri,
    ...(metadata.sizeBytes === undefined ? {} : { size: metadata.sizeBytes }),
    ...(metadata.mimeType === undefined ? {} : { mimeType: metadata.mimeType })
  };
}

function mapInstagramPlatformData(type: InstagramPublishContentRequest["type"]): ZernioInstagramPlatformData {
  switch (type) {
    case "story":
      return { contentType: "story" };
    case "reel":
      return { shareToFeed: true };
    case "post":
      return {};
  }
}
