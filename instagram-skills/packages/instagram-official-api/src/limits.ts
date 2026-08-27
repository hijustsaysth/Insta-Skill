import { InstagramProviderError, type InstagramAssetRef, type InstagramPublishType } from "@instagram-skills/instagram-core";

export interface OfficialApiAssetMetadata {
  sizeBytes?: number;
  durationSeconds?: number;
  aspectRatio?: number;
  mimeType?: string;
}

export type OfficialApiPublishAssetRef = InstagramAssetRef & OfficialApiAssetMetadata;

const MB = 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime"]);
const BLOCKED_SHARE_HOSTS = [
  "drive.google.com",
  "dropbox.com",
  "www.dropbox.com",
  "onedrive.live.com",
  "1drv.ms",
  "sharepoint.com",
  "icloud.com",
  "www.icloud.com"
];

/**
 * 输入：发布类型、caption 和素材列表。
 * 输出：无。
 * 作用：按 Zernio Instagram 官方发布路线做前置规格校验。
 */
export function validateOfficialApiPublishInput(type: InstagramPublishType, caption: string | undefined, assets: InstagramAssetRef[]): void {
  if (caption !== undefined && caption.length > 2200) {
    throwUnsupported("Instagram caption must be <= 2200 characters");
  }

  if (assets.length === 0) {
    throwUnsupported("Instagram publishing requires at least one media asset");
  }

  if (type === "story" && caption !== undefined && caption.trim().length > 0) {
    throwUnsupported("Instagram story does not support regular caption");
  }

  if (type === "post" && assets.length > 10) {
    throwUnsupported("Instagram carousel supports at most 10 assets");
  }

  if (type === "story" && assets.length !== 1) {
    throwUnsupported("Instagram story publishing supports one asset per request");
  }

  if (type === "reel" && assets.length !== 1) {
    throwUnsupported("Instagram reel publishing supports one video asset per request");
  }

  for (const asset of assets as OfficialApiPublishAssetRef[]) {
    validatePublicMediaUrl(asset.uri);

    switch (type) {
      case "post":
        validateFeedAsset(asset);
        break;
      case "story":
        validateStoryAsset(asset);
        break;
      case "reel":
        validateReelAsset(asset);
        break;
    }
  }
}

function validatePublicMediaUrl(uri: string): void {
  let url: URL;

  try {
    url = new URL(uri);
  } catch {
    throwUnsupported("Zernio official publishing requires a public HTTP/HTTPS media URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throwUnsupported("Zernio official publishing requires a public HTTP/HTTPS media URL");
  }

  if (BLOCKED_SHARE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throwUnsupported("Common cloud drive sharing links are not supported as direct media URLs");
  }
}

function validateFeedAsset(asset: OfficialApiPublishAssetRef): void {
  if (asset.mediaType === "image") {
    rejectMimeOutside(asset.mimeType, IMAGE_MIME_TYPES, "Feed image must be JPEG or PNG");
    rejectAbove(asset.sizeBytes, 8 * MB, "Feed image must be <= 8MB");
    rejectAspectOutside(asset.aspectRatio, 0.8, 1.91, "Feed image aspect ratio must be between 4:5 and 1.91:1");
    return;
  }

  rejectMimeOutside(asset.mimeType, VIDEO_MIME_TYPES, "Feed video must be MP4 or MOV");
  rejectOutside(asset.durationSeconds, 3, 60 * 60, "Feed video duration must be 3 seconds to 60 minutes");
  rejectAbove(asset.sizeBytes, 300 * MB, "Feed video must be <= 300MB");
  rejectAspectOutside(asset.aspectRatio, 0.8, 1.91, "Feed video aspect ratio must be between 4:5 and 1.91:1");
}

function validateStoryAsset(asset: OfficialApiPublishAssetRef): void {
  if (asset.mediaType === "image") {
    rejectMimeOutside(asset.mimeType, IMAGE_MIME_TYPES, "Story image must be JPEG or PNG");
    rejectAbove(asset.sizeBytes, 8 * MB, "Story image must be <= 8MB");
    return;
  }

  rejectMimeOutside(asset.mimeType, VIDEO_MIME_TYPES, "Story video must be MP4 or MOV");
  rejectOutside(asset.durationSeconds, 3, 60, "Story video duration must be 3-60 seconds");
  rejectAbove(asset.sizeBytes, 100 * MB, "Story video must be <= 100MB");
}

function validateReelAsset(asset: OfficialApiPublishAssetRef): void {
  if (asset.mediaType !== "video") {
    throwUnsupported("Reels require a video asset");
  }

  rejectMimeOutside(asset.mimeType, VIDEO_MIME_TYPES, "Reel video must be MP4 or MOV");
  rejectOutside(asset.durationSeconds, 3, 90, "Reel duration must be 3-90 seconds");
  rejectAbove(asset.sizeBytes, 300 * MB, "Reel video must be <= 300MB");
}

function rejectMimeOutside(value: string | undefined, allowed: Set<string>, message: string): void {
  if (value !== undefined && !allowed.has(value.toLowerCase())) {
    throwUnsupported(message);
  }
}

function rejectOutside(value: number | undefined, min: number, max: number, message: string): void {
  if (value !== undefined && (value < min || value > max)) {
    throwUnsupported(message);
  }
}

function rejectAbove(value: number | undefined, max: number, message: string): void {
  if (value !== undefined && value > max) {
    throwUnsupported(message);
  }
}

function rejectAspectOutside(value: number | undefined, min: number, max: number, message: string): void {
  rejectOutside(value, min, max, message);
}

function throwUnsupported(message: string): never {
  throw new InstagramProviderError("unsupported_operation", message);
}
