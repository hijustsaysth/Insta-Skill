export type InstagramConnectorAdapterErrorCode =
  | "CONNECTOR_CLI_CONFIG_INVALID"
  | "CONNECTOR_CLI_EXECUTION_FAILED"
  | "CONNECTOR_CLI_RESULT_INVALID"
  | "CONNECTOR_RUNTIME_NOT_FOUND";

export class InstagramConnectorAdapterError extends Error {
  readonly code: InstagramConnectorAdapterErrorCode;
  readonly detail: string;

  /**
   * 输入：稳定错误码和错误详情。
   * 输出：connector 适配层错误。
   * 作用：让 agent 服务可以按 code 识别配置、session 和结果解析失败。
   */
  constructor(code: InstagramConnectorAdapterErrorCode, detail: string) {
    super(detail);
    this.name = "InstagramConnectorAdapterError";
    this.code = code;
    this.detail = detail;
  }
}
