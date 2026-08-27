import type { InstagramVideoInteractionRuntimeOptions } from "./runtime.js";
import { registerVideoInteractionTools, type VideoInteractionToolConsumer } from "./tool-registry.js";

export interface InstagramVideoInteractionToolContext {
  tools: VideoInteractionToolConsumer;
}

/**
 * 输入：包含 tools.register 的 agent 上下文和可选模型能力。
 * 输出：工具注册返回值列表。
 * 作用：把视频互动三个工具注册到 dsh、pi 或其他兼容 agent 底座。
 */
export function apply(
  ctx: InstagramVideoInteractionToolContext,
  options: InstagramVideoInteractionRuntimeOptions = {}
): unknown[] {
  return registerVideoInteractionTools(ctx.tools, options);
}
