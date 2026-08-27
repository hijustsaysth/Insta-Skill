export type InstagramVideoInteractionToolName =
  | "instagram_video_interaction_plan"
  | "instagram_video_evaluate"
  | "instagram_video_log_summarize";

export interface VideoInteractionToolDefinition {
  name: InstagramVideoInteractionToolName;
  description: string;
}

export interface InstagramVideoInteractionPlanRequest {
  accountId: string;
  sessionRef: string;
  keywords: string[];
  targetDescription: string;
  maxLikes: number;
  maxComments: number;
  minDwellMs: number;
  maxDwellMs: number;
}

export interface InstagramVideoInteractionPlan extends InstagramVideoInteractionPlanRequest {
  action: "video.interaction";
  connectorTools: string[];
  requestDraft: InstagramVideoInteractionPlanRequest;
  logFields: Record<string, string | number | boolean>;
  startedAt: string;
}

export interface InstagramVideoEvaluateRequest {
  accountId: string;
  keyword: string;
  targetDescription: string;
  visibleText?: string[];
  ocrText?: string[];
  frameAssets?: string[];
  visionModelAvailable?: boolean;
  alreadyLiked?: boolean;
  remainingLikeCount: number;
  remainingCommentCount: number;
  minDwellMs: number;
  maxDwellMs: number;
}

export interface InstagramVideoEvaluateResult {
  matched: boolean;
  shouldLike: boolean;
  shouldComment: boolean;
  commentIntent?: string;
  dwellMs: number;
  skipReason?: string;
}

export interface InstagramVideoInteractionLogItem {
  action: "watch" | "like" | "comment" | "skip";
  keyword: string;
  matched: boolean;
  commentText?: string;
  dwellMs: number;
  resultStatus: "succeeded" | "failed" | "skipped";
  reason?: string;
  actedAt: string;
}

export interface InstagramVideoLogSummarizeRequest {
  accountId: string;
  startedAt: string;
  endedAt: string;
  items: InstagramVideoInteractionLogItem[];
}

export interface InstagramVideoLogSummary {
  accountId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  watchedCount: number;
  likedCount: number;
  commentedCount: number;
  skippedCount: number;
  items: InstagramVideoInteractionLogItem[];
}
