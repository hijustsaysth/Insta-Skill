import { InstagramProviderError, type InstagramAssetRef, type InstagramPublishType } from "./instagram-types.js";

export interface AiograpiRestAssetMetadata {
  sizeBytes?: number;
  durationSeconds?: number;
  aspectRatio?: number;
  mimeType?: string;
}

export type AiograpiRestPublishAssetRef = InstagramAssetRef & AiograpiRestAssetMetadata;

const MB = 1024 * 1024;

/**
 * 输入：发布类型和素材列表。
 * 输出：无。
 * 作用：对调用方已提供元数据的发布素材执行 aiograpi-rest 前置规格校验。
 */
export function validatePublishAssets(type: InstagramPublishType, assets: InstagramAssetRef[]): void {
  for (const asset of assets as AiograpiRestPublishAssetRef[]) {
    switch (type) {
      case "post":
        validatePostAsset(asset);
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

/**
 * 输入：Post 素材。
 * 输出：无。
 * 作用：校验 Post 图片或视频规格。
 */
function validatePostAsset(asset: AiograpiRestPublishAssetRef): void {
  if (asset.mediaType === "image") {
    rejectAbove(asset.sizeBytes, 8 * MB, "Post image must be <= 8MB");
    rejectAspectOutside(asset.aspectRatio, 0.8, 1.91, "Post image aspect ratio must be between 4:5 and 1.91:1");

    if (asset.mimeType !== undefined && asset.mimeType !== "image/jpeg") {
      throwUnsupported("Post image must be JPEG when mimeType is provided");
    }
    return;
  }

  rejectOutside(asset.durationSeconds, 3, 60, "Post video duration must be 3-60 seconds");
  rejectAbove(asset.sizeBytes, 100 * MB, "Post video must be <= 100MB");
  rejectAspectOutside(asset.aspectRatio, 0.8, 1.91, "Post video aspect ratio must be between 4:5 and 1.91:1");
}

/**
 * 输入：Story 素材。
 * 输出：无。
 * 作用：校验 Story 图片或视频规格。
 */
function validateStoryAsset(asset: AiograpiRestPublishAssetRef): void {
  if (asset.mediaType === "image") {
    rejectAbove(asset.sizeBytes, 8 * MB, "Story image must be <= 8MB");
    return;
  }

  rejectOutside(asset.durationSeconds, 3, 60, "Story video duration must be 3-60 seconds");
  rejectAbove(asset.sizeBytes, 100 * MB, "Story video must be <= 100MB");
}

/**
 * 输入：Reel 素材。
 * 输出：无。
 * 作用：校验 Reel 视频规格。
 */
function validateReelAsset(asset: AiograpiRestPublishAssetRef): void {
  if (asset.mediaType !== "video") {
    throwUnsupported("Reels require video assets");
  }

  rejectOutside(asset.durationSeconds, 3, 900, "Reel duration must be 3 seconds to 15 minutes");
  rejectAbove(asset.sizeBytes, 300 * MB, "Reel video must be <= 300MB");
}

/**
 * 输入：数值、下限、上限和错误信息。
 * 输出：无。
 * 作用：当调用方提供的数值超出区间时快速失败。
 */
function rejectOutside(value: number | undefined, min: number, max: number, message: string): void {
  if (value !== undefined && (value < min || value > max)) {
    throwUnsupported(message);
  }
}

/**
 * 输入：数值、上限和错误信息。
 * 输出：无。
 * 作用：当调用方提供的数值超过上限时快速失败。
 */
function rejectAbove(value: number | undefined, max: number, message: string): void {
  if (value !== undefined && value > max) {
    throwUnsupported(message);
  }
}

/**
 * 输入：宽高比、下限、上限和错误信息。
 * 输出：无。
 * 作用：当调用方提供的宽高比超出区间时快速失败。
 */
function rejectAspectOutside(value: number | undefined, min: number, max: number, message: string): void {
  rejectOutside(value, min, max, message);
}

/**
 * 输入：错误信息。
 * 输出：无。
 * 作用：抛出本地规格不支持错误。
 */
function throwUnsupported(message: string): never {
  throw new InstagramProviderError("unsupported_operation", message);
}
