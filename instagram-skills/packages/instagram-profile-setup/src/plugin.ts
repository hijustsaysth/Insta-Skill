import { registerProfileSetupTools, type ProfileSetupToolConsumer } from "./tool-registry.js";

export interface InstagramProfileSetupToolContext {
  tools: ProfileSetupToolConsumer;
}

/**
 * 输入：包含 tools.register 的 agent 上下文。
 * 输出：工具注册返回值列表。
 * 作用：把资料生成和编辑计划工具注册到兼容 agent 底座。
 */
export function apply(ctx: InstagramProfileSetupToolContext): unknown[] {
  return registerProfileSetupTools(ctx.tools);
}

