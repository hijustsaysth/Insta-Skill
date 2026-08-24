import {
  InstagramAccountId,
  InstagramMediaId,
  InstagramPublishId,
  InstagramSessionRef,
  type InstagramAccountRef,
  type InstagramAssetRef,
  type InstagramClient,
  type InstagramCommentMediaRequest,
  type InstagramGetMediaRequest,
  type InstagramLikeMediaRequest,
  type InstagramPublishContentRequest,
  type InstagramPublishStatusRequest,
  type InstagramSearchVideosRequest,
  type InstagramUpdateProfileRequest
} from "../src/index.js";

const account: InstagramAccountRef = {
  accountId: InstagramAccountId("acct_1"),
  sessionRef: InstagramSessionRef("session_1")
};

const mediaId = InstagramMediaId("media_1");
const publishId = InstagramPublishId("publish_1");
const avatarAsset: InstagramAssetRef = {
  uri: "file:///tmp/avatar.jpg",
  mediaType: "image"
};

const videoAsset: InstagramAssetRef = {
  uri: "file:///tmp/reel.mp4",
  mediaType: "video"
};

const invalidAccount: InstagramAccountRef = {
  // @ts-expect-error 验证 InstagramMediaId 不能误传给 InstagramAccountId。
  accountId: mediaId,
  sessionRef: InstagramSessionRef("session_2")
};

void invalidAccount;

const invalidAsset: InstagramAssetRef = {
  uri: "file:///tmp/audio.mp3",
  // @ts-expect-error 验证素材引用只允许 image / video。
  mediaType: "audio"
};

void invalidAsset;

const profileRequest: InstagramUpdateProfileRequest = {
  account,
  username: "demo_user",
  displayName: "Demo User",
  biography: "Demo biography",
  avatarAsset
};

const searchRequest: InstagramSearchVideosRequest = {
  account,
  keyword: "demo",
  limit: 10
};

const getMediaRequest: InstagramGetMediaRequest = {
  account,
  mediaId
};

const likeRequest: InstagramLikeMediaRequest = {
  account,
  mediaId
};

const commentRequest: InstagramCommentMediaRequest = {
  account,
  mediaId,
  text: "Nice reel"
};

const publishPostRequest: InstagramPublishContentRequest = {
  account,
  type: "post",
  caption: "Post caption",
  tags: ["demo"],
  assets: [avatarAsset]
};

const publishStoryRequest: InstagramPublishContentRequest = {
  account,
  type: "story",
  assets: [avatarAsset]
};

const publishReelRequest: InstagramPublishContentRequest = {
  account,
  type: "reel",
  caption: "Reel caption",
  assets: [videoAsset]
};

const invalidPublishRequest: InstagramPublishContentRequest = {
  account,
  // @ts-expect-error 验证发布类型只允许 post / story / reel。
  type: "album",
  assets: [avatarAsset]
};

void invalidPublishRequest;

const statusRequest: InstagramPublishStatusRequest = {
  account,
  publishId
};

// 验证 mock provider 能完整实现 profile / media / publish 三组接口。
const mockClient: InstagramClient = {
  profile: {
    async updateProfile() {
      return {
        accountId: account.accountId,
        updatedAt: "2026-08-24T00:00:00.000Z"
      };
    }
  },
  media: {
    async searchVideos() {
      return {
        items: [
          {
            mediaId,
            url: "https://example.com/reel/1",
            caption: "demo reel",
            authorUsername: "demo"
          }
        ]
      };
    },
    async getMedia() {
      return {
        mediaId,
        caption: "demo reel"
      };
    },
    async likeMedia() {
      return {
        mediaId,
        actedAt: "2026-08-24T00:00:00.000Z"
      };
    },
    async commentMedia() {
      return {
        mediaId,
        actedAt: "2026-08-24T00:00:00.000Z"
      };
    }
  },
  publish: {
    async publishContent() {
      return {
        publishId,
        status: "submitted",
        submittedAt: "2026-08-24T00:00:00.000Z"
      };
    },
    async getPublishStatus() {
      return {
        publishId,
        status: "published",
        mediaId,
        checkedAt: "2026-08-24T00:00:00.000Z"
      };
    }
  }
};

void mockClient;

/**
 * 输入：InstagramClient mock provider。
 * 输出：Promise<void>。
 * 作用：验证业务调用只依赖 InstagramClient，不感知具体 provider。
 */
async function verifyBusinessCalls(instagram: InstagramClient): Promise<void> {
  await instagram.profile.updateProfile(profileRequest);
  await instagram.media.searchVideos(searchRequest);
  await instagram.media.getMedia(getMediaRequest);
  await instagram.media.likeMedia(likeRequest);
  await instagram.media.commentMedia(commentRequest);
  await instagram.publish.publishContent(publishPostRequest);
  await instagram.publish.publishContent(publishStoryRequest);
  await instagram.publish.publishContent(publishReelRequest);
  await instagram.publish.getPublishStatus(statusRequest);
}

void verifyBusinessCalls(mockClient);
