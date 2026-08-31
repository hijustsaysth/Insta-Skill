import type { WarmupToolDefinition } from "./schema.js";

export const warmupOrchestratorTools: WarmupToolDefinition[] = [
  { name: "instagram_warmup_plan", description: "根据账号信息生成今日养号结构化计划" },
  { name: "instagram_warmup_result_summarize", description: "汇总 agent 服务执行后的任务日志" }
];
