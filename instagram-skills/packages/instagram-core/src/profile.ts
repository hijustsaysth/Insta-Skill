import type { InstagramAccountRef } from "./account.js";
import type { InstagramAccountId } from "./ids.js";
import type { InstagramAssetRef } from "./media.js";

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

export interface InstagramProfileClient {
  updateProfile(request: InstagramUpdateProfileRequest): Promise<InstagramUpdateProfileResult>;
}
