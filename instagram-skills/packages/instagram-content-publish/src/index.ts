export type ContentTarget = "post_image" | "post_video" | "reels" | "story_image" | "story_video";

export interface ContentPublishToolDefinition {
  name: "instagram_content_generate" | "instagram_content_publish_plan" | "instagram_publish_status_plan";
  description: string;
}

export interface ContentGenerateRequest {
  target: ContentTarget;
  productBrief: string;
  materialRefs: string[];
  language: string;
}

export interface ContentDraft {
  caption?: string;
  tags: string[];
  assetRefs: string[];
  evaluationTags: string[];
}

export interface PublishPlanRequest {
  accountId: string;
  sessionRef?: string;
  target: ContentTarget;
  draft: ContentDraft;
  approved: boolean;
}

export interface PublishPlan {
  action: "content.publish";
  targetTool: "InstagramClient.publish.publishContent" | "instagram.content.publish";
  requestDraft: PublishPlanRequest;
  logFields: Record<string, string | number | boolean | undefined>;
}

export interface PublishStatusPlanRequest {
  accountId: string;
  sessionRef?: string;
  publishId: string;
}

export interface PublishStatusPlan {
  action: "content.publishStatus";
  targetTool: "InstagramClient.publish.getPublishStatus" | "instagram.content.publishStatus";
  requestDraft: PublishStatusPlanRequest;
  logFields: Record<string, string | number | boolean | undefined>;
}

export const contentPublishTools: ContentPublishToolDefinition[] = [
  { name: "instagram_content_generate", description: "生成 Instagram 发布草稿" },
  { name: "instagram_content_publish_plan", description: "生成发布计划和参数草案" },
  { name: "instagram_publish_status_plan", description: "生成发布状态查询计划和参数草案" }
];

/**
 * 输入：内容生成请求。
 * 输出：内容草稿。
 * 作用：生成文案、标签和素材引用；当前仅保留实现占位。
 */
export async function instagramContentGenerate(request: ContentGenerateRequest): Promise<ContentDraft> {
  // TODO: 根据 productBrief、materialRefs 和 language 生成文案。
  // TODO: 图片和视频生成依赖 agent 是否接入相应模型服务。
  void request;
  throw new Error("NOT_IMPLEMENTED");
}

/**
 * 输入：审批后的内容草稿和目标发布类型。
 * 输出：发布计划。
 * 作用：生成发布计划和参数草案，不执行发布。
 */
export async function instagramContentPublishPlan(request: PublishPlanRequest): Promise<PublishPlan> {
  // TODO: 校验 approved=true，并返回稳定 logFields。
  // TODO: 定时发布第一版返回 NOT_IMPLEMENTED 占位，不生成可执行参数。
  // TODO: 发布素材规格由 provider 校验，本包只声明计划。
  void request;
  throw new Error("NOT_IMPLEMENTED");
}

/**
 * 输入：发布记录。
 * 输出：状态查询计划。
 * 作用：生成状态查询计划和参数草案，不查询真实状态。
 */
export async function instagramPublishStatusPlan(request: PublishStatusPlanRequest): Promise<PublishStatusPlan> {
  // TODO: 返回状态查询 requestDraft 和稳定 logFields。
  void request;
  throw new Error("NOT_IMPLEMENTED");
}
