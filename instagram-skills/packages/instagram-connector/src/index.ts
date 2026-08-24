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
  | "instagram.reel.next";

export interface ConnectorToolDefinition {
  name: ConnectorToolName;
  description: string;
}

export interface ConnectorActionResult {
  status: "SUCCESS" | "FAILED" | "DEGRADED";
  fallbackStrategy?: "xml_node" | "screenshot_coordinate";
  xmlAttempts?: number;
  coordinateAttempted?: boolean;
  errorCode?: string;
  raw?: unknown;
}

export const connectorTools: ConnectorToolDefinition[] = [
  { name: "instagram.app.open", description: "打开 Instagram App" },
  { name: "instagram.debug.snapshot", description: "采集当前 UI XML 快照" },
  { name: "instagram.debug.ocr", description: "采集当前页面 OCR 文本" },
  { name: "instagram.search.open", description: "打开 Instagram 搜索页" },
  { name: "instagram.search.input", description: "输入搜索关键词" },
  { name: "instagram.search.open_first_reel", description: "打开第一条 Reel" },
  { name: "instagram.reel.inspect", description: "读取当前 Reel 可见信息" },
  { name: "instagram.reel.collect_signals", description: "采集当前 Reel 截图、OCR 和可见文本" },
  { name: "instagram.reel.like", description: "点赞当前 Reel" },
  { name: "instagram.reel.comment", description: "评论当前 Reel" },
  { name: "instagram.reel.next", description: "切换到下一条 Reel" }
];

/**
 * 输入：工具名称和工具参数。
 * 输出：connector 动作结果。
 * 作用：MCP Server 执行入口占位，后续接入 Android connector 和 local-mobile-runtime。
 */
export async function executeConnectorTool(
  toolName: ConnectorToolName,
  input: Record<string, unknown>
): Promise<ConnectorActionResult> {
  // TODO: 按 toolName 调用 Android Instagram Connector。
  // TODO: 点击类动作先走 XML 节点执行，有限次重试失败后仅执行一次截图坐标兜底。
  // TODO: 如果截图坐标兜底仍失败，返回 DEGRADED 和明确错误码。
  void toolName;
  void input;

  return {
    status: "FAILED",
    errorCode: "NOT_IMPLEMENTED"
  };
}
