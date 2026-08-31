import { instagramProfileEditPlan } from "./edit-plan.js";
import { instagramProfileGenerate } from "./generate.js";
import type { InstagramProfileSetupToolName } from "./schema.js";

export interface ProfileSetupExecutableTool {
  name: InstagramProfileSetupToolName;
  description: string;
  parameters: Record<string, unknown>;
  output: {
    schema: Record<string, unknown>;
    render(args: unknown, value: unknown): Array<{ type: "text"; text: string }>;
  };
  execute(args: unknown): Promise<unknown>;
}

export interface ProfileSetupToolRegistry {
  tools: ProfileSetupExecutableTool[];
  schemas(): Array<Omit<ProfileSetupExecutableTool, "execute" | "output">>;
  execute(name: InstagramProfileSetupToolName, args: unknown): Promise<unknown>;
}

export interface ProfileSetupToolConsumer {
  register(tool: ProfileSetupExecutableTool): unknown;
}

export function createProfileSetupToolRegistry(): ProfileSetupToolRegistry {
  const tools = createTools();

  return {
    tools,
    schemas() {
      return tools.map(({ execute: _execute, output: _output, ...schema }) => schema);
    },
    async execute(name, args) {
      const tool = tools.find((item) => item.name === name);

      if (tool === undefined) {
        throw new Error(`INSTAGRAM_PROFILE_SETUP_TOOL_NOT_FOUND: ${name}`);
      }

      return tool.execute(args);
    }
  };
}

export function registerProfileSetupTools(consumer: ProfileSetupToolConsumer): unknown[] {
  return createTools().map((tool) => consumer.register(tool));
}

function createTools(): ProfileSetupExecutableTool[] {
  return [
    {
      name: "instagram_profile_generate",
      description: "根据提示词说明和参考素材生成 Instagram 账号资料草案",
      parameters: GENERATE_INPUT_SCHEMA,
      output: createJsonOutput(GENERATE_OUTPUT_SCHEMA),
      execute: (args) => instagramProfileGenerate(args as Parameters<typeof instagramProfileGenerate>[0])
    },
    {
      name: "instagram_profile_edit_plan",
      description: "根据审批后的资料生成编辑计划和参数草案",
      parameters: EDIT_PLAN_INPUT_SCHEMA,
      output: createJsonOutput(EDIT_PLAN_OUTPUT_SCHEMA),
      execute: (args) => instagramProfileEditPlan(args as Parameters<typeof instagramProfileEditPlan>[0])
    }
  ];
}

function createJsonOutput(schema: Record<string, unknown>): ProfileSetupExecutableTool["output"] {
  return {
    schema,
    render(_args, value) {
      return [{ type: "text", text: JSON.stringify(value, null, 2) }];
    }
  };
}

const AVATAR_ASSET_SCHEMA = {
  type: "object",
  properties: {
    uri: { type: "string" },
    mediaType: { const: "image" }
  },
  required: ["uri", "mediaType"],
  additionalProperties: false
};

const AVATAR_GENERATION_SCHEMA = {
  type: "object",
  properties: {
    status: { enum: ["generated", "degraded"] },
    requestedCount: { type: "integer" },
    referenceAssets: {
      type: "array",
      items: AVATAR_ASSET_SCHEMA
    },
    generatedAssets: {
      type: "array",
      items: AVATAR_ASSET_SCHEMA
    },
    prompt: { type: "string" },
    fallbackReason: { type: "string" }
  },
  required: ["status", "requestedCount", "referenceAssets", "generatedAssets", "prompt"],
  additionalProperties: false
};

const GENERATE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    accountId: { type: "string" },
    targets: {
      type: "array",
      items: { enum: ["username", "displayName", "biography", "avatar"] },
      minItems: 1
    },
    namePrompt: { type: "string" },
    brandPrefix: { type: "string" },
    englishName: { type: "string" },
    biographyPrompt: { type: "string" },
    businessPrompt: { type: "string" },
    contactPrompt: { type: "string" },
    referenceAssets: { type: "array", items: { type: "string" } },
    generatedAvatarAssets: { type: "array", items: { type: "string" } },
    avatarCount: { type: "integer", enum: [2, 3] },
    avatarOutputDir: { type: "string" },
    avatarGenerationSupported: { type: "boolean" },
    targetLanguage: { type: "string" }
  },
  required: ["accountId", "targets"],
  additionalProperties: false
};

const GENERATE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    username: { type: "string" },
    displayName: { type: "string" },
    biography: { type: "string" },
    avatarAsset: AVATAR_ASSET_SCHEMA,
    avatarGeneration: AVATAR_GENERATION_SCHEMA
  },
  additionalProperties: false
};

const EDIT_PLAN_INPUT_SCHEMA = {
  type: "object",
  properties: {
    accountId: { type: "string" },
    sessionRef: { type: "string" },
    approved: { type: "boolean" },
    username: { type: "string" },
    displayName: { type: "string" },
    biography: { type: "string" },
    avatarAsset: AVATAR_ASSET_SCHEMA,
    preferredProvider: { enum: ["instagram-client", "mcp-tool", "http-provider"] }
  },
  required: ["accountId", "approved"],
  additionalProperties: false
};

const EDIT_PLAN_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: true
};
