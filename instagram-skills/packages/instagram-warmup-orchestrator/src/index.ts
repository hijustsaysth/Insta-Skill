export interface WarmupToolDefinition {
  name: "instagram_warmup_plan" | "instagram_warmup_result_summarize";
  description: string;
}

export interface WarmupPlanRequest {
  accountId: string;
  sessionRef: string;
  registeredAt: string;
  currentDate: string;
  language?: string;
  materialLibraryPath?: string;
}

export interface WarmupTaskDraft {
  skillPackage: string;
  toolName: string;
  requestDraft: Record<string, unknown>;
}

export interface WarmupPlan {
  phase: string;
  tasks: WarmupTaskDraft[];
  nextSuggestedRunAt?: string;
}

export const warmupOrchestratorTools: WarmupToolDefinition[] = [
  { name: "instagram_warmup_plan", description: "生成当前阶段和今日养号任务计划" },
  { name: "instagram_warmup_result_summarize", description: "汇总 agent 服务执行后的任务日志" }
];

/**
 * 输入：账号注册日期、当前日期和任务上下文。
 * 输出：今日养号计划。
 * 作用：生成总编排计划，不调用任何执行工具。
 */
export async function instagramWarmupPlan(request: WarmupPlanRequest): Promise<WarmupPlan> {
  // TODO: 根据账号注册日期和当前日期识别养号阶段。
  // TODO: 生成 profile、video、content 对应的任务计划和参数草案。
  void request;
  throw new Error("NOT_IMPLEMENTED");
}

/**
 * 输入：agent 服务回传的真实执行日志。
 * 输出：执行汇总文本。
 * 作用：汇总执行结果，不伪造任务成功状态。
 */
export async function instagramWarmupResultSummarize(executionLogs: unknown[]): Promise<string> {
  // TODO: 汇总真实执行日志，输出成功、失败、降级和后续建议。
  void executionLogs;
  throw new Error("NOT_IMPLEMENTED");
}
