export type InstagramProfileSetupToolName = "instagram_profile_generate" | "instagram_profile_edit_plan";

export type InstagramProfileGenerateTarget = "username" | "displayName" | "biography" | "avatar";

export interface InstagramProfileAvatarAsset {
  uri: string;
  mediaType: "image";
}

export type InstagramProfileAvatarGenerationStatus = "generated" | "degraded";

export interface InstagramProfileAvatarGenerationResult {
  status: InstagramProfileAvatarGenerationStatus;
  requestedCount: number;
  referenceAssets: InstagramProfileAvatarAsset[];
  generatedAssets: InstagramProfileAvatarAsset[];
  prompt: string;
  fallbackReason?: string;
}

export interface InstagramProfileGenerateRequest {
  accountId: string;
  targets: InstagramProfileGenerateTarget[];
  namePrompt?: string;
  brandPrefix?: string;
  englishName?: string;
  biographyPrompt?: string;
  businessPrompt?: string;
  contactPrompt?: string;
  referenceAssets?: string[];
  generatedAvatarAssets?: string[];
  avatarCount?: number;
  avatarOutputDir?: string;
  avatarGenerationSupported?: boolean;
  targetLanguage?: string;
}

export interface InstagramProfileGenerateResult {
  username?: string;
  displayName?: string;
  biography?: string;
  avatarAsset?: InstagramProfileAvatarAsset;
  avatarGeneration?: InstagramProfileAvatarGenerationResult;
}

export type InstagramProfileEditProvider = "instagram-client" | "mcp-tool" | "http-provider";

export interface InstagramProfileEditPlanRequest extends InstagramProfileGenerateResult {
  accountId: string;
  sessionRef?: string;
  approved: boolean;
  preferredProvider?: InstagramProfileEditProvider;
}

export type InstagramProfileEditableField = "username" | "displayName" | "biography" | "avatarAsset";

export interface InstagramProfileEditPlanResult {
  action: "update_profile";
  approvalRequired: false;
  targetTool: "InstagramClient.profile.updateProfile" | "instagram.profile.update";
  requestDraft: {
    accountId: string;
    sessionRef?: string;
    username?: string;
    displayName?: string;
    biography?: string;
    avatarAsset?: InstagramProfileAvatarAsset;
  };
  fieldsToUpdate: InstagramProfileEditableField[];
  warnings: string[];
}

export interface ProfileToolDefinition {
  name: InstagramProfileSetupToolName;
  description: string;
}

export const DISPLAY_NAME_MAX_LENGTH = 64;
export const BIOGRAPHY_MAX_LENGTH = 150;
