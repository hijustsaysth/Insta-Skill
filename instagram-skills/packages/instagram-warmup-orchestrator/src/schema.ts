export type InstagramWarmupStage = "day_1_5" | "day_6_14" | "stable";

export type InstagramWarmupTaskType = "profile_setup" | "video_interaction";

export interface WarmupToolDefinition {
  name: "instagram_warmup_plan" | "instagram_warmup_result_summarize";
  description: string;
}

export interface InstagramWarmupPlanRequest {
  accountId: string;
  sessionRef: string;
  registeredAt: string;
  currentDate: string;
  targetLanguage?: string;
  materialLibraryPath?: string;
  keywords?: string[];
}

export interface InstagramWarmupTask {
  taskId: string;
  type: InstagramWarmupTaskType;
  skill: string;
  toolHints: string[];
  suggestedInput: Record<string, unknown>;
  reason: string;
}

export interface InstagramWarmupPlan {
  accountId: string;
  sessionRef: string;
  date: string;
  stage: InstagramWarmupStage;
  tasks: InstagramWarmupTask[];
  nextSuggestedRunAt?: string;
}

export type InstagramWarmupExecutionStatus = "succeeded" | "failed" | "skipped";

export interface InstagramWarmupExecutionLogItem {
  taskId: string;
  type: InstagramWarmupTaskType;
  status: InstagramWarmupExecutionStatus;
  startedAt: string;
  endedAt: string;
  toolResults?: Record<string, unknown>[];
  reason?: string;
}

export interface InstagramWarmupResultSummarizeRequest {
  accountId: string;
  date: string;
  stage: InstagramWarmupStage;
  items: InstagramWarmupExecutionLogItem[];
}

export interface InstagramWarmupResultSummary {
  accountId: string;
  date: string;
  stage: InstagramWarmupStage;
  totalTaskCount: number;
  succeededTaskCount: number;
  failedTaskCount: number;
  skippedTaskCount: number;
  items: InstagramWarmupExecutionLogItem[];
}
