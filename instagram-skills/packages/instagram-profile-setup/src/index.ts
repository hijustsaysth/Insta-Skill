export interface ProfileToolDefinition {
  name: "instagram_profile_generate" | "instagram_profile_edit_plan";
  description: string;
}

export interface ProfileGenerateRequest {
  targets: Array<"fullName" | "biography" | "avatar">;
  prompt: string;
  materialRefs: string[];
}

export interface ProfileGenerateResult {
  fullName?: string;
  biography?: string;
  avatarAssetRef?: string;
}

export interface ProfileEditPlanRequest {
  accountId: string;
  sessionRef?: string;
  approved: boolean;
  profile: ProfileGenerateResult;
}

export interface ProfileEditPlan {
  action: "profile.update";
  targetTool: "InstagramClient.profile.updateProfile" | "instagram.profile.update";
  requestDraft: ProfileEditPlanRequest;
}

export const profileSetupTools: ProfileToolDefinition[] = [
  { name: "instagram_profile_generate", description: "生成 Instagram 账号名字、简介和头像引用" },
  { name: "instagram_profile_edit_plan", description: "根据审批后的资料生成编辑计划和参数草案" }
];

/**
 * 输入：资料生成请求。
 * 输出：资料生成结果。
 * 作用：生成账号名字、简介和头像引用；当前仅保留实现占位。
 */
export async function instagramProfileGenerate(request: ProfileGenerateRequest): Promise<ProfileGenerateResult> {
  // TODO: 根据 targets、prompt 和 materialRefs 生成对应资料内容。
  // TODO: fullName 限制 64 字符，biography 限制 150 字符。
  // TODO: 头像生成依赖 agent 是否接入图片生成服务。
  void request;
  throw new Error("NOT_IMPLEMENTED");
}

/**
 * 输入：人工审批后的资料和账号信息。
 * 输出：资料编辑计划。
 * 作用：生成编辑计划和参数草案，不执行资料更新。
 */
export async function instagramProfileEditPlan(request: ProfileEditPlanRequest): Promise<ProfileEditPlan> {
  // TODO: 校验 approved=true，并拒绝空更新计划。
  // TODO: 只返回 requestDraft，不调用 InstagramClient 或 MCP tool。
  void request;
  throw new Error("NOT_IMPLEMENTED");
}
