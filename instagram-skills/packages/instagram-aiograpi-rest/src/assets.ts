import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { InstagramProviderError, type InstagramAssetRef, type InstagramPublishType } from "@instagram-skills/instagram-core";
import { AIOGRAPI_REST_ROUTES } from "./routes.js";

export type AiograpiRestPublishTransport = "form" | "multipart";

export interface AiograpiRestPublishRequestBody {
  path: string;
  transport: AiograpiRestPublishTransport;
  body: URLSearchParams | FormData;
}

export interface AiograpiRestPublishPayload {
  accountId: string;
  type: InstagramPublishType;
  caption?: string;
  tags?: string[];
  assets: InstagramAssetRef[];
  scheduledAt?: string;
}

/**
 * 输入：发布请求 payload。
 * 输出：aiograpi-rest 发布请求体和传输方式。
 * 作用：根据素材 URI 类型选择 JSON by URL 或 multipart by file 发布路线。
 */
export async function createPublishRequestBody(payload: AiograpiRestPublishPayload): Promise<AiograpiRestPublishRequestBody> {
  if (payload.assets.length === 0) {
    throw new InstagramProviderError("unsupported_operation", "publish assets cannot be empty");
  }

  if (payload.assets.length > 1) {
    throw new InstagramProviderError("unsupported_operation", "aiograpi-rest single upload endpoints only support one asset");
  }

  const asset = payload.assets[0];

  if (asset === undefined) {
    throw new InstagramProviderError("unsupported_operation", "publish assets cannot be empty");
  }

  return isHttpAssetUri(asset.uri) ? createUrlUploadBody(payload, asset) : createFileUploadBody(payload, asset);
}

/**
 * 输入：头像素材。
 * 输出：aiograpi-rest 头像上传 multipart 请求体。
 * 作用：把本地头像文件转换为 /account/picture 需要的 picture 字段。
 */
export async function createProfilePictureBody(asset: InstagramAssetRef): Promise<FormData> {
  if (isHttpAssetUri(asset.uri)) {
    throw new InstagramProviderError("unsupported_operation", "aiograpi-rest profile picture update requires a local file asset");
  }

  const localPath = resolveLocalAssetPath(asset.uri);
  const fileBuffer = await readFile(localPath);
  const form = new FormData();
  form.append("picture", new Blob([fileBuffer as unknown as BlobPart]), basename(localPath));

  return form;
}

/**
 * 输入：素材 URI。
 * 输出：是否为 HTTP/HTTPS URL。
 * 作用：识别可直接交给 aiograpi-rest by URL 上传的远程素材。
 */
export function isHttpAssetUri(uri: string): boolean {
  return uri.startsWith("http://") || uri.startsWith("https://");
}

/**
 * 输入：发布 payload 和远程素材。
 * 输出：真实 aiograpi-rest URL 上传请求。
 * 作用：按 post/story/reel 和媒体类型选择对应 by URL endpoint。
 */
function createUrlUploadBody(payload: AiograpiRestPublishPayload, asset: InstagramAssetRef): AiograpiRestPublishRequestBody {
  if (payload.type === "post" && asset.mediaType === "image") {
    return {
      path: AIOGRAPI_REST_ROUTES.photoUploadByUrl,
      transport: "form",
      body: createFormFields({
        url: asset.uri,
        caption: payload.caption ?? ""
      })
    };
  }

  if (payload.type === "story") {
    return {
      path: AIOGRAPI_REST_ROUTES.storyUploadByUrl,
      transport: "form",
      body: createFormFields({
        url: asset.uri,
        caption: payload.caption ?? "",
        as_video: asset.mediaType === "video" ? "true" : "false"
      })
    };
  }

  const form = new FormData();
  form.append("url", asset.uri);
  form.append("caption", payload.caption ?? "");

  return {
    path: payload.type === "reel" ? AIOGRAPI_REST_ROUTES.clipUploadByUrl : AIOGRAPI_REST_ROUTES.videoUploadByUrl,
    transport: "multipart",
    body: form
  };
}

/**
 * 输入：发布 payload 和本地素材。
 * 输出：真实 aiograpi-rest 文件上传请求。
 * 作用：读取本地文件并按 post/story/reel 和媒体类型选择对应 upload endpoint。
 */
async function createFileUploadBody(payload: AiograpiRestPublishPayload, asset: InstagramAssetRef): Promise<AiograpiRestPublishRequestBody> {
  const localPath = resolveLocalAssetPath(asset.uri);
  const fileBuffer = await readFile(localPath);
  const form = new FormData();
  form.append("file", new Blob([fileBuffer as unknown as BlobPart]), basename(localPath));

  if (payload.type !== "story") {
    form.append("caption", payload.caption ?? "");
  } else {
    form.append("caption", payload.caption ?? "");
    form.append("as_video", asset.mediaType === "video" ? "true" : "false");
  }

  return {
    path: getFileUploadPath(payload.type, asset),
    transport: "multipart",
    body: form
  };
}

/**
 * 输入：发布类型和素材。
 * 输出：真实 aiograpi-rest 文件上传路径。
 * 作用：把 core 发布类型和素材类型映射到 photo/video/clip/story endpoint。
 */
function getFileUploadPath(type: InstagramPublishType, asset: InstagramAssetRef): string {
  if (type === "story") {
    return AIOGRAPI_REST_ROUTES.storyUpload;
  }

  if (type === "reel") {
    return AIOGRAPI_REST_ROUTES.clipUpload;
  }

  return asset.mediaType === "image" ? AIOGRAPI_REST_ROUTES.photoUpload : AIOGRAPI_REST_ROUTES.videoUpload;
}

/**
 * 输入：键值对象。
 * 输出：URLSearchParams。
 * 作用：创建 aiograpi-rest 表单请求体。
 */
function createFormFields(fields: Record<string, string>): URLSearchParams {
  const form = new URLSearchParams();

  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }

  return form;
}

/**
 * 输入：本地文件 URI 或路径。
 * 输出：本地文件系统路径。
 * 作用：兼容 file:// URI 和普通路径两类本地素材引用。
 */
function resolveLocalAssetPath(uri: string): string {
  if (uri.startsWith("file://")) {
    return fileURLToPath(uri);
  }

  return uri;
}
