export type ConnectorToolName =
  | "instagram.app.open"
  | "instagram.debug.snapshot"
  | "instagram.debug.ocr"
  | "instagram.search.open"
  | "instagram.search.input"
  | "instagram.search.open_first_reel"
  | "instagram.reel.inspect"
  | "instagram.reel.collect_signals"
  | "instagram.reel.like"
  | "instagram.reel.comment"
  | "instagram.reel.next"
  | "instagram.reels.engage_workflow"
  | "instagram.profile.update";

export interface JsonObjectSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: boolean;
}

export interface ConnectorToolDefinition {
  name: ConnectorToolName;
  description: string;
  inputSchema: JsonObjectSchema;
  sideEffect: boolean;
}

const emptyInputSchema: JsonObjectSchema = {
  type: "object",
  properties: {},
  additionalProperties: false
};

const searchInputSchema: JsonObjectSchema = {
  type: "object",
  properties: {
    keyword: { type: "string", minLength: 1 }
  },
  required: ["keyword"],
  additionalProperties: false
};

const collectSignalsInputSchema: JsonObjectSchema = {
  type: "object",
  properties: {
    frameCount: { type: "integer", minimum: 1, default: 1 },
    intervalMs: { type: "integer", minimum: 0, default: 0 },
    includeVisibleText: { type: "boolean", default: true },
    includeOcr: { type: "boolean", default: true }
  },
  additionalProperties: false
};

const commentInputSchema: JsonObjectSchema = {
  type: "object",
  properties: {
    commentText: { type: "string", minLength: 1 }
  },
  required: ["commentText"],
  additionalProperties: false
};

const likeInputSchema: JsonObjectSchema = {
  type: "object",
  properties: {
    force: { type: "boolean", default: false }
  },
  additionalProperties: false
};

const engageWorkflowInputSchema: JsonObjectSchema = {
  type: "object",
  properties: {
    packageName: { type: "string" },
    keyword: { type: "string", minLength: 1 },
    preOpenScrollMin: { type: "integer", minimum: 0 },
    preOpenScrollMax: { type: "integer", minimum: 0 },
    preOpenScrollCount: { type: "integer", minimum: 0 },
    perVideoWatchMs: { type: "integer", minimum: 1, maximum: 60000 },
    totalWatchMs: { type: "integer", minimum: 1, maximum: 3600000 }
  },
  required: ["keyword", "perVideoWatchMs", "totalWatchMs"],
  additionalProperties: false
};

const profileUpdateInputSchema: JsonObjectSchema = {
  type: "object",
  properties: {
    displayName: { type: "string" },
    username: { type: "string" },
    bio: { type: "string" },
    avatarUrl: { type: "string" },
    packageName: { type: "string" }
  },
  additionalProperties: false
};

export const connectorTools: ConnectorToolDefinition[] = [
  { name: "instagram.app.open", description: "打开 Instagram App", inputSchema: emptyInputSchema, sideEffect: false },
  { name: "instagram.debug.snapshot", description: "采集当前 UI XML 快照", inputSchema: emptyInputSchema, sideEffect: false },
  { name: "instagram.debug.ocr", description: "采集当前页面 OCR 文本", inputSchema: emptyInputSchema, sideEffect: false },
  { name: "instagram.search.open", description: "打开 Instagram 搜索页", inputSchema: emptyInputSchema, sideEffect: false },
  { name: "instagram.search.input", description: "输入搜索关键词", inputSchema: searchInputSchema, sideEffect: false },
  { name: "instagram.search.open_first_reel", description: "打开第一条 Reel", inputSchema: emptyInputSchema, sideEffect: false },
  { name: "instagram.reel.inspect", description: "读取当前 Reel 可见信息", inputSchema: emptyInputSchema, sideEffect: false },
  {
    name: "instagram.reel.collect_signals",
    description: "采集当前 Reel 截图、OCR 和可见文本",
    inputSchema: collectSignalsInputSchema,
    sideEffect: false
  },
  { name: "instagram.reel.like", description: "点赞当前 Reel", inputSchema: likeInputSchema, sideEffect: true },
  { name: "instagram.reel.comment", description: "评论当前 Reel", inputSchema: commentInputSchema, sideEffect: true },
  { name: "instagram.reel.next", description: "切换到下一条 Reel", inputSchema: emptyInputSchema, sideEffect: false },
  {
    name: "instagram.reels.engage_workflow",
    description: "执行搜索、打开 Reel，并按传入时长连续观看多条视频的组合流程",
    inputSchema: engageWorkflowInputSchema,
    sideEffect: false
  },
  {
    name: "instagram.profile.update",
    description: "修改当前已登录账号的个人资料",
    inputSchema: profileUpdateInputSchema,
    sideEffect: true
  }
];

/**
 * 输入：connector tool 名称。
 * 输出：是否属于会修改 Instagram 状态的副作用动作。
 * 作用：供 agent 服务在执行点赞、评论前要求确认。
 */
export function isConnectorSideEffectTool(toolName: ConnectorToolName): boolean {
  return connectorTools.some((tool) => tool.name === toolName && tool.sideEffect);
}
