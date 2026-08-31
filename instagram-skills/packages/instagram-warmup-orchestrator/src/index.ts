export type {
  InstagramWarmupExecutionLogItem,
  InstagramWarmupExecutionStatus,
  InstagramWarmupPlan,
  InstagramWarmupPlanRequest,
  InstagramWarmupResultSummarizeRequest,
  InstagramWarmupResultSummary,
  InstagramWarmupStage,
  InstagramWarmupTask,
  InstagramWarmupTaskType,
  WarmupToolDefinition
} from "./schema.js";
export { warmupOrchestratorTools } from "./tools.js";
export { nextSuggestedRunAt, parseDateOnly, resolveWarmupStage, warmupDayNumber } from "./stage.js";
export {
  createWarmupPlan,
  normalizedKeywords,
  profileSetupTask,
  tasksForStage,
  validatePlanRequest,
  videoInteractionTask
} from "./plan.js";
export { countByStatus, summarizeWarmupResult, validateSummarizeRequest } from "./summarize.js";

import { createWarmupPlan } from "./plan.js";
import { summarizeWarmupResult } from "./summarize.js";
import type {
  InstagramWarmupPlan,
  InstagramWarmupPlanRequest,
  InstagramWarmupResultSummarizeRequest,
  InstagramWarmupResultSummary
} from "./schema.js";

/**
 * 输入：账号注册日期、当前日期和任务上下文。
 * 输出：今日养号计划。
 * 作用：生成总编排计划，不调用任何执行工具。
 */
export async function instagramWarmupPlan(request: InstagramWarmupPlanRequest): Promise<InstagramWarmupPlan> {
  return createWarmupPlan(request);
}

/**
 * 输入：agent 服务回传的真实执行日志。
 * 输出：结构化执行汇总。
 * 作用：汇总执行结果，不伪造任务成功状态。
 */
export async function instagramWarmupResultSummarize(
  request: InstagramWarmupResultSummarizeRequest
): Promise<InstagramWarmupResultSummary> {
  return summarizeWarmupResult(request);
}
