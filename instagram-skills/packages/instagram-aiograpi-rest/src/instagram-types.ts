export type InstagramAccountId = string & { readonly __brand: "InstagramAccountId" };
export type InstagramSessionRef = string & { readonly __brand: "InstagramSessionRef" };
export type InstagramMediaId = string & { readonly __brand: "InstagramMediaId" };
export type InstagramPublishId = string & { readonly __brand: "InstagramPublishId" };

export function InstagramAccountId(value: string): InstagramAccountId {
  return value as InstagramAccountId;
}

export function InstagramSessionRef(value: string): InstagramSessionRef {
  return value as InstagramSessionRef;
}

export function InstagramMediaId(value: string): InstagramMediaId {
  return value as InstagramMediaId;
}

export function InstagramPublishId(value: string): InstagramPublishId {
  return value as InstagramPublishId;
}

export type InstagramProviderErrorCode =
  | "auth_required"
  | "rate_limited"
  | "unsupported_operation"
  | "provider_request_failed";

export class InstagramProviderError extends Error {
  readonly code: InstagramProviderErrorCode;
  readonly causeDetail?: unknown;

  constructor(code: InstagramProviderErrorCode, message: string, causeDetail?: unknown) {
    super(message);
    this.name = "InstagramProviderError";
    this.code = code;
    this.causeDetail = causeDetail;
  }
}

export interface InstagramAccountRef {
  accountId: InstagramAccountId;
  sessionRef: InstagramSessionRef;
}

export interface InstagramAssetRef {
  uri: string;
  mediaType: "image" | "video";
}

export type InstagramPublishType = "post" | "story" | "reel";
export type InstagramPublishStatus = "submitted" | "published" | "failed";

export interface InstagramUpdateProfileRequest {
  account: InstagramAccountRef;
  username?: string;
  displayName?: string;
  biography?: string;
  avatarAsset?: InstagramAssetRef;
}

export interface InstagramUpdateProfileResult {
  accountId: InstagramAccountId;
  updatedAt: string;
}

export interface InstagramSearchVideosRequest {
  account: InstagramAccountRef;
  keyword: string;
  limit: number;
}

export interface InstagramGetMediaRequest {
  account: InstagramAccountRef;
  mediaId: InstagramMediaId;
}

export interface InstagramLikeMediaRequest {
  account: InstagramAccountRef;
  mediaId: InstagramMediaId;
}

export interface InstagramCommentMediaRequest {
  account: InstagramAccountRef;
  mediaId: InstagramMediaId;
  text: string;
}

export interface InstagramMediaItem {
  mediaId: InstagramMediaId;
  url?: string;
  caption?: string;
  authorUsername?: string;
}

export interface InstagramActionResult {
  mediaId: InstagramMediaId;
  actedAt: string;
}

export interface InstagramPublishContentRequest {
  account: InstagramAccountRef;
  type: InstagramPublishType;
  assets: InstagramAssetRef[];
  caption?: string;
  tags?: string[];
  scheduledAt?: string;
}

export interface InstagramPublishResult {
  publishId: InstagramPublishId;
  status: InstagramPublishStatus;
  submittedAt: string;
}

export interface InstagramPublishStatusRequest {
  publishId: InstagramPublishId;
}

export interface InstagramPublishStatusResult {
  publishId: InstagramPublishId;
  status: InstagramPublishStatus;
  checkedAt: string;
  mediaId?: InstagramMediaId;
}

export interface InstagramClient {
  profile: {
    updateProfile(request: InstagramUpdateProfileRequest): Promise<InstagramUpdateProfileResult>;
  };
  media: {
    searchVideos(request: InstagramSearchVideosRequest): Promise<{ items: InstagramMediaItem[] }>;
    getMedia(request: InstagramGetMediaRequest): Promise<InstagramMediaItem>;
    likeMedia(request: InstagramLikeMediaRequest): Promise<InstagramActionResult>;
    commentMedia(request: InstagramCommentMediaRequest): Promise<InstagramActionResult>;
  };
  publish: {
    publishContent(request: InstagramPublishContentRequest): Promise<InstagramPublishResult>;
    getPublishStatus(request: InstagramPublishStatusRequest): Promise<InstagramPublishStatusResult>;
  };
}
