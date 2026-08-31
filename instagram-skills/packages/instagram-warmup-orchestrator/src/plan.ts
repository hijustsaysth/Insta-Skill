import {
  DEFAULT_KEYWORDS,
  DEFAULT_MATERIAL_LIBRARY_PATH,
  DEFAULT_MAX_DWELL_MS,
  DEFAULT_MIN_DWELL_MS,
  DEFAULT_TARGET_LANGUAGE,
  DEFAULT_VIDEO_INTERACTION_DURATION_MS,
  DEFAULT_VIDEO_INTERACTION_MAX_COMMENTS,
  DEFAULT_VIDEO_INTERACTION_MAX_LIKES,
  NEXT_RUN_HOUR
} from "./limits.js";
import { nextSuggestedRunAt, resolveWarmupStage } from "./stage.js";
import type {
  InstagramWarmupPlan,
  InstagramWarmupPlanRequest,
  InstagramWarmupStage,
  InstagramWarmupTask
} from "./schema.js";

/**
 * 输入：养号计划请求。
 * 输出：今日养号结构化计划。
 * 作用：只生成任务、工具提示和参数草案，不调用任何外部工具。
 */
export function createWarmupPlan(request: InstagramWarmupPlanRequest): InstagramWarmupPlan {
  validatePlanRequest(request);
  const stage = resolveWarmupStage(request.registeredAt, request.currentDate);
  return {
    accountId: request.accountId,
    sessionRef: request.sessionRef,
    date: request.currentDate,
    stage,
    tasks: tasksForStage(stage, request),
    nextSuggestedRunAt: nextSuggestedRunAt(request.currentDate, NEXT_RUN_HOUR)
  };
}

/**
 * 输入：计划请求。
 * 输出：无。
 * 作用：在系统边界快速失败，避免生成不可执行的空计划。
 */
export function validatePlanRequest(request: InstagramWarmupPlanRequest): void {
  if (!request.accountId?.trim()) throw new Error("accountId is required");
  if (!request.sessionRef?.trim()) throw new Error("sessionRef is required");
  if (!request.registeredAt?.trim()) throw new Error("registeredAt is required");
  if (!request.currentDate?.trim()) throw new Error("currentDate is required");
}

/**
 * 输入：养号阶段和请求上下文。
 * 输出：阶段对应的任务列表。
 * 作用：按第一版写死规则生成今日计划。
 */
export function tasksForStage(
  stage: InstagramWarmupStage,
  request: InstagramWarmupPlanRequest
): InstagramWarmupTask[] {
  if (stage === "day_1_5") {
    return [profileSetupTask(request, 1), videoInteractionTask(request, 1)];
  }
  if (stage === "day_6_14") {
    return [videoInteractionTask(request, 1)];
  }
  return [videoInteractionTask(request, 1)];
}

/**
 * 输入：请求上下文和序号。
 * 输出：资料建设任务。
 * 作用：只生成资料建设参数草案，不生成头像、名字或简介。
 */
export function profileSetupTask(request: InstagramWarmupPlanRequest, sequence: number): InstagramWarmupTask {
  return {
    taskId: `profile-setup-${sequence.toString().padStart(3, "0")}`,
    type: "profile_setup",
    skill: "instagram-profile-setup",
    toolHints: ["instagram_profile_generate", "instagram_profile_edit_plan"],
    suggestedInput: {
      accountId: request.accountId,
      sessionRef: request.sessionRef,
      targets: ["displayName", "biography", "avatar"],
      materialLibraryPath: request.materialLibraryPath ?? DEFAULT_MATERIAL_LIBRARY_PATH,
      targetLanguage: request.targetLanguage ?? DEFAULT_TARGET_LANGUAGE
    },
    reason: "账号处于早期养号阶段，需要完善基础资料，提高账号可信度"
  };
}

/**
 * 输入：请求上下文和序号。
 * 输出：视频互动任务。
 * 作用：只生成视频互动参数草案，不判断单条视频、不执行点赞评论。
 */
export function videoInteractionTask(request: InstagramWarmupPlanRequest, sequence: number): InstagramWarmupTask {
  return {
    taskId: `video-interaction-${sequence.toString().padStart(3, "0")}`,
    type: "video_interaction",
    skill: "instagram-video-interaction",
    toolHints: [
      "instagram.app.open",
      "instagram.search.open",
      "instagram.search.input",
      "instagram.search.open_first_reel",
      "instagram.reel.collect_signals",
      "instagram_video_evaluate",
      "instagram_video_comment_generate",
      "instagram.reel.like",
      "instagram.reel.comment",
      "instagram.reel.next",
      "instagram_video_log_summarize"
    ],
    suggestedInput: {
      accountId: request.accountId,
      sessionRef: request.sessionRef,
      keywords: normalizedKeywords(request.keywords),
      durationMs: DEFAULT_VIDEO_INTERACTION_DURATION_MS,
      maxLikes: DEFAULT_VIDEO_INTERACTION_MAX_LIKES,
      maxComments: DEFAULT_VIDEO_INTERACTION_MAX_COMMENTS,
      minDwellMs: DEFAULT_MIN_DWELL_MS,
      maxDwellMs: DEFAULT_MAX_DWELL_MS,
      targetLanguage: request.targetLanguage ?? DEFAULT_TARGET_LANGUAGE
    },
    reason: "账号需要持续浏览同类型短视频并进行轻量互动，形成稳定用户轨迹"
  };
}

/**
 * 输入：关键词数组。
 * 输出：非空关键词数组。
 * 作用：清洗空关键词，未传入时返回第一版默认草案。
 */
export function normalizedKeywords(keywords?: string[]): string[] {
  const values = keywords?.map((keyword) => keyword.trim()).filter((keyword) => keyword.length > 0) ?? [];
  return values.length > 0 ? values : [...DEFAULT_KEYWORDS];
}
