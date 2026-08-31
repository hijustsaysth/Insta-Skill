import type { ProfileToolDefinition } from "./schema.js";

export const profileSetupTools: ProfileToolDefinition[] = [
  { name: "instagram_profile_generate", description: "根据提示词说明、参考素材和头像生成结果生成 Instagram 账号资料草案" },
  { name: "instagram_profile_edit_plan", description: "根据审批后的资料生成编辑计划和参数草案" }
];
