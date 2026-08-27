import type { VideoInteractionToolDefinition } from "./schema.js";

export const videoInteractionTools: VideoInteractionToolDefinition[] = [
  { name: "instagram_video_interaction_plan", description: "生成原子动作组合流程的视频动作计划，支持观看、点赞和评论" },
  { name: "instagram_video_evaluate", description: "根据当前 Reel 信号判断是否匹配和是否建议互动" },
  { name: "instagram_video_log_summarize", description: "汇总 agent 服务回传的视频互动执行日志" }
];
