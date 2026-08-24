import type { InstagramAccountRef } from "./account.js";
import type { InstagramAssetRef } from "./media.js";
import type { InstagramMediaId, InstagramPublishId } from "./ids.js";

export type InstagramPublishType = "post" | "story" | "reel";

export type InstagramPublishStatus = "submitted" | "published" | "failed";

export interface InstagramPublishContentRequest {
  account: InstagramAccountRef;
  type: InstagramPublishType;
  caption?: string;
  tags?: string[];
  assets: InstagramAssetRef[];
  scheduledAt?: string;
}

export interface InstagramPublishResult {
  publishId: InstagramPublishId;
  status: InstagramPublishStatus;
  submittedAt: string;
}

export interface InstagramPublishStatusRequest {
  account: InstagramAccountRef;
  publishId: InstagramPublishId;
}

export interface InstagramPublishStatusResult {
  publishId: InstagramPublishId;
  status: InstagramPublishStatus;
  mediaId?: InstagramMediaId;
  checkedAt: string;
}

export interface InstagramPublishClient {
  publishContent(request: InstagramPublishContentRequest): Promise<InstagramPublishResult>;
  getPublishStatus(request: InstagramPublishStatusRequest): Promise<InstagramPublishStatusResult>;
}
