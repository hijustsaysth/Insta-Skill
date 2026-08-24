export interface VideoInteractionToolDefinition {
  name:
    | "instagram_video_interaction_plan"
    | "instagram_video_evaluate"
    | "instagram_video_comment_generate"
    | "instagram_video_log_summarize";
  description: string;
}

export interface VideoInteractionPlanRequest {
  accountId: string;
  sessionRef: string;
  keywords: string[];
  maxInteractions: number;
  durationMinutes: number;
  commentStyle?: string;
}

export interface VideoInteractionPlan {
  action: "video.interaction";
  connectorTools: string[];
  requestDraft: VideoInteractionPlanRequest;
}

export interface VideoSignals {
  visibleText?: string;
  ocrText?: string;
  frameAssets?: string[];
  visionModelAvailable: boolean;
}

export interface VideoEvaluation {
  matched: boolean;
  shouldLike: boolean;
  shouldComment: boolean;
  reason: string;
}

export const videoInteractionTools: VideoInteractionToolDefinition[] = [
  { name: "instagram_video_interaction_plan", description: "生成视频互动计划" },
  { name: "instagram_video_evaluate", description: "判断单条视频是否匹配和是否互动" },
  { name: "instagram_video_comment_generate", description: "生成视频评论内容" },
  { name: "instagram_video_log_summarize", description: "汇总视频互动日志" }
];

/**
 * 输入：视频互动目标和账号信息。
 * 输出：视频互动计划。
 * 作用：生成互动计划，不执行半小时循环或移动端动作。
 */
export async function instagramVideoInteractionPlan(
  request: VideoInteractionPlanRequest
): Promise<VideoInteractionPlan> {
  // TODO: 生成 connector tool 调用建议和互动上限，不调用 MCP tool。
  void request;
  throw new Error("NOT_IMPLEMENTED");
}

/**
 * 输入：单条视频信号。
 * 输出：是否匹配、是否点赞、是否评论的决策。
 * 作用：判断视频互动决策，不执行点赞或评论。
 */
export async function instagramVideoEvaluate(signals: VideoSignals): Promise<VideoEvaluation> {
  // TODO: 有视觉模型时结合截图、OCR、可见文本判断。
  // TODO: 无视觉模型时只基于 visibleText 和 ocrText 保守判断。
  void signals;
  throw new Error("NOT_IMPLEMENTED");
}

/**
 * 输入：视频信号和评论风格。
 * 输出：评论文本。
 * 作用：生成评论内容，不提交评论。
 */
export async function instagramVideoCommentGenerate(signals: VideoSignals, commentStyle?: string): Promise<string> {
  // TODO: 基于视频信号生成自然评论。
  void signals;
  void commentStyle;
  throw new Error("NOT_IMPLEMENTED");
}

/**
 * 输入：agent 服务回传的真实互动日志。
 * 输出：汇总文本。
 * 作用：汇总观看、点赞、评论、跳过记录。
 */
export async function instagramVideoLogSummarize(logs: unknown[]): Promise<string> {
  // TODO: 汇总真实执行日志，不伪造互动结果。
  void logs;
  throw new Error("NOT_IMPLEMENTED");
}
