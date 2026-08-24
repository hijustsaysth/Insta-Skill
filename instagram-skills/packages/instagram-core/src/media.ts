import type { InstagramAccountRef } from "./account.js";
import type { InstagramMediaId } from "./ids.js";

export interface InstagramAssetRef {
  uri: string;
  mediaType: "image" | "video";
}

export interface InstagramMediaClient {
  searchVideos(request: InstagramSearchVideosRequest): Promise<InstagramSearchVideosResult>;
  getMedia(request: InstagramGetMediaRequest): Promise<InstagramMediaItem>;
  likeMedia(request: InstagramLikeMediaRequest): Promise<InstagramActionResult>;
  commentMedia(request: InstagramCommentMediaRequest): Promise<InstagramActionResult>;
}

export interface InstagramSearchVideosRequest {
  account: InstagramAccountRef;
  keyword: string;
  limit: number;
}

export interface InstagramSearchVideosResult {
  items: InstagramMediaItem[];
}

export interface InstagramGetMediaRequest {
  account: InstagramAccountRef;
  mediaId: InstagramMediaId;
}

export interface InstagramMediaItem {
  mediaId: InstagramMediaId;
  url?: string;
  caption?: string;
  authorUsername?: string;
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

export interface InstagramActionResult {
  mediaId: InstagramMediaId;
  actedAt: string;
}
