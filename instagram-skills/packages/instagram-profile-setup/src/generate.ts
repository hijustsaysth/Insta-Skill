import {
  BIOGRAPHY_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  type InstagramProfileAvatarAsset,
  type InstagramProfileAvatarGenerationResult,
  type InstagramProfileGenerateRequest,
  type InstagramProfileGenerateResult,
  type InstagramProfileGenerateTarget
} from "./schema.js";

const USERNAME_MAX_LENGTH = 30;
const DEFAULT_AVATAR_COUNT = 3;
const MIN_AVATAR_COUNT = 2;
const MAX_AVATAR_COUNT = 3;

/**
 * 输入：资料生成请求。
 * 输出：结构化资料草案。
 * 作用：按提示词说明风格和参考素材生成字段草案，不调用模型或 provider。
 */
export async function instagramProfileGenerate(
  request: InstagramProfileGenerateRequest
): Promise<InstagramProfileGenerateResult> {
  validateGenerateRequest(request);

  const result: InstagramProfileGenerateResult = {};

  if (request.targets.includes("username")) {
    result.username = createUsernameCandidate(requiredText(request.namePrompt, "namePrompt"));
  }

  if (request.targets.includes("displayName")) {
    result.displayName = limitText(createDisplayNameCandidate(request), DISPLAY_NAME_MAX_LENGTH);
  }

  if (request.targets.includes("biography")) {
    result.biography = limitText(createBiographyCandidate(request), BIOGRAPHY_MAX_LENGTH);
  }

  if (request.targets.includes("avatar")) {
    const avatarGeneration = createAvatarGenerationResult(request);
    result.avatarGeneration = avatarGeneration;
    const primaryAvatar = avatarGeneration.generatedAssets[0];
    if (primaryAvatar !== undefined) {
      result.avatarAsset = primaryAvatar;
    }
  }

  return result;
}

function validateGenerateRequest(request: InstagramProfileGenerateRequest): void {
  assertNonEmpty(request.accountId, "accountId");

  if (!Array.isArray(request.targets) || request.targets.length === 0) {
    throw new Error("PROFILE_TARGETS_REQUIRED");
  }

  const seen = new Set<InstagramProfileGenerateTarget>();
  for (const target of request.targets) {
    if (!isGenerateTarget(target)) {
      throw new Error(`PROFILE_TARGET_UNSUPPORTED: ${String(target)}`);
    }
    seen.add(target);
  }

  if (seen.has("username") || seen.has("displayName")) {
    if (seen.has("username")) {
      requiredText(request.namePrompt, "namePrompt");
    }
    if (seen.has("displayName")) {
      requiredText(request.brandPrefix, "brandPrefix");
      requiredText(request.englishName, "englishName");
    }
  }

  if (seen.has("biography")) {
    requiredText(request.businessPrompt ?? request.biographyPrompt, "businessPrompt");
    requiredText(request.contactPrompt, "contactPrompt");
  }

  if (seen.has("avatar")) {
    requiredReferenceAsset(request.referenceAssets);
    validateAvatarCount(request.avatarCount);
    validateGeneratedAvatarAssets(request.generatedAvatarAssets);
  }
}

function createUsernameCandidate(namePrompt: string): string {
  const normalized = namePrompt
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._]+/g, "_")
    .replace(/[._]{2,}/g, "_")
    .replace(/^[._]+|[._]+$/g, "");

  if (normalized.length === 0) {
    throw new Error("PROFILE_USERNAME_PROMPT_UNUSABLE");
  }

  if (normalized.length > USERNAME_MAX_LENGTH) {
    throw new Error(`PROFILE_USERNAME_TOO_LONG: max ${USERNAME_MAX_LENGTH}`);
  }

  return normalized;
}

function createDisplayNameCandidate(request: InstagramProfileGenerateRequest): string {
  const brandPrefix = collapseInlineWhitespace(requiredText(request.brandPrefix, "brandPrefix"));
  const englishName = collapseInlineWhitespace(requiredText(request.englishName, "englishName"));
  return `${brandPrefix}-${englishName}`;
}

function createBiographyCandidate(request: InstagramProfileGenerateRequest): string {
  const business = stripTrailingPeriod(collapseInlineWhitespace(requiredText(request.businessPrompt ?? request.biographyPrompt, "businessPrompt")));
  const contact = collapseInlineWhitespace(requiredText(request.contactPrompt, "contactPrompt"));
  return `Selling ${business}. Contact & WhatsAPP: ${contact}`;
}

function createAvatarGenerationResult(request: InstagramProfileGenerateRequest): InstagramProfileAvatarGenerationResult {
  const requestedCount = normalizeAvatarCount(request.avatarCount);
  const referenceAssets = requiredReferenceAssets(request.referenceAssets);
  const generatedAssets = createGeneratedAvatarAssets(request.generatedAvatarAssets);
  const prompt = createAvatarPrompt(request, referenceAssets, requestedCount);

  if (generatedAssets.length > 0) {
    if (generatedAssets.length !== requestedCount) {
      throw new Error(`PROFILE_GENERATED_AVATAR_ASSETS_COUNT_MISMATCH: expected ${requestedCount}`);
    }

    return {
      status: "generated",
      requestedCount,
      referenceAssets,
      generatedAssets,
      prompt
    };
  }

  if (request.avatarGenerationSupported !== false) {
    throw new Error("PROFILE_GENERATED_AVATAR_ASSETS_REQUIRED");
  }

  return {
    status: "degraded",
    requestedCount,
    referenceAssets,
    generatedAssets,
    prompt,
    fallbackReason: request.avatarGenerationSupported === false
      ? "agent image generation is not supported"
      : "agent image generation did not provide generated avatar asset paths"
  };
}

function limitText(value: string, maxLength: number): string {
  const text = value.trim();

  if (text.length > maxLength) {
    throw new Error(`PROFILE_FIELD_TOO_LONG: max ${maxLength}`);
  }

  return text;
}

function requiredText(value: string | undefined, field: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`PROFILE_${field.toUpperCase()}_REQUIRED`);
  }

  return value.trim();
}

function requiredReferenceAsset(value: string[] | undefined): string {
  const asset = value?.find((item) => item.trim().length > 0);

  if (asset === undefined) {
    throw new Error("PROFILE_AVATAR_REFERENCE_ASSET_REQUIRED");
  }

  return asset;
}

function requiredReferenceAssets(value: string[] | undefined): InstagramProfileAvatarAsset[] {
  const assets = value?.filter((item) => item.trim().length > 0).map((uri) => ({ uri: uri.trim(), mediaType: "image" as const })) ?? [];

  if (assets.length === 0) {
    throw new Error("PROFILE_AVATAR_REFERENCE_ASSET_REQUIRED");
  }

  return assets;
}

function createGeneratedAvatarAssets(value: string[] | undefined): InstagramProfileAvatarAsset[] {
  return value?.filter((item) => item.trim().length > 0).map((uri) => ({ uri: uri.trim(), mediaType: "image" as const })) ?? [];
}

function normalizeAvatarCount(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_AVATAR_COUNT;
  }

  validateAvatarCount(value);
  return value;
}

function validateAvatarCount(value: number | undefined): void {
  if (value === undefined) {
    return;
  }

  if (!Number.isInteger(value) || value < MIN_AVATAR_COUNT || value > MAX_AVATAR_COUNT) {
    throw new Error(`PROFILE_AVATAR_COUNT_UNSUPPORTED: expected ${MIN_AVATAR_COUNT}-${MAX_AVATAR_COUNT}`);
  }
}

function validateGeneratedAvatarAssets(value: string[] | undefined): void {
  const generatedCount = value?.filter((item) => item.trim().length > 0).length ?? 0;
  if (generatedCount === 0) {
    return;
  }

  if (generatedCount < MIN_AVATAR_COUNT || generatedCount > MAX_AVATAR_COUNT) {
    throw new Error(`PROFILE_GENERATED_AVATAR_ASSETS_UNSUPPORTED: expected ${MIN_AVATAR_COUNT}-${MAX_AVATAR_COUNT}`);
  }
}

function createAvatarPrompt(
  request: InstagramProfileGenerateRequest,
  referenceAssets: InstagramProfileAvatarAsset[],
  requestedCount: number
): string {
  const name = request.brandPrefix === undefined || request.englishName === undefined
    ? "the Instagram profile"
    : createDisplayNameCandidate(request);
  const business = request.businessPrompt ?? request.biographyPrompt ?? "business shown in the reference assets";
  const outputDir = request.avatarOutputDir ?? "output";

  return [
    `Generate ${requestedCount} square Instagram avatar images for ${name}.`,
    `Match the visual style and business category of these reference assets: ${referenceAssets.map((asset) => asset.uri).join(", ")}.`,
    `Business context: ${business}.`,
    `Use a clean brand/profile composition suitable for a small circular crop; avoid extra text, watermarks, and clutter.`,
    `Save generated assets under ${outputDir} and return their file paths.`
  ].join(" ");
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`PROFILE_${field.toUpperCase()}_REQUIRED`);
  }
}

function collapseInlineWhitespace(value: string): string {
  return value.replace(/[^\S\r\n]+/g, " ").trim();
}

function stripTrailingPeriod(value: string): string {
  return value.replace(/[.。]+$/g, "");
}

function isGenerateTarget(value: unknown): value is InstagramProfileGenerateTarget {
  return value === "username" || value === "displayName" || value === "biography" || value === "avatar";
}
