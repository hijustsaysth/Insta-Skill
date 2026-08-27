import type { InstagramVideoEvaluateRequest, InstagramVideoInteractionPlanRequest } from "./schema.js";

export const CONNECTOR_VIDEO_TOOLS = [
  "instagram.app.open",
  "instagram.search.open",
  "instagram.search.input",
  "instagram.search.open_first_reel",
  "instagram.reel.collect_signals",
  "instagram.reel.like",
  "instagram.reel.comment",
  "instagram.reel.next",
  // 连续观看固定时长任务直接使用该组合 workflow，不进入点赞/评论决策链路。
  "instagram.reels.engage_workflow"
];

/**
 * 输入：原子动作组合流程计划请求。
 * 输出：无。
 * 作用：校验视频动作计划的用户输入边界。
 */
export function assertValidPlanRequest(request: InstagramVideoInteractionPlanRequest): void {
  if (request.accountId.trim().length === 0) {
    throw new Error("INSTAGRAM_VIDEO_ACCOUNT_ID_REQUIRED");
  }

  if (request.sessionRef.trim().length === 0) {
    throw new Error("INSTAGRAM_VIDEO_SESSION_REF_REQUIRED");
  }

  if (request.keywords.map((keyword) => keyword.trim()).filter(Boolean).length === 0) {
    throw new Error("INSTAGRAM_VIDEO_KEYWORDS_REQUIRED");
  }

  if (request.targetDescription.trim().length === 0) {
    throw new Error("INSTAGRAM_VIDEO_TARGET_DESCRIPTION_REQUIRED");
  }

  assertValidInteractionCounts(request.maxLikes, request.maxComments);
  assertValidDwellRange(request.minDwellMs, request.maxDwellMs);
}

/**
 * 输入：单条视频判断请求。
 * 输出：无。
 * 作用：校验视频判断所需的计数和停留时间边界。
 */
export function assertValidEvaluateRequest(request: InstagramVideoEvaluateRequest): void {
  if (request.accountId.trim().length === 0) {
    throw new Error("INSTAGRAM_VIDEO_ACCOUNT_ID_REQUIRED");
  }

  if (request.keyword.trim().length === 0) {
    throw new Error("INSTAGRAM_VIDEO_KEYWORD_REQUIRED");
  }

  if (request.targetDescription.trim().length === 0) {
    throw new Error("INSTAGRAM_VIDEO_TARGET_DESCRIPTION_REQUIRED");
  }

  assertValidInteractionCounts(request.remainingLikeCount, request.remainingCommentCount);
  assertValidDwellRange(request.minDwellMs, request.maxDwellMs);
}

/**
 * 输入：点赞数、评论数。
 * 输出：无。
 * 作用：校验互动次数不能为负数。
 */
export function assertValidInteractionCounts(likeCount: number, commentCount: number): void {
  if (!Number.isInteger(likeCount) || likeCount < 0) {
    throw new Error("INSTAGRAM_VIDEO_LIKE_COUNT_INVALID");
  }

  if (!Number.isInteger(commentCount) || commentCount < 0) {
    throw new Error("INSTAGRAM_VIDEO_COMMENT_COUNT_INVALID");
  }
}

/**
 * 输入：最小和最大停留毫秒数。
 * 输出：无。
 * 作用：校验停留时间范围。
 */
export function assertValidDwellRange(minDwellMs: number, maxDwellMs: number): void {
  if (!Number.isInteger(minDwellMs) || minDwellMs <= 0) {
    throw new Error("INSTAGRAM_VIDEO_MIN_DWELL_MS_INVALID");
  }

  if (!Number.isInteger(maxDwellMs) || maxDwellMs < minDwellMs) {
    throw new Error("INSTAGRAM_VIDEO_MAX_DWELL_MS_INVALID");
  }
}
