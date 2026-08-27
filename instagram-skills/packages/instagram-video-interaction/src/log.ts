import type { InstagramVideoLogSummarizeRequest, InstagramVideoLogSummary } from "./schema.js";

/**
 * 输入：agent 服务回传的真实互动日志。
 * 输出：结构化日志汇总。
 * 作用：统计观看、点赞、评论、跳过数量，不伪造执行结果。
 */
export async function instagramVideoLogSummarize(
  request: InstagramVideoLogSummarizeRequest
): Promise<InstagramVideoLogSummary> {
  if (request.accountId.trim().length === 0) {
    throw new Error("INSTAGRAM_VIDEO_ACCOUNT_ID_REQUIRED");
  }

  const startedAt = Date.parse(request.startedAt);
  const endedAt = Date.parse(request.endedAt);

  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) {
    throw new Error("INSTAGRAM_VIDEO_LOG_TIME_INVALID");
  }

  return {
    accountId: request.accountId,
    startedAt: request.startedAt,
    endedAt: request.endedAt,
    durationMs: endedAt - startedAt,
    watchedCount: countAction(request.items, "watch"),
    likedCount: countAction(request.items, "like"),
    commentedCount: countAction(request.items, "comment"),
    skippedCount: countAction(request.items, "skip"),
    items: request.items
  };
}

/**
 * 输入：日志条目和动作类型。
 * 输出：指定动作的条目数量。
 * 作用：为日志汇总提供稳定计数。
 */
function countAction(items: InstagramVideoLogSummarizeRequest["items"], action: string): number {
  return items.filter((item) => item.action === action).length;
}
