import { InstagramConnectorAdapterError } from "./errors.js";

export type ConnectorActionStatus = "SUCCESS" | "FAILED" | "DEGRADED" | "CANCELLED";

export interface ConnectorActionResult {
  status: ConnectorActionStatus;
  code: string;
  detail?: string;
  output?: unknown;
  primaryStrategy?: "xml_node";
  fallbackStrategy?: "screenshot_coordinate";
  coordinateAttempted?: boolean;
  raw: unknown;
}

const coordinateDegradedCodes = new Set([
  "INSTAGRAM_VISUAL_COORDINATE_UNSUPPORTED",
  "INSTAGRAM_COORDINATE_FALLBACK_UNAVAILABLE",
  "INSTAGRAM_COORDINATE_FALLBACK_FAILED"
]);

const degradedCodes = new Set([
  ...coordinateDegradedCodes,
  "UI_INPUT_UNICODE_UNSUPPORTED"
]);

/**
 * 输入：Java CLI 输出的 connector result。
 * 输出：connector 适配层标准结果。
 * 作用：保留原始 connector 输出，同时把成功、失败和降级状态转成稳定结构。
 */
export function normalizeInstagramConnectorCliResult(raw: unknown): ConnectorActionResult {
  if (!isRecord(raw)) {
    throw new InstagramConnectorAdapterError("CONNECTOR_CLI_RESULT_INVALID", "CLI result must be an object");
  }

  const code = readString(raw, "code") ?? "OK";
  const status = degradedCodes.has(code) ? "DEGRADED" : normalizeStatus(readString(raw, "status"));
  const output = readOutput(raw);
  const detail = readString(raw, "detail");

  const result: ConnectorActionResult = { status, code, raw };
  if (detail !== undefined) result.detail = detail;
  if (output !== undefined) result.output = output;
  if (status === "DEGRADED" && coordinateDegradedCodes.has(code)) {
    result.primaryStrategy = "xml_node";
    result.fallbackStrategy = "screenshot_coordinate";
    result.coordinateAttempted = false;
  }
  return result;
}

/**
 * 输入：状态文本。
 * 输出：标准 connector 状态。
 * 作用：把外部 ConnectorResult 状态收窄为本包稳定枚举。
 */
function normalizeStatus(status: string | undefined): ConnectorActionStatus {
  if (status === "SUCCEEDED" || status === "SUCCESS") return "SUCCESS";
  if (status === "FAILED") return "FAILED";
  if (status === "DEGRADED") return "DEGRADED";
  if (status === "CANCELLED") return "CANCELLED";
  return "SUCCESS";
}

/**
 * 输入：connector payload。
 * 输出：业务输出对象或 undefined。
 * 作用：兼容 output 字段和 outputJson 字符串字段。
 */
function readOutput(payload: Record<string, unknown>): unknown {
  if ("output" in payload) return payload.output;
  const outputJson = readString(payload, "outputJson");
  if (outputJson === undefined || outputJson.trim().length === 0) return undefined;
  try {
    return JSON.parse(outputJson) as unknown;
  } catch (error) {
    throw new InstagramConnectorAdapterError(
      "CONNECTOR_CLI_RESULT_INVALID",
      error instanceof Error ? error.message : "outputJson parse failed"
    );
  }
}

/**
 * 输入：对象和字段名。
 * 输出：字符串字段值或 undefined。
 * 作用：读取外部结果中的可选字符串字段。
 */
function readString(source: Record<string, unknown>, field: string): string | undefined {
  const value = source[field];
  return typeof value === "string" ? value : undefined;
}

/**
 * 输入：未知值。
 * 输出：是否为普通对象。
 * 作用：在 CLI 边界解析前确认结构。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
