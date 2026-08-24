import type {
  InstagramClient,
  InstagramCommentMediaRequest,
  InstagramGetMediaRequest,
  InstagramLikeMediaRequest,
  InstagramPublishContentRequest,
  InstagramPublishStatusRequest,
  InstagramSearchVideosRequest,
  InstagramUpdateProfileRequest
} from "@instagram-skills/instagram-core";
import { InstagramProviderError } from "@instagram-skills/instagram-core";
import type { AiograpiRestClientConfig } from "./config.js";
import { createProfilePictureBody, createPublishRequestBody } from "./assets.js";
import { createAiograpiRestHttpClient } from "./http.js";
import {
  mapActionResult,
  mapMediaItem,
  mapProfileResult,
  mapPublishResult,
  mapPublishStatusResult,
  mapSearchVideosResult
} from "./mappers.js";
import { AIOGRAPI_REST_ROUTES } from "./routes.js";
import { validatePublishAssets } from "./validation.js";

/**
 * 输入：aiograpi-rest provider 配置。
 * 输出：InstagramClient。
 * 作用：创建普通 TS/Node agent 可直接使用的 aiograpi-rest client。
 */
export function createAiograpiRestClient(config: AiograpiRestClientConfig): InstagramClient {
  const http = createAiograpiRestHttpClient(config);

  return {
    profile: {
      async updateProfile(request: InstagramUpdateProfileRequest) {
        const updatedAt = new Date().toISOString();
        let response: unknown = {};

        if (request.username !== undefined || request.displayName !== undefined || request.biography !== undefined) {
          response = await http.requestForm({
            path: AIOGRAPI_REST_ROUTES.account,
            method: "PATCH",
            sessionRef: request.account.sessionRef,
            body: createFormFields({
              username: request.username,
              full_name: request.displayName,
              biography: request.biography
            })
          });
        }

        if (request.avatarAsset !== undefined) {
          response = await http.requestMultipart({
            path: AIOGRAPI_REST_ROUTES.accountPicture,
            method: "PATCH",
            sessionRef: request.account.sessionRef,
            body: await createProfilePictureBody(request.avatarAsset)
          });
        }

        return mapProfileResult(response, request.account.accountId, updatedAt);
      }
    },
    media: {
      async searchVideos(request: InstagramSearchVideosRequest) {
        const response = await http.requestJson({
          path: AIOGRAPI_REST_ROUTES.searchReels,
          method: "GET",
          sessionRef: request.account.sessionRef,
          query: {
            query: request.keyword
          }
        });

        return mapSearchVideosResult(response, request.limit);
      },
      async getMedia(request: InstagramGetMediaRequest) {
        const response = await http.requestJson({
          path: AIOGRAPI_REST_ROUTES.media,
          method: "GET",
          sessionRef: request.account.sessionRef,
          query: {
            id: request.mediaId,
            use_cache: "true"
          }
        });

        return mapMediaItem(response);
      },
      async likeMedia(request: InstagramLikeMediaRequest) {
        const actedAt = new Date().toISOString();
        const response = await http.requestForm({
          path: AIOGRAPI_REST_ROUTES.mediaLike,
          method: "POST",
          sessionRef: request.account.sessionRef,
          body: createFormFields({
            media_id: request.mediaId
          })
        });

        return mapActionResult(response, request.mediaId, actedAt);
      },
      async commentMedia(request: InstagramCommentMediaRequest) {
        const actedAt = new Date().toISOString();
        const response = await http.requestForm({
          path: AIOGRAPI_REST_ROUTES.mediaComment,
          method: "POST",
          sessionRef: request.account.sessionRef,
          body: createFormFields({
            media_id: request.mediaId,
            text: request.text
          })
        });

        return mapActionResult(response, request.mediaId, actedAt);
      }
    },
    publish: {
      async publishContent(request: InstagramPublishContentRequest) {
        validatePublishAssets(request.type, request.assets);
        const publishBody = await createPublishRequestBody({
          accountId: request.account.accountId,
          type: request.type,
          assets: request.assets,
          ...(request.caption === undefined ? {} : { caption: request.caption }),
          ...(request.tags === undefined ? {} : { tags: request.tags }),
          ...(request.scheduledAt === undefined ? {} : { scheduledAt: request.scheduledAt })
        });

        const baseRequest = {
          path: publishBody.path,
          method: "POST" as const,
          sessionRef: request.account.sessionRef
        };
        const response =
          publishBody.transport === "form"
            ? await http.requestForm({
                ...baseRequest,
                body: publishBody.body as URLSearchParams
              })
            : await http.requestMultipart({
                ...baseRequest,
                body: publishBody.body as FormData
              });

        return mapPublishResult(response, new Date().toISOString());
      },
      async getPublishStatus(request: InstagramPublishStatusRequest) {
        throw new InstagramProviderError(
          "unsupported_operation",
          `aiograpi-rest does not provide a publish status endpoint for ${request.publishId}`
        );
      }
    }
  };
}

/**
 * 输入：可选字符串字段。
 * 输出：URLSearchParams。
 * 作用：为 aiograpi-rest form-urlencoded 接口构造请求体并跳过未传字段。
 */
function createFormFields(fields: Record<string, string | undefined>): URLSearchParams {
  const form = new URLSearchParams();

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      form.set(key, value);
    }
  }

  return form;
}
