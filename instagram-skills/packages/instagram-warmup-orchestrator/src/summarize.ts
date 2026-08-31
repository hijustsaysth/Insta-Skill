import type {
  InstagramWarmupExecutionLogItem,
  InstagramWarmupResultSummarizeRequest,
  InstagramWarmupResultSummary
} from "./schema.js";

/**
 * 输入：agent 服务回传的执行日志。
 * 输出：结构化执行汇总。
 * 作用：只统计真实日志，不补跑失败任务，不改写失败状态。
 */
export function summarizeWarmupResult(
  request: InstagramWarmupResultSummarizeRequest
): InstagramWarmupResultSummary {
  validateSummarizeRequest(request);
  return {
    accountId: request.accountId,
    date: request.date,
    stage: request.stage,
    totalTaskCount: request.items.length,
    succeededTaskCount: countByStatus(request.items, "succeeded"),
    failedTaskCount: countByStatus(request.items, "failed"),
    skippedTaskCount: countByStatus(request.items, "skipped"),
    items: request.items
  };
}

/**
 * 输入：汇总请求。
 * 输出：无。
 * 作用：校验汇总边界输入，避免伪造空账号或非法日志。
 */
export function validateSummarizeRequest(request: InstagramWarmupResultSummarizeRequest): void {
  if (!request.accountId?.trim()) throw new Error("accountId is required");
  if (!request.date?.trim()) throw new Error("date is required");
  if (!Array.isArray(request.items)) throw new Error("items must be an array");
  for (const item of request.items) {
    if (!item.taskId?.trim()) throw new Error("item.taskId is required");
    if (!["profile_setup", "video_interaction"].includes(item.type)) {
      throw new Error(`unsupported item.type: ${item.type}`);
    }
    if (!["succeeded", "failed", "skipped"].includes(item.status)) {
      throw new Error(`unsupported item.status: ${item.status}`);
    }
  }
}

/**
 * 输入：日志列表和状态。
 * 输出：匹配状态的数量。
 * 作用：集中统计执行状态，保持汇总逻辑可测试。
 */
export function countByStatus(
  items: InstagramWarmupExecutionLogItem[],
  status: InstagramWarmupExecutionLogItem["status"]
): number {
  return items.filter((item) => item.status === status).length;
}
