import type { InstagramVideoEvaluateRequest } from "./schema.js";

export const VIDEO_EVALUATE_PROMPT_TEMPLATE = `你是 Instagram 轻量互动判断助手。

根据以下信息判断当前短视频是否适合互动：
- 搜索关键词：{{keyword}}
- 目标说明：{{targetDescription}}
- 页面可见文本：{{visibleText}}
- OCR 文本：{{ocrText}}
- 当前是否已点赞：{{alreadyLiked}}
- 剩余点赞次数：{{remainingLikeCount}}
- 剩余评论次数：{{remainingCommentCount}}

要求：
1. 只在内容和目标说明明显相关时，matched 才返回 true。
2. 不要为了完成数量强行点赞或评论。
3. 如果剩余点赞次数为 0，shouldLike 必须为 false。
4. 如果当前已经点赞，shouldLike 必须为 false，避免再次点击导致取消点赞。
5. 如果剩余评论次数为 0，shouldComment 必须为 false。
6. 评论只适合真实、有上下文、不会打扰对方的视频。
7. 没有足够信息时跳过。
8. dwellMs 必须在 {{minDwellMs}} 到 {{maxDwellMs}} 之间。
9. 只返回 JSON，不要解释。

输出格式：
{
  "matched": true,
  "shouldLike": true,
  "shouldComment": false,
  "commentIntent": "string | null",
  "dwellMs": 8000,
  "skipReason": "string | null"
}`;

export const VIDEO_FRAME_ANALYSIS_PROMPT_TEMPLATE = `你是 Instagram Reel 截图理解助手。

请只根据截图中能明确看到的内容，提取有助于判断视频主题的文字、物体、场景和动作。
不要推断看不到的信息，不要生成点赞或评论建议。`;

/**
 * 输入：视频判断请求。
 * 输出：填充后的判断提示词。
 * 作用：为 agent 服务接入 LLM 判断提供稳定提示词。
 */
export function buildVideoEvaluatePrompt(request: InstagramVideoEvaluateRequest): string {
  return applyPromptVariables(VIDEO_EVALUATE_PROMPT_TEMPLATE, {
    keyword: request.keyword,
    targetDescription: request.targetDescription,
    visibleText: formatTextList(request.visibleText),
    ocrText: formatTextList(request.ocrText),
    alreadyLiked: request.alreadyLiked === true ? "true" : "false",
    remainingLikeCount: String(request.remainingLikeCount),
    remainingCommentCount: String(request.remainingCommentCount),
    minDwellMs: String(request.minDwellMs),
    maxDwellMs: String(request.maxDwellMs)
  });
}

/**
 * 输入：模板和变量表。
 * 输出：完成变量替换的提示词。
 * 作用：生成稳定可测试的提示词文本。
 */
function applyPromptVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_placeholder, key: string) => variables[key] ?? "");
}

/**
 * 输入：文本数组。
 * 输出：适合放入提示词的文本。
 * 作用：统一空文本展示，避免提示词出现 undefined。
 */
function formatTextList(values: string[] | undefined): string {
  const normalized = (values ?? []).map((value) => value.trim()).filter(Boolean);

  return normalized.length === 0 ? "(无)" : normalized.join("\n");
}
