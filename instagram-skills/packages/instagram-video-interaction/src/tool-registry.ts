import { instagramVideoEvaluate } from "./evaluate.js";
import { instagramVideoLogSummarize } from "./log.js";
import { instagramVideoInteractionPlan } from "./plan.js";
import type { InstagramVideoInteractionRuntimeOptions } from "./runtime.js";
import type { InstagramVideoInteractionToolName } from "./schema.js";

export interface VideoInteractionExecutableTool {
  name: InstagramVideoInteractionToolName;
  description: string;
  parameters: Record<string, unknown>;
  output: {
    schema: Record<string, unknown>;
    render(args: unknown, value: unknown): Array<{ type: "text"; text: string }>;
  };
  execute(args: unknown): Promise<unknown>;
}

export interface VideoInteractionToolRegistry {
  tools: VideoInteractionExecutableTool[];
  schemas(): Array<Omit<VideoInteractionExecutableTool, "execute" | "output">>;
  execute(name: InstagramVideoInteractionToolName, args: unknown): Promise<unknown>;
}

export interface VideoInteractionToolConsumer {
  register(tool: VideoInteractionExecutableTool): unknown;
}

/**
 * 输入：运行时模型能力。
 * 输出：底座无关的视频互动工具注册表。
 * 作用：让 dsh、pi 或其他 agent 服务自行注册并调用本包工具。
 */
export function createVideoInteractionToolRegistry(
  options: InstagramVideoInteractionRuntimeOptions = {}
): VideoInteractionToolRegistry {
  const tools = createTools(options);

  return {
    tools,
    schemas() {
      return tools.map(({ execute: _execute, output: _output, ...schema }) => schema);
    },
    async execute(name, args) {
      const tool = tools.find((item) => item.name === name);

      if (tool === undefined) {
        throw new Error(`INSTAGRAM_VIDEO_TOOL_NOT_FOUND: ${name}`);
      }

      return tool.execute(args);
    }
  };
}

/**
 * 输入：具有 register 方法的底座工具容器和运行时模型能力。
 * 输出：底座 register 返回值列表。
 * 作用：把本包三个工具注册到外部 agent 服务。
 */
export function registerVideoInteractionTools(
  consumer: VideoInteractionToolConsumer,
  options: InstagramVideoInteractionRuntimeOptions = {}
): unknown[] {
  return createTools(options).map((tool) => consumer.register(tool));
}

/**
 * 输入：运行时模型能力。
 * 输出：三个可执行工具定义。
 * 作用：集中描述工具 schema 与执行函数的绑定关系。
 */
function createTools(options: InstagramVideoInteractionRuntimeOptions): VideoInteractionExecutableTool[] {
  return [
    {
      name: "instagram_video_interaction_plan",
      description: "生成原子动作组合流程的视频动作计划，支持观看、点赞和评论",
      parameters: PLAN_INPUT_SCHEMA,
      output: createJsonOutput(PLAN_OUTPUT_SCHEMA),
      execute: (args) => instagramVideoInteractionPlan(args as Parameters<typeof instagramVideoInteractionPlan>[0])
    },
    {
      name: "instagram_video_evaluate",
      description: "根据当前 Reel 信号判断是否匹配和是否建议互动",
      parameters: EVALUATE_INPUT_SCHEMA,
      output: createJsonOutput(EVALUATE_OUTPUT_SCHEMA),
      execute: (args) => instagramVideoEvaluate(args as Parameters<typeof instagramVideoEvaluate>[0], options)
    },
    {
      name: "instagram_video_log_summarize",
      description: "汇总 agent 服务回传的视频互动执行日志",
      parameters: LOG_INPUT_SCHEMA,
      output: createJsonOutput(LOG_OUTPUT_SCHEMA),
      execute: (args) => instagramVideoLogSummarize(args as Parameters<typeof instagramVideoLogSummarize>[0])
    }
  ];
}

/**
 * 输入：工具输出 JSON Schema。
 * 输出：dsh 兼容的 output 定义。
 * 作用：让注册工具返回结构化值，同时向模型渲染 JSON 文本。
 */
function createJsonOutput(schema: Record<string, unknown>): VideoInteractionExecutableTool["output"] {
  return {
    schema,
    render(_args, value) {
      return [{ type: "text", text: JSON.stringify(value, null, 2) }];
    }
  };
}

const PLAN_INPUT_SCHEMA = {
  type: "object",
  properties: {
    accountId: { type: "string" },
    sessionRef: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
    targetDescription: { type: "string" },
    maxLikes: { type: "integer" },
    maxComments: { type: "integer" },
    minDwellMs: { type: "integer" },
    maxDwellMs: { type: "integer" }
  },
  required: ["accountId", "sessionRef", "keywords", "targetDescription", "maxLikes", "maxComments", "minDwellMs", "maxDwellMs"],
  additionalProperties: false
};

const PLAN_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: true
};

const EVALUATE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    accountId: { type: "string" },
    keyword: { type: "string" },
    targetDescription: { type: "string" },
    visibleText: { type: "array", items: { type: "string" } },
    ocrText: { type: "array", items: { type: "string" } },
    frameAssets: { type: "array", items: { type: "string" } },
    visionModelAvailable: { type: "boolean" },
    alreadyLiked: { type: "boolean" },
    remainingLikeCount: { type: "integer" },
    remainingCommentCount: { type: "integer" },
    minDwellMs: { type: "integer" },
    maxDwellMs: { type: "integer" }
  },
  required: ["accountId", "keyword", "targetDescription", "remainingLikeCount", "remainingCommentCount", "minDwellMs", "maxDwellMs"],
  additionalProperties: false
};

const EVALUATE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: true
};

const LOG_INPUT_SCHEMA = {
  type: "object",
  properties: {
    accountId: { type: "string" },
    startedAt: { type: "string" },
    endedAt: { type: "string" },
    items: { type: "array", items: { type: "object", additionalProperties: true } }
  },
  required: ["accountId", "startedAt", "endedAt", "items"],
  additionalProperties: false
};

const LOG_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: true
};
