import { assertValidPlanRequest, CONNECTOR_VIDEO_TOOLS } from "./limits.js";
import type { InstagramVideoInteractionPlan, InstagramVideoInteractionPlanRequest } from "./schema.js";

/**
 * 输入：视频互动目标和账号信息。
 * 输出：结构化视频动作计划。
 * 作用：生成原子动作组合流程计划和 connector 工具建议，不执行连续观看 workflow 或移动端动作。
 */
export async function instagramVideoInteractionPlan(
  request: InstagramVideoInteractionPlanRequest
): Promise<InstagramVideoInteractionPlan> {
  assertValidPlanRequest(request);

  const requestDraft = {
    ...request,
    keywords: request.keywords.map((keyword) => keyword.trim()).filter(Boolean)
  };

  return {
    ...requestDraft,
    action: "video.interaction",
    connectorTools: [...CONNECTOR_VIDEO_TOOLS],
    requestDraft,
    logFields: {
      accountId: requestDraft.accountId,
      sessionRef: requestDraft.sessionRef,
      keywordCount: requestDraft.keywords.length,
      maxLikes: requestDraft.maxLikes,
      maxComments: requestDraft.maxComments,
      minDwellMs: requestDraft.minDwellMs,
      maxDwellMs: requestDraft.maxDwellMs
    },
    startedAt: new Date().toISOString()
  };
}
