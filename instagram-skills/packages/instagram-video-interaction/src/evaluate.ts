import { assertValidEvaluateRequest } from "./limits.js";
import { buildVideoEvaluatePrompt, VIDEO_FRAME_ANALYSIS_PROMPT_TEMPLATE } from "./prompts.js";
import type { InstagramVideoInteractionRuntimeOptions } from "./runtime.js";
import type { InstagramVideoEvaluateRequest, InstagramVideoEvaluateResult } from "./schema.js";

/**
 * 输入：单条视频信号、目标说明、互动剩余额度和停留时间范围。
 * 输出：是否匹配、是否建议点赞、是否建议评论的结构化决策。
 * 作用：只基于已传入文本信号做保守判断，不执行点赞或评论。
 */
export async function instagramVideoEvaluate(
  request: InstagramVideoEvaluateRequest,
  options: InstagramVideoInteractionRuntimeOptions = {}
): Promise<InstagramVideoEvaluateResult> {
  assertValidEvaluateRequest(request);

  const requestWithVisionSignals = await collectVisionSignals(request, options);
  const textSignals = collectTextSignals(requestWithVisionSignals.visibleText, requestWithVisionSignals.ocrText);
  const dwellMs = midpoint(request.minDwellMs, request.maxDwellMs);

  if (textSignals.length === 0) {
    return {
      matched: false,
      shouldLike: false,
      shouldComment: false,
      dwellMs,
      skipReason:
        request.visionModelAvailable === true && (request.frameAssets?.length ?? 0) > 0
          ? "text_signals_required_for_package_evaluation"
          : "insufficient_signals_without_vision_model"
    };
  }

  if (options.textModel !== undefined) {
    return validateModelEvaluation(
      await options.textModel.generateJson<InstagramVideoEvaluateResult>({
        prompt: buildVideoEvaluatePrompt(requestWithVisionSignals),
        schemaName: "InstagramVideoEvaluateResult"
      }),
      requestWithVisionSignals
    );
  }

  const matched = isRelevant(textSignals.join(" "), request.keyword, request.targetDescription);

  if (!matched) {
    return {
      matched: false,
      shouldLike: false,
      shouldComment: false,
      dwellMs,
      skipReason: "not_matched_target"
    };
  }

  return {
    matched: true,
    shouldLike: request.remainingLikeCount > 0 && request.alreadyLiked !== true,
    shouldComment: request.remainingCommentCount > 0,
    ...(request.remainingCommentCount > 0
      ? { commentIntent: `围绕「${request.keyword.trim()}」表达轻量、真实的观看反馈` }
      : {}),
    dwellMs
  };
}

/**
 * 输入：视频判断请求和运行时模型能力。
 * 输出：补充视觉文本后的判断请求。
 * 作用：在 agent 服务提供视觉模型时，把截图分析结果转成文本信号。
 */
async function collectVisionSignals(
  request: InstagramVideoEvaluateRequest,
  options: InstagramVideoInteractionRuntimeOptions
): Promise<InstagramVideoEvaluateRequest> {
  const hasTextSignals = collectTextSignals(request.visibleText, request.ocrText).length > 0;

  if (hasTextSignals || request.visionModelAvailable !== true || (request.frameAssets?.length ?? 0) === 0) {
    return request;
  }

  if (options.visionModel === undefined) {
    return request;
  }

  const result = await options.visionModel.analyzeFrames({
    frameAssets: request.frameAssets ?? [],
    prompt: VIDEO_FRAME_ANALYSIS_PROMPT_TEMPLATE
  });

  return {
    ...request,
    visibleText: [
      ...(request.visibleText ?? []),
      ...(result.visibleText ?? []),
      ...(result.description === undefined ? [] : [result.description])
    ],
    ocrText: [...(request.ocrText ?? []), ...(result.ocrText ?? [])]
  };
}

/**
 * 输入：模型返回的判断结果和原始请求。
 * 输出：通过硬限制约束后的判断结果。
 * 作用：校验模型输出，并强制剩余次数和停留时间限制。
 */
function validateModelEvaluation(
  result: InstagramVideoEvaluateResult,
  request: InstagramVideoEvaluateRequest
): InstagramVideoEvaluateResult {
  if (!Number.isInteger(result.dwellMs) || result.dwellMs < request.minDwellMs || result.dwellMs > request.maxDwellMs) {
    throw new Error("INSTAGRAM_VIDEO_MODEL_DWELL_MS_INVALID");
  }

  return {
    matched: result.matched,
    shouldLike: result.matched && request.remainingLikeCount > 0 && request.alreadyLiked !== true && result.shouldLike,
    shouldComment: result.matched && request.remainingCommentCount > 0 && result.shouldComment,
    ...(result.commentIntent === undefined ? {} : { commentIntent: result.commentIntent }),
    dwellMs: result.dwellMs,
    ...(result.skipReason === undefined ? {} : { skipReason: result.skipReason })
  };
}

/**
 * 输入：可见文本和 OCR 文本数组。
 * 输出：去空后的文本信号数组。
 * 作用：合并 connector 采集到的文本信号。
 */
function collectTextSignals(visibleText?: string[], ocrText?: string[]): string[] {
  return [...(visibleText ?? []), ...(ocrText ?? [])].map((text) => text.trim()).filter(Boolean);
}

/**
 * 输入：最小和最大停留毫秒数。
 * 输出：中位停留毫秒数。
 * 作用：生成稳定、可测试的停留建议。
 */
function midpoint(minDwellMs: number, maxDwellMs: number): number {
  return Math.round((minDwellMs + maxDwellMs) / 2);
}

/**
 * 输入：视频文本、关键词和目标说明。
 * 输出：是否相关。
 * 作用：用关键词和目标说明词元做第一版确定性相关性判断。
 */
function isRelevant(text: string, keyword: string, targetDescription: string): boolean {
  const normalizedText = normalize(text);
  const normalizedKeyword = normalize(keyword);

  if (normalizedText.includes(normalizedKeyword)) {
    return true;
  }

  return tokenize(targetDescription).some((token) => normalizedText.includes(token));
}

/**
 * 输入：原始文本。
 * 输出：标准化文本。
 * 作用：降低大小写和多空格对匹配的影响。
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * 输入：目标说明文本。
 * 输出：可用于匹配的词元列表。
 * 作用：提取第一版相关性判断需要的关键词。
 */
function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^\p{L}\p{N}#@]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}
